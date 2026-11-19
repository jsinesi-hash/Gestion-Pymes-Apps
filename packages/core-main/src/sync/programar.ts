// Frecuencia del sync (ADR-150 §9, ADR-152): push agrupado unos segundos después de cada cambio y
// pull periódico. Las dos son tareas `local`: cada terminal sincroniza lo suyo.
import { programarTareaSegura, type LogFn } from '../tareas';
import { esErrorDeConexion, type ClienteSync } from './cliente';

export interface OpcionesProgramarSync {
  /** Cada cuánto se mira la cola: los cambios de esos segundos suben juntos. */
  readonly intervaloPushMs?: number;
  /** Cada cuánto se baja lo del hub (parámetro; segundos en la red local). */
  readonly intervaloPullMs?: number;
  readonly log?: LogFn;
}

export const INTERVALO_PUSH_MS = 3_000;
export const INTERVALO_PULL_MS = 15_000;

/**
 * Sin conexión la terminal sigue operando y la cola crece: un corte no es una falla del código y no
 * llena el registro de errores (queda en `cliente.estado()`). Cualquier otro error se registra una
 * vez, no en cada tick, hasta que cambie.
 */
function tolerante(fn: () => Promise<unknown>): () => Promise<unknown> {
  let ultimo: string | null = null;
  return async () => {
    try {
      await fn();
      ultimo = null;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (esErrorDeConexion(e) || m === ultimo) return;
      ultimo = m;
      throw e;
    }
  };
}

export function programarSync(cliente: ClienteSync, o: OpcionesProgramarSync = {}): { detener(): void } {
  const push = programarTareaSegura('sync:push', o.intervaloPushMs ?? INTERVALO_PUSH_MS,
    tolerante(() => cliente.pushSiHayPendientes()), o.log, { tipo: 'local' });
  const pull = programarTareaSegura('sync:pull', o.intervaloPullMs ?? INTERVALO_PULL_MS,
    tolerante(() => cliente.sincronizar()), o.log, { tipo: 'local', ejecutarAlInicio: true });
  return {
    detener() {
      clearInterval(push);
      clearInterval(pull);
    },
  };
}
