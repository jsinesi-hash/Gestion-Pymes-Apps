import { useState, useEffect, useMemo, useRef } from 'react';
import { resolverPrecio, redondearPeso, nombreCompletoCliente } from '@ferreteria/shared';

export const CONSUMIDOR_FINAL_ID = 'cf000000-0000-0000-0000-000000000001';

import type { MedioPago, VentaPagoPayload } from '@core/ui';
export type { MedioPago, VentaPagoPayload };

export type PresentacionOpcion = {
  id: string;
  unidad_abreviatura: string;
  factor_a_stock: number;
  es_default: boolean;
};

export type PosLine = {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precioListaCentavos: number;
  ajustePct: number;
  descuentoLineaPct: number;
  alicuota_iva: number;
  permite_fraccion: boolean;
  stock_fisico: number;
  precioOrigen: 'promocion' | 'vigente' | 'fallback';
  presentacion_id?: string | null;
  factor_a_stock?: number;
  unidad_abreviatura?: string;
  presentaciones?: PresentacionOpcion[];
};

export type VentaEsperaItem = {
  id: string;
  alias: string | null;
  en_espera_desde: Date | null;
  turno_creacion_id: string | null;
  cliente_id: string;
  total: number;
  count_items: number;
  vencida: boolean;
};

export type AvisosRetomar = {
  stock_caido: Array<{ producto_id: string; nombre: string; stock_disponible: number }>;
  precio_cambiado: Array<{ producto_id: string; nombre: string; precio_viejo: number; precio_nuevo: number }>;
};

type ClienteInfo = {
  nombre_completo: string;
  habilita_ccc: boolean;
  tipo_documento?: string;
  numero_documento?: string;
  condicion_fiscal?: string;
  telefono?: string | null;
};

const f = () => (globalThis as any).ferreteria;

