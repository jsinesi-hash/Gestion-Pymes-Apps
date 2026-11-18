import { ivaPorAlicuota, type ComprobantePayload, type ItemComprobante, type PagoComprobante } from '@ferreteria/shared';

type VentaRetail = {
  numero_interno: string; total_centavos: number; descuento_global: number; ajuste_redondeo_centavos: number;
  forma_pago: string; fecha: string | number | Date; estado?: string;
};
type DetalleRetail = {
  descripcion: string; cantidad: number; precio_unitario_centavos: number; subtotal_centavos: number; alicuota_iva?: number;
};

/** Pago tal como lo confirma el modal de cobro (subconjunto de `VentaPagoPayload`). */
export type PagoConfirmado = { medio_pago: string; monto_centavos: number; recargo_centavos?: number };

/** Adaptador: la venta de Retail (centavos, ADR-157) → B1. Mapeo mecánico, sin lógica de negocio. */
export function ticketDesdeVentaRetail(
  r: { venta: VentaRetail; detalles: DetalleRetail[] },
  clienteNombre: string,
  pagos: readonly PagoConfirmado[] = [],
): ComprobantePayload {
  const items: ItemComprobante[] = r.detalles.map((d) => ({
    descripcion: d.descripcion, cantidad: d.cantidad,
    precioUnitarioCentavos: d.precio_unitario_centavos, subtotalCentavos: d.subtotal_centavos,
    alicuotaIva: d.alicuota_iva ?? 21,
  }));
  // En Retail `venta.descuento_global` guarda el PORCENTAJE (el POS envía descuentoGlobalPct), no un importe.
  const brutoCentavos = items.reduce((s, i) => s + i.subtotalCentavos, 0);
  // Misma fórmula que `resolverPrecio` (shared/precio.ts): bruto − round(bruto × (1 − pct/100)), así el ticket cierra al centavo.
  const descuentoGlobalCentavos = brutoCentavos - Math.round(brutoCentavos * (1 - r.venta.descuento_global / 100));
  const totalCentavos = r.venta.total_centavos;
  // `forma_pago` es un campo legado (primer medio): solo respalda al ticket si no hay pagos reales.
  const pagosTicket: PagoComprobante[] = pagos.length > 0
    ? pagos.map((p) => ({
        medio: p.medio_pago, montoCentavos: p.monto_centavos,
        ...(p.recargo_centavos !== undefined ? { recargoCentavos: p.recargo_centavos } : {}),
      }))
    : [{ medio: r.venta.forma_pago, montoCentavos: totalCentavos }];
  return {
    tipo: 'ticket_interno',
    numero: r.venta.numero_interno,
    fechaIso: new Date(r.venta.fecha).toISOString(),
    receptor: { nombre: clienteNombre, condicionFiscal: 'Consumidor Final' },
    items,
    ivaPorAlicuota: ivaPorAlicuota(items, descuentoGlobalCentavos),
    descuentoGlobalCentavos,
    ajusteRedondeoCentavos: r.venta.ajuste_redondeo_centavos,
    totalCentavos,
    pagos: pagosTicket,
    anulado: r.venta.estado === 'anulada',
  };
}
