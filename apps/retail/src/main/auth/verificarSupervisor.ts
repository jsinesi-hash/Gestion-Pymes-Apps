import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { verifyPassword } from './hash';

type Db = BetterSQLite3Database<typeof schema>;

export function verificarSupervisor(
  db: Db,
  creds: { nombre_usuario: string; password: string },
): string {
  const supervisorRol = db
    .select({ id: schema.rol.id })
    .from(schema.rol)
    .where(and(eq(schema.rol.nombre, 'SUPERVISOR'), eq(schema.rol.activo, true)))
    .get();
  if (!supervisorRol) throw new Error('SUPERVISOR_INVALIDO');

  const user = db
    .select({ id: schema.usuario.id, hash_password: schema.usuario.hash_password })
    .from(schema.usuario)
    .where(and(
      eq(schema.usuario.nombre_usuario, creds.nombre_usuario),
      eq(schema.usuario.activo, true),
      eq(schema.usuario.rol_id, supervisorRol.id),
    ))
    .get();

  if (!user) throw new Error('SUPERVISOR_INVALIDO');
  if (!verifyPassword(creds.password, user.hash_password)) throw new Error('SUPERVISOR_INVALIDO');
  return user.id;
}