export function usePosSession() {
  const [cajaActiva, setCajaActiva] = useState<any>(undefined);
  const [listaPredeterminada, setListaPredeterminada] = useState<any | null>(null);
  const [impuestos, setImpuestos] = useState<any[]>([]);
  const [lines, setLines] = useState<PosLine[]>([]);
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState(0);
  const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente'>('efectivo');
  const [clienteId, setClienteIdState] = useState<string>(CONSUMIDOR_FINAL_ID);
  const [clienteInfo, setClienteInfo] = useState<ClienteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ventasEnEspera, setVentasEnEspera] = useState<VentaEsperaItem[]>([]);
  const [ventaEnEsperaId, setVentaEnEsperaId] = useState<string | null>(null);
  const [avisosRetomar, setAvisosRetomar] = useState<AvisosRetomar | null>(null);
  // ADR-046 §4: si la sesion proviene de convertir un presupuesto, su id. Se envia al
  // confirmar para marcar el presupuesto como convertido en la misma transaccion.
  const [presupuestoId, setPresupuestoId] = useState<string | null>(null);

  // ADR-056 Lote 1: con el estado elevado a un provider que vive desde el login, el init
  // corre una sola vez. Pero la caja puede abrirse/cerrarse en /caja DESPUÉS del arranque,
  // así que PosView re-consulta la caja activa cada vez que se monta (al entrar a /pos).
  // Es solo lectura: no escribe nada en la BD.
  async function refrescarCaja() {
    try {
      const caja = await f().caja.getActiva();
      setCajaActiva(caja ?? null);
    } catch {
      // deja el estado previo
    }
  }

  async function cargarVentasEnEspera() {
    try {
      const lista = await f().venta.espera.listar();
      setVentasEnEspera(lista ?? []);
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const [caja, listas, imps] = await Promise.all([
          f().caja.getActiva(),
          f().precios.lista.list(),
          f().catalogo.impuesto.list(),
        ]);
        setCajaActiva(caja ?? null);
        setListaPredeterminada(listas.find((l: any) => l.predeterminada) ?? null);
        setImpuestos(imps);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
        setCajaActiva(null);
      }
    }
    init().then(() => cargarVentasEnEspera());
  }, []);

  const totales = useMemo(() => {
    const result = resolverPrecio({
      lineas: lines.map(l => ({
        precioListaCentavos: l.precioListaCentavos,
        ajustePct: l.ajustePct,
        descuentoLineaPct: l.descuentoLineaPct,
        cantidad: l.cantidad,
      })),
      descuentoGlobalPct,
    });
    const redondeo = redondearPeso(result.totalCentavos);
    return { ...result, ...redondeo };
  }, [lines, descuentoGlobalPct]);

  function setCliente(id: string, info: ClienteInfo | null) {
    setClienteIdState(id);
    setClienteInfo(info);
    if (!info?.habilita_ccc) setFormaPago(prev => prev === 'cuenta_corriente' ? 'efectivo' : prev);
  }

  // ADR-049 §9 — repregunta el precio de cada línea al cambiar de cliente (la lista
  // efectiva puede depender de cliente.lista_precio_id). Sin esto, cambiar de cliente
  // con el carrito armado dejaba los precios de la lista anterior.
  const clienteIdAnteriorRef = useRef(clienteId);
  useEffect(() => {
    const anterior = clienteIdAnteriorRef.current;
    clienteIdAnteriorRef.current = clienteId;
    if (anterior === clienteId || lines.length === 0 || !listaPredeterminada) return;
    let vigente = true;
    (async () => {
      const repricedas = await Promise.all(lines.map(async (l) => {
        try {
          const r = await f().precios.valor.getPrecioEnLista({
            productoId: l.producto_id, listaId: listaPredeterminada.id, clienteId,
          });
          const factor = l.factor_a_stock ?? 1.0;
          return {
            ...l,
            precioListaCentavos: Math.round((r?.precio_centavos ?? 0) * factor),
            precioOrigen: (r?.origen as 'promocion' | 'vigente' | 'fallback') ?? l.precioOrigen,
          };
        } catch {
          return l;
        }
      }));
      if (vigente) setLines(repricedas);
    })();
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  async function addLinea(productoId: string, presentacionId?: string | null, factorAStock?: number, unidadAbreviatura?: string) {
    setLoading(true);
    setError(null);
    try {
      const [prod, ex, precioResuelto, presentacionesRaw] = await Promise.all([
        f().catalogo.producto.get({ id: productoId }),
        f().catalogo.existencias.get({ producto_id: productoId }),
        listaPredeterminada
          ? f().precios.valor.getPrecioEnLista({ productoId, listaId: listaPredeterminada.id, clienteId })
          : Promise.resolve({ precio_centavos: 0, origen: 'fallback' as const }),
        (f().presentacion?.listByProducto?.({ producto_id: productoId }) ?? Promise.resolve([])).catch(() => []),
      ]);

      if (!prod?.activo) throw new Error('PRODUCTO_INACTIVO');

      const presentaciones: PresentacionOpcion[] = (presentacionesRaw ?? [])
        .filter((p: any) => p.activo)
        .map((p: any) => ({
          id: p.id,
          unidad_abreviatura: p.unidad_abreviatura,
          factor_a_stock: p.factor_a_stock,
          es_default: p.es_default,
        }));

      const defaultPp = presentaciones.find(p => p.es_default) ?? presentaciones[0];
      const resolvedFactor = factorAStock ?? defaultPp?.factor_a_stock ?? 1.0;
      const resolvedPpId = presentacionId ?? defaultPp?.id ?? null;
      const resolvedAbr = unidadAbreviatura ?? defaultPp?.unidad_abreviatura ?? prod.unidad_venta ?? '';

      const existing = lines.find(l => l.producto_id === productoId);
      const nuevaCantidad = (existing?.cantidad ?? 0) + 1;
      const checkFactor = existing ? (existing.factor_a_stock ?? 1.0) : resolvedFactor;
      if (!ex || ex.stock_fisico < nuevaCantidad * checkFactor) throw new Error('STOCK_INSUFICIENTE');

      const basePrecio = precioResuelto.precio_centavos
        ? precioResuelto.precio_centavos
        : Math.round(prod.precio_venta_lista * 100);
      const precioListaCentavos = Math.round(basePrecio * resolvedFactor);
      const precioOrigen = precioResuelto.origen as 'promocion' | 'vigente' | 'fallback';
      const ajustePct = 0; // already incorporated in precioListaCentavos by the backend
      const imp = impuestos.find((i: any) => i.id === prod.impuesto_id);

      if (existing) {
        setLines(prev => prev.map(l =>
          l.producto_id === productoId
            ? { ...l, cantidad: nuevaCantidad, stock_fisico: ex.stock_fisico }
            : l,
        ));
      } else {
        setLines(prev => [...prev, {
          producto_id: productoId,
          descripcion: prod.nombre_corto,
          cantidad: 1,
          precioListaCentavos,
          ajustePct,
          descuentoLineaPct: 0,
          alicuota_iva: imp?.alicuota ?? 0,
          permite_fraccion: prod.permite_fraccion ?? false,
          stock_fisico: ex.stock_fisico,
          precioOrigen,
          presentacion_id: resolvedPpId,
          factor_a_stock: resolvedFactor,
          unidad_abreviatura: resolvedAbr,
          presentaciones,
        }]);
      }

      if (precioOrigen === 'fallback') {
        setError('Precio sin confirmar en esta lista — se usó precio base calculado');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al agregar producto');
    } finally {
      setLoading(false);
    }
  }

  function updateCantidad(productoId: string, cantidad: number) {
    if (cantidad <= 0) {
      setLines(prev => prev.filter(l => l.producto_id !== productoId));
      return;
    }
    const line = lines.find(l => l.producto_id === productoId);
    if (!line) return;
    if (cantidad * (line.factor_a_stock ?? 1.0) > line.stock_fisico) { setError('STOCK_INSUFICIENTE'); return; }
    setLines(prev => prev.map(l => l.producto_id === productoId ? { ...l, cantidad } : l));
  }

  async function updatePresentacion(productoId: string, presentacionId: string, factorAStock: number, unidadAbreviatura: string) {
    const line = lines.find(l => l.producto_id === productoId);
    if (!line) return;
    const ex = await f().catalogo.existencias.get({ producto_id: productoId });
    if (!ex || ex.stock_fisico < line.cantidad * factorAStock) {
      setError('STOCK_INSUFICIENTE con la presentación seleccionada');
      return;
    }
    const currentFactor = line.factor_a_stock ?? 1.0;
    const nuevoPrecioCentavos = Math.round((line.precioListaCentavos / currentFactor) * factorAStock);
    setLines(prev => prev.map(l =>
      l.producto_id === productoId
        ? { ...l, presentacion_id: presentacionId, factor_a_stock: factorAStock, unidad_abreviatura: unidadAbreviatura, precioListaCentavos: nuevoPrecioCentavos }
        : l,
    ));
  }

  function updateDescuentoLinea(productoId: string, pct: number) {
    setLines(prev => prev.map(l =>
      l.producto_id === productoId ? { ...l, descuentoLineaPct: pct } : l,
    ));
  }

  function removeLine(productoId: string) {
    setLines(prev => prev.filter(l => l.producto_id !== productoId));
  }

  function reset() {
    setLines([]);
    setDescuentoGlobalPct(0);
    setFormaPago('efectivo');
    setError(null);
    setClienteIdState(CONSUMIDOR_FINAL_ID);
    setClienteInfo(null);
    setVentaEnEsperaId(null);
    setAvisosRetomar(null);
    setPresupuestoId(null);
  }

  /**
   * ADR-046 §4: precarga el POS desde un presupuesto emitido/vencido. Dentro de validez
   * usa el precio snapshot congelado; vencido reprecia al valor de hoy (el backend ya
   * resolvio cual corresponde). NO impacta stock/caja: eso ocurre al confirmar la venta.
   */
  async function precargarDesdePresupuesto(presupId: string): Promise<{ vencido: boolean; aviso: string | null }> {
    setLoading(true);
    setError(null);
    try {
      const conv = await f().presupuesto.prepararConversion({ id: presupId });
      const stocks = await Promise.all(conv.lineas.map((l: any) =>
        f().catalogo.existencias.get({ producto_id: l.producto_id }).catch(() => null)));

      setLines(conv.lineas.map((l: any, i: number) => ({
        producto_id: l.producto_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        // precio_unitario_centavos ya viene neto del descuento de linea → descLinea = 0
        precioListaCentavos: l.precio_unitario_centavos,
        ajustePct: 0,
        descuentoLineaPct: 0,
        alicuota_iva: l.alicuota_iva ?? 0,
        permite_fraccion: true,
        stock_fisico: stocks[i]?.stock_fisico ?? 0,
        precioOrigen: 'vigente' as const,
        presentacion_id: l.presentacion_id ?? null,
        factor_a_stock: l.factor_a_stock ?? 1.0,
        unidad_abreviatura: '',
        presentaciones: [],
      })));
      setDescuentoGlobalPct(conv.descuento_global_pct ?? 0);
      setPresupuestoId(conv.presupuesto_id);

      if (conv.cliente_id) {
        setClienteIdState(conv.cliente_id);
        try {
          const c = await f().cliente.get(conv.cliente_id);
          if (c) setClienteInfo({ habilita_ccc: !!c.habilita_cuenta_corriente, nombre_completo: nombreCompletoCliente(c) });
        } catch { /* info opcional */ }
      } else {
        setClienteIdState(CONSUMIDOR_FINAL_ID);
        setClienteInfo(null);
      }

      // Aviso proactivo de stock: un presupuesto puede cotizar productos sin stock, pero
      // la venta requiere stock. Se avisa al precargar para no chocar recién al confirmar.
      const sinStock = conv.lineas
        .map((l: any, i: number) => ({
          descripcion: l.descripcion,
          stock: stocks[i]?.stock_fisico ?? 0,
          requerido: l.cantidad * (l.factor_a_stock ?? 1),
        }))
        .filter((x: any) => x.stock < x.requerido);

      let aviso: string | null = conv.vencido ? conv.aviso : null;
      if (sinStock.length > 0) {
        const detalle = sinStock.map((x: any) => `${x.descripcion} (stock ${x.stock})`).join(', ');
        const txtStock = `Sin stock suficiente para: ${detalle}. La venta no se podrá confirmar hasta reponer stock o quitar esas líneas.`;
        aviso = aviso ? `${aviso} ${txtStock}` : txtStock;
      }
      return { vencido: conv.vencido, aviso };
    } finally {
      setLoading(false);
    }
  }

  async function confirmar(pagos: VentaPagoPayload[], vuelto_centavos: number | null, supervisorCredenciales?: { nombre_usuario: string; password: string }) {
    if (!cajaActiva) throw new Error('CAJA_REQUERIDA');
    if (lines.length === 0) throw new Error('CARRITO_VACIO');

    const priceResult = resolverPrecio({
      lineas: lines.map(l => ({
        precioListaCentavos: l.precioListaCentavos,
        ajustePct: l.ajustePct,
        descuentoLineaPct: l.descuentoLineaPct,
        cantidad: l.cantidad,
      })),
      descuentoGlobalPct,
    });
    const { totalCentavos: totalRedondeadoCentavos, ajusteRedondeoCentavos } =
      redondearPeso(priceResult.totalCentavos);

    const lineasPayload = lines.map((l, i) => {
      const lr = priceResult.lineas[i];
      return {
        producto_id: l.producto_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: lr.precioUnitarioCentavos / 100,
        descuento_linea: l.descuentoLineaPct,
        alicuota_iva: l.alicuota_iva,
        subtotal: lr.subtotalCentavos / 100,
        presentacion_id: l.presentacion_id ?? null,
        factor_a_stock_aplicado: l.factor_a_stock ?? 1.0,
      };
    });

    const importe_iva = lineasPayload.reduce(
      (sum, l) => sum + l.subtotal * l.alicuota_iva / (100 + l.alicuota_iva),
      0,
    );

    setLoading(true);
    try {
      return await f().venta.confirmar({
        caja_id: cajaActiva.id,
        cliente_id: clienteId,
        lineas: lineasPayload,
        descuento_global: descuentoGlobalPct,
        subtotal: priceResult.subtotalCentavos / 100,
        importe_iva,
        total: totalRedondeadoCentavos / 100,
        ajuste_redondeo: ajusteRedondeoCentavos / 100,
        pagos,
        vuelto_centavos,
        venta_en_espera_id: ventaEnEsperaId ?? undefined,
        presupuesto_id: presupuestoId ?? undefined,
        supervisor_credenciales: supervisorCredenciales,
      });
    } finally {
      setLoading(false);
    }
  }

  async function pausarVenta(alias?: string) {
    if (!cajaActiva) throw new Error('CAJA_REQUERIDA');
    if (lines.length === 0) throw new Error('CARRITO_VACIO');

    const priceResult = resolverPrecio({
      lineas: lines.map(l => ({
        precioListaCentavos: l.precioListaCentavos,
        ajustePct: l.ajustePct,
        descuentoLineaPct: l.descuentoLineaPct,
        cantidad: l.cantidad,
      })),
      descuentoGlobalPct,
    });
    const { totalCentavos, ajusteRedondeoCentavos } = redondearPeso(priceResult.totalCentavos);

    const lineasPayload = lines.map((l, i) => {
      const lr = priceResult.lineas[i];
      return {
        producto_id: l.producto_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: lr.precioUnitarioCentavos / 100,
        descuento_linea: l.descuentoLineaPct,
        alicuota_iva: l.alicuota_iva,
        subtotal: lr.subtotalCentavos / 100,
      };
    });

    const importe_iva = lineasPayload.reduce(
      (sum, l) => sum + l.subtotal * l.alicuota_iva / (100 + l.alicuota_iva),
      0,
    );

    setLoading(true);
    setError(null);
    try {
      await f().venta.espera.pausar({
        caja_id: cajaActiva.id,
        cliente_id: clienteId,
        lineas: lineasPayload,
        descuento_global: descuentoGlobalPct,
        subtotal: priceResult.subtotalCentavos / 100,
        importe_iva,
        total: totalCentavos / 100,
        ajuste_redondeo: ajusteRedondeoCentavos / 100,
        alias,
      });
      reset();
      await cargarVentasEnEspera();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al poner en espera');
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function retomarVenta(venta_id: string): Promise<AvisosRetomar> {
    setLoading(true);
    setError(null);
    try {
      const result = await f().venta.espera.retomar({ venta_id });

      setLines(result.lineas.map((l: any) => ({
        producto_id: l.producto_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioListaCentavos: l.precio_lista_actual_centavos,
        ajustePct: 0,
        descuentoLineaPct: l.descuento_linea_pct,
        alicuota_iva: l.alicuota_iva,
        permite_fraccion: l.permite_fraccion,
        stock_fisico: l.stock_fisico,
        precioOrigen: 'vigente' as const,
        presentacion_id: l.presentacion_id ?? null,
        factor_a_stock: l.factor_a_stock ?? 1.0,
        unidad_abreviatura: l.unidad_abreviatura ?? '',
        presentaciones: [],
      })));

      setClienteIdState(result.cliente_id);
      setDescuentoGlobalPct(result.descuento_global);
      setVentaEnEsperaId(result.venta_id);
      setAvisosRetomar(result.avisos);

      await cargarVentasEnEspera();
      return result.avisos;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al retomar la venta');
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function descartarVenta(venta_id: string) {
    setLoading(true);
    setError(null);
    try {
      await f().venta.espera.descartar({ venta_id });
      await cargarVentasEnEspera();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descartar la venta');
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return {
    cajaActiva,
    lines,
    descuentoGlobalPct,
    formaPago,
    totales,
    loading,
    error,
    clienteId,
    clienteInfo,
    setCliente,
    addLinea,
    updateCantidad,
    updateDescuentoLinea,
    updatePresentacion,
    removeLine,
    setDescuentoGlobal: setDescuentoGlobalPct,
    setFormaPago,
    confirmar,
    reset,
    clearError: () => setError(null),
    ventasEnEspera,
    cantidadEnEspera: ventasEnEspera.length,
    pausarVenta,
    retomarVenta,
    descartarVenta,
    recargarVentasEnEspera: cargarVentasEnEspera,
    refrescarCaja,
    avisosRetomar,
    clearAvisosRetomar: () => setAvisosRetomar(null),
    precargarDesdePresupuesto,
    presupuestoId,
  };
}
