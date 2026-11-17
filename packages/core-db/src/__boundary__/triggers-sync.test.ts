import { describe, it, expect } from 'vitest';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { RegistroSync } from './registro-sync';
import { nombresTriggersSync, triggersSinBorrado, triggersSync } from './triggers-sync';

// Generación pura (texto). Los triggers se ejercitan sobre una base real en los tests de main de
// cada app (corren bajo Electron, con better-sqlite3).
const sync = {
  version: integer('version').notNull().default(1),
  origin_id: text('origin_id').notNull(),
  sync_state: text('sync_state').notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
};
const zona = sqliteTable('zona', { id: text('id').primaryKey() });
const saldo = sqliteTable('saldo', { id: text('id').primaryKey(), nombre: text('nombre'), stock: integer('stock'), ...sync });
const mov = sqliteTable('mov', { id: text('id').primaryKey(), cantidad: integer('cantidad'), ...sync });
const registro: RegistroSync = {
  zona: { tipo: 'local' },
  saldo: { tipo: 'maestro', proyectadas: ['stock'] },
  mov: { tipo: 'libro' },
};
const schema = { zona, saldo, mov };

describe('triggersSync', () => {
  const ddl = triggersSync(schema, registro).join('\n');

  it('genera un trigger de alta y uno de modificación por tabla maestro/libro, ninguno para local', () => {
    expect(nombresTriggersSync(schema, registro)).toEqual([
      'sync_ins_mov',
      'sync_upd_mov',
      'sync_del_mov',
      'sync_ins_saldo',
      'sync_upd_saldo',
      'sync_del_saldo',
    ]);
    expect(ddl).not.toMatch(/ON "zona"/);
  });

  it('no encola mientras se aplican cambios recibidos del hub', () => {
    expect(ddl.match(/NOT EXISTS \(SELECT 1 FROM "sync_aplicando"\)/g)).toHaveLength(4);
  });

  it('la fila encolada excluye las columnas proyectadas', () => {
    const insSaldo = triggersSync(schema, registro).find((s) => s.includes('"sync_ins_saldo"'))!;
    expect(insSaldo).toContain(`'nombre', "nombre"`);
    expect(insSaldo).not.toContain(`'stock'`);
  });

  it('una modificación solo de proyectadas o de campos de sync no encola', () => {
    const updSaldo = triggersSync(schema, registro).find((s) => s.includes('"sync_upd_saldo"'))!;
    expect(updSaldo).toContain('OLD."nombre" IS NOT NEW."nombre"');
    for (const c of ['stock', 'version', 'sync_state', 'updated_at']) {
      expect(updSaldo).not.toContain(`OLD."${c}" IS NOT`);
    }
  });

  it('sube la versión si el handler no la subió y marca pending', () => {
    const updSaldo = triggersSync(schema, registro).find((s) => s.includes('"sync_upd_saldo"'))!;
    expect(updSaldo).toMatch(/"version" = CASE WHEN NEW\."version" = OLD\."version" THEN OLD\."version" \+ 1 ELSE NEW\."version" END/);
    expect(updSaldo).toContain(`"sync_state" = 'pending'`);
  });

  it('parte el JSON de tablas anchas para no pasar el límite de argumentos de SQLite', () => {
    const cols: Record<string, ReturnType<typeof text>> = {};
    for (let i = 0; i < 80; i++) cols[`c${i}`] = text(`c${i}`);
    const ancha = sqliteTable('ancha', { id: text('id').primaryKey(), ...cols, ...sync });
    const s = triggersSync({ ancha }, { ancha: { tipo: 'maestro' } }).join('\n');
    expect(s).toContain('json_patch(');
    for (const m of s.matchAll(/json_object\(([^)]*)\)/g)) expect(m[1].split(',').length).toBeLessThanOrEqual(100);
  });

  it('falla si una tabla que sincroniza no tiene id', () => {
    const sinId = sqliteTable('sin_id', { clave: text('clave').primaryKey(), ...sync });
    expect(() => triggersSync({ sinId }, { sin_id: { tipo: 'maestro' } })).toThrow('TRIGGER_SIN_ID: sin_id');
  });
});

const BR = String.fromCharCode(10);

describe('triggersSinBorrado (ADR-150 §7)', () => {
  it('aborta el DELETE de cada tabla maestro/libro con un error que nombra la tabla', () => {
    const ddl = triggersSinBorrado(schema, registro);
    expect(ddl).toHaveLength(2);
    const mov = ddl.find((s) => s.includes('"sync_del_mov"'))!;
    expect(mov).toContain('BEFORE DELETE ON "mov"');
    expect(mov).toContain("RAISE(ABORT, 'BORRADO_FISICO_EN_TABLA_SYNC: mov')");
    expect(ddl.join(BR)).not.toMatch(/ON "zona"/);
  });

  it('respeta las excepciones', () => {
    expect(triggersSinBorrado(schema, registro, ['mov'])).toHaveLength(1);
  });

  it('triggersSync incluye la baranda: en modo distribuido tampoco se borra', () => {
    expect(triggersSync(schema, registro).join(BR)).toContain('BEFORE DELETE ON "saldo"');
  });
});
