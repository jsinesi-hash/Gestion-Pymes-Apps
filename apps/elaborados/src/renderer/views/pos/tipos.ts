export type OpcionPos = { id: string; nombre: string; recargo_centavos: number };
export type GrupoPos = {
  grupo_modificador_id: string; nombre: string; min: number; max: number; cantidad_total: number;
  modo_descuento: 'reparto' | 'por_opcion' | 'sin_descuento'; opciones: OpcionPos[];
};
export type ProductoPos = { id: string; nombre: string; categoria_venta_id: string; precio_centavos: number; grupos: GrupoPos[] };
export type CategoriaPos = { id: string; nombre: string; orden: number };
export type CatalogoPos = { categorias: CategoriaPos[]; productos: ProductoPos[] };

export type ModificadorElegido = { grupo_modificador_id: string; opcion_ids: string[] };

export type LineaCarrito = {
  key: string;
  producto_venta_id: string;
  nombre: string;
  /** "Choco, DDL": nombres de las opciones elegidas, solo para mostrar. */
  detalle: string;
  cantidad: number;
  descuento_linea_pct: number;
  modificadores: ModificadorElegido[];
};

export type AvisoStock = { articulo_id: string; nombre: string; stockResultante: number };

export type CotizacionLinea = {
  descripcion: string; cantidad: number; precio_unitario_centavos: number;
  descuento_linea_pct: number; subtotal_centavos: number;
  opciones: { nombre: string; recargo_centavos: number }[];
};
export type Cotizacion = {
  lineas: CotizacionLinea[];
  subtotal_centavos: number; descuento_global_centavos: number; total_centavos: number;
  ajuste_redondeo_centavos: number; importe_iva_centavos: number;
  bloqueos: AvisoStock[]; advertencias: AvisoStock[];
};

/** Payload de `venta.cotizar` / base de `venta.confirmar` (sin precios). */
export type CarritoPayload = {
  lineas: { producto_venta_id: string; cantidad: number; descuento_linea_pct: number; modificadores: ModificadorElegido[] }[];
  descuento_global_pct: number;
};
