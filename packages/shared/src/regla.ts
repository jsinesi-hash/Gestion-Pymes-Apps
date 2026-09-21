/**
 * Reglas de margen (ADR-049 §2). Resuelve **una sola** regla por producto y lista,
 * con prioridad por especificidad; nunca combina reglas.
 *
 * Semántica de margen: **markup sobre costo neto** — `precio = costoNeto × (1 + margen/100)`.
 * El "margen real sobre precio" es un dato derivado de solo lectura para la UI.
 *
 * Aritmética pura, sin efectos (mismo criterio que `precio.ts` / `costo.ts`).
 */
import type { RedondeoComercialModo } from './precio.js';

export type ReglaPrecioTipo = 'producto' | 'marca' | 'rubro' | 'proveedor' | 'lista';

export type ReglaPrecio = {
  id: string;
  tipo: ReglaPrecioTipo;
  /** null para `lista` (regla base); si no, el id del objetivo (producto/marca/rubro/proveedor). */
  objetivo_id: string | null;
  margen_pct: number;
  margen_min_pct: number | null;
  margen_max_pct: number | null;
  redondeo_modo: RedondeoComercialModo;
  redondeo_valor: number | null;
  /** INTEGER; menor gana a igual especificidad. */
  prioridad: number;
};

export type ContextoProducto = {
  producto_id: string;
  marca_id: string | null;
  categoria_id: string | null; // rubro
  proveedor_id: string | null; // proveedor preferido
};

// Especificidad: menor rango = más específico (gana).
const RANGO: Record<ReglaPrecioTipo, number> = {
  producto: 0,
  marca: 1,
  rubro: 2,
  proveedor: 3,
  lista: 4,
};

function matchea(regla: ReglaPrecio, ctx: ContextoProducto): boolean {
  switch (regla.tipo) {
    case 'producto':  return regla.objetivo_id === ctx.producto_id;
    case 'marca':     return ctx.marca_id != null && regla.objetivo_id === ctx.marca_id;
    case 'rubro':     return ctx.categoria_id != null && regla.objetivo_id === ctx.categoria_id;
    case 'proveedor': return ctx.proveedor_id != null && regla.objetivo_id === ctx.proveedor_id;
    case 'lista':     return true;
    default:          return false;
  }
}

/**
 * Devuelve la regla aplicable a un producto en una lista, o `null` si ninguna aplica
 * (en cuyo caso el llamador cae al fallback fuera de shared).
 * Orden: especificidad (producto → … → lista); a igual especificidad, menor `prioridad`.
 */
export function resolverRegla(reglas: ReglaPrecio[], ctx: ContextoProducto): ReglaPrecio | null {
  const candidatas = reglas.filter(r => matchea(r, ctx));
  if (candidatas.length === 0) return null;
  candidatas.sort((a, b) => {
    const ra = RANGO[a.tipo];
    const rb = RANGO[b.tipo];
    if (ra !== rb) return ra - rb;
    return a.prioridad - b.prioridad;
  });
  return candidatas[0];
}

/** Precio a partir del costo neto y el margen (markup sobre costo). */
export function precioConMargen(costoNetoCentavos: number, margenPct: number): number {
  return Math.round(costoNetoCentavos * (1 + margenPct / 100));
}

/** Margen real sobre precio `(precio − costo) / precio`, en %. Dato derivado de solo lectura. */
export function margenRealPct(precioCentavos: number, costoNetoCentavos: number): number {
  if (precioCentavos <= 0) return 0;
  return ((precioCentavos - costoNetoCentavos) / precioCentavos) * 100;
}
