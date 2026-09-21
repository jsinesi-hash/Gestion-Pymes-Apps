import { describe, it, expect } from 'vitest';
import { validarFila, type FilaValidacionInput, type Umbrales } from './validacion';

const UMBRALES: Umbrales = { variacionMaximaPct: 30, margenMinimoPct: 0 };

function fila(over: Partial<FilaValidacionInput>): FilaValidacionInput {
  return {
    costoNetoCentavos: 10000,
    precioPropuestoCentavos: 14000,
    precioAnteriorCentavos: 13000,
    tienePreferido: true,
    proveedorActivo: true,
    productoActivo: true,
    margenMinPct: null,
    margenMaxPct: null,
    ...over,
  };
}

describe('validarFila (ADR-049 §5)', () => {
  it('fila sana => ok', () => {
    expect(validarFila(fila({}), UMBRALES).estado).toBe('ok');
  });

  it('precio bajo el costo neto => error', () => {
    const r = validarFila(fila({ precioPropuestoCentavos: 9000 }), UMBRALES);
    expect(r.estado).toBe('error');
    expect(r.motivo).toMatch(/costo/i);
  });

  it('sin proveedor preferido => error', () => {
    expect(validarFila(fila({ tienePreferido: false, costoNetoCentavos: null }), UMBRALES).estado).toBe('error');
  });

  it('proveedor inactivo => error', () => {
    expect(validarFila(fila({ proveedorActivo: false }), UMBRALES).estado).toBe('error');
  });

  it('producto inactivo => error', () => {
    expect(validarFila(fila({ productoActivo: false }), UMBRALES).estado).toBe('error');
  });

  it('markup por debajo del mínimo global => error', () => {
    // costo 10000, precio 10500 => markup 5%; mínimo 10% => error
    const r = validarFila(fila({ precioPropuestoCentavos: 10500 }), { ...UMBRALES, margenMinimoPct: 10 });
    expect(r.estado).toBe('error');
    expect(r.motivo).toMatch(/margen/i);
  });

  it('markup fuera del máximo de la regla => error', () => {
    // markup 40% > máx 30 de la regla
    const r = validarFila(fila({ margenMaxPct: 30 }), UMBRALES);
    expect(r.estado).toBe('error');
  });

  it('variación mayor al umbral => advertencia', () => {
    // anterior 10000, propuesto 14000 => +40% > 30 => advertencia
    const r = validarFila(fila({ precioAnteriorCentavos: 10000 }), UMBRALES);
    expect(r.estado).toBe('advertencia');
    expect(r.motivo).toMatch(/variaci/i);
  });

  it('sin precio anterior no evalúa variación => ok', () => {
    expect(validarFila(fila({ precioAnteriorCentavos: null }), UMBRALES).estado).toBe('ok');
  });

  it('el error tiene prioridad sobre la advertencia', () => {
    const r = validarFila(fila({ precioPropuestoCentavos: 9000, precioAnteriorCentavos: 10000 }), UMBRALES);
    expect(r.estado).toBe('error');
  });
});
