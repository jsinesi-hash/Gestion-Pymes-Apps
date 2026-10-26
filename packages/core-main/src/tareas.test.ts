import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { ejecutarSeguro, programarTareaSegura, registrarErroresNoCapturados } from './tareas';

// Revisión 2026-10-20 (P0): `applyPendingCambiosProgramados` y `presupuestoVencerLoteHandler` corrían
// sin try/catch al arrancar y dentro de `setInterval` (un error de SQLite como SQLITE_BUSY tumbaba
// el proceso main), y el worker de avisos usaba `.catch(() => {})` (fallo sin rastro). Además no
// había handlers de `uncaughtException`/`unhandledRejection`.
describe('ejecutarSeguro', () => {
  it('devuelve el resultado cuando la tarea anda', () => {
    expect(ejecutarSeguro('ok', () => 42, vi.fn())).toBe(42);
  });

  it('un throw síncrono se registra con el nombre de la tarea y no se propaga', () => {
    const log = vi.fn();
    const error = new Error('SQLITE_BUSY');
    expect(() => ejecutarSeguro('precios', () => { throw error; }, log)).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('precios'), error);
  });

  it('un rechazo asíncrono se registra y la promesa devuelta nunca rechaza', async () => {
    const log = vi.fn();
    const error = new Error('fallo async');
    await expect(ejecutarSeguro('avisos', async () => { throw error; }, log)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('avisos'), error);
  });
});

describe('programarTareaSegura', () => {
  afterEach(() => vi.useRealTimers());

  it('un tick que falla no frena los siguientes', () => {
    vi.useFakeTimers();
    const log = vi.fn();
    let n = 0;
    const timer = programarTareaSegura('job', 1000, () => { n += 1; if (n === 1) throw new Error('boom'); }, log);
    vi.advanceTimersByTime(3000);
    clearInterval(timer);
    expect(n).toBe(3);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('con ejecutarAlInicio corre una vez de inmediato (también protegida)', () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const fn = vi.fn(() => { throw new Error('al inicio'); });
    const timer = programarTareaSegura('job', 1000, fn, log, { ejecutarAlInicio: true });
    clearInterval(timer);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('registrarErroresNoCapturados', () => {
  it('registra uncaughtException y unhandledRejection sin cortar el proceso', () => {
    const proc = new EventEmitter();
    const log = vi.fn();
    registrarErroresNoCapturados(proc, log);

    const e1 = new Error('no capturado');
    const e2 = new Error('promesa rechazada');
    expect(() => proc.emit('uncaughtException', e1)).not.toThrow();
    expect(() => proc.emit('unhandledRejection', e2)).not.toThrow();

    expect(log).toHaveBeenCalledWith(expect.stringContaining('uncaughtException'), e1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('unhandledRejection'), e2);
  });

  it('es idempotente: registrarlo dos veces no duplica el log', () => {
    const proc = new EventEmitter();
    const log = vi.fn();
    registrarErroresNoCapturados(proc, log);
    registrarErroresNoCapturados(proc, log);
    proc.emit('uncaughtException', new Error('x'));
    expect(log).toHaveBeenCalledTimes(1);
  });
});
