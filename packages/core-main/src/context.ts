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
  // ADR-156 (F1 PR8): en esta versión no hay hub ni sincronización: solo standalone.
  if (!MODOS_SOPORTADOS.includes(modo)) {
    throw new Error(`MODO_TERMINAL_NO_SOPORTADO: modo "${String(modo)}" (esta versión solo funciona en modo standalone)`);
  }
  setOriginId(id);
  setModoTerminal(modo);
}

// ── Modo de la terminal (ADR-156) y terminal coordinadora (ADR-152) ────────────────────────────────

/** `standalone`: una sola terminal, sin hub. `distribuido`: varias terminales que sincronizan (F2). */
export type ModoTerminal = 'standalone' | 'distribuido';

const MODOS_SOPORTADOS: readonly ModoTerminal[] = ['standalone'];

let _modo: ModoTerminal = 'standalone';

export function setModoTerminal(modo: ModoTerminal): void {
  _modo = modo;
}

export function getModoTerminal(): ModoTerminal {
  return _modo;
}

/**
 * ¿Esta terminal corre las tareas coordinadas (las que escriben tablas que sincronizan)? En
 * standalone, siempre. En distribuido, solo con el permiso vigente que otorga el hub (F2): hasta
 * entonces, no.
 */
export function esTerminalCoordinadora(): boolean {
  return _modo === 'standalone';
}
