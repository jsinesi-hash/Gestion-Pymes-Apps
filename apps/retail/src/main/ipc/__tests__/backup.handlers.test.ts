import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDb, setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  backupEjecutarHandler,
  backupListarHandler,
  backupEliminarHandler,
  evaluarDepuracionCore,
  backupDepurarHandler,
  leerPolitica,
} from '../backup';
import { parametrosSetHandler } from '../parametros';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-handler-'));
  clearSession();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('backupEjecutarHandler', () => {
  it('lanza FORBIDDEN sin sesión activa', async () => {
    const db = setupDb();
    await expect(
      backupEjecutarHandler(db, { tipo: 'manual', destino: tmpDir, appVersion: '1.0.0', sucursalId: 's1' })
    ).rejects.toThrow('FORBIDDEN');
  });

  it('crea .fbk en el directorio destino cuando el usuario tiene permiso', async () => {
    const db = setupDb();
    loginAsAdmin(db);

    const ruta = await backupEjecutarHandler(db, {
      tipo: 'manual',
      destino: tmpDir,
      appVersion: '1.0.0',
      sucursalId: 's1',
    });

    expect(fs.existsSync(ruta)).toBe(true);
    expect(ruta.endsWith('.fbk')).toBe(true);
  });

  it('backupEjecutarHandler ya no borra backups viejos (sin rotación automática)', async () => {
    const db = setupDb();
    await loginAsAdmin(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbk-norot-'));
    await backupEjecutarHandler(db, { tipo: 'auto', destino: dir, appVersion: '1.0.0', sucursalId: 'C1' });
    await new Promise(r => setTimeout(r, 1100));
    await backupEjecutarHandler(db, { tipo: 'auto', destino: dir, appVersion: '1.0.0', sucursalId: 'C1' });
    const restantes = fs.readdirSync(dir).filter(f => f.endsWith('.fbk'));
    expect(restantes.length).toBe(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('backupListarHandler', () => {
  it('retorna lista vacía si el destino no existe', async () => {
    const db = setupDb();
    loginAsAdmin(db);
    const lista = await backupListarHandler(db, { directorio: path.join(tmpDir, 'vacio') });
    expect(lista).toEqual([]);
  });

  it('lista los backups existentes en el directorio', async () => {
    const db = setupDb();
    loginAsAdmin(db);

    await backupEjecutarHandler(db, { tipo: 'auto', destino: tmpDir, appVersion: '1.0.0', sucursalId: 's1' });
    const lista = await backupListarHandler(db, { directorio: tmpDir });

    expect(lista.length).toBe(1);
    expect(lista[0].tipo).toBe('auto');
  });
});

describe('backupEliminarHandler', () => {
  it('lanza FORBIDDEN sin sesión', async () => {
    const db = setupDb();
    await expect(
      backupEliminarHandler(db, { ruta: '/cualquier/archivo.fbk' })
    ).rejects.toThrow('FORBIDDEN');
  });

  it('elimina el archivo .fbk indicado', async () => {
    const db = setupDb();
    loginAsAdmin(db);

    const rutaFbk = await backupEjecutarHandler(db, { tipo: 'manual', destino: tmpDir, appVersion: '1.0.0', sucursalId: 's1' });
    expect(fs.existsSync(rutaFbk)).toBe(true);

    await backupEliminarHandler(db, { ruta: rutaFbk });
    expect(fs.existsSync(rutaFbk)).toBe(false);
  });

  it('no permite eliminar archivos fuera de extensión .fbk', async () => {
    const db = setupDb();
    loginAsAdmin(db);
    await expect(
      backupEliminarHandler(db, { ruta: path.join(tmpDir, 'ferreteria.db') })
    ).rejects.toThrow('INVALID_PATH');
  });
});

describe('migración 0042 — parámetros de retención', () => {
  it('la migración 0042 siembra los parámetros de retención', () => {
    const db = createTestDb();
    const get = (clave: string) =>
      (db as any).$client.prepare('SELECT valor FROM parametros_sistema WHERE clave = ?').get(clave)?.valor;
    expect(get('backup_retencion_cantidad')).toBe('10');
    expect(get('backup_retencion_piso')).toBe('3');
    expect(get('backup_retencion_size_mb')).toBe('0');
  });
});

describe('evaluarDepuracionCore', () => {
  it('propone auto viejos y respeta piso', async () => {
    const db = setupDb();
    loginAsAdmin(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbk-eval-'));
    for (let i = 0; i < 5; i++) {
      await backupEjecutarHandler(db, { tipo: 'auto', destino: dir, appVersion: '1.0.0', sucursalId: 'C1' });
      if (i < 4) await new Promise(r => setTimeout(r, 1100)); // evita colisión de nombre por timestamp a segundos
    }
    const politica = { cantidad: 2, dias: 0, piso: 1, sizeMb: 0 };
    const r = await evaluarDepuracionCore(db, [dir], politica);
    expect(r.candidatos.length).toBe(3); // 5 auto, dias=0 no protege por edad, N=2 -> 3 candidatos
    fs.rmSync(dir, { recursive: true, force: true });
  }, 15000); // 4x sleep de 1100ms + overhead: cerca del timeout default bajo carga de la suite completa

  it('no cuenta doble cuando la misma carpeta aparece repetida', async () => {
    const db = setupDb();
    loginAsAdmin(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbk-dup-'));
    const rutaViejo = await backupEjecutarHandler(db, { tipo: 'auto', destino: dir, appVersion: '1.0.0', sucursalId: 'C1' });
    await new Promise(r => setTimeout(r, 1100)); // timestamp a segundos: evita colisión de nombre
    await backupEjecutarHandler(db, { tipo: 'auto', destino: dir, appVersion: '1.0.0', sucursalId: 'C1' });
    const politica = { cantidad: 1, dias: 0, piso: 1, sizeMb: 0 };
    const bytesViejo = fs.statSync(rutaViejo).size;
    // Con la carpeta pasada dos veces, el resultado debe ser idéntico a pasarla una sola vez.
    const r = await evaluarDepuracionCore(db, [dir, dir], politica);
    expect(r.candidatos.length).toBe(1);          // N=1 protege el más nuevo; el viejo es el único candidato
    expect(r.bytesALiberar).toBe(bytesViejo);     // no duplicado
    fs.rmSync(dir, { recursive: true, force: true });
  }, 15000);
});

describe('leerPolitica', () => {
  it('nunca deja el piso por debajo de 1 aunque el parámetro sea 0', () => {
    const db = setupDb();
    loginAsAdmin(db);
    parametrosSetHandler(db, { clave: 'backup_retencion_piso', valor: '0' });
    expect(leerPolitica(db).piso).toBe(1);
  });
});

describe('backupDepurarHandler', () => {
  it('backupDepurar borra sólo auto válidas bajo carpetas conocidas y cuenta bytes', async () => {
    const db = setupDb();
    await loginAsAdmin(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbk-dep-'));
    // registrar la carpeta como destino conocido para que la validación la acepte
    parametrosSetHandler(db, { clave: 'backup_destino_local', valor: dir });

    const rutaAuto = await backupEjecutarHandler(db, { tipo: 'auto', destino: dir, appVersion: '1.0.0', sucursalId: 'C1' });
    await new Promise(r => setTimeout(r, 1100)); // evita colisión de nombre por timestamp a segundos
    const rutaManual = await backupEjecutarHandler(db, { tipo: 'manual', destino: dir, appVersion: '1.0.0', sucursalId: 'C1' });

    const res = await backupDepurarHandler(db, { rutas: [rutaAuto, rutaManual, '/x/y.txt'] });
    expect(res.eliminados).toBe(1);                 // sólo la auto
    expect(fs.existsSync(rutaAuto)).toBe(false);
    expect(fs.existsSync(rutaManual)).toBe(true);   // manual intacta
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('backupDepurar sin permiso backup.crear lanza FORBIDDEN', async () => {
    const db = setupDb();
    // sin login -> sin sesión -> sin permiso
    await expect(backupDepurarHandler(db, { rutas: [] })).rejects.toThrow('FORBIDDEN');
  });
});
