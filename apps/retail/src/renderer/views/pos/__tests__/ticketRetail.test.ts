import { describe, it, expect } from 'vitest';
import { ticketDesdeVentaRetail } from '../ticketRetail';

const result = {
  venta: { id: 'v-1', numero_interno: 'V-C1-000007', total: 1000, descuento_global: 5, ajuste_redondeo: 0.5,
    forma_pago: 'tarjeta', fecha: '2026-10-13T15:30:00.000Z', estado: 'confirmada' },
  detalles: [
    { id: 'd-1', descripcion: 'Tornillo M6', cantidad: 2, precio_unitario: 400, subtotal: 800, alicuota_iva: 21 },
    { id: 'd-2', descripcion: 'Arandela', cantidad: 1, precio_unitario: 250, subtotal: 250, alicuota_iva: 21 },
  ],
};

describe('ticketDesdeVentaRetail', () => {
  it('convierte pesos a centavos, el % de descuento global a importe y arma el ComprobantePayload', () => {
    const c = ticketDesdeVentaRetail(result, 'Consumidor Final');
    expect(c).toMatchObject({
      tipo: 'ticket_interno', numero: 'V-C1-000007', totalCentavos: 100000,
      descuentoGlobalCentavos: 5250, ajusteRedondeoCentavos: 50,
      receptor: { nombre: 'Consumidor Final', condicionFiscal: 'Consumidor Final' },
    });
    expect(c.items[0]).toEqual({ descripcion: 'Tornillo M6', cantidad: 2, precioUnitarioCentavos: 40000, subtotalCentavos: 80000, alicuotaIva: 21 });
    expect(c.pagos).toEqual([{ medio: 'tarjeta', montoCentavos: 100000 }]);
    expect(c.ivaPorAlicuota).toHaveLength(1);
    expect(c.anulado).toBe(false);
  });

  it('marca anulado si la venta está anulada', () => {
    expect(ticketDesdeVentaRetail({ ...result, venta: { ...result.venta, estado: 'anulada' } }, 'X').anulado).toBe(true);
  });
});
