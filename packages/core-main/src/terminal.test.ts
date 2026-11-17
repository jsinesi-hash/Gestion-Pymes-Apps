import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cargarConfigTerminal, iniciarTerminal } from './terminal';
import { getOriginId, setOriginId } from './context';

// Revisión 2026-10-20 (P2): `config.ts` (load + write de config.json) estaba duplicado en Retail y
// Elaborados, y el origin_id se aplicaba en otro paso (P0). Ahora es una sola función del núcleo.
let dir: string;
let aviso: ReturnType<typeof vi.spyOn>;
const archivo = () => path.join(dir, 'config.json');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-test-'));
  aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
  setOriginId('C1');
});
afterEach(() => { aviso.mockRestore(); setOriginId('C1'); fs.rmSync(dir, { recursive: true, force: true }); });

describe('cargarConfigTerminal', () => {
  it('sin config.json crea uno con el origin_id por defecto (C1)', () => {
    expect(cargarConfigTerminal(dir)).toEqual({ origin_id: 'C1', modo: 'standalone' });
    expect(JSON.parse(fs.readFileSync(archivo(), 'utf8'))).toEqual({ origin_id: 'C1', modo: 'standalone' });
  });

  it('respeta el origin_id de un config.json existente y no lo reescribe distinto', () => {
    fs.writeFileSync(archivo(), JSON.stringify({ origin_id: 'C2' }));
    expect(cargarConfigTerminal(dir)).toEqual({ origin_id: 'C2', modo: 'standalone' });
    expect(JSON.parse(fs.readFileSync(archivo(), 'utf8'))).toEqual({ origin_id: 'C2', modo: 'standalone' });
  });

  it('un config.json ilegible cae al valor por defecto y lo avisa (no se queda callado)', () => {
    fs.writeFileSync(archivo(), '{ esto no es json');
    expect(cargarConfigTerminal(dir)).toEqual({ origin_id: 'C1', modo: 'standalone' });
    expect(aviso).toHaveBeenCalled();
  });

  it('no toca el origin_id activo del proceso (eso lo hace iniciarTerminal)', () => {
    fs.writeFileSync(archivo(), JSON.stringify({ origin_id: 'C5' }));
    cargarConfigTerminal(dir);
    expect(getOriginId()).toBe('C1');
  });
});

describe('iniciarTerminal', () => {
  it('carga la config y aplica el origin_id al contexto del main', () => {
    fs.writeFileSync(archivo(), JSON.stringify({ origin_id: 'C3' }));
    expect(iniciarTerminal(dir)).toEqual({ origin_id: 'C3', modo: 'standalone' });
    expect(getOriginId()).toBe('C3');
  });

  it('un config.json viejo (sin modo) queda en standalone y se reescribe con el modo', () => {
    fs.writeFileSync(archivo(), JSON.stringify({ origin_id: 'C4' }));
    expect(iniciarTerminal(dir)).toEqual({ origin_id: 'C4', modo: 'standalone' });
    expect(JSON.parse(fs.readFileSync(archivo(), 'utf8'))).toEqual({ origin_id: 'C4', modo: 'standalone' });
  });

  it('un modo que esta versión no soporta lanza MODO_TERMINAL_NO_SOPORTADO', () => {
    fs.writeFileSync(archivo(), JSON.stringify({ origin_id: 'C4', modo: 'distribuido' }));
    expect(() => iniciarTerminal(dir)).toThrow('MODO_TERMINAL_NO_SOPORTADO');
    expect(getOriginId()).toBe('C1');
  });

  it('un origin_id inválido en el archivo lanza TERMINAL_INVALIDA y no cambia el activo', () => {
    fs.writeFileSync(archivo(), JSON.stringify({ origin_id: 'C 7!' }));
    expect(() => iniciarTerminal(dir)).toThrow('TERMINAL_INVALIDA');
    expect(getOriginId()).toBe('C1');
  });
});
