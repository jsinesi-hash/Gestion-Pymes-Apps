import type { CarritoPayload, LineaCarrito, ModificadorElegido, ProductoPos } from './tipos';

export type CarritoState = { lineas: LineaCarrito[]; descuentoGlobalPct: number; siguienteKey: number };
export const carritoInicial: CarritoState = { lineas: [], descuentoGlobalPct: 0, siguienteKey: 1 };

export type CarritoAction =
  | { tipo: 'agregar'; producto: ProductoPos; modificadores: ModificadorElegido[] }
  | { tipo: 'cantidad'; key: string; cantidad: number }
  | { tipo: 'descuentoLinea'; key: string; pct: number }
  | { tipo: 'descuentoGlobal'; pct: number }
  | { tipo: 'quitar'; key: string }
  | { tipo: 'limpiar' };

const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Firma estable de los sabores elegidos (independiente del orden) para fusionar líneas idénticas. */
const firma = (mods: readonly ModificadorElegido[]) =>
  [...mods].sort((a, b) => a.grupo_modificador_id.localeCompare(b.grupo_modificador_id))
    .map((m) => `${m.grupo_modificador_id}:${[...m.opcion_ids].sort().join(',')}`).join('|');

function detalleDe(producto: ProductoPos, mods: readonly ModificadorElegido[]): string {
  const nombres = new Map(producto.grupos.flatMap((g) => g.opciones.map((o) => [o.id, o.nombre] as const)));
  return mods.flatMap((m) => m.opcion_ids.map((id) => nombres.get(id) ?? id)).join(', ');
}

export function carritoReducer(state: CarritoState, a: CarritoAction): CarritoState {
  switch (a.tipo) {
    case 'agregar': {
      const f = firma(a.modificadores);
      const existente = state.lineas.find((l) => l.producto_venta_id === a.producto.id && firma(l.modificadores) === f && l.descuento_linea_pct === 0);
      if (existente) {
        return { ...state, lineas: state.lineas.map((l) => (l.key === existente.key ? { ...l, cantidad: l.cantidad + 1 } : l)) };
      }
      const linea: LineaCarrito = {
        key: `l${state.siguienteKey}`, producto_venta_id: a.producto.id, nombre: a.producto.nombre,
        detalle: detalleDe(a.producto, a.modificadores), cantidad: 1, descuento_linea_pct: 0,
        modificadores: a.modificadores.map((m) => ({ ...m, opcion_ids: [...m.opcion_ids] })),
      };
      return { ...state, lineas: [...state.lineas, linea], siguienteKey: state.siguienteKey + 1 };
    }
    case 'cantidad':
      return { ...state, lineas: state.lineas.map((l) => (l.key === a.key ? { ...l, cantidad: Math.max(1, a.cantidad) } : l)) };
    case 'descuentoLinea':
      return { ...state, lineas: state.lineas.map((l) => (l.key === a.key ? { ...l, descuento_linea_pct: acotar(a.pct, 0, 100) } : l)) };
    case 'descuentoGlobal':
      return { ...state, descuentoGlobalPct: acotar(a.pct, 0, 100) };
    case 'quitar':
      return { ...state, lineas: state.lineas.filter((l) => l.key !== a.key) };
    case 'limpiar':
      return carritoInicial;
  }
}

export function aPayload(s: CarritoState): CarritoPayload {
  return {
    lineas: s.lineas.map((l) => ({
      producto_venta_id: l.producto_venta_id, cantidad: l.cantidad,
      descuento_linea_pct: l.descuento_linea_pct, modificadores: l.modificadores,
    })),
    descuento_global_pct: s.descuentoGlobalPct,
  };
}
