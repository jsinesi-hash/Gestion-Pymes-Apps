import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { firmarManifest, verificarFirma, idDeClave } from './firma';

// El `.fbk` solo traía un SHA-256 propio: detecta un archivo dañado, pero quien edita la base
// recalcula el hash. La firma HMAC (clave por instalación, en safeStorage) cubre el manifest, que
// ya incluye el SHA-256 de la base.
const MANIFEST = JSON.stringify({ app_version: '1.0.0', db_sha256: 'abc123', tipo: 'manual' }, null, 2);

describe('firmarManifest', () => {
  it('devuelve algoritmo, id de clave y mac en hexadecimal', () => {
    const clave = randomBytes(32);
    const f = firmarManifest(clave, MANIFEST);
    expect(f.alg).toBe('HMAC-SHA256');
    expect(f.key_id).toBe(idDeClave(clave));
    expect(f.mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es determinista para la misma clave y el mismo manifest', () => {
    const clave = randomBytes(32);
    expect(firmarManifest(clave, MANIFEST)).toEqual(firmarManifest(clave, MANIFEST));
  });

  it('cambia si cambia el manifest o la clave', () => {
    const clave = randomBytes(32);
    const base = firmarManifest(clave, MANIFEST).mac;
    expect(firmarManifest(clave, MANIFEST.replace('abc123', 'abc124')).mac).not.toBe(base);
    expect(firmarManifest(randomBytes(32), MANIFEST).mac).not.toBe(base);
  });
});

describe('idDeClave', () => {
  it('es un identificador corto que no revela la clave', () => {
    const clave = randomBytes(32);
    const id = idDeClave(clave);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(clave.toString('hex')).not.toContain(id);
  });
});

describe('verificarFirma', () => {
  it('valida: misma clave, manifest intacto', () => {
    const clave = randomBytes(32);
    expect(verificarFirma(clave, MANIFEST, firmarManifest(clave, MANIFEST))).toBe('valida');
  });

  it('invalida: misma clave pero el manifest se tocó (base reemplazada y hash recalculado)', () => {
    const clave = randomBytes(32);
    const firma = firmarManifest(clave, MANIFEST);
    expect(verificarFirma(clave, MANIFEST.replace('abc123', 'otro-hash'), firma)).toBe('invalida');
  });

  it('invalida: misma clave y mac adulterado', () => {
    const clave = randomBytes(32);
    const firma = { ...firmarManifest(clave, MANIFEST), mac: '0'.repeat(64) };
    expect(verificarFirma(clave, MANIFEST, firma)).toBe('invalida');
  });

  it('no_verificable: la firma es de otra instalación (otra clave)', () => {
    const otra = randomBytes(32);
    const firma = firmarManifest(otra, MANIFEST);
    expect(verificarFirma(randomBytes(32), MANIFEST, firma)).toBe('no_verificable');
  });

  it('no_verificable: esta instalación no tiene clave (safeStorage no disponible)', () => {
    const firma = firmarManifest(randomBytes(32), MANIFEST);
    expect(verificarFirma(null, MANIFEST, firma)).toBe('no_verificable');
  });

  it('sin_firma: backups anteriores a la firma', () => {
    expect(verificarFirma(randomBytes(32), MANIFEST, null)).toBe('sin_firma');
  });

  it('un firma.json malformado cuenta como sin_firma, no rompe', () => {
    const clave = randomBytes(32);
    expect(verificarFirma(clave, MANIFEST, { alg: 'otro' } as never)).toBe('sin_firma');
    expect(verificarFirma(clave, MANIFEST, 'basura' as never)).toBe('sin_firma');
  });

  it('un mac de largo distinto no lanza (comparación en tiempo constante)', () => {
    const clave = randomBytes(32);
    const firma = { ...firmarManifest(clave, MANIFEST), mac: 'abcd' };
    expect(verificarFirma(clave, MANIFEST, firma)).toBe('invalida');
  });
});
