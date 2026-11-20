let _originId = 'C1';

export function setOriginId(id: string): void {
  _originId = id;
}

export function getOriginId(): string {
  return _originId;
}

// Código corto de terminal (ej. 'C1'): entra en `origin_id` de cada fila y en el correlativo
// `V-<terminal>-NNNNNN`. Sin guiones ni espacios (rompen el parseo) y nunca un UUID.
const TERMINAL_VALIDA = /^[A-Za-z0-9]{1,8}$/;

/**
 * Aplica la config de la terminal (`loadTerminalConfig()` de cada app) al contexto del main.
 * Debe llamarse al arrancar, antes de registrar handlers. Si el valor es inválido lanza y deja
 * el `origin_id` anterior: caer en silencio a 'C1' es justo el bug que esto corrige.
 */
export function aplicarConfigTerminal(config: { origin_id: string; modo?: ModoTerminal }): void {
  const id = typeof config.origin_id === 'string' ? config.origin_id.trim() : '';
  if (!TERMINAL_VALIDA.test(id) || id !== config.origin_id) {
    throw new Error(`TERMINAL_INVALIDA: origin_id "${config.origin_id}" (esperado 1-8 caracteres alfanuméricos, ej. C1)`);
  }
  const modo = config.modo ?? 'standalone';
  if (!MODOS_SOPORTADOS.includes(modo)) {
    throw new Error(`MODO_TERMINAL_NO_SOPORTADO: modo "${String(modo)}" (esperado standalone o distribuido)`);
  }
  setOriginId(id);
  setModoTerminal(modo);
}

// ── Modo de la terminal (ADR-156) y terminal coordinadora (ADR-152) ────────────────────────────────

/** `standalone`: una sola terminal, sin hub. `distribuido`: varias terminales que sincronizan (F2). */
export type ModoTerminal = 'standalone' | 'distribuido';

// F2 PR4: el modo distribuido arranca el cliente de sync contra el hub emparejado.
const MODOS_SOPORTADOS: readonly ModoTerminal[] = ['standalone', 'distribuido'];

let _modo: ModoTerminal = 'standalone';

export function setModoTerminal(modo: ModoTerminal): void {
  _modo = modo;
}

export function getModoTerminal(): ModoTerminal {
  return _modo;
}

// Hasta cuándo (hora local, ms) vale el permiso de coordinadora que otorgó el hub (ADR-152 §2, F2 PR5).
let _coordinadoraHastaMs = 0;

/** Lo fija la renovación del permiso (`sync/coordinacion.ts`); 0 = sin permiso. */
export function setCoordinadoraHasta(ms: number): void {
  _coordinadoraHastaMs = ms;
}

/**
 * ¿Esta terminal corre las tareas coordinadas (las que escriben tablas que sincronizan)? En
 * standalone, siempre. En distribuido, solo mientras tenga vigente el permiso que otorga el hub: si
 * deja de renovarlo (sin conexión), deja de serlo sola antes de que el hub se lo dé a otra.
 */
export function esTerminalCoordinadora(ahoraMs: number = Date.now()): boolean {
  return _modo === 'standalone' || ahoraMs < _coordinadoraHastaMs;
}
