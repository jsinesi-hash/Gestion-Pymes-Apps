import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type https from 'node:https';
import { eq, is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { createDb, instalarTriggersSync } from '@core/db';
import {
  abrirAlmacenHub, abrirTerminales, crearServidorHub, generarCertificado, PROTOCOLO_VERSION, versionEsquema,
  type AlmacenHub, type CambioEntrante,
} from '@core/hub';
import {
  cajaAbrirHandler, crearClienteSync, crearTransporteHttps, setOriginId, CLAVE_CURSOR,
  type ClienteSync, type TransporteHub,
} from '@core/main';
import * as schema from '../../db/schema';
import { registroSyncRetail } from '../../db/registro-sync';
import { setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler, productoUpdateHandler } from '../../ipc/producto';
import { stockEntradaHandler } from '../../ipc/stock';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { proyectarCostoPromedio, proyectarStock } from '../../catalog/stock-proyeccion';
import { proyeccionesRetail } from '../proyecciones';

// Convergencia (F2 PR3, ADR-150 y ADR-151): un hub HTTPS en el proceso y dos terminales de Retail que
// venden y cargan stock sin verse entre sí. Al sincronizar, las dos y el hub tienen las mismas filas,
// el stock y el costo proyectados son los mismos en las tres bases y una edición concurrente del mismo
// producto termina con un ganador y una entrada en el log de conflictos.
type Db = ReturnType<typeof setupDb>;
const registro = registroSyncRetail();
const MIGRACIONES = path.resolve(__dirname, '../../db/migrations');
const CF_ID = 'cf000000-0000-0000-0000-000000000001';
const tablasSync = Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t).sort();
const COLUMNAS = new Map(Object.values(schema).filter((v) => is(v, SQLiteTable))
  .map((v) => getTableConfig(v as SQLiteTable)).map((c) => [c.name, c.columns.map((col) => col.name)]));

function columnasQueViajan(tabla: string): string[] {
  const proyectadas = new Set(registro[tabla]!.proyectadas ?? []);
  return COLUMNAS.get(tabla)!.filter((c) => !proyectadas.has(c));
}
function filas(sqlite: Database.Database, tabla: string): Record<string, unknown>[] {
  return sqlite.prepare(`select ${columnasQueViajan(tabla).map((c) => `"${c}"`).join(', ')} from "${tabla}" order by id`).all() as Record<string, unknown>[];
}
/** Lo que no se compara: el estado de sync es de cada nodo; en tablas con proyectadas, mover el saldo
 * sube `version` y `updated_at` localmente sin encolar (ADR-151). */
function comparables(tabla: string, lista: Record<string, unknown>[]): Record<string, unknown>[] {
  const conSaldo = (registro[tabla]!.proyectadas ?? []).length > 0;
  return lista.map((f) => {
    const { sync_state: _s, ...resto } = f;
    if (conSaldo) { delete resto['version']; delete resto['updated_at']; }
    return resto;
  });
}

