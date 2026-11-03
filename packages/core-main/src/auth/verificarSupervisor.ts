import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { usuario, rol } from '@core/db';
import { verifyPassword } from './hash';
import { limiteIntentos } from './intentos';

type Db = BetterSQLite3Database<typeof schema>;

export function verificarSupervisor(
  db: Db,
  creds: { nombre_usuario: string; password: string },
): string {
  // Revisión 2026-10-20 (P1): la autorización de Supervisor del POS comparte el límite de intentos
  // del login (3 fallos → 15 minutos), porque permitía adivinar contraseñas sin freno.
  limiteIntentos.verificar(creds.nombre_usuario);
  try {
    const id = verificarCredenciales(db, creds);
    limiteIntentos.registrarExito(creds.nombre_usuario);
    return id;
  } catch (e) {
    limiteIntentos.registrarFallo(creds.nombre_usuario);
    throw e;
  }
}

function verificarCredenciales(
  db: Db,
  creds: { nombre_usuario: string; password: string },
): string {
  const supervisorRol = db
    .select({ id: rol.id })
    .from(rol)
    .where(and(eq(rol.nombre, 'SUPERVISOR'), eq(rol.activo, true)))
    .get();
  if (!supervisorRol) throw new Error('SUPERVISOR_INVALIDO');

  const user = db
    .select({ id: usuario.id, hash_password: usuario.hash_password })
    .from(usuario)
    .where(and(
      eq(usuario.nombre_usuario, creds.nombre_usuario),
      eq(usuario.activo, true),
      eq(usuario.rol_id, supervisorRol.id),
    ))
    .get();

  if (!user) throw new Error('SUPERVISOR_INVALIDO');
  if (!verifyPassword(creds.password, user.hash_password)) throw new Error('SUPERVISOR_INVALIDO');
  return user.id;
}
