import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { restoreValidarHandler } from '../restore';
import { backupEjecutarHandler } from '../backup';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-h-'));
  clearSession();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('restoreValidarHandler', () => {
  it('lanza FORBIDDEN sin sesión', async () => {
    const db = setupDb();
    await expect(
      restoreValidarHandler(db, { ruta: '/cualquier.fbk' })
    ).rejects.toThrow('FORBIDDEN');
  });

  it('retorna error para archivo inexistente', async () => {
    const db = setupDb();
    loginAsAdmin(db);
    const result = await restoreValidarHandler(db, { ruta: path.join(tmpDir, 'no-existe.fbk') });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('retorna resultado válido para un .fbk correcto', async () => {
    const db = setupDb();
    loginAsAdmin(db);
    const ruta = await backupEjecutarHandler(db, { tipo: 'manual', destino: tmpDir, appVersion: '1.0.0', sucursalId: 's1' });

    const result = await restoreValidarHandler(db, { ruta });
    expect(result.ok).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.row_counts_actuales).toBeDefined();
  });
});
