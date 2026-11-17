import Database from 'better-sqlite3';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { createDb, instalarBarandaSinBorrado, quitarBarandaSinBorrado, runMigrations } from '@core/db';
import { runSeed, loginHandler } from '@core/main';
import * as schema from '../db/schema';
import { registroSyncElaborados } from '../db/registro-sync';
import { PERMISOS_ELABORADOS, OPERADOR_PERMISOS_ELABORADOS } from '../auth/seed';
import { asegurarConsumidorFinal } from '../catalog/seed';

export const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');

/**
 * Tablas que todavía borran físicamente. F1 PR4c pasó a lápida las últimas (receta y líneas de
 * pedido): la lista queda vacía y ninguna tabla entra acá (ADR-150 §7).
 */
export const BORRADO_FISICO_PENDIENTE: readonly string[] = [];

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const { db } = createDb(sqlite, schema);
  runMigrations(db, sqlite, MIGRATIONS_DIR);
  // Baranda ADR-150 §7: un handler que borre una fila de una tabla que sincroniza rompe su test.
  instalarBarandaSinBorrado(sqlite, schema, registroSyncElaborados(), BORRADO_FISICO_PENDIENTE);
  return db;
}

/**
 * Quita la baranda de esta base. Solo para tests que borran a propósito: simular datos previos o
 * ejercitar un borrado que existe solo en standalone (seeds de desarrollo, «quitar catálogo demo»).
 */
export function permitirBorradoFisico(db: ReturnType<typeof createTestDb>): void {
  quitarBarandaSinBorrado(db.$client as BetterSqlite3.Database, schema, registroSyncElaborados());
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
