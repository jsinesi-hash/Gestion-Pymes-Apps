import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { createCoreTestDb } from './esquema';
import { runSeed } from '../auth/seed';
import { loginHandler } from '../ipc/auth';
import { limiteIntentos } from '../auth/intentos';
import { hashPassword } from '../auth/hash';

/**
 * BD del núcleo con el seed de auth (roles, permisos universales y el usuario `admin`), sin
 * permisos de ninguna app. El límite de intentos de login vive en memoria del proceso: se reinicia
 * para que un test que falla credenciales no arrastre el bloqueo al siguiente.
 */
export function setupCoreDb() {
  const db = createCoreTestDb();
  runSeed(db, { permisos: [], operador: [] });
  limiteIntentos.reiniciar();
  return db;
}

export function loginAsAdmin(db: ReturnType<typeof setupCoreDb>) {
  return loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' }); // NOSONAR
}

/** Crea (si no existe) un usuario con rol OPERADOR y abre sesión con él. */
export function loginAsOperador(db: ReturnType<typeof setupCoreDb>) {
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

export { clearSession } from '../auth/session';
