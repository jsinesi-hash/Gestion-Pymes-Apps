import { ivaPorAlicuota, type ComprobantePayload, type ItemComprobante } from '@ferreteria/shared';

type VentaRetail = {
  numero_interno: string; total: number; descuento_global: number; ajuste_redondeo: number;
  forma_pago: string; fecha: string | number | Date; estado?: string;
};
type DetalleRetail = {
  descripcion: string; cantidad: number; precio_unitario: number; subtotal: number; alicuota_iva?: number;
};

const centavos = (pesos: number) => Math.round(pesos * 100);

/** Adaptador: la venta de Retail (pesos) → B1 (centavos). Mapeo mecánico, sin lógica de negocio. */
export function ticketDesdeVentaRetail(
  r: { venta: VentaRetail; detalles: DetalleRetail[] },
  clienteNombre: string,
): ComprobantePayload {
  const items: ItemComprobante[] = r.detalles.map((d) => ({
    descripcion: d.descripcion, cantidad: d.cantidad,
    precioUnitarioCentavos: centavos(d.precio_unitario), subtotalCentavos: centavos(d.subtotal),
    alicuotaIva: d.alicuota_iva ?? 21,
  }));
  // En Retail `venta.descuento_global` guarda el PORCENTAJE (el POS envía descuentoGlobalPct), no un importe.
  const brutoCentavos = items.reduce((s, i) => s + i.subtotalCentavos, 0);
  // Misma fórmula que `resolverPrecio` (shared/precio.ts): bruto − round(bruto × (1 − pct/100)), así el ticket cierra al centavo.
  const descuentoGlobalCentavos = brutoCentavos - Math.round(brutoCentavos * (1 - r.venta.descuento_global / 100));
  const totalCentavos = centavos(r.venta.total);
  return {
    tipo: 'ticket_interno',
    numero: r.venta.numero_interno,
    fechaIso: new Date(r.venta.fecha).toISOString(),
    receptor: { nombre: clienteNombre, condicionFiscal: 'Consumidor Final' },
    items,
    ivaPorAlicuota: ivaPorAlicuota(items, descuentoGlobalCentavos),
    descuentoGlobalCentavos,
    ajusteRedondeoCentavos: centavos(r.venta.ajuste_redondeo),
    totalCentavos,
    pagos: [{ medio: r.venta.forma_pago, montoCentavos: totalCentavos }],
    anulado: r.venta.estado === 'anulada',
  };
}
