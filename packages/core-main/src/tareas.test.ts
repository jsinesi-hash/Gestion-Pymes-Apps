import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { ejecutarSeguro, programarTareaSegura, registrarErroresNoCapturados } from './tareas';
import { registroErrores } from './registro-errores';

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

// ADR-140: además de ir al log, los errores de los jobs y los no capturados quedan en el registro de
// errores del sistema, que un Supervisor consulta en Backup y restauración.
describe('errores registrados en el registro del sistema', () => {
  afterEach(() => registroErrores.limpiar());

  it('un job que falla (síncrono) queda registrado con origen tarea:<nombre>', () => {
    registroErrores.limpiar();
    ejecutarSeguro('cambios-programados', () => { throw new Error('SQLITE_BUSY'); }, vi.fn());
    const [e] = registroErrores.listar();
    expect(e!.origen).toBe('tarea:cambios-programados');
    expect(e!.mensaje).toBe('SQLITE_BUSY');
  });

  it('un job asíncrono que rechaza también queda registrado', async () => {
    registroErrores.limpiar();
    await ejecutarSeguro('avisos-reintentos', async () => { throw new Error('SMTP caído'); }, vi.fn());
    expect(registroErrores.listar().map((x) => x.origen)).toEqual(['tarea:avisos-reintentos']);
  });

  it('se registra aunque el que llama pase su propia función de log', () => {
    registroErrores.limpiar();
    const log = vi.fn();
    ejecutarSeguro('presupuestos-vencidos', () => { throw new Error('x'); }, log);
    expect(log).toHaveBeenCalled();
    expect(registroErrores.listar()).toHaveLength(1);
  });

  it('un job que anda no registra nada', () => {
    registroErrores.limpiar();
    ejecutarSeguro('ok', () => 1, vi.fn());
    expect(registroErrores.listar()).toEqual([]);
  });

  it('cada tick que falla se registra, y los siguientes siguen corriendo', () => {
    vi.useFakeTimers();
    registroErrores.limpiar();
    const timer = programarTareaSegura('job', 1000, () => { throw new Error('boom'); }, vi.fn());
    vi.advanceTimersByTime(3000);
    clearInterval(timer);
    vi.useRealTimers();
    expect(registroErrores.listar()).toHaveLength(3);
  });

  it('los errores no capturados del proceso se registran con origen main:<evento>', () => {
    registroErrores.limpiar();
    const proc = new EventEmitter();
    registrarErroresNoCapturados(proc, vi.fn());
    proc.emit('uncaughtException', new Error('caída inesperada'));
    proc.emit('unhandledRejection', new Error('promesa suelta'));
    const porOrigen = Object.fromEntries(registroErrores.listar().map((x) => [x.origen, x.mensaje]));
    expect(porOrigen['main:uncaughtException']).toBe('caída inesperada');
    expect(porOrigen['main:unhandledRejection']).toBe('promesa suelta');
  });

  it('un fallo del registro no impide loguear ni propaga nada', () => {
    registroErrores.limpiar();
    registroErrores.persistirEn({ cargar: () => [], guardar: () => { throw new Error('disco lleno'); } });
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.fn();
    expect(() => ejecutarSeguro('job', () => { throw new Error('x'); }, log)).not.toThrow();
    expect(log).toHaveBeenCalled();
    registroErrores.persistirEn(null);
    consola.mockRestore();
  });
});
