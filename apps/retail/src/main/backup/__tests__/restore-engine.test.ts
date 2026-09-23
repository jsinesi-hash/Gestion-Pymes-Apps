import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setupDb } from '../../ipc/__tests__/helpers';
import { crearBackup } from '@core/main';
import { validarBackup, determinarCompatibilidad } from '@core/main';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function crearFbkDePrueba(db: ReturnType<typeof setupDb>, dir: string) {
  return crearBackup({ db, destino: dir, tipo: 'manual', incluirCerts: false, appVersion: '1.0.0', sucursalId: 's1' });
}

describe('determinarCompatibilidad', () => {
  it('retorna direct cuando el hash del backup coincide con el último actual', () => {
    const result = determinarCompatibilidad('hash-c', ['hash-a', 'hash-b', 'hash-c']);
    expect(result).toBe('direct');
  });

  it('retorna migrate cuando el hash del backup es un subconjunto del historial actual', () => {
    const result = determinarCompatibilidad('hash-a', ['hash-a', 'hash-b', 'hash-c']);
    expect(result).toBe('migrate');
  });

  it('retorna incompatible cuando el hash no está en el historial actual', () => {
    const result = determinarCompatibilidad('hash-nuevo', ['hash-a', 'hash-b']);
    expect(result).toBe('incompatible');
  });

  it('retorna incompatible con lista vacía', () => {
    const result = determinarCompatibilidad('hash-x', []);
    expect(result).toBe('incompatible');
  });
});

describe('validarBackup', () => {
  it('valida un .fbk correcto y retorna manifest + compatibilidad', async () => {
    const db = setupDb();
    const fbkPath = await crearFbkDePrueba(db, tmpDir);

    const result = await validarBackup(db, { ruta: fbkPath });
    expect(result.ok).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.manifest!.tipo).toBe('manual');
    expect(['direct', 'migrate', 'incompatible']).toContain(result.compatibilidad);
    expect(result.row_counts_actuales).toBeDefined();
  });

  it('retorna error si el archivo no existe', async () => {
    const db = setupDb();
    const result = await validarBackup(db, { ruta: path.join(tmpDir, 'no-existe.fbk') });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no encontrado|ENOENT/i);
  });

  it('retorna error si el .fbk está corrupto (no es ZIP válido)', async () => {
    const rutaCorrupta = path.join(tmpDir, 'corrupto.fbk');
    fs.writeFileSync(rutaCorrupta, Buffer.from('esto no es un zip'));
    const db = setupDb();

    const result = await validarBackup(db, { ruta: rutaCorrupta });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('retorna error si el checksum del DB no coincide', async () => {
    const db = setupDb();
    const fbkPath = await crearFbkDePrueba(db, tmpDir);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(fs.readFileSync(fbkPath));
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    manifest.db_sha256 = 'sha256-incorrecto-aaaa0000';
    zip.file('manifest.json', JSON.stringify(manifest));
    fs.writeFileSync(fbkPath, await zip.generateAsync({ type: 'nodebuffer' }));

    const result = await validarBackup(db, { ruta: fbkPath });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/checksum|dañado/i);
  });

  it('solicita contraseña para backups cifrados', async () => {
    const db = setupDb();
    const fbkPath = await crearBackup({
      db, destino: tmpDir, tipo: 'manual',
      incluirCerts: true, password: 'MiPass123',
      appVersion: '1.0.0', sucursalId: 's1',
    });

    const sinPass = await validarBackup(db, { ruta: fbkPath });
    expect(sinPass.ok).toBe(false);
    expect(sinPass.error).toMatch(/contraseña|cifrado/i);

    const malaPass = await validarBackup(db, { ruta: fbkPath, password: 'incorrecta' });
    expect(malaPass.ok).toBe(false);

    const buena = await validarBackup(db, { ruta: fbkPath, password: 'MiPass123' });
    expect(buena.ok).toBe(true);
  });
});
