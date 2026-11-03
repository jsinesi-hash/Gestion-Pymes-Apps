/**
 * Política mínima de contraseña (revisión 2026-10-20, P1).
 *
 * Mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial, y distinta del
 * nombre de usuario. Función pura y browser-safe: el main la aplica en el borde de los handlers
 * (`usuario:create`, `usuario:changePassword`) y la UI la usa para avisar antes de enviar. Solo
 * rige para contraseñas NUEVAS: no toca a las existentes ni al admin sembrado.
 */

export const PASSWORD_MIN_LARGO = 8;

export type MotivoPasswordDebil = 'LARGO' | 'MAYUSCULA' | 'NUMERO' | 'ESPECIAL' | 'USUARIO';

const MENSAJES: Record<MotivoPasswordDebil, string> = {
  LARGO: `La contraseña debe tener al menos ${PASSWORD_MIN_LARGO} caracteres.`,
  MAYUSCULA: 'La contraseña debe incluir al menos una letra mayúscula.',
  NUMERO: 'La contraseña debe incluir al menos un número.',
  ESPECIAL: 'La contraseña debe incluir al menos un carácter especial (por ejemplo ! # $ % & - _).',
  USUARIO: 'La contraseña no puede ser igual al nombre de usuario.',
};

export function mensajePasswordDebil(motivo: MotivoPasswordDebil): string {
  return MENSAJES[motivo];
}

/** Motivos por los que la contraseña no cumple, en orden estable. Vacío = cumple. */
export function motivosPasswordDebil(password: string, nombreUsuario?: string): MotivoPasswordDebil[] {
  const p = typeof password === 'string' ? password : '';
  const motivos: MotivoPasswordDebil[] = [];
  if (p.length < PASSWORD_MIN_LARGO) motivos.push('LARGO');
  if (!/\p{Lu}/u.test(p)) motivos.push('MAYUSCULA');
  if (!/\d/.test(p)) motivos.push('NUMERO');
  // Especial = ni letra, ni número, ni espacio.
  if (!/[^\p{L}\p{N}\s]/u.test(p)) motivos.push('ESPECIAL');
  const usuario = typeof nombreUsuario === 'string' ? nombreUsuario.trim().toLowerCase() : '';
  if (usuario !== '' && p.trim().toLowerCase() === usuario) motivos.push('USUARIO');
  return motivos;
}

/** Lanza `Error('PASSWORD_DEBIL:<motivo>')` (formato CÓDIGO:arg del catálogo de errores del renderer). */
export function validarPoliticaPassword(password: string, nombreUsuario?: string): void {
  const [primero] = motivosPasswordDebil(password, nombreUsuario);
  if (primero) throw new Error(`PASSWORD_DEBIL:${primero}`);
}
