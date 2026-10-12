import { resolverPrecio, redondearPeso } from '@ferreteria/shared';
import { calcularConsumo, type ComponenteFijo, type ConsumoLinea, type GrupoConfig, type ModoDescuento } from './consumo';

export type OpcionCatalogo = {
  id: string; grupo_modificador_id: string; articulo_id: string; nombre: string;
  recargo_centavos: number; cantidad: number;
};
export type GrupoProducto = {
  grupo_modificador_id: string; min: number; max: number; cantidad_total: number; modo_descuento: ModoDescuento;
};
export type ProductoCatalogo = {
  id: string; nombre: string; precio_centavos: number; alicuota_iva: number;
  componentes: ComponenteFijo[]; grupos: GrupoProducto[];
};
export type CarritoLinea = {
  producto_venta_id: string; cantidad: number; descuento_linea_pct: number;
  modificadores: { grupo_modificador_id: string; opcion_ids: string[] }[];
};
export type Carrito = { lineas: CarritoLinea[]; descuento_global_pct: number };

export type OpcionValorizada = {
  opcion_id: string; grupo_modificador_id: string; articulo_id: string; nombre: string;
  recargo_centavos: number; cantidad_consumida: number;
};
export type LineaValorizada = {
  producto_venta_id: string; descripcion: string; cantidad: number;
  /** base + recargos, ANTES del descuento de línea. */
  precio_unitario_centavos: number; descuento_linea_pct: number; alicuota_iva: number;
  subtotal_centavos: number; opciones: OpcionValorizada[]; consumo: ConsumoLinea[];
};
export type VentaValorizada = {
  lineas: LineaValorizada[];
  subtotal_centavos: number;
  descuento_global_centavos: number;
  total_centavos: number;            // redondeado al peso
  ajuste_redondeo_centavos: number;  // total redondeado - total exacto
  importe_iva_centavos: number;
  consumo_total: ConsumoLinea[];
};

export function valorizarCarrito(
  productos: ReadonlyMap<string, ProductoCatalogo>,
  opciones: ReadonlyMap<string, OpcionCatalogo>,
  carrito: Carrito,
): VentaValorizada {
  if (carrito.lineas.length === 0) throw new Error('CARRITO_VACIO');
  if (!(carrito.descuento_global_pct >= 0 && carrito.descuento_global_pct <= 100)) throw new Error('DESCUENTO_INVALIDO');

  const parciales = carrito.lineas.map((l) => {
    const prod = productos.get(l.producto_venta_id);
    if (!prod) throw new Error('PRODUCTO_VENTA_NO_ENCONTRADO');
    if (!(l.cantidad > 0)) throw new Error('CANTIDAD_INVALIDA');
    if (!(l.descuento_linea_pct >= 0 && l.descuento_linea_pct <= 100)) throw new Error('DESCUENTO_INVALIDO');

    const elegidasPorGrupo = new Map<string, string[]>();
    for (const m of l.modificadores) {
      if (!prod.grupos.some((g) => g.grupo_modificador_id === m.grupo_modificador_id)) throw new Error('GRUPO_NO_PERMITIDO');
      elegidasPorGrupo.set(m.grupo_modificador_id, [...(elegidasPorGrupo.get(m.grupo_modificador_id) ?? []), ...m.opcion_ids]);
    }

    const opcionesValorizadas: OpcionValorizada[] = [];
    const gruposCfg: GrupoConfig[] = [];
    let recargoUnitario = 0;

    for (const g of prod.grupos) {
      const ids = elegidasPorGrupo.get(g.grupo_modificador_id) ?? [];
      if (new Set(ids).size !== ids.length) throw new Error('OPCION_DUPLICADA');
      if (ids.length < g.min) throw new Error('MODIFICADOR_MIN');
      if (ids.length > g.max) throw new Error('MODIFICADOR_MAX');
      const elegidas = ids.map((id) => {
        const o = opciones.get(id);
        if (!o || o.grupo_modificador_id !== g.grupo_modificador_id) throw new Error('OPCION_INVALIDA');
        return o;
      });
      const cfg: GrupoConfig = {
        modo_descuento: g.modo_descuento, cantidad_total: g.cantidad_total,
        opciones_elegidas: elegidas.map((o) => ({ articulo_id: o.articulo_id, cantidad: o.cantidad })),
      };
      gruposCfg.push(cfg);
      // consumo por opción y por unidad: misma fórmula que el consumo de la línea (sin duplicarla)
      const porUnidad = calcularConsumo(1, [], [cfg]);
      elegidas.forEach((o, i) => {
        recargoUnitario += o.recargo_centavos;
        opcionesValorizadas.push({
          opcion_id: o.id, grupo_modificador_id: g.grupo_modificador_id, articulo_id: o.articulo_id,
          nombre: o.nombre, recargo_centavos: o.recargo_centavos,
          cantidad_consumida: g.modo_descuento === 'sin_descuento' ? 0 : (porUnidad[i]?.cantidad ?? 0),
        });
      });
    }

    return {
      prod, l, opciones: opcionesValorizadas,
      precioLista: prod.precio_centavos + recargoUnitario,
      consumo: calcularConsumo(l.cantidad, prod.componentes, gruposCfg),
    };
  });

  const precio = resolverPrecio({
    lineas: parciales.map((p) => ({
      precioListaCentavos: p.precioLista, ajustePct: 0,
      descuentoLineaPct: p.l.descuento_linea_pct, cantidad: p.l.cantidad,
    })),
    descuentoGlobalPct: carrito.descuento_global_pct,
  });
  const redondeo = redondearPeso(precio.totalCentavos);

  const factorGlobal = precio.subtotalCentavos > 0 ? precio.totalCentavos / precio.subtotalCentavos : 1;
  const ivaExacto = parciales.reduce(
    (s, p, i) => s + precio.lineas[i].subtotalCentavos * factorGlobal * p.prod.alicuota_iva / (100 + p.prod.alicuota_iva), 0);

  const lineas: LineaValorizada[] = parciales.map((p, i) => ({
    producto_venta_id: p.prod.id, descripcion: p.prod.nombre, cantidad: p.l.cantidad,
    precio_unitario_centavos: p.precioLista, descuento_linea_pct: p.l.descuento_linea_pct,
    alicuota_iva: p.prod.alicuota_iva, subtotal_centavos: precio.lineas[i].subtotalCentavos,
    opciones: p.opciones, consumo: p.consumo,
  }));

  const agregado = new Map<string, number>();
  for (const p of parciales) for (const c of p.consumo) agregado.set(c.articulo_id, (agregado.get(c.articulo_id) ?? 0) + c.cantidad);
  const consumo_total: ConsumoLinea[] = [...agregado].map(([articulo_id, cantidad]) => ({
    articulo_id, cantidad: Math.round(cantidad * 1e6) / 1e6,
  }));

  return {
    lineas,
    subtotal_centavos: precio.subtotalCentavos,
    descuento_global_centavos: precio.descuentoGlobalCentavos,
    total_centavos: redondeo.totalCentavos,
    ajuste_redondeo_centavos: redondeo.ajusteRedondeoCentavos,
    importe_iva_centavos: Math.round(ivaExacto),
    consumo_total,
  };
}
