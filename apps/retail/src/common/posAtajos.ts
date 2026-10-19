// Tabla declarativa de atajos de teclado del POS de Retail (ADR "atajos POS", decisión A).
// Módulo puro: lo importan el renderer (hook usePosHotkeys, rótulos y tooltips) y el main
// (texto de ayuda F1 en appMenu.ts). Se evitan F5, F10, F11 y F12 (sistema/desarrollo) y F1
// (ayuda del menú nativo).

export type PosAccion =
  | 'enfocar-buscador'
  | 'cobrar'
  | 'descuento-ultima-linea'
  | 'ventas-espera'
  | 'poner-espera'
  | 'cancelar-multiplicador';

/** Estado del POS que condiciona qué atajos están activos. */
export interface PosAtajoCtx {
  lineas: number;
  loading: boolean;
  cantidadEnEspera: number;
  canOverride: boolean;
  multiplicadorPendiente: boolean;
}

export interface PosAtajo {
  accion: PosAccion;
  /** Valor de `KeyboardEvent.key`. */
  tecla: string;
  /** Texto corto para la ayuda y los rótulos. */
  descripcion: string;
  habilitado: (ctx: PosAtajoCtx) => boolean;
}

export const POS_ATAJOS: readonly PosAtajo[] = [
  { accion: 'enfocar-buscador', tecla: 'F2', descripcion: 'Enfocar el buscador', habilitado: () => true },
  { accion: 'cobrar', tecla: 'F4', descripcion: 'Cobrar (confirmar venta)', habilitado: (c) => c.lineas > 0 && !c.loading },
  { accion: 'descuento-ultima-linea', tecla: 'F6', descripcion: 'Desc. % de la última línea', habilitado: (c) => c.canOverride && c.lineas > 0 },
  { accion: 'ventas-espera', tecla: 'F8', descripcion: 'Ventas en espera', habilitado: (c) => c.cantidadEnEspera > 0 },
  { accion: 'poner-espera', tecla: 'F9', descripcion: 'Poner la venta en espera', habilitado: (c) => c.lineas > 0 && !c.loading },
  { accion: 'cancelar-multiplicador', tecla: 'Escape', descripcion: 'Cancelar la cantidad N*', habilitado: (c) => c.multiplicadorPendiente },
];

export function atajoDe(accion: PosAccion): PosAtajo {
  const a = POS_ATAJOS.find((x) => x.accion === accion);
  if (!a) throw new Error(`Atajo desconocido: ${accion}`);
  return a;
}

export function teclaDe(accion: PosAccion): string {
  return atajoDe(accion).tecla;
}

export function atajoHabilitado(accion: PosAccion, ctx: PosAtajoCtx): boolean {
  return atajoDe(accion).habilitado(ctx);
}

/** Etiqueta visible de la tecla ("Escape" se muestra "Esc"). */
export function etiquetaTecla(tecla: string): string {
  return tecla === 'Escape' ? 'Esc' : tecla;
}

/** Atajos del menú nativo (appMenuTemplate.ts). Se listan acá solo para la ayuda F1. */
const ATAJOS_MENU: readonly { descripcion: string; tecla: string }[] = [
  { descripcion: 'Nueva venta', tecla: 'Ctrl+N' },
  { descripcion: 'Buscar producto', tecla: 'Ctrl+F' },
  { descripcion: 'Cerrar caja', tecla: 'Ctrl+F4' },
  { descripcion: 'Ventas en espera', tecla: 'Ctrl+E' },
  { descripcion: 'Atajos de teclado (esta ayuda)', tecla: 'F1' },
  { descripcion: 'Pantalla completa', tecla: 'F11' },
  { descripcion: 'Salir', tecla: 'Ctrl+Q' },
];

function fila(descripcion: string, tecla: string): string {
  return `${descripcion.padEnd(30)}${tecla}`;
}

/** Texto del diálogo de ayuda F1, generado desde la misma tabla que usa el POS. */
export function textoAyudaAtajos(): string {
  return [
    ...ATAJOS_MENU.map((a) => fila(a.descripcion, a.tecla)),
    '',
    'En el punto de venta:',
    ...POS_ATAJOS.map((a) => fila(a.descripcion, etiquetaTecla(a.tecla))),
  ].join('\n');
}
