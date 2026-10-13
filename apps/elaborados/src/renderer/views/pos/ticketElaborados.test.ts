import { describe, it, expect } from 'vitest';
import { ticketDesdeVentaElaborados } from './ticketElaborados';

const venta = (o: Record<string, unknown> = {}) => ({
  numero_interno: 'V-C1-000007', fecha: 1760000000000, total: 810, descuento_global: 0, ajuste_redondeo: 0,
  estado: 'confirmada', ...o,
});
const linea = (o: Record<string, unknown> = {}) => ({
  descripcion: 'Cucurucho', cantidad: 1, precio_unitario_centavos: 90000, descuento_linea_pct: 0,
  alicuota_iva: 21, subtotal_centavos: 90000, modificadores: [], ...o,
});
const cliente = { nombre: 'Consumidor Final' };

describe('ticketDesdeVentaElaborados', () => {
  it('arma descripciones con y sin sabores y copia montos en centavos', () => {
    const t = ticketDesdeVentaElaborados(
      { venta: venta({ total: 1900 }), lineas: [
        linea({ descripcion: 'Pote', precio_unitario_centavos: 100000, subtotal_centavos: 100000 }),
        linea({ descripcion: 'Cucurucho', precio_unitario_centavos: 90000, subtotal_centavos: 90000,
          modificadores: [{ descripcion: 'Choco', recargo_centavos: 0 }, { descripcion: 'DDL', recargo_centavos: 0 }] }),
      ] },
      cliente, [{ medio: 'efectivo', montoCentavos: 190000 }],
    );
    expect(t.items[0]).toMatchObject({ descripcion: 'Pote', precioUnitarioCentavos: 100000, subtotalCentavos: 100000 });
    expect(t.items[1].descripcion).toBe('Cucurucho — Choco, DDL');
    expect(t.totalCentavos).toBe(190000);
    expect(t.numero).toBe('V-C1-000007');
    expect(t.receptor).toEqual({ nombre: 'Consumidor Final', condicionFiscal: 'Consumidor Final' });
    expect(t.fechaIso).toBe(new Date(1760000000000).toISOString());
  });

  it('descuento global 10% sobre 90000 da 9000 y el ticket cierra', () => {
    const t = ticketDesdeVentaElaborados(
      { venta: venta({ descuento_global: 10, total: 810, ajuste_redondeo: 0 }), lineas: [linea()] },
      cliente, [{ medio: 'efectivo', montoCentavos: 81000 }],
    );
    expect(t.descuentoGlobalCentavos).toBe(9000);
    const suma = t.items.reduce((s, i) => s + i.subtotalCentavos, 0);
    expect(suma - t.descuentoGlobalCentavos + t.ajusteRedondeoCentavos).toBe(t.totalCentavos);
  });

  it('pasa los pagos mixtos tal cual', () => {
    const pagos = [
      { medio: 'efectivo', montoCentavos: 50000 },
      { medio: 'tarjeta', montoCentavos: 31000, recargoCentavos: 1000 },
    ];
    const t = ticketDesdeVentaElaborados({ venta: venta(), lineas: [linea()] }, cliente, pagos);
    expect(t.pagos).toEqual(pagos);
  });

  it('incluye el IVA por alícuota', () => {
    const t = ticketDesdeVentaElaborados({ venta: venta({ total: 900 }), lineas: [linea()] }, cliente, []);
    expect(t.ivaPorAlicuota).toHaveLength(1);
    expect(t.ivaPorAlicuota[0].alicuota).toBe(21);
    expect(t.ivaPorAlicuota[0].ivaCentavos).toBeGreaterThan(0);
  });

  it('estado anulada marca anulado', () => {
    const t = ticketDesdeVentaElaborados({ venta: venta({ estado: 'anulada' }), lineas: [linea()] }, cliente, []);
    expect(t.anulado).toBe(true);
    const t2 = ticketDesdeVentaElaborados({ venta: venta(), lineas: [linea()] }, cliente, []);
    expect(t2.anulado).toBe(false);
  });
});
