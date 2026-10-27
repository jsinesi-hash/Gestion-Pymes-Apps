import Database from 'better-sqlite3';
import path from 'node:path';
import { createDb, runMigrations } from '@core/db';
import * as schema from '../../db/schema';
import { runSeed } from '../../auth/seed';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { loginHandler, hashPassword, limiteIntentos } from '@core/main';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const { db } = createDb(sqlite, schema);
  runMigrations(db, sqlite, MIGRATIONS_DIR);
  return db;
}

export function setupDb() {
  const db = createTestDb();
  runSeed(db);
  // El límite de intentos de login vive en memoria del proceso: sin esto un test que falla
  // credenciales arrastraría el bloqueo a los siguientes del mismo archivo.
  limiteIntentos.reiniciar();
  return db;
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
