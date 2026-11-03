import crypto from 'node:crypto';

// Firma HMAC del `.fbk`. El archivo ya trae un SHA-256 de la base dentro del manifest, pero eso solo
// detecta un archivo dañado: quien edita la base recalcula el hash. La firma cubre el manifest
// (y por lo tanto ese hash) con una clave por instalación que vive en safeStorage (`clave-firma.ts`),
// fuera del backup. Funciones puras: la clave llega por parámetro.

export const ALG_FIRMA = 'HMAC-SHA256';

export interface FirmaFbk {
  alg: typeof ALG_FIRMA;
  /** Identifica la clave sin revelarla: permite distinguir «otra instalación» de «manipulado». */
  key_id: string;
  mac: string;
}

/**
 * - `valida`: firmado por esta instalación y el manifest está intacto.
 * - `invalida`: firmado por ESTA clave pero el mac no coincide → el archivo fue modificado.
 * - `no_verificable`: firmado por otra instalación (o esta no tiene clave): no se puede comprobar.
 * - `sin_firma`: backup anterior a la firma, o `firma.json` ilegible.
 */
export type ResultadoFirma = 'valida' | 'invalida' | 'no_verificable' | 'sin_firma';

export function idDeClave(clave: Buffer): string {
  return crypto.createHash('sha256').update(clave).digest('hex').slice(0, 16);
}

function macDe(clave: Buffer, manifestJson: string): string {
  return crypto.createHmac('sha256', clave).update(manifestJson, 'utf8').digest('hex');
}

export function firmarManifest(clave: Buffer, manifestJson: string): FirmaFbk {
  return { alg: ALG_FIRMA, key_id: idDeClave(clave), mac: macDe(clave, manifestJson) };
}

function esFirma(x: unknown): x is FirmaFbk {
  if (typeof x !== 'object' || x === null) return false;
  const f = x as Record<string, unknown>;
  return f.alg === ALG_FIRMA && typeof f.key_id === 'string' && typeof f.mac === 'string';
}

export function verificarFirma(clave: Buffer | null, manifestJson: string, firma: FirmaFbk | null): ResultadoFirma {
  if (!esFirma(firma)) return 'sin_firma';
  if (clave === null || firma.key_id !== idDeClave(clave)) return 'no_verificable';
  const esperado = Buffer.from(macDe(clave, manifestJson), 'hex');
  const recibido = Buffer.from(firma.mac, 'hex');
  const coincide = esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
  return coincide ? 'valida' : 'invalida';
}
