import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { intercambiarBaseDeDatos, rutaDeBaseDeDatos, RestoreSwapError } from './swap-bd';

// Revisión 2026-10-20 (P0): el swap del restore cerraba la conexión y, si fallaba, el rollback
// era `catch {}` vacío (la BD podía quedar ausente sin rastro) y un `unlink` fallido DESPUÉS de
// un swap exitoso revertía el restore pisando la BD nueva con la vieja.
describe('intercambiarBaseDeDatos', () => {
  let dir: string;
  let dbPath: string;
  let tempPath: string;
  let bakPath: string;
  const leer = (p: string) => fs.readFileSync(p, 'utf8');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swap-bd-test-'));
    dbPath = path.join(dir, 'app.db');
    tempPath = path.join(dir, 'app.db.restoring');
    bakPath = dbPath + '.pre-restore.bak';
    fs.writeFileSync(dbPath, 'ORIGINAL');
    fs.writeFileSync(tempPath, 'RESTAURADA');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('camino feliz: cierra la conexión primero, deja la BD restaurada y borra el .bak', () => {
    const orden: string[] = [];
    const renombrar = vi.fn((a: string, b: string) => { orden.push(`rename:${path.basename(a)}`); fs.renameSync(a, b); });
    intercambiarBaseDeDatos({ dbPath, tempPath, cerrarConexion: () => orden.push('cerrar'), renombrar });
    expect(orden[0]).toBe('cerrar');
    expect(leer(dbPath)).toBe('RESTAURADA');
    expect(fs.existsSync(bakPath)).toBe(false);
  });

  it('si falla el rename de la BD restaurada, vuelve la original y lanza RESTORE_SWAP_FALLIDO', () => {
    const renombrar = (a: string, b: string) => {
      if (a === tempPath) throw new Error('EBUSY simulado');
      fs.renameSync(a, b);
    };
    const intento = () => intercambiarBaseDeDatos({ dbPath, tempPath, cerrarConexion: () => {}, renombrar });
    expect(intento).toThrow(RestoreSwapError);
    expect(intento).toThrow(/RESTORE_SWAP_FALLIDO/);
    expect(leer(dbPath)).toBe('ORIGINAL');
  });

  it('si falla también el rollback lanza RESTORE_ROLLBACK_FALLIDO con la ruta del .bak y la deja en disco', () => {
    const log = vi.fn();
    const renombrar = (a: string, b: string) => {
      if (a === tempPath) throw new Error('EBUSY simulado');
      if (a === bakPath) throw new Error('EPERM simulado');
      fs.renameSync(a, b);
    };
    let error: unknown;
    try {
      intercambiarBaseDeDatos({ dbPath, tempPath, cerrarConexion: () => {}, renombrar, log });
    } catch (e) { error = e; }
    expect(error).toBeInstanceOf(RestoreSwapError);
    const err = error as RestoreSwapError;
    expect(err.code).toBe('RESTORE_ROLLBACK_FALLIDO');
    expect(err.bakPath).toBe(bakPath);
    expect(err.message).toContain(bakPath);
    expect(fs.existsSync(bakPath)).toBe(true);
    expect(leer(bakPath)).toBe('ORIGINAL');
    // el fallo del rollback queda registrado con las rutas, no se traga en silencio
    expect(log).toHaveBeenCalledWith(expect.stringContaining(bakPath), expect.anything());
  });

  it('si falla mover la BD original al .bak, la deja intacta y lanza RESTORE_SWAP_FALLIDO', () => {
    const renombrar = (a: string, b: string) => {
      if (a === dbPath) throw new Error('EBUSY simulado');
      fs.renameSync(a, b);
    };
    expect(() => intercambiarBaseDeDatos({ dbPath, tempPath, cerrarConexion: () => {}, renombrar }))
      .toThrow(/RESTORE_SWAP_FALLIDO/);
    expect(leer(dbPath)).toBe('ORIGINAL');
  });

  it('un fallo al borrar el .bak DESPUÉS de un swap exitoso NO revierte el restore', () => {
    const log = vi.fn();
    const borrar = () => { throw new Error('EPERM simulado'); };
    intercambiarBaseDeDatos({ dbPath, tempPath, cerrarConexion: () => {}, borrar, log });
    expect(leer(dbPath)).toBe('RESTAURADA');
    expect(log).toHaveBeenCalled();
  });
});

describe('rutaDeBaseDeDatos', () => {
  it('toma la ruta de la propia conexión (sirve para ferreteria.db y elaborados.db)', () => {
    expect(rutaDeBaseDeDatos({ $client: { name: 'C:\\datos\\elaborados.db' } })).toBe('C:\\datos\\elaborados.db');
  });

  it.each([':memory:', '', undefined])('rechaza una conexión sin archivo (%j)', (name) => {
    expect(() => rutaDeBaseDeDatos({ $client: { name } })).toThrow('RESTORE_RUTA_BD');
  });
});
