import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { eq, is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { instalarTriggersSync } from '@core/db';
import { abrirAlmacenHub, type CambioEntrante } from '@core/hub';
import { cajaAbrirHandler } from '@core/main';
import * as schema from '../schema';
import { registroSyncRetail } from '../registro-sync';
import { setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler } from '../../ipc/producto';
import { stockEntradaHandler } from '../../ipc/stock';
import { ventaConfirmarHandler } from '../../ipc/venta';

// Contrato del almacén del hub (F2 PR1, ADR-149 §2, ADR-150 §4 y §5) con el esquema real de Retail:
// la base de una terminal sube entera como semilla, después sus cambios del día por el outbox, y el
// hub queda con las mismas filas que la terminal (salvo lo que no viaja: proyectadas y sync_state).
const registro = registroSyncRetail();
const MIGRACIONES = path.resolve(__dirname, '../migrations');
const CF_ID = 'cf000000-0000-0000-0000-000000000001';
const tablasSync = Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t).sort();

// Columnas del esquema Drizzle (las mismas que captura el trigger), no las de la base: la base conserva
// columnas retiradas del código (p. ej. `usuario.pin_rapido`, ADR-027) que no viajan.
const COLUMNAS = new Map(Object.values(schema).filter((v) => is(v, SQLiteTable))
  .map((v) => getTableConfig(v as SQLiteTable)).map((c) => [c.name, c.columns.map((col) => col.name)]));

function columnasQueViajan(_sqlite: Database.Database, tabla: string): string[] {
  const proyectadas = new Set(registro[tabla]!.proyectadas ?? []);
  return COLUMNAS.get(tabla)!.filter((c) => !proyectadas.has(c) && c !== 'sync_state');
}

function filas(sqlite: Database.Database, tabla: string): Record<string, unknown>[] {
  const cols = columnasQueViajan(sqlite, tabla);
  return sqlite.prepare(`select ${cols.map((c) => `"${c}"`).join(', ')} from "${tabla}" order by id`).all() as Record<string, unknown>[];
}

/** Lo que la terminal subiría como semilla: todas las filas de las tablas que sincronizan (PR4). */
function semilla(sqlite: Database.Database): CambioEntrante[] {
  return tablasSync.flatMap((t) => filas(sqlite, t).map((fila) => ({ tabla: t, fila })));
}

describe('almacén del hub con el esquema de Retail', () => {
  it('semilla + cambios del día por el outbox: el hub queda igual que la terminal', () => {
    // Terminal standalone con su seed, catálogo base y un producto, como una instalación real.
    const db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
    const terminal = db.$client as Database.Database;
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    const previo = productoCreateHandler(db, {
      nombre_corto: 'Pinza', categoria_id: categoriaCreateHandler(db, { nombre: 'Herramientas' }).id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista_centavos: 90000,
      stock_inicial: { cantidad: 4, costo_centavos: 45000 },
    });

    const sqlite = new Database(':memory:');
    const hub = abrirAlmacenHub(sqlite, { schema, registro, migracionesApp: MIGRACIONES });

    // 1. Semilla (de standalone a distribuido): toda la base en un lote, con las FK diferidas.
    const rSemilla = hub.aplicarLote('C1', semilla(terminal));
    expect(rSemilla.filter((r) => r.estado !== 'aplicado'), JSON.stringify(hub.conflictos())).toEqual([]);

    // 2. Desde acá la terminal captura cambios: alta con stock, entrada con costo y una venta.
    instalarTriggersSync(terminal, schema, registro);
    const cat = categoriaCreateHandler(db, { nombre: 'Fijaciones' });
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Tornillo', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u',
      precio_venta_lista_centavos: 100000, stock_inicial: { cantidad: 10, costo_centavos: 10000 },
    });
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: 5, costo_unitario_centavos: 13000 });
    stockEntradaHandler(db, { producto_id: previo.id, cantidad: 1 });
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CF_ID,
      lineas: [{ producto_id: prod.id, descripcion: 'Tornillo', cantidad: 2, precio_unitario_centavos: 100000, descuento_linea: 0, alicuota_iva: 21, subtotal_centavos: 200000 }],
      descuento_global: 0, subtotal_centavos: 200000, importe_iva_centavos: 34711, total_centavos: 200000, ajuste_redondeo_centavos: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 200000 }],
    });

    const outbox = (terminal.prepare('select tabla, fila from sync_outbox order by seq').all() as { tabla: string; fila: string }[])
      .map((o) => ({ tabla: o.tabla, fila: JSON.parse(o.fila) as Record<string, unknown> }));
    expect(outbox.length).toBeGreaterThan(5);
    const rDia = hub.aplicarLote('C1', outbox);
    expect(rDia.filter((r) => r.estado !== 'aplicado')).toEqual([]);

    // 3. El hub tiene las mismas filas que la terminal en cada tabla que sincroniza.
    const snap = new Map(hub.snapshot().tablas.map((t) => [t.tabla, t.filas]));
    // En una tabla con proyectadas, mover el saldo sube `version` y `updated_at` en la terminal sin
    // encolar nada (solo cambió un saldo, ADR-151): esas dos columnas pueden quedar atrás en el hub.
    for (const t of tablasSync) {
      const sinSaldo = (registro[t]!.proyectadas ?? []).length > 0;
      const comparable = (f: Record<string, unknown>) => {
        const { sync_state: _s, ...resto } = f;
        if (sinSaldo) { delete resto['version']; delete resto['updated_at']; }
        return resto;
      };
      expect((snap.get(t) ?? []).map(comparable), t).toEqual(filas(terminal, t).map(comparable));
    }
    // last-write-wins compara `updated_at`: ninguna fila puede quedar en milisegundos (migración 0062).
    for (const t of tablasSync) {
      const ms = terminal.prepare(`select count(*) n from "${t}" where updated_at > 100000000000`).get() as { n: number };
      expect(ms.n, `${t}: updated_at en milisegundos`).toBe(0);
    }
    // Las columnas proyectadas no viajan: el stock del hub no es dato (cada nodo lo recalcula).
    expect(snap.get('existencias')![0]).not.toHaveProperty('stock_fisico');
  });
});
