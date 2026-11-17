import { createHash } from 'node:crypto';

/**
 * Ids deterministas (ADR-152 §3, F1 PR8). Lo que dos terminales pueden generar a la vez —un evento
 * de agenda desde una rutina, las filas de precio de un cambio programado— usa un id calculado a
 * partir de lo que lo identifica: si se genera dos veces, choca por id en vez de duplicarse.
 * El resto de los ids sigue siendo aleatorio (`generateId`, ADR-003).
 */

/** Namespace propio del sistema para `uuidDeterminista` (un UUID v4 fijo, no cambiar). */
const NAMESPACE_GESTION = '3f6c2a1e-8b4d-4c7a-9e21-5d0b7f9a6c13';

function bytesDeUuid(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`UUID_INVALIDO: ${uuid}`);
  return Buffer.from(hex, 'hex');
}

/** UUID versión 5 (RFC 4122 §4.3): SHA-1 de namespace + nombre. */
export function uuidV5(nombre: string, namespace: string): string {
  const hash = createHash('sha1').update(bytesDeUuid(namespace)).update(nombre, 'utf8').digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // versión 5
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Id determinista a partir de sus partes (por ejemplo `'agenda_evento', rutinaId, fechaMs`). Las
 * partes se codifican con su largo, así `('a', 'b|c')` y `('a|b', 'c')` no colisionan.
 */
export function uuidDeterminista(...partes: string[]): string {
  return uuidV5(partes.map((p) => `${p.length}:${p}`).join(''), NAMESPACE_GESTION);
}
