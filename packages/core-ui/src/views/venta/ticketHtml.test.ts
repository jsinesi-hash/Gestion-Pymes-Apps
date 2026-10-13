import { describe, it, expect } from 'vitest';
import type { ComprobantePayload } from '@ferreteria/shared';
import { buildTicketHtml, formatPesos } from './ticketHtml';

const base: ComprobantePayload = {
  tipo: 'ticket_interno', numero: 'V-C1-000001', fechaIso: '2026-10-13T15:30:00.000Z',
  receptor: { nombre: 'Consumidor Final', condicionFiscal: 'Consumidor Final' },
  items: [
    { descripcion: 'Pote 1/4 — Choco, DDL', cantidad: 2, precioUnitarioCentavos: 170000, subtotalCentavos: 340000, alicuotaIva: 21 },
    { descripcion: 'Palito', cantidad: 1, precioUnitarioCentavos: 100000, subtotalCentavos: 100000, alicuotaIva: 21 },
  ],
  ivaPorAlicuota: [{ alicuota: 21, netoCentavos: 363636, ivaCentavos: 76364 }],
  descuentoGlobalCentavos: 0, ajusteRedondeoCentavos: 0, totalCentavos: 440000,
  pagos: [{ medio: 'efectivo', montoCentavos: 440000 }],
};

describe('formatPesos', () => {
  it('formatea centavos como pesos es-AR con 2 decimales', () => {
    expect(formatPesos(440000)).toBe('4.400,00');
    expect(formatPesos(5)).toBe('0,05');
  });
});

describe('buildTicketHtml', () => {
  it('incluye número, ítems con cantidad, total y forma de pago', () => {
    const html = buildTicketHtml(base);
    expect(html).toContain('TICKET INTERNO');
    expect(html).toContain('V-C1-000001');
    expect(html).toContain('Pote 1/4 — Choco, DDL × 2');
    expect(html).toContain('$ 3.400,00');
    expect(html).toContain('TOTAL');
    expect(html).toContain('$ 4.400,00');
    expect(html).toContain('Efectivo');
  });

  it('muestra descuento global y ajuste de redondeo solo cuando existen, como importes', () => {
    expect(buildTicketHtml(base)).not.toContain('Descuento global');
    expect(buildTicketHtml(base)).not.toContain('Ajuste redondeo');
    const html = buildTicketHtml({ ...base, descuentoGlobalCentavos: 5000, ajusteRedondeoCentavos: -50 });
    expect(html).toContain('Descuento global');
    expect(html).toContain('-$ 50,00');
    expect(html).toContain('Ajuste redondeo');
  });

  it('escapa HTML en descripciones y marca ANULADA', () => {
    const html = buildTicketHtml({
      ...base, anulado: true,
      items: [{ ...base.items[0], descripcion: '<b>Pote</b> & "sabor"' }],
    });
    expect(html).not.toContain('<b>Pote</b>');
    expect(html).toContain('&lt;b&gt;Pote&lt;/b&gt; &amp; &quot;sabor&quot;');
    expect(html).toContain('ANULADA');
  });

  it('lista un renglón por pago cuando hay varios medios', () => {
    const html = buildTicketHtml({ ...base, pagos: [
      { medio: 'efectivo', montoCentavos: 240000 }, { medio: 'cuenta_corriente', montoCentavos: 200000 },
    ] });
    expect(html).toContain('Efectivo');
    expect(html).toContain('Cuenta corriente');
  });
});
