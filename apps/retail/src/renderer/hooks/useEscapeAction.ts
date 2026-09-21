import { useEffect, useRef } from 'react';

/**
 * Capa del registro. Un `overlay` (modal, drawer) siempre gana sobre una `page`, sin
 * importar el orden de montaje: los efectos de React corren de hijo a padre, así que un
 * modal puede registrarse antes que la pantalla que lo contiene.
 */
export type EscapeLayer = 'page' | 'overlay';

export type EscapeOptions = {
  /** En `false` el handler queda registrado pero no atiende (ej. mientras se guarda). */
  enabled?: boolean;
  layer?: EscapeLayer;
};

type Entrada = { layer: EscapeLayer; run: () => void };

/**
 * Pila LIFO a nivel de módulo con un único listener en `window`. Es lo que hace que dos
 * modales anidados se cierren de a uno: con un `addEventListener` por componente, un
 * Escape los cerraría todos a la vez.
 */
const pila: Entrada[] = [];
let listenerActivo = false;

function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  const entrada = topeActivo();
  if (!entrada) return;
  e.preventDefault();
  e.stopPropagation();
  entrada.run();
}

/** El overlay más reciente; si no hay ninguno, la page más reciente. */
function topeActivo(): Entrada | undefined {
  for (let i = pila.length - 1; i >= 0; i--) {
    if (pila[i].layer === 'overlay') return pila[i];
  }
  return pila[pila.length - 1];
}

function suscribir(entrada: Entrada) {
  pila.push(entrada);
  if (!listenerActivo) {
    window.addEventListener('keydown', handleKeyDown);
    listenerActivo = true;
  }
}

function desuscribir(entrada: Entrada) {
  const i = pila.lastIndexOf(entrada);
  if (i >= 0) pila.splice(i, 1);
  if (pila.length === 0 && listenerActivo) {
    window.removeEventListener('keydown', handleKeyDown);
    listenerActivo = false;
  }
}

export const MSG_CAMBIOS_SIN_GUARDAR = 'Hay cambios sin guardar. ¿Salir y descartarlos?';

/**
 * Variante para formularios: si `hayCambios`, pide confirmación antes de salir. Se usa
 * tanto en modales con formulario como en pantallas completas, así Escape nunca descarta
 * trabajo en silencio.
 */
export function useEscapeSalir(
  salir: () => void,
  hayCambios: boolean,
  opts?: EscapeOptions,
): void {
  useEscapeAction(() => {
    if (hayCambios && !window.confirm(MSG_CAMBIOS_SIN_GUARDAR)) return;
    salir();
  }, opts);
}

/**
 * Ejecuta `handler` al presionar Escape, atendiendo solo a la ventana de más arriba.
 *
 * En un modal o drawer se pasa su propia función de cierre; en una pantalla completa, la
 * misma acción del botón «Volver» (`layer: 'page'`), de modo que Escape y el botón hagan
 * exactamente lo mismo — incluida la confirmación si hay cambios sin guardar.
 */
export function useEscapeAction(handler: () => void, opts?: EscapeOptions): void {
  const { enabled = true, layer = 'overlay' } = opts ?? {};

  // El handler vive en un ref para que cambiar de identidad en cada render no re-suscriba
  // (y no reordene la pila, que es lo que decide quién atiende).
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const entrada: Entrada = { layer, run: () => handlerRef.current() };
    suscribir(entrada);
    return () => desuscribir(entrada);
  }, [enabled, layer]);
}
