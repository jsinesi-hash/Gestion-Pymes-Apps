import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
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
import { registroSyncElaborados } from '../../db/registro-sync';
import { setupDb, loginAsAdmin, clearSession, MIGRATIONS_DIR } from '../../__tests__/helpers';
import { CONSUMIDOR_FINAL_ID } from '../../catalog/seed';
import { catalogo } from '../../ipc/__tests__/ventaFixtures';
import { movimientoArticuloCreateHandler } from '../../ipc/movimiento-articulo';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { proyectarCostoPromedio, proyectarStock } from '../../catalog/stock-proyeccion';
import { proyeccionesElaborados } from '../proyecciones';

// Convergencia (F2 PR3) con el esquema de Elaborados: dos terminales compran y venden el mismo artículo
// sin verse; al sincronizar, las dos y el hub tienen las mismas filas y el mismo stock y costo proyectados.
type Db = ReturnType<typeof setupDb>;
const registro = registroSyncElaborados();
const tablasSync = Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t).sort();
const COLUMNAS = new Map(Object.values(schema).filter((v) => is(v, SQLiteTable))
  .map((v) => getTableConfig(v as SQLiteTable)).map((c) => [c.name, c.columns.map((col) => col.name)]));

function filas(sqlite: Database.Database, tabla: string): Record<string, unknown>[] {
  const proyectadas = new Set(registro[tabla]!.proyectadas ?? []);
  const cols = COLUMNAS.get(tabla)!.filter((c) => !proyectadas.has(c));
  return sqlite.prepare(`select ${cols.map((c) => `"${c}"`).join(', ')} from "${tabla}" order by id`).all() as Record<string, unknown>[];
}
function comparables(tabla: string, lista: Record<string, unknown>[]): Record<string, unknown>[] {
  const conSaldo = (registro[tabla]!.proyectadas ?? []).length > 0;
  return lista.map((f) => {
    const { sync_state: _s, ...resto } = f;
    if (conSaldo) { delete resto['version']; delete resto['updated_at']; }
    return resto;
  });
}

describe('convergencia de dos terminales de Elaborados con el hub', () => {
  let a: Db;
  let b: Db;
  let almacen: AlmacenHub;
  let hubSqlite: Database.Database;
  let server: https.Server;
  let syncA: ClienteSync;
  let syncB: ClienteSync;
  const transportes: TransporteHub[] = [];
  let c: ReturnType<typeof catalogo>;

  function como<T>(origen: string, fn: () => T): T {
    setOriginId(origen);
    try { return fn(); } finally { setOriginId('C1'); }
  }
  const sqliteDe = (db: Db) => db.$client as Database.Database;

  beforeAll(async () => {
    setOriginId('C1');
    a = setupDb();
    clearSession();
    loginAsAdmin(a);
    c = catalogo(a);

    hubSqlite = new Database(':memory:');
    almacen = abrirAlmacenHub(hubSqlite, { schema, registro, migracionesApp: MIGRATIONS_DIR });
    const terminales = abrirTerminales(hubSqlite);
    const semilla: CambioEntrante[] = tablasSync.flatMap((t) => filas(sqliteDe(a), t).map((fila) => ({ tabla: t, fila })));
    expect(almacen.aplicarLote('C1', semilla).filter((r) => r.estado !== 'aplicado')).toEqual([]);
    b = createDb(new Database(sqliteDe(a).serialize()), schema).db as unknown as Db;
    const cursor = String(almacen.ultimoCursor());
    for (const db of [a, b]) {
      instalarTriggersSync(sqliteDe(db), schema, registro);
      sqliteDe(db).prepare(`insert into parametros_sistema (clave, valor, tipo) values (?, ?, 'number')`).run(CLAVE_CURSOR, cursor);
    }

    const cert = generarCertificado({ nombre: 'hub-elaborados', dias: 30 });
    const versiones = { protocolo: PROTOCOLO_VERSION, esquema: versionEsquema(MIGRATIONS_DIR) };
    server = crearServidorHub({ almacen, terminales, tls: cert, versiones });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const sync = (db: Db, origen: string) => {
      const { codigo } = terminales.generarCodigo();
      const { credencial } = terminales.emparejar(codigo, { nombre: `Caja ${origen}`, origin_id_propuesto: origen });
      const transporte = crearTransporteHttps({ url, certPem: cert.certPem, huella: cert.huella, credencial, versiones });
      transportes.push(transporte);
      return crearClienteSync(db, { schema, registro, transporte, alAplicar: proyeccionesElaborados(db) });
    };
    syncA = sync(a, 'C1');
    syncB = sync(b, 'C2');
  });
  afterAll(async () => {
    for (const t of transportes) t.cerrar();
    await new Promise<void>((r) => server.close(() => r()));
    setOriginId('C1');
  });

  it('compran y venden el mismo artículo por separado; al sincronizar, las tres bases coinciden', async () => {
    const operar = (db: Db, cantidad: number, costo: number) => {
      const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
      movimientoArticuloCreateHandler(db, { articulo_id: c.palitoArt.id, motivo: 'compra', cantidad, costo_unitario_centavos: costo });
      ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 100_000 }],
      });
    };
    como('C1', () => operar(a, 4, 150));
    como('C2', () => operar(b, 3, 300));

    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncA.sincronizar();
      await syncB.sincronizar();
    }
    expect([syncA.estado().pendientes, syncB.estado().pendientes]).toEqual([0, 0]);

    const snap = new Map(almacen.snapshot().tablas.map((t) => [t.tabla, t.filas]));
    for (const t of tablasSync) {
      const enA = comparables(t, filas(sqliteDe(a), t));
      expect(comparables(t, filas(sqliteDe(b), t)), `${t}: A y B`).toEqual(enA);
      expect(comparables(t, (snap.get(t) ?? []) as Record<string, unknown>[]), `${t}: hub`).toEqual(enA);
    }

    // 2 iniciales + 4 − 1 + 3 − 1.
    const hubDb = createDb(hubSqlite, schema).db as unknown as Db;
    const stock = (db: Db) => db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, c.palitoArt.id)).get()!.stock;
    const costo = (db: Db) => db.select().from(schema.articulo).where(eq(schema.articulo.id, c.palitoArt.id)).get()!.costo_promedio_centavos;
    expect([stock(a), stock(b), proyectarStock(hubDb, c.palitoArt.id)]).toEqual([7, 7, 7]);
    expect(costo(b)).toBe(costo(a));
    expect(proyectarCostoPromedio(hubDb, c.palitoArt.id)).toBe(costo(a));
    expect(almacen.conflictos()).toEqual([]);
  });
});
