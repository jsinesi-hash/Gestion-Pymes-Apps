import Database from 'better-sqlite3';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { createDb, instalarBarandaSinBorrado, quitarBarandaSinBorrado, runMigrations } from '@core/db';
import * as schema from '../../db/schema';
import { registroSyncRetail } from '../../db/registro-sync';
import { runSeed } from '../../auth/seed';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { loginHandler, hashPassword, limiteIntentos } from '@core/main';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

/**
 * Tablas que todavía borran físicamente (líneas de documentos en borrador): F1 PR4b las pasa a
 * lápida y esta lista queda vacía. Ninguna tabla nueva entra acá (ADR-150 §7).
 */
export const BORRADO_FISICO_PENDIENTE = ['item_oc', 'presupuesto_detalle', 'remito_linea', 'venta_detalle'] as const;

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const { db } = createDb(sqlite, schema);
  runMigrations(db, sqlite, MIGRATIONS_DIR);
  // Baranda ADR-150 §7: un handler que borre una fila de una tabla que sincroniza rompe su test.
  instalarBarandaSinBorrado(sqlite, schema, registroSyncRetail(), BORRADO_FISICO_PENDIENTE);
  return db;
}

/**
 * Quita la baranda de esta base. Solo para tests que borran a propósito: simular datos legacy o
 * ejercitar un borrado que existe solo en standalone (seeds de desarrollo, «quitar catálogo demo»).
 */
export function permitirBorradoFisico(db: ReturnType<typeof createTestDb>): void {
  quitarBarandaSinBorrado(db.$client as BetterSqlite3.Database, schema, registroSyncRetail());
}

export function setupDb() {
  const db = createTestDb();
  runSeed(db);
  marcarUsuariosAlDia(db);
  // El límite de intentos de login vive en memoria del proceso: sin esto un test que falla
  // credenciales arrastraría el bloqueo a los siguientes del mismo archivo.
  limiteIntentos.reiniciar();
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

export function loginAsAdmin(db: ReturnType<typeof setupDb>) {
  return loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' }); // NOSONAR
}

/** Crea (si no existe) un usuario con rol OPERADOR y abre sesión con él. */
export function loginAsOperador(db: ReturnType<typeof setupDb>) {
  const rol = db.select().from(schema.rol).where(eq(schema.rol.nombre, 'OPERADOR')).get()!;
  const now = new Date();
  const existente = db.select().from(schema.usuario)
    .where(eq(schema.usuario.nombre_usuario, 'operador1')).get();
  if (!existente) {
    db.insert(schema.usuario).values({
      id: randomUUID(),
      nombre_usuario: 'operador1',
      nombre_completo: 'Operador de prueba',
      hash_password: hashPassword('operador1234'), // NOSONAR
      email: 'operador@prueba.local',
      password_changed_at: now,
      rol_id: rol.id,
      activo: true,
      usuario_creacion_id: 'system',
      fecha_creacion: now,
      version: 1,
      origin_id: 'system',
      sync_state: 'synced',
      updated_at: now,
    }).run();
  }
  return loginHandler(db, { nombreUsuario: 'operador1', password: 'operador1234' }); // NOSONAR
}

export { clearSession } from '@core/main';
