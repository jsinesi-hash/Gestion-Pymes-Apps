import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VAR_USER_DATA, resolverUserDataAislado, aplicarUserDataAislado } from './userdata-aislado';

// Verificación en la app real (2026-11-02): `pnpm dev` con `APPDATA` apuntando a una carpeta temporal
// abrió igual la BD real, porque Electron resuelve `userData` por la API de Windows y no por el
// entorno. Esta variable es el único aislamiento garantizado: se aplica ANTES de abrir la BD y, si
// está mal puesta, falla en vez de caer en silencio a los datos reales.
let base: string;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'userdata-aislado-')); });
afterEach(() => { fs.rmSync(base, { recursive: true, force: true }); });

describe('resolverUserDataAislado', () => {
  it('sin la variable no hace nada (null): la app usa su userData normal', () => {
    expect(resolverUserDataAislado({})).toBeNull();
    expect(resolverUserDataAislado({ [VAR_USER_DATA]: '' })).toBeNull();
    expect(resolverUserDataAislado({ [VAR_USER_DATA]: '   ' })).toBeNull();
  });

  it('con una ruta absoluta devuelve la ruta normalizada', () => {
    const d = path.join(base, 'x', '..', 'datos');
    expect(resolverUserDataAislado({ [VAR_USER_DATA]: d })).toBe(path.join(base, 'datos'));
  });

  it('una ruta relativa es un error (no se adivina contra qué carpeta)', () => {
    expect(() => resolverUserDataAislado({ [VAR_USER_DATA]: 'datos-de-prueba' })).toThrow(VAR_USER_DATA);
  });
});

describe('aplicarUserDataAislado', () => {
  it('crea la carpeta, fija userData y avisa por consola', () => {
    const setPath = vi.fn();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const destino = path.join(base, 'aislado', 'datos');
    const r = aplicarUserDataAislado({ setPath }, { [VAR_USER_DATA]: destino });
    expect(r).toBe(destino);
    expect(fs.statSync(destino).isDirectory()).toBe(true);
    expect(setPath).toHaveBeenCalledWith('userData', destino);
    expect(log.mock.calls.flat().join(' ')).toContain(destino);
    log.mockRestore();
  });

  it('sin la variable no toca nada', () => {
    const setPath = vi.fn();
    expect(aplicarUserDataAislado({ setPath }, {})).toBeNull();
    expect(setPath).not.toHaveBeenCalled();
  });

  it('si no puede crear la carpeta, falla sin tocar userData', () => {
    const setPath = vi.fn();
    const archivo = path.join(base, 'es-un-archivo');
    fs.writeFileSync(archivo, 'x');
    expect(() => aplicarUserDataAislado({ setPath }, { [VAR_USER_DATA]: path.join(archivo, 'sub') })).toThrow();
    expect(setPath).not.toHaveBeenCalled();
  });
});
