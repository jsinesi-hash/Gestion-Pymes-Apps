import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from '../../db/schema';
import { runSeed } from '../seed';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../../db/migrations/0001_r1_schema.sql'), 'utf8'
  );
  const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) sqlite.exec(stmt);
  // ADR-136 (0050): `usuario.password_changed_at`. Este harness liviano no corre el migrator
  // completo: se aplica el SQL real de la migración para que la tabla siga el schema de Drizzle.
  const sql0050 = fs.readFileSync(
    path.resolve(__dirname, '../../db/migrations/0050_adr136_password_vigencia.sql'), 'utf8'
  );
  for (const stmt of sql0050.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) sqlite.exec(stmt);
  return drizzle(sqlite, { schema });
}

describe('runSeed', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('crea 2 roles sobre DB vacía', () => {
    runSeed(db);
    const roles = db.select().from(schema.rol).all();
    expect(roles).toHaveLength(2);
    const nombres = roles.map(r => r.nombre);
    expect(nombres).toContain('OPERADOR');
    expect(nombres).toContain('SUPERVISOR');
  });

  it('crea 29 permisos', () => {
    runSeed(db);
    const permisos = db.select().from(schema.permiso).all();
    expect(permisos).toHaveLength(35);
  });

  it('OPERADOR tiene exactamente 17 permisos', () => {
    runSeed(db);
    const operador = db.select().from(schema.rol).all().find(r => r.nombre === 'OPERADOR')!;
    const rp = db.select().from(schema.rol_permiso).all().filter(rp => rp.rol_id === operador.id);
    expect(rp).toHaveLength(18);
  });

  it('SUPERVISOR tiene exactamente 29 permisos', () => {
    runSeed(db);
    const supervisor = db.select().from(schema.rol).all().find(r => r.nombre === 'SUPERVISOR')!;
    const rp = db.select().from(schema.rol_permiso).all().filter(rp => rp.rol_id === supervisor.id);
    expect(rp).toHaveLength(35);
  });

  it('crea usuario admin inicial', () => {
    runSeed(db);
    const usuarios = db.select().from(schema.usuario).all();
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].nombre_usuario).toBe('admin');
  });

  it('es idempotente: segunda llamada no modifica nada', () => {
    runSeed(db);
    runSeed(db); // segunda llamada — no debe fallar ni duplicar
    const roles = db.select().from(schema.rol).all();
    expect(roles).toHaveLength(2);
    const permisos = db.select().from(schema.permiso).all();
    expect(permisos).toHaveLength(35);
    const usuarios = db.select().from(schema.usuario).all();
    expect(usuarios).toHaveLength(1);
  });
});
