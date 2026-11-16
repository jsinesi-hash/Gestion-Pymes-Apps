import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { usuario, rol, rol_permiso, permiso } from '@core/db';
import { verifyPassword } from './hash';
import { limiteIntentos } from './intentos';

type Db = BetterSQLite3Database<typeof schema>;

/**
 * Autorización en el momento (anular, override de precio, cierre de caja con diferencia, venta
 * sobre el límite de crédito…): valida las credenciales de quien autoriza y que su rol tenga el
 * permiso de la acción (ADR-146; antes exigía el rol SUPERVISOR por nombre). Devuelve su id.
 * Cualquier fallo es `SUPERVISOR_INVALIDO`, sin distinguir clave incorrecta de falta de permiso.
 */
export function verificarAutorizacion(
  db: Db,
  creds: { nombre_usuario: string; password: string },
  codigoPermiso: string,
): string {
  // Revisión 2026-10-20 (P1): comparte el límite de intentos del login (3 fallos → 15 minutos),
  // porque permitía adivinar contraseñas sin freno.
  limiteIntentos.verificar(creds.nombre_usuario);
  const user = db
    .select({ id: usuario.id, hash_password: usuario.hash_password, rol_id: usuario.rol_id })
    .from(usuario)
    .where(and(eq(usuario.nombre_usuario, creds.nombre_usuario), eq(usuario.activo, true)))
    .get();
  if (!user || !verifyPassword(creds.password, user.hash_password)) {
    limiteIntentos.registrarFallo(creds.nombre_usuario);
    throw new Error('SUPERVISOR_INVALIDO');
  }
  limiteIntentos.registrarExito(creds.nombre_usuario);
  if (!rolTienePermiso(db, user.rol_id, codigoPermiso)) throw new Error('SUPERVISOR_INVALIDO');
  return user.id;
}

function rolTienePermiso(db: Db, rolId: string, codigoPermiso: string): boolean {
  const fila = db
    .select({ id: rol_permiso.id })
    .from(rol_permiso)
    .innerJoin(rol, eq(rol.id, rol_permiso.rol_id))
    .innerJoin(permiso, eq(permiso.id, rol_permiso.permiso_id))
    .where(and(eq(rol_permiso.rol_id, rolId), eq(rol.activo, true), eq(permiso.codigo, codigoPermiso)))
    .get();
  return !!fila;
}
