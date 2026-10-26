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
export function aplicarConfigTerminal(config: { origin_id: string }): void {
  const id = typeof config.origin_id === 'string' ? config.origin_id.trim() : '';
  if (!TERMINAL_VALIDA.test(id) || id !== config.origin_id) {
    throw new Error(`TERMINAL_INVALIDA: origin_id "${config.origin_id}" (esperado 1-8 caracteres alfanuméricos, ej. C1)`);
  }
  setOriginId(id);
}
