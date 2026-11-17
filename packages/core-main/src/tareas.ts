import type { EventEmitter } from 'node:events';
import { registroErrores } from './registro-errores';
import { esTerminalCoordinadora } from './context';

// Revisión 2026-10-20 (P0): tareas en segundo plano del main (scheduler de precios, vencimiento de
// presupuestos, worker de avisos) y errores no capturados. Un error en un tick no debe tumbar el
// proceso ni dejar el job muerto sin rastro.

export type LogFn = (mensaje: string, detalle?: unknown) => void;

const logPorDefecto: LogFn = (mensaje, detalle) => console.error(mensaje, detalle);

type Resultado<T> = T extends PromiseLike<infer U> ? Promise<U | undefined> : T | undefined;

/**
 * Ejecuta `fn` sin propagar errores: los registra con el nombre de la tarea. Si `fn` es asíncrona
 * devuelve una promesa que nunca rechaza (evita `unhandledRejection` y el `.catch(() => {})` mudo).
 */
export function ejecutarSeguro<T>(nombre: string, fn: () => T, log: LogFn = logPorDefecto): Resultado<T> {
  // ADR-140: además del log, el error queda en el registro del sistema que ve el Supervisor.
  const registrar = (e: unknown) => {
    registroErrores.registrar(`tarea:${nombre}`, e);
    log(`[tarea:${nombre}] falló:`, e);
    return undefined;
  };
  try {
    const r = fn();
    if (r && typeof (r as { then?: unknown }).then === 'function') {
      return (r as unknown as Promise<unknown>).then(undefined, registrar) as Resultado<T>;
    }
    return r as Resultado<T>;
  } catch (e) {
    return registrar(e) as Resultado<T>;
  }
}

/**
 * ADR-152: `coordinada` escribe tablas que sincronizan (corre solo en la terminal coordinadora);
 * `local` escribe estado de la terminal (corre en cada una). Toda tarea lo declara: es obligatorio
 * en la firma, así una tarea nueva sin tipo no compila.
 */
export type TipoTarea = 'coordinada' | 'local';

export interface TareaOpts {
  tipo: TipoTarea;
  /** Corre una vez de inmediato (también protegida) antes de programar el intervalo. */
  ejecutarAlInicio?: boolean;
}

const registradas = new Map<string, TipoTarea>();

/** Tareas registradas en este proceso con su tipo (diagnóstico y tests). */
export function tareasRegistradas(): { nombre: string; tipo: TipoTarea }[] {
  return [...registradas].map(([nombre, tipo]) => ({ nombre, tipo }));
}

function ejecutarSiCorresponde(nombre: string, tipo: TipoTarea, fn: () => unknown, log: LogFn) {
  if (tipo === 'coordinada' && !esTerminalCoordinadora()) return undefined;
  return ejecutarSeguro(nombre, fn, log);
}

/** `setInterval` donde cada tick (y el inicial, si se pide) va por `ejecutarSeguro`. */
export function programarTareaSegura(
  nombre: string,
  intervaloMs: number,
  fn: () => unknown,
  log: LogFn = logPorDefecto,
  opts: TareaOpts,
): ReturnType<typeof setInterval> {
  registradas.set(nombre, opts.tipo);
  if (opts.ejecutarAlInicio) void ejecutarSiCorresponde(nombre, opts.tipo, fn, log);
  return setInterval(() => { void ejecutarSiCorresponde(nombre, opts.tipo, fn, log); }, intervaloMs);
}

/** Una tarea que corre una sola vez (p. ej. al arrancar), protegida y con su tipo declarado. */
export function ejecutarTareaUnica(nombre: string, tipo: TipoTarea, fn: () => unknown, log: LogFn = logPorDefecto): void {
  registradas.set(nombre, tipo);
  void ejecutarSiCorresponde(nombre, tipo, fn, log);
}

const MARCA_REGISTRADO = Symbol.for('@core/main.erroresNoCapturados');

/**
 * Registra `uncaughtException` y `unhandledRejection` para dejarlos en el log en vez de cortar el
 * proceso en plena operación. Idempotente por proceso.
 */
export function registrarErroresNoCapturados(
  proc: EventEmitter = process,
  log: LogFn = logPorDefecto,
): void {
  const marcado = proc as unknown as Record<symbol, boolean>;
  if (marcado[MARCA_REGISTRADO]) return;
  marcado[MARCA_REGISTRADO] = true;
  proc.on('uncaughtException', (e: unknown) => {
    registroErrores.registrar('main:uncaughtException', e);
    log('[main] uncaughtException:', e);
  });
  proc.on('unhandledRejection', (e: unknown) => {
    registroErrores.registrar('main:unhandledRejection', e);
    log('[main] unhandledRejection:', e);
  });
}
