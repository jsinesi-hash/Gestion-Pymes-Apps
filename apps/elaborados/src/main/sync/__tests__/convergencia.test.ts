import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type https from 'node:https';
import { eq, is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { createDb } from '@core/db';
import {
  abrirAlmacenHub, abrirCoordinacion, abrirTerminales, crearServidorHub, generarCertificado, PROTOCOLO_VERSION, versionEsquema,
  type AlmacenHub,
} from '@core/hub';
import {
  cajaAbrirHandler, crearSyncTerminal, setModoTerminal, setOriginId,
  type SyncTerminal,
} from '@core/main';
import * as schema from '../../db/schema';
import { registroSyncElaborados } from '../../db/registro-sync';
import { setupDb, loginAsAdmin, clearSession, MIGRATIONS_DIR } from '../../__tests__/helpers';
import { CONSUMIDOR_FINAL_ID, runCatalogSeedElaborados } from '../../catalog/seed';
import { catalogo } from '../../ipc/__tests__/ventaFixtures';
import { movimientoArticuloCreateHandler } from '../../ipc/movimiento-articulo';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { proyectarCostoPromedio, proyectarStock } from '../../catalog/stock-proyeccion';
import { opcionesSyncElaborados } from '../proyecciones';

// Convergencia (F2 PR3 y PR4) con el esquema de Elaborados: la primera terminal se empareja y sube su base;
// la segunda, una instalación nueva con su propio seed, se empareja y baja el snapshot. Después compran y
// venden el mismo artículo sin verse; al sincronizar, las dos y el hub tienen las mismas filas y el mismo
// stock y costo proyectados.
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
  let syncA: SyncTerminal;
  let syncB: SyncTerminal;
  const carpetas: string[] = [];
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
    const cert = generarCertificado({ nombre: 'hub-elaborados', dias: 30 });
    const versiones = { protocolo: PROTOCOLO_VERSION, esquema: versionEsquema(MIGRATIONS_DIR) };
    server = crearServidorHub({ almacen, terminales, coordinacion: abrirCoordinacion(hubSqlite), tls: cert, versiones });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `127.0.0.1:${(server.address() as AddressInfo).port}`;

    const terminal = (db: Db): SyncTerminal => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'convergencia-elaborados-'));
      carpetas.push(dir);
      return crearSyncTerminal(db as never, opcionesSyncElaborados(db, { migrationsFolder: MIGRATIONS_DIR, carpetaDatos: dir }), {
        safeStorage: { isEncryptionAvailable: () => true, encryptString: (t) => Buffer.from(t), decryptString: (b) => b.toString() },
        respaldar: async () => undefined,
        programar: () => ({ detener() {} }), // el test sincroniza a mano
      });
    };

    syncA = terminal(a);
    const { huella } = await syncA.sondear(url);
    expect(huella).toBe(cert.huella);
    expect(await syncA.emparejar({ url, codigo: terminales.generarCodigo().codigo, huella })).toMatchObject({ origin_id: 'C1', arranque: 'semilla' });

    // Una instalación nueva con su propio seed; el mismo proceso hace de las dos terminales.
    setModoTerminal('standalone');
    b = setupDb();
    runCatalogSeedElaborados(b);
    syncB = terminal(b);
    expect(await syncB.emparejar({ url, codigo: terminales.generarCodigo().codigo, huella })).toMatchObject({ origin_id: 'C2', arranque: 'snapshot' });
    // Bajar el snapshot cerró la sesión: los usuarios ahora son los del hub (los mismos que en A).
    loginAsAdmin(a);
  });
  afterAll(async () => {
    for (const s of [syncA, syncB]) s?.detener();
    await new Promise<void>((r) => server.close(() => r()));
    setOriginId('C1');
    setModoTerminal('standalone');
    for (const d of carpetas) fs.rmSync(d, { recursive: true, force: true });
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
      await syncA.sincronizarAhora();
      await syncB.sincronizarAhora();
    }
    expect([syncA.estado().sync?.pendientes, syncB.estado().sync?.pendientes]).toEqual([0, 0]);

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
