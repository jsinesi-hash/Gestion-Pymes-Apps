import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { obtenerOCrearClaveFirma, activarFirmaBackup, type ClaveFirmaDeps } from './clave-firma';
import { claveFirmaActual, configurarFirmaBackup } from './firma-config';

// safeStorage falso: «cifra» invirtiendo el texto para poder comprobar que en disco NO queda la clave.
const reversa = (s: string) => s.split('').reverse().join('');
function safeStorageFalso(disponible = true, falla = false): ClaveFirmaDeps['safeStorage'] {
  return {
    isEncryptionAvailable: () => disponible,
    encryptString: (s: string) => Buffer.from(reversa(s), 'utf8'),
    decryptString: (b: Buffer) => {
      if (falla) throw new Error('no se puede descifrar');
      return reversa(b.toString('utf8'));
    },
  };
}

let carpeta: string;
let filePath: string;
beforeEach(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'clave-firma-'));
  filePath = path.join(carpeta, 'backup-signing.key');
  configurarFirmaBackup(() => null);
});
afterEach(() => { fs.rmSync(carpeta, { recursive: true, force: true }); });

describe('obtenerOCrearClaveFirma', () => {
  it('la primera vez crea 32 bytes y los guarda cifrados (no en claro)', () => {
    const clave = obtenerOCrearClaveFirma({ safeStorage: safeStorageFalso(), filePath })!;
    expect(clave).toBeInstanceOf(Buffer);
    expect(clave.length).toBe(32);
    const enDisco = fs.readFileSync(filePath).toString('utf8');
    expect(enDisco).not.toContain(clave.toString('hex'));
  });

  it('las siguientes veces devuelve la misma clave', () => {
    const deps = { safeStorage: safeStorageFalso(), filePath };
    const a = obtenerOCrearClaveFirma(deps)!;
    const b = obtenerOCrearClaveFirma(deps)!;
    expect(b.equals(a)).toBe(true);
  });

  it('sin safeStorage disponible devuelve null y no crea el archivo', () => {
    expect(obtenerOCrearClaveFirma({ safeStorage: safeStorageFalso(false), filePath })).toBeNull();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('si el archivo existe pero no se puede descifrar devuelve null y NO lo pisa', () => {
    const original = obtenerOCrearClaveFirma({ safeStorage: safeStorageFalso(), filePath })!;
    const antes = fs.readFileSync(filePath);
    expect(obtenerOCrearClaveFirma({ safeStorage: safeStorageFalso(true, true), filePath })).toBeNull();
    expect(fs.readFileSync(filePath).equals(antes)).toBe(true);
    // y la clave original sigue siendo recuperable cuando safeStorage vuelve a andar
    expect(obtenerOCrearClaveFirma({ safeStorage: safeStorageFalso(), filePath })!.equals(original)).toBe(true);
  });

  it('un archivo con contenido que no es una clave válida devuelve null', () => {
    fs.writeFileSync(filePath, Buffer.from(reversa('no-es-hexadecimal'), 'utf8'));
    expect(obtenerOCrearClaveFirma({ safeStorage: safeStorageFalso(), filePath })).toBeNull();
  });
});

describe('activarFirmaBackup / claveFirmaActual', () => {
  it('sin activar no hay clave', () => {
    expect(claveFirmaActual()).toBeNull();
  });

  it('activado entrega la clave de la instalación', () => {
    activarFirmaBackup({ safeStorage: safeStorageFalso(), filePath });
    const clave = claveFirmaActual();
    expect(clave?.length).toBe(32);
    expect(claveFirmaActual()!.equals(clave!)).toBe(true);
  });

  it('un null no se cachea: cuando safeStorage está disponible se crea la clave', () => {
    let disponible = false;
    const ss = safeStorageFalso();
    activarFirmaBackup({ safeStorage: { ...ss, isEncryptionAvailable: () => disponible }, filePath });
    expect(claveFirmaActual()).toBeNull();
    disponible = true;
    expect(claveFirmaActual()?.length).toBe(32);
  });

  it('si el proveedor lanza, claveFirmaActual devuelve null (un backup no se cae por la firma)', () => {
    configurarFirmaBackup(() => { throw new Error('boom'); });
    expect(claveFirmaActual()).toBeNull();
  });
});
