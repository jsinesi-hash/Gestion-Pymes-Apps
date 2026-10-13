/**
 * B1 — forma canónica de un comprobante (ADR-091/092, spec familia §5.5).
 * Dinero en CENTAVOS, precios con IVA incluido. Hoy lo consume el ticket interno; en R2 lo consumirá
 * el motor ARCA (ADR-013 sigue abierto: nada de acá cierra esa decisión).
 */

export type ItemComprobante = {
  descripcion: string;
  cantidad: number;
  precioUnitarioCentavos: number;
  subtotalCentavos: number;
  alicuotaIva: number;
};

export type CondicionFiscalComprobante = 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento';

export type ReceptorComprobante = {
  nombre: string;
  condicionFiscal: CondicionFiscalComprobante;
  tipoDocumento?: 'DNI' | 'CUIT' | 'CUIL';
  numeroDocumento?: string;
};

export type IvaAlicuota = { alicuota: number; netoCentavos: number; ivaCentavos: number };

export type PagoComprobante = { medio: string; montoCentavos: number; recargoCentavos?: number };

export type ComprobantePayload = {
  tipo: 'ticket_interno';
  numero: string;
  fechaIso: string;
  receptor: ReceptorComprobante;
  items: ItemComprobante[];
  ivaPorAlicuota: IvaAlicuota[];
  descuentoGlobalCentavos: number;
  ajusteRedondeoCentavos: number;
  totalCentavos: number;
  pagos: PagoComprobante[];
  anulado?: boolean;
};

/**
 * Discrimina el IVA por alícuota a partir de ítems con IVA incluido. El descuento global se prorratea
 * entre ítems. Redondea por grupo, así que la suma puede diferir ±1 centavo del IVA total persistido en
 * la venta: el desglose es informativo (ticket interno).
 */
export function ivaPorAlicuota(items: readonly ItemComprobante[], descuentoGlobalCentavos: number): IvaAlicuota[] {
  const bruto = items.reduce((s, i) => s + i.subtotalCentavos, 0);
  const factor = bruto > 0 ? (bruto - descuentoGlobalCentavos) / bruto : 1;
  const grupos = new Map<number, number>();
  for (const i of items) grupos.set(i.alicuotaIva, (grupos.get(i.alicuotaIva) ?? 0) + i.subtotalCentavos * factor);
  return [...grupos]
    .sort(([a], [b]) => a - b)
    .map(([alicuota, brutoGrupo]) => {
      const ivaCentavos = Math.round(brutoGrupo * alicuota / (100 + alicuota));
      return { alicuota, netoCentavos: Math.round(brutoGrupo) - ivaCentavos, ivaCentavos };
    });
}
