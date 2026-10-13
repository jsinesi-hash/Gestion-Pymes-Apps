import { ivaPorAlicuota, type ComprobantePayload, type ItemComprobante, type PagoComprobante } from '@ferreteria/shared';

type VentaElaborados = {
  numero_interno: string; fecha: string | number | Date; total: number;
  descuento_global: number; ajuste_redondeo: number; estado?: string;
};
type LineaElaborados = {
  descripcion: string; cantidad: number; precio_unitario_centavos: number; descuento_linea_pct?: number;
  alicuota_iva: number; subtotal_centavos: number;
  modificadores: { descripcion: string; recargo_centavos: number }[];
};
export type ResultadoVentaElaborados = { venta: VentaElaborados; lineas: LineaElaborados[] };

const centavos = (pesos: number) => Math.round(pesos * 100);

/** Adaptador: resultado de `venta:confirmar` de Elaborados → B1. Las líneas ya vienen en centavos; la cabecera legada en pesos. */
export function ticketDesdeVentaElaborados(
  r: ResultadoVentaElaborados,
  cliente: { nombre: string },
  pagos: PagoComprobante[],
): ComprobantePayload {
  const items: ItemComprobante[] = r.lineas.map((l) => ({
    descripcion: l.modificadores.length > 0
      ? `${l.descripcion} — ${l.modificadores.map((m) => m.descripcion).join(', ')}`
      : l.descripcion,
    cantidad: l.cantidad,
    precioUnitarioCentavos: l.precio_unitario_centavos,
    subtotalCentavos: l.subtotal_centavos,
    alicuotaIva: l.alicuota_iva,
  }));
  // `venta.descuento_global` guarda el PORCENTAJE (igual que Retail), no un importe.
  const bruto = items.reduce((s, i) => s + i.subtotalCentavos, 0);
  const descuentoGlobalCentavos = bruto - Math.round(bruto * (1 - r.venta.descuento_global / 100));
  return {
    tipo: 'ticket_interno',
    numero: r.venta.numero_interno,
    fechaIso: new Date(r.venta.fecha).toISOString(),
    receptor: { nombre: cliente.nombre, condicionFiscal: 'Consumidor Final' },
    items,
    ivaPorAlicuota: ivaPorAlicuota(items, descuentoGlobalCentavos),
    descuentoGlobalCentavos,
    ajusteRedondeoCentavos: centavos(r.venta.ajuste_redondeo),
    totalCentavos: centavos(r.venta.total),
    pagos,
    anulado: r.venta.estado === 'anulada',
  };
}
