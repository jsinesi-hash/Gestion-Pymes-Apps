import Database from 'better-sqlite3';
import path from 'node:path';
import { createDb, runMigrations } from '@core/db';
import { runSeed, loginHandler } from '@core/main';
import * as schema from '../db/schema';
import { PERMISOS_ELABORADOS, OPERADOR_PERMISOS_ELABORADOS } from '../auth/seed';
import { asegurarConsumidorFinal } from '../catalog/seed';

export const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const { db } = createDb(sqlite, schema);
  runMigrations(db, sqlite, MIGRATIONS_DIR);
  return db;
}

export function setupDb() {
  const db = createTestDb();
  runSeed(db, { permisos: PERMISOS_ELABORADOS, operador: OPERADOR_PERMISOS_ELABORADOS });
  asegurarConsumidorFinal(db);
  marcarUsuariosAlDia(db);
  return db;
}

/**
 * ADR-136: el seed crea al `admin` sin mail ni fecha de cambio de contraseña (en una instalación real
 * el primer ingreso obliga a cambiar la clave y cargar el mail). Los tests que solo necesitan iniciar
 * sesión parten de usuarios al día; los que prueban la vigencia lo pisan explícitamente.
 */
export function marcarUsuariosAlDia(db: ReturnType<typeof createTestDb>) {
  db.update(schema.usuario)
    .set({ email: 'usuario@prueba.local', password_changed_at: new Date() })
    .run();
}

// Los tests que arman la base con `createTestDb` + `runSeed` (sin `setupDb`) también entran como
// admin: el helper lo deja al día antes de iniciar sesión (ADR-136).
export const loginAsAdmin = (db: ReturnType<typeof setupDb>) => {
  marcarUsuariosAlDia(db);
  return loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' }); // NOSONAR
};

export { clearSession } from '@core/main';
