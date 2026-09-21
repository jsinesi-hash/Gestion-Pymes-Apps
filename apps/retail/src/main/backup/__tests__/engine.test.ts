import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema';
import { setupDb } from '../../ipc/__tests__/helpers';
import { generarManifest, crearBackup, leerManifestBackup } from '../engine';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbk-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('generarManifest', () => {
  it('incluye row_counts dinámico con las tablas de sqlite_master', () => {
    const db = setupDb();
    const manifest = generarManifest(db, {
      tipo: 'manual',
      incluirCerts: false,
      appVersion: '1.0.0',
      sucursalId: 'terminal-1',
      dbSha256: 'abc123',
    });
    expect(manifest.tipo).toBe('manual');
    expect(manifest.incluye_certs).toBe(false);
    expect(manifest.cifrado).toBe(false);
    expect(Object.keys(manifest.row_counts).length).toBeGreaterThan(0);
    expect(manifest.row_counts).toHaveProperty('usuario');
    expect(manifest.schema.driver).toBe('drizzle');
    expect(manifest.schema.migrations_applied).toBeGreaterThan(0);
    expect(manifest.schema.last_migration_hash).toBeTruthy();
  });

  it('row_counts refleja los datos sembrados', () => {
    const db = setupDb();
    const manifest = generarManifest(db, {
      tipo: 'manual',
      incluirCerts: false,
      appVersion: '1.0.0',
      sucursalId: 'terminal-1',
      dbSha256: 'abc123',
    });
    expect(manifest.row_counts['rol']).toBeGreaterThanOrEqual(2);
    expect(manifest.row_counts['usuario']).toBeGreaterThanOrEqual(1);
  });
});

