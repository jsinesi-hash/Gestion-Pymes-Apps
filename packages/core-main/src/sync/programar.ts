// Frecuencia del sync (ADR-150 §9, ADR-152): push agrupado unos segundos después de cada cambio y
// pull periódico. Las dos son tareas `local`: cada terminal sincroniza lo suyo. F2 PR5 (ADR-152 §2): la
// renovación del permiso de coordinadora y los bloques de correlativos, y las alertas después del pull,
// que son `coordinada` (corren solo en la coordinadora).
import { ejecutarTareaUnica, programarTareaSegura, type LogFn } from '../tareas';
import { esErrorDeConexion, type ClienteSync } from './cliente';
import type { CoordinacionTerminal } from './coordinacion';

export interface OpcionesProgramarSync {
  /** Cada cuánto se mira la cola: los cambios de esos segundos suben juntos. */
  readonly intervaloPushMs?: number;
  /** Cada cuánto se baja lo del hub (parámetro; segundos en la red local). */
  readonly intervaloPullMs?: number;
  /** Cada cuánto se renueva el permiso de coordinadora (bien por debajo de su vigencia) y se miran los bloques. */
  readonly intervaloCoordinacionMs?: number;
  readonly log?: LogFn;
}

/** Lo que el modo distribuido le suma al sync (F2 PR5). */
export interface ExtrasProgramarSync {
  readonly coordinacion?: CoordinacionTerminal;
  /** Tarea coordinada después de cada pull (ADR-153 §4: alertas de stock negativo y crédito). */
  readonly despuesDelPull?: () => unknown;
}

export const INTERVALO_PUSH_MS = 3_000;
export const INTERVALO_PULL_MS = 15_000;
export const INTERVALO_COORDINACION_MS = 30_000;

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

export function programarSync(cliente: ClienteSync, o: OpcionesProgramarSync & ExtrasProgramarSync = {}): { detener(): void } {
  const push = programarTareaSegura('sync:push', o.intervaloPushMs ?? INTERVALO_PUSH_MS,
    tolerante(() => cliente.pushSiHayPendientes()), o.log, { tipo: 'local' });
  const pull = programarTareaSegura('sync:pull', o.intervaloPullMs ?? INTERVALO_PULL_MS,
    tolerante(async () => {
      await cliente.sincronizar();
      if (o.despuesDelPull) ejecutarTareaUnica('sync:alertas', 'coordinada', o.despuesDelPull, o.log);
    }), o.log, { tipo: 'local', ejecutarAlInicio: true });
  const c = o.coordinacion;
  const coordinacion = c ? programarTareaSegura('sync:coordinacion', o.intervaloCoordinacionMs ?? INTERVALO_COORDINACION_MS,
    tolerante(async () => { await c.renovar(); await c.revisarBloques(); }), o.log, { tipo: 'local', ejecutarAlInicio: true }) : null;
  return {
    detener() {
      clearInterval(push);
      clearInterval(pull);
      if (coordinacion) clearInterval(coordinacion);
    },
  };
}
