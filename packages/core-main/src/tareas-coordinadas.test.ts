import { describe, it, expect, vi, afterEach } from 'vitest';
import { programarTareaSegura, ejecutarTareaUnica, tareasRegistradas } from './tareas';
import { aplicarConfigTerminal, esTerminalCoordinadora, getModoTerminal, setModoTerminal } from './context';
import { uuidDeterminista, uuidV5 } from './ids';

// F1 PR8 (ADR-152, ADR-156): cada tarea declara si es coordinada o local; las coordinadas corren
// solo en la terminal coordinadora (en standalone, siempre). Ids deterministas como respaldo.
afterEach(() => { vi.useRealTimers(); setModoTerminal('standalone'); });

describe('modo de la terminal', () => {
  it('por defecto es standalone y la terminal es coordinadora', () => {
    expect(getModoTerminal()).toBe('standalone');
    expect(esTerminalCoordinadora()).toBe(true);
  });

  it('en esta versión solo se acepta standalone: otro modo en config.json lanza y no cambia nada', () => {
    expect(() => aplicarConfigTerminal({ origin_id: 'C1', modo: 'distribuido' })).toThrow('MODO_TERMINAL_NO_SOPORTADO');
    expect(() => aplicarConfigTerminal({ origin_id: 'C1', modo: 'otro' as never })).toThrow('MODO_TERMINAL_NO_SOPORTADO');
    expect(getModoTerminal()).toBe('standalone');
  });

  it('una terminal en modo distribuido no es coordinadora hasta que el hub le dé el permiso (F2)', () => {
    setModoTerminal('distribuido');
    expect(esTerminalCoordinadora()).toBe(false);
  });
});

describe('tareas coordinadas y locales', () => {
  it('cada tarea queda registrada con su tipo', () => {
    vi.useFakeTimers();
    const a = programarTareaSegura('tarea-local-x', 1000, () => {}, vi.fn(), { tipo: 'local' });
    const b = programarTareaSegura('tarea-coord-x', 1000, () => {}, vi.fn(), { tipo: 'coordinada' });
    clearInterval(a); clearInterval(b);
    expect(tareasRegistradas()).toEqual(expect.arrayContaining([
      { nombre: 'tarea-local-x', tipo: 'local' },
      { nombre: 'tarea-coord-x', tipo: 'coordinada' },
    ]));
  });

  it('una coordinada no corre si la terminal no es coordinadora; una local corre igual', () => {
    vi.useFakeTimers();
    setModoTerminal('distribuido');
    const coord = vi.fn();
    const local = vi.fn();
    const a = programarTareaSegura('coord', 1000, coord, vi.fn(), { tipo: 'coordinada', ejecutarAlInicio: true });
    const b = programarTareaSegura('local', 1000, local, vi.fn(), { tipo: 'local', ejecutarAlInicio: true });
    vi.advanceTimersByTime(2000);
    clearInterval(a); clearInterval(b);
    expect(coord).not.toHaveBeenCalled();
    expect(local).toHaveBeenCalledTimes(3);
  });

  it('ejecutarTareaUnica corre una vez, protegida, y respeta el tipo', () => {
    const fn = vi.fn(() => { throw new Error('boom'); });
    expect(() => ejecutarTareaUnica('catchup', 'coordinada', fn, vi.fn())).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
    setModoTerminal('distribuido');
    ejecutarTareaUnica('catchup', 'coordinada', fn, vi.fn());
    expect(fn).toHaveBeenCalledTimes(1);
    expect(tareasRegistradas()).toEqual(expect.arrayContaining([{ nombre: 'catchup', tipo: 'coordinada' }]));
  });
});

describe('uuidDeterminista', () => {
  it('implementa UUID v5 (RFC 4122): vector conocido', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });

  it('las mismas partes dan el mismo id, en cualquier terminal; partes distintas, ids distintos', () => {
    const a = uuidDeterminista('agenda_evento', 'rutina-1', '1700000000000');
    expect(uuidDeterminista('agenda_evento', 'rutina-1', '1700000000000')).toBe(a);
    expect(uuidDeterminista('agenda_evento', 'rutina-1', '1700000060000')).not.toBe(a);
    expect(uuidDeterminista('agenda_evento', 'rutina-1|1700000000000')).not.toBe(a); // sin colisión por separador
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
