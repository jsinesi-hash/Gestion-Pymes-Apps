import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { guardarPasswordSmtp, leerPasswordSmtp, borrarPasswordSmtp, tienePasswordSmtp } from '../smtp-secret';

function fakeSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, ''),
  };
}

describe('smtp-secret', () => {
  let dir: string;
  let deps: any;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smtp-'));
    deps = { safeStorage: fakeSafeStorage(), filePath: path.join(dir, 'smtp-secret.bin') };
  });
  it('guarda y lee la contraseña', () => {
    guardarPasswordSmtp('secreta123', deps);
    expect(leerPasswordSmtp(deps)).toBe('secreta123');
    expect(tienePasswordSmtp(deps)).toBe(true);
  });
  it('sin archivo, leer devuelve null y tiene=false', () => {
    expect(leerPasswordSmtp(deps)).toBeNull();
    expect(tienePasswordSmtp(deps)).toBe(false);
  });
  it('borrar elimina el archivo', () => {
    guardarPasswordSmtp('x', deps);
    borrarPasswordSmtp(deps);
    expect(tienePasswordSmtp(deps)).toBe(false);
  });
  it('lanza si el cifrado no está disponible', () => {
    deps.safeStorage = { ...fakeSafeStorage(), isEncryptionAvailable: () => false };
    expect(() => guardarPasswordSmtp('x', deps)).toThrow('SAFE_STORAGE_NO_DISPONIBLE');
  });
});
