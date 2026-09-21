import { describe, it, expect } from 'vitest';
import { resolverRegla, precioConMargen, margenRealPct, type ReglaPrecio, type ContextoProducto } from './regla.js';

// ADR-049 §2 — una sola regla por producto y lista, con prioridad por especificidad
// (producto → marca → rubro → proveedor → lista); nunca combina reglas.

const CTX: ContextoProducto = {
  producto_id: 'p1',
  marca_id: 'm1',
  categoria_id: 'c1',
  proveedor_id: 'prov1',
};

function regla(over: Partial<ReglaPrecio>): ReglaPrecio {
  return {
    id: 'r', tipo: 'lista', objetivo_id: null, margen_pct: 0,
    margen_min_pct: null, margen_max_pct: null,
    redondeo_modo: 'ninguno', redondeo_valor: null, prioridad: 100,
    ...over,
  };
}

describe('resolverRegla', () => {
  it('sin reglas devuelve null (cae al fallback fuera de shared)', () => {
    expect(resolverRegla([], CTX)).toBeNull();
  });

  it('la regla de lista aplica cuando no hay otra más específica', () => {
    const base = regla({ id: 'base', tipo: 'lista', margen_pct: 30 });
    expect(resolverRegla([base], CTX)?.id).toBe('base');
  });

  it('producto gana sobre marca, rubro, proveedor y lista', () => {
    const reglas = [
      regla({ id: 'lista', tipo: 'lista' }),
      regla({ id: 'marca', tipo: 'marca', objetivo_id: 'm1' }),
      regla({ id: 'rubro', tipo: 'rubro', objetivo_id: 'c1' }),
      regla({ id: 'prov', tipo: 'proveedor', objetivo_id: 'prov1' }),
      regla({ id: 'prod', tipo: 'producto', objetivo_id: 'p1' }),
    ];
    expect(resolverRegla(reglas, CTX)?.id).toBe('prod');
  });

  it('marca gana sobre rubro cuando no hay regla de producto', () => {
    const reglas = [
      regla({ id: 'rubro', tipo: 'rubro', objetivo_id: 'c1' }),
      regla({ id: 'marca', tipo: 'marca', objetivo_id: 'm1' }),
    ];
    expect(resolverRegla(reglas, CTX)?.id).toBe('marca');
  });

  it('ignora reglas cuyo objetivo no matchea el contexto', () => {
    const reglas = [
      regla({ id: 'otra-marca', tipo: 'marca', objetivo_id: 'm-otra' }),
      regla({ id: 'lista', tipo: 'lista' }),
    ];
    expect(resolverRegla(reglas, CTX)?.id).toBe('lista');
  });

  it('a igual especificidad, menor prioridad gana', () => {
    const reglas = [
      regla({ id: 'a', tipo: 'marca', objetivo_id: 'm1', prioridad: 50 }),
      regla({ id: 'b', tipo: 'marca', objetivo_id: 'm1', prioridad: 10 }),
    ];
    expect(resolverRegla(reglas, CTX)?.id).toBe('b');
  });

  it('un contexto sin marca no matchea reglas de marca', () => {
    const ctxSinMarca = { ...CTX, marca_id: null };
    const reglas = [regla({ id: 'marca', tipo: 'marca', objetivo_id: 'm1' })];
    expect(resolverRegla(reglas, ctxSinMarca)).toBeNull();
  });
});

describe('precioConMargen (markup sobre costo neto)', () => {
  it('precio = costoNeto × (1 + margen/100)', () => {
    expect(precioConMargen(10000, 40)).toBe(14000);
  });
  it('redondea a centavo entero', () => {
    expect(precioConMargen(333, 10)).toBe(366);
  });
});

describe('margenRealPct (dato derivado de solo lectura)', () => {
  it('markup 40% sobre costo => 28,57% sobre precio', () => {
    // (14000 − 10000) / 14000 = 0,2857...
    expect(margenRealPct(14000, 10000)).toBeCloseTo(28.57, 1);
  });
  it('precio 0 => 0 (evita división por cero)', () => {
    expect(margenRealPct(0, 10000)).toBe(0);
  });
});