describe('crearBackup', () => {
  it('crea un archivo .fbk en el directorio destino', async () => {
    const db = setupDb();
    const rutaFbk = await crearBackup({
      db,
      destino: tmpDir,
      tipo: 'manual',
      incluirCerts: false,
      appVersion: '1.0.0',
      sucursalId: 'terminal-1',
    });

    expect(fs.existsSync(rutaFbk)).toBe(true);
    expect(rutaFbk.endsWith('.fbk')).toBe(true);
  });

  it('el .fbk contiene manifest.json, checksums.sha256 y ferreteria.db', async () => {
    const db = setupDb();

    const rutaFbk = await crearBackup({
      db,
      destino: tmpDir,
      tipo: 'manual',
      incluirCerts: false,
      appVersion: '1.0.0',
      sucursalId: 'terminal-1',
    });

    const zip = await JSZip.loadAsync(fs.readFileSync(rutaFbk));
    expect(zip.file('manifest.json')).not.toBeNull();
    expect(zip.file('checksums.sha256')).not.toBeNull();
    expect(zip.file('ferreteria.db')).not.toBeNull();

    const manifestStr = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestStr);
    expect(manifest.tipo).toBe('manual');
    expect(manifest.db_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('backup con escrituras WAL pendientes → restore → integrity_check + conteos OK', async () => {
    // Usar dir separado para la DB WAL — evita contención con afterEach en Windows
    const walDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wal-db-'));
    try {
      const dbPath = path.join(walDir, 'wal-test.db');
      const sqlite = new Database(dbPath);
      sqlite.pragma('journal_mode = WAL');
      const db = drizzle(sqlite, { schema });
      const { migrate: migrateDb } = await import('drizzle-orm/better-sqlite3/migrator');
      migrateDb(db, { migrationsFolder: path.join(__dirname, '../../db/migrations') });

      // Introducir escritura para generar WAL
      sqlite.prepare('INSERT OR IGNORE INTO rol (id, nombre, es_sistema, activo, version, origin_id, sync_state, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run('wal-test-rol', 'TEST_WAL_ROL', 0, 1, 1, 'test', 'synced', new Date().toISOString());

      // Crear backup (backupDb hace checkpoint WAL internamente)
      const rutaFbk = await crearBackup({
        db,
        destino: tmpDir,
        tipo: 'manual',
        incluirCerts: false,
        appVersion: '1.0.0',
        sucursalId: 's1',
      });
      sqlite.close();

      // Restaurar el .fbk y verificar
      const zip = await JSZip.loadAsync(fs.readFileSync(rutaFbk));
      const dbBuffer = await zip.file('ferreteria.db')!.async('nodebuffer');
      const restoredPath = path.join(tmpDir, 'restored.db');
      fs.writeFileSync(restoredPath, dbBuffer);

      const restoredSqlite = new Database(restoredPath);
      const integrity = restoredSqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      expect(integrity.integrity_check).toBe('ok');

      const rol = restoredSqlite.prepare("SELECT id FROM rol WHERE id = 'wal-test-rol'").get();
      expect(rol).toBeDefined();
      restoredSqlite.close();
    } finally {
      try { fs.rmSync(walDir, { recursive: true, force: true }); } catch { /* Windows lock best-effort */ }
    }
  });

  it('cuando incluirCerts=true, incluye data.enc y NO ferreteria.db directamente', async () => {
    const db = setupDb();

    const rutaFbk = await crearBackup({
      db,
      destino: tmpDir,
      tipo: 'manual',
      incluirCerts: true,
      password: 'TestPassword123',
      appVersion: '1.0.0',
      sucursalId: 'terminal-1',
    });

    const zip = await JSZip.loadAsync(fs.readFileSync(rutaFbk));
    expect(zip.file('manifest.json')).not.toBeNull();
    expect(zip.file('checksums.sha256')).not.toBeNull();
    expect(zip.file('data.enc')).not.toBeNull();
    expect(zip.file('ferreteria.db')).toBeNull();

    const manifestStr = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestStr);
    expect(manifest.cifrado).toBe(true);
    expect(manifest.incluye_certs).toBe(true);
  });

  it('rechaza incluirCerts=true sin contraseña', async () => {
    const db = setupDb();

    await expect(
      crearBackup({
        db,
        destino: tmpDir,
        tipo: 'manual',
        incluirCerts: true,
        appVersion: '1.0.0',
        sucursalId: 'terminal-1',
      })
    ).rejects.toThrow('PASSWORD_REQUIRED');
  });
});

describe('leerManifestBackup', () => {
  it('devuelve el manifest de un .fbk válido', async () => {
    const db = setupDb();
    const ruta = await crearBackup({
      db,
      destino: tmpDir,
      tipo: 'auto',
      incluirCerts: false,
      appVersion: '1.0.0',
      sucursalId: 'C1',
    });
    const manifest = await leerManifestBackup(ruta);
    expect(manifest?.tipo).toBe('auto');
  });

  it('devuelve null si el archivo no existe o es inválido', async () => {
    expect(await leerManifestBackup('/no/existe/x.fbk')).toBeNull();
  });
});

import { calcularCandidatosDepuracion } from '../engine';
import type { BackupListItem, PoliticaRetencion } from '@ferreteria/shared';

function item(ruta: string, fechaISO: string, tipo: 'auto' | 'manual', bytes: number): BackupListItem {
  return {
    ruta, nombre: ruta.split('/').pop()!, tamano_bytes: bytes, fecha: fechaISO,
    tipo, incluye_certs: false, cifrado: false, app_version: '1.0.0',
  };
}

const POL: PoliticaRetencion = { cantidad: 3, dias: 7, piso: 2, sizeMb: 0 };

describe('calcularCandidatosDepuracion', () => {
  it('protege por unión: últimos N o dentro de X días', () => {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 86400000).toISOString();
    const backups = [
      item('/A/b0.fbk', d(0),  'auto', 100),
      item('/A/b1.fbk', d(1),  'auto', 100),
      item('/A/b2.fbk', d(2),  'auto', 100),
      item('/A/b3.fbk', d(10), 'auto', 100),
      item('/A/b4.fbk', d(20), 'auto', 100),
    ];
    const r = calcularCandidatosDepuracion(backups, POL);
    const rutas = r.candidatos.map(c => c.ruta).sort();
    expect(rutas).toEqual(['/A/b3.fbk', '/A/b4.fbk']);
    expect(r.bytesALiberar).toBe(200);
  });

  it('un auto viejo pero dentro de los últimos N queda protegido', () => {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 86400000).toISOString();
    const backups = [
      item('/A/b0.fbk', d(30), 'auto', 100),
      item('/A/b1.fbk', d(40), 'auto', 100),
      item('/A/b2.fbk', d(50), 'auto', 100),
      item('/A/b3.fbk', d(60), 'auto', 100),
    ];
    const r = calcularCandidatosDepuracion(backups, POL);
    expect(r.candidatos.map(c => c.ruta)).toEqual(['/A/b3.fbk']);
  });

  it('el piso nunca se viola aunque N y días sean agresivos', () => {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 86400000).toISOString();
    const pol: PoliticaRetencion = { cantidad: 1, dias: 1, piso: 2, sizeMb: 0 };
    const backups = [
      item('/A/b0.fbk', d(10), 'auto', 100),
      item('/A/b1.fbk', d(20), 'auto', 100),
      item('/A/b2.fbk', d(30), 'auto', 100),
    ];
    const r = calcularCandidatosDepuracion(backups, pol);
    expect(r.candidatos.map(c => c.ruta)).toEqual(['/A/b2.fbk']);
  });

  it('los manuales nunca son candidatos', () => {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 86400000).toISOString();
    const backups = [
      item('/A/b0.fbk', d(0),   'auto',   100),
      item('/A/m0.fbk', d(100), 'manual', 100),
    ];
    const r = calcularCandidatosDepuracion(backups, POL);
    expect(r.candidatos).toHaveLength(0);
    expect(r.protegidos.some(p => p.ruta === '/A/m0.fbk')).toBe(true);
  });

  it('tope de tamaño agrega auto protegidos más viejos sin violar el piso', () => {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 86400000).toISOString();
    const pol: PoliticaRetencion = { cantidad: 10, dias: 365, piso: 2, sizeMb: 1 };
    const backups = [
      item('/A/b0.fbk', d(0), 'auto', 400_000),
      item('/A/b1.fbk', d(1), 'auto', 400_000),
      item('/A/b2.fbk', d(2), 'auto', 400_000),
      item('/A/b3.fbk', d(3), 'auto', 400_000),
    ];
    const r = calcularCandidatosDepuracion(backups, pol);
    expect(r.candidatos.map(c => c.ruta).sort()).toEqual(['/A/b2.fbk', '/A/b3.fbk']);
  });

  it('dos carpetas: piso independiente y totales agregados', () => {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 86400000).toISOString();
    const pol: PoliticaRetencion = { cantidad: 1, dias: 1, piso: 1, sizeMb: 0 };
    const backups = [
      item('/A/a0.fbk', d(10), 'auto', 100),
      item('/A/a1.fbk', d(20), 'auto', 100),
      item('/B/b0.fbk', d(10), 'auto', 100),
      item('/B/b1.fbk', d(20), 'auto', 100),
    ];
    const r = calcularCandidatosDepuracion(backups, pol);
    expect(r.candidatos.map(c => c.ruta).sort()).toEqual(['/A/a1.fbk', '/B/b1.fbk']);
    expect(r.porCarpeta['/A'].candidatos).toBe(1);
    expect(r.porCarpeta['/B'].candidatos).toBe(1);
    expect(r.bytesALiberar).toBe(200);
  });
});
