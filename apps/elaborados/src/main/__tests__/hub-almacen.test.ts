import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { columnasQueNoViajan, instalarTriggersSync } from '@core/db';
import { abrirAlmacenHub, type CambioEntrante } from '@core/hub';
import { cajaAbrirHandler } from '@core/main';
import * as schema from '../db/schema';
import { registroSyncElaborados } from '../db/registro-sync';
import { setupDb, loginAsAdmin, clearSession, MIGRATIONS_DIR } from './helpers';
import { CONSUMIDOR_FINAL_ID } from '../catalog/seed';
import { catalogo } from '../ipc/__tests__/ventaFixtures';
import { ventaConfirmarHandler } from '../ipc/venta';

// Contrato del almacén del hub (F2 PR1, ADR-149 §2, ADR-150 §4 y §5) con el esquema real de
// Elaborados: semilla de la terminal, cambios del día por el outbox, y el hub igual que la terminal.
const registro = registroSyncElaborados();
const tablasSync = Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t).sort();
// Columnas del esquema Drizzle (las mismas que captura el trigger), no las de la base.
const COLUMNAS = new Map(Object.values(schema).filter((v) => is(v, SQLiteTable))
  .map((v) => getTableConfig(v as SQLiteTable)).map((c) => [c.name, c.columns.map((col) => col.name)]));

function filas(sqlite: Database.Database, tabla: string): Record<string, unknown>[] {
  const proyectadas = columnasQueNoViajan(registro[tabla]!); // y las locales (F3 PR1)
  const cols = COLUMNAS.get(tabla)!.filter((c) => !proyectadas.has(c) && c !== 'sync_state');
  return sqlite.prepare(`select ${cols.map((c) => `"${c}"`).join(', ')} from "${tabla}" order by id`).all() as Record<string, unknown>[];
}

function semilla(sqlite: Database.Database): CambioEntrante[] {
  return tablasSync.flatMap((t) => filas(sqlite, t).map((fila) => ({ tabla: t, fila })));
}

describe('almacén del hub con el esquema de Elaborados', () => {
  it('semilla + cambios del día por el outbox: el hub queda igual que la terminal', () => {
    const db = setupDb();
    clearSession();
    loginAsAdmin(db);
    const terminal = db.$client as Database.Database;
    const c = catalogo(db);

    const sqlite = new Database(':memory:');
    const hub = abrirAlmacenHub(sqlite, { schema, registro, migracionesApp: MIGRATIONS_DIR });

    const rSemilla = hub.aplicarLote('C1', semilla(terminal));
    expect(rSemilla.filter((r) => r.estado !== 'aplicado'), JSON.stringify(hub.conflictos())).toEqual([]);

    instalarTriggersSync(terminal, schema, registro);
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
      lineas: [{ producto_venta_id: c.palito.id, cantidad: 2 }],
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 200000 }],
    });
    const outbox = (terminal.prepare('select tabla, fila from sync_outbox order by seq').all() as { tabla: string; fila: string }[])
      .map((o) => ({ tabla: o.tabla, fila: JSON.parse(o.fila) as Record<string, unknown> }));
    expect(outbox.length).toBeGreaterThan(3);
    expect(hub.aplicarLote('C1', outbox).filter((r) => r.estado !== 'aplicado'), JSON.stringify(hub.conflictos())).toEqual([]);

    for (const t of tablasSync) {
      const ms = terminal.prepare(`select count(*) n from "${t}" where updated_at > 100000000000`).get() as { n: number };
      expect(ms.n, `${t}: updated_at en milisegundos`).toBe(0);
    }
    // En una tabla con proyectadas, mover el saldo sube `version` y `updated_at` sin encolar (ADR-151).
    const snap = new Map(hub.snapshot().tablas.map((t) => [t.tabla, t.filas]));
    for (const t of tablasSync) {
      const sinSaldo = (registro[t]!.proyectadas ?? []).length > 0;
      const comparable = (f: Record<string, unknown>) => {
        const { sync_state: _s, ...resto } = f;
        if (sinSaldo) { delete resto['version']; delete resto['updated_at']; }
        return resto;
      };
      expect((snap.get(t) ?? []).map(comparable), t).toEqual(filas(terminal, t).map(comparable));
    }
  });
});
