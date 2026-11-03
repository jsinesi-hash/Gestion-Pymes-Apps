import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import JSZip from 'jszip';
import { setupDb } from '../../ipc/__tests__/helpers';
import { crearBackup, validarBackup, ejecutarRestoreAtomico, configurarFirmaBackup } from '@core/main';

// ADR-135: el `.fbk` trae un SHA-256 de la base dentro del manifest, pero quien edita la base lo
// recalcula. La firma HMAC (clave por instalación) cubre el manifest. Acá se prueba integrada con
// una base real: crear, validar y el bloqueo de restore.
let tmpDir: string;
const claveA = randomBytes(32);
const claveB = randomBytes(32);

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'firma-backup-'));
  configurarFirmaBackup(() => null);
});
afterEach(() => {
  configurarFirmaBackup(() => null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function crear(db: ReturnType<typeof setupDb>) {
  return crearBackup({ db, destino: tmpDir, tipo: 'manual', incluirCerts: false, appVersion: '1.0.0', sucursalId: 's1' });
}

async function reescribirManifest(fbk: string, cambio: (m: Record<string, unknown>) => void) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fbk));
  const m = JSON.parse(await zip.file('manifest.json')!.async('string'));
  cambio(m);
  zip.file('manifest.json', JSON.stringify(m, null, 2));
  fs.writeFileSync(fbk, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

describe('crearBackup — firma', () => {
  it('con clave configurada agrega firma.json con el id de la clave', async () => {
    configurarFirmaBackup(() => claveA);
    const fbk = await crear(setupDb());
    const zip = await JSZip.loadAsync(fs.readFileSync(fbk));
    const firma = JSON.parse(await zip.file('firma.json')!.async('string'));
    expect(firma.alg).toBe('HMAC-SHA256');
    expect(firma.key_id).toMatch(/^[0-9a-f]{16}$/);
    expect(firma.mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sin clave (safeStorage no disponible) el backup se crea igual y sin firma.json', async () => {
    const fbk = await crear(setupDb());
    const zip = await JSZip.loadAsync(fs.readFileSync(fbk));
    expect(zip.file('firma.json')).toBeNull();
  });
});

describe('validarBackup — firma', () => {
  it('firmado por esta instalación → firma valida', async () => {
    configurarFirmaBackup(() => claveA);
    const db = setupDb();
    const r = await validarBackup(db, { ruta: await crear(db) });
    expect(r.ok).toBe(true);
    expect(r.firma).toBe('valida');
  });

  it('backup sin firma (anterior a ADR-135) → ok con firma sin_firma', async () => {
    const db = setupDb();
    const r = await validarBackup(db, { ruta: await crear(db) });
    expect(r.ok).toBe(true);
    expect(r.firma).toBe('sin_firma');
  });

  it('firmado por otra instalación → ok con firma no_verificable', async () => {
    configurarFirmaBackup(() => claveA);
    const db = setupDb();
    const fbk = await crear(db);
    configurarFirmaBackup(() => claveB);
    const r = await validarBackup(db, { ruta: fbk });
    expect(r.ok).toBe(true);
    expect(r.firma).toBe('no_verificable');
  });

  it('manifest modificado con la misma clave → rechazado (archivo manipulado)', async () => {
    configurarFirmaBackup(() => claveA);
    const db = setupDb();
    const fbk = await crear(db);
    await reescribirManifest(fbk, (m) => { m.app_version = '9.9.9'; });
    const r = await validarBackup(db, { ruta: fbk });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/firma/i);
  });

  it('un firma.json ilegible cuenta como sin_firma, no rompe la validación', async () => {
    configurarFirmaBackup(() => claveA);
    const db = setupDb();
    const fbk = await crear(db);
    const zip = await JSZip.loadAsync(fs.readFileSync(fbk));
    zip.file('firma.json', '{ esto no es json');
    fs.writeFileSync(fbk, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    const r = await validarBackup(db, { ruta: fbk });
    expect(r.ok).toBe(true);
    expect(r.firma).toBe('sin_firma');
  });
});

describe('ejecutarRestoreAtomico — firma', () => {
  const opcionesBase = (db: ReturnType<typeof setupDb>, fbkPath: string) => ({
    db,
    dbPath: path.join(tmpDir, 'no-se-toca.db'),
    fbkPath,
    usuarioId: 'u1',
    migrationsFolder: path.join(tmpDir, 'sin-migraciones'),
  });

  it('un backup sin firma verificable NO se restaura sin confirmación explícita', async () => {
    const db = setupDb();
    const fbk = await crear(db); // sin clave → sin_firma
    await expect(ejecutarRestoreAtomico(opcionesBase(db, fbk))).rejects.toThrow('FIRMA_NO_VERIFICABLE');
    expect(fs.existsSync(path.join(tmpDir, 'no-se-toca.db'))).toBe(false);
  });

  it('firmado por otra instalación tampoco, sin confirmación', async () => {
    configurarFirmaBackup(() => claveA);
    const db = setupDb();
    const fbk = await crear(db);
    configurarFirmaBackup(() => claveB);
    await expect(ejecutarRestoreAtomico(opcionesBase(db, fbk))).rejects.toThrow('FIRMA_NO_VERIFICABLE');
  });

  it('un manifest manipulado no se restaura ni con confirmación (la validación lo rechaza)', async () => {
    configurarFirmaBackup(() => claveA);
    const db = setupDb();
    const fbk = await crear(db);
    await reescribirManifest(fbk, (m) => { m.app_version = '9.9.9'; });
    await expect(
      ejecutarRestoreAtomico({ ...opcionesBase(db, fbk), confirmarSinFirma: true }),
    ).rejects.toThrow(/firma/i);
  });
});