describe('convergencia de dos terminales de Retail con el hub', () => {
  let a: Db;
  let b: Db;
  let almacen: AlmacenHub;
  let hubSqlite: Database.Database;
  let server: https.Server;
  let syncA: ClienteSync;
  let syncB: ClienteSync;
  const transportes: TransporteHub[] = [];
  let productoId = '';

  function como<T>(origen: string, fn: () => T): T {
    setOriginId(origen);
    try { return fn(); } finally { setOriginId('C1'); }
  }
  const sqliteDe = (db: Db) => db.$client as Database.Database;

  beforeAll(async () => {
    setOriginId('C1');
    a = setupDb();
    runCatalogSeed(a);
    clearSession();
    loginAsAdmin(a);
    const imp = a.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    productoId = productoCreateHandler(a, {
      nombre_corto: 'Pinza', categoria_id: categoriaCreateHandler(a, { nombre: 'Herramientas' }).id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista_centavos: 90_000,
      stock_inicial: { cantidad: 10, costo_centavos: 10_000 },
    }).id;

    // Hub con su certificado; la semilla de la primera terminal y la copia para la segunda son el
    // arranque de F2 PR4, acá simulado: las dos parten de la misma base y del cursor de la semilla.
    hubSqlite = new Database(':memory:');
    almacen = abrirAlmacenHub(hubSqlite, { schema, registro, migracionesApp: MIGRACIONES });
    const terminales = abrirTerminales(hubSqlite);
    const semilla: CambioEntrante[] = tablasSync.flatMap((t) => filas(sqliteDe(a), t).map((fila) => ({ tabla: t, fila })));
    expect(almacen.aplicarLote('C1', semilla).filter((r) => r.estado !== 'aplicado')).toEqual([]);
    b = createDb(new Database(sqliteDe(a).serialize()), schema).db as unknown as Db;
    const cursor = String(almacen.ultimoCursor());
    for (const db of [a, b]) {
      instalarTriggersSync(sqliteDe(db), schema, registro);
      sqliteDe(db).prepare(`insert into parametros_sistema (clave, valor, tipo) values (?, ?, 'number')`).run(CLAVE_CURSOR, cursor);
    }

    const cert = generarCertificado({ nombre: 'hub-retail', dias: 30 });
    const versiones = { protocolo: PROTOCOLO_VERSION, esquema: versionEsquema(MIGRACIONES) };
    server = crearServidorHub({ almacen, terminales, tls: cert, versiones });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const sync = (db: Db, origen: string) => {
      const { codigo } = terminales.generarCodigo();
      const { credencial } = terminales.emparejar(codigo, { nombre: `Caja ${origen}`, origin_id_propuesto: origen });
      const transporte = crearTransporteHttps({ url, certPem: cert.certPem, huella: cert.huella, credencial, versiones });
      transportes.push(transporte);
      return crearClienteSync(db, { schema, registro, transporte, alAplicar: proyeccionesRetail(db) });
    };
    syncA = sync(a, 'C1');
    syncB = sync(b, 'C2');
  });
  afterAll(async () => {
    for (const t of transportes) t.cerrar();
    await new Promise<void>((r) => server.close(() => r()));
    setOriginId('C1');
  });

  const vender = (db: Db, cajaId: string, cantidad: number) => ventaConfirmarHandler(db, {
    caja_id: cajaId, cliente_id: CF_ID,
    lineas: [{ producto_id: productoId, descripcion: 'Pinza', cantidad, precio_unitario_centavos: 90_000, descuento_linea: 0, alicuota_iva: 21, subtotal_centavos: 90_000 * cantidad }],
    descuento_global: 0, subtotal_centavos: 90_000 * cantidad, importe_iva_centavos: Math.round((90_000 * cantidad * 21) / 121),
    total_centavos: 90_000 * cantidad, ajuste_redondeo_centavos: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: 90_000 * cantidad }],
  });

  it('venden y cargan stock por separado; al sincronizar, las tres bases coinciden', async () => {
    como('C1', () => {
      const caja = cajaAbrirHandler(a, { monto_inicial_centavos: 0 });
      stockEntradaHandler(a, { producto_id: productoId, cantidad: 5, costo_unitario_centavos: 13_000 });
      vender(a, caja.id, 2);
      productoUpdateHandler(a, { id: productoId, nombre_corto: 'Pinza de A' });
    });
    como('C2', () => {
      const caja = cajaAbrirHandler(b, { monto_inicial_centavos: 0 });
      stockEntradaHandler(b, { producto_id: productoId, cantidad: 3, costo_unitario_centavos: 20_000 });
      vender(b, caja.id, 1);
      productoUpdateHandler(b, { id: productoId, nombre_corto: 'Pinza de B' });
    });

    // Dos vueltas: cada una sube lo suyo y baja lo del otro (y los ganadores reemitidos).
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncA.sincronizar();
      await syncB.sincronizar();
    }
    expect([syncA.estado().pendientes, syncB.estado().pendientes]).toEqual([0, 0]);

    // Mismas filas en las dos terminales y en el hub, tabla por tabla.
    const snap = new Map(almacen.snapshot().tablas.map((t) => [t.tabla, t.filas]));
    for (const t of tablasSync) {
      const enA = comparables(t, filas(sqliteDe(a), t));
      expect(comparables(t, filas(sqliteDe(b), t)), `${t}: A y B`).toEqual(enA);
      expect(comparables(t, (snap.get(t) ?? []) as Record<string, unknown>[]), `${t}: hub`).toEqual(enA);
    }

    // El stock y el costo proyectados son los mismos en las tres bases: 10 + 5 − 2 + 3 − 1.
    const hubDb = createDb(hubSqlite, schema).db as unknown as Db;
    const stock = (db: Db) => db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, productoId)).get()!.stock_fisico;
    const costo = (db: Db) => db.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get()!.precio_costo_promedio_centavos;
    expect([stock(a), stock(b), proyectarStock(hubDb, productoId)]).toEqual([15, 15, 15]);
    expect(costo(b)).toBe(costo(a));
    expect(proyectarCostoPromedio(hubDb, productoId)).toBe(costo(a));
    expect(proyectarCostoPromedio(a, productoId)).toBe(costo(a));

    // La edición concurrente del mismo producto: un ganador en las tres bases y una entrada en el log.
    const nombre = (db: Db) => db.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get()!.nombre_corto;
    expect(['Pinza de A', 'Pinza de B']).toContain(nombre(a));
    expect(nombre(b)).toBe(nombre(a));
    const lww = almacen.conflictos().filter((c) => c.tipo === 'lww');
    expect(lww.map((c) => c.tabla)).toEqual(['producto']);
  });
});
