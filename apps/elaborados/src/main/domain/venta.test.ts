import { describe, it, expect } from 'vitest';
import {
  valorizarCarrito,
  type ProductoCatalogo, type OpcionCatalogo, type Carrito,
} from './venta';

const GRUPO = 'g-sabores';
const op = (id: string, art: string, recargo = 0, cantidad = 0): OpcionCatalogo =>
  ({ id, grupo_modificador_id: GRUPO, articulo_id: art, nombre: id, recargo_centavos: recargo, cantidad });

const OPCIONES = new Map<string, OpcionCatalogo>([
  ['choco', op('choco', 'a-choco')],
  ['ddl', op('ddl', 'a-ddl')],
  ['frut', op('frut', 'a-frut')],
  ['premium', op('premium', 'a-premium', 20000)],
]);

function pote(modo: 'reparto' | 'por_opcion' | 'sin_descuento' = 'reparto'): ProductoCatalogo {
  return {
    id: 'p-pote', nombre: 'Pote 1/4', precio_centavos: 150000, alicuota_iva: 21,
    componentes: [{ articulo_id: 'a-envase', cantidad: 1 }],
    grupos: [{ grupo_modificador_id: GRUPO, min: 1, max: 3, cantidad_total: 0.25, modo_descuento: modo }],
  };
}
const palito: ProductoCatalogo = {
  id: 'p-palito', nombre: 'Palito', precio_centavos: 100000, alicuota_iva: 21,
  componentes: [{ articulo_id: 'a-palito', cantidad: 1 }], grupos: [],
};
const catalogo = (...ps: ProductoCatalogo[]) => new Map(ps.map((p) => [p.id, p]));
const cart = (lineas: Carrito['lineas'], descuento_global_pct = 0): Carrito => ({ lineas, descuento_global_pct });

describe('valorizarCarrito', () => {
  it('producto simple: subtotal, total, IVA incluido y sin ajuste de redondeo', () => {
    const v = valorizarCarrito(catalogo(palito), OPCIONES, cart([
      { producto_venta_id: 'p-palito', cantidad: 2, descuento_linea_pct: 0, modificadores: [] },
    ]));
    expect(v.lineas[0]).toMatchObject({ precio_unitario_centavos: 100000, subtotal_centavos: 200000, descripcion: 'Palito' });
    expect(v.subtotal_centavos).toBe(200000);
    expect(v.total_centavos).toBe(200000);
    expect(v.ajuste_redondeo_centavos).toBe(0);
    expect(v.importe_iva_centavos).toBe(34711); // 200000 * 21 / 121
    expect(v.consumo_total).toEqual([{ articulo_id: 'a-palito', cantidad: 2 }]);
  });

  it('pote con 3 sabores en reparto: consumo parejo, envase fijo y recargo premium en el unitario', () => {
    const v = valorizarCarrito(catalogo(pote()), OPCIONES, cart([{
      producto_venta_id: 'p-pote', cantidad: 1, descuento_linea_pct: 0,
      modificadores: [{ grupo_modificador_id: GRUPO, opcion_ids: ['choco', 'ddl', 'premium'] }],
    }]));
    expect(v.lineas[0].precio_unitario_centavos).toBe(170000); // 150000 + 20000
    expect(v.total_centavos).toBe(170000);
    const consumo = Object.fromEntries(v.consumo_total.map((c) => [c.articulo_id, c.cantidad]));
    expect(consumo['a-envase']).toBe(1);
    expect(consumo['a-choco']).toBeCloseTo(0.083333, 5);
    expect(consumo['a-ddl']).toBeCloseTo(0.083333, 5);
    expect(consumo['a-premium']).toBeCloseTo(0.083333, 5);
    expect(v.lineas[0].opciones.map((o) => o.cantidad_consumida)).toEqual([0.083333, 0.083333, 0.083333]);
    expect(v.lineas[0].opciones[2]).toMatchObject({ opcion_id: 'premium', recargo_centavos: 20000, articulo_id: 'a-premium' });
  });

  it('por_opcion consume la cantidad de cada opción; sin_descuento no consume sabores', () => {
    const conCantidad = new Map(OPCIONES);
    conCantidad.set('choco', op('choco', 'a-choco', 0, 0.05));
    const porOpcion = valorizarCarrito(catalogo(pote('por_opcion')), conCantidad, cart([{
      producto_venta_id: 'p-pote', cantidad: 2, descuento_linea_pct: 0,
      modificadores: [{ grupo_modificador_id: GRUPO, opcion_ids: ['choco'] }],
    }]));
    expect(porOpcion.consumo_total.find((c) => c.articulo_id === 'a-choco')?.cantidad).toBeCloseTo(0.1, 6);

    const sin = valorizarCarrito(catalogo(pote('sin_descuento')), OPCIONES, cart([{
      producto_venta_id: 'p-pote', cantidad: 1, descuento_linea_pct: 0,
      modificadores: [{ grupo_modificador_id: GRUPO, opcion_ids: ['choco', 'ddl'] }],
    }]));
    expect(sin.consumo_total.map((c) => c.articulo_id)).toEqual(['a-envase']);
    expect(sin.lineas[0].opciones.every((o) => o.cantidad_consumida === 0)).toBe(true);
  });

  it('descuento de línea y global: base → línea → global; IVA sobre el total con descuento', () => {
    const v = valorizarCarrito(catalogo(palito), OPCIONES, cart([
      { producto_venta_id: 'p-palito', cantidad: 1, descuento_linea_pct: 10, modificadores: [] },
    ], 10));
    expect(v.lineas[0].subtotal_centavos).toBe(90000);
    expect(v.subtotal_centavos).toBe(90000);
    expect(v.descuento_global_centavos).toBe(9000);
    expect(v.total_centavos).toBe(81000);
    expect(v.importe_iva_centavos).toBe(14058); // 81000 * 21 / 121
  });

  it('redondea el total al peso y reporta el ajuste (.5 sube)', () => {
    const caro = { ...palito, precio_centavos: 100050 };
    const v = valorizarCarrito(catalogo(caro), OPCIONES, cart([
      { producto_venta_id: 'p-palito', cantidad: 1, descuento_linea_pct: 0, modificadores: [] },
    ]));
    expect(v.total_centavos).toBe(100100);
    expect(v.ajuste_redondeo_centavos).toBe(50);
  });

  it('agrega el consumo por artículo entre líneas', () => {
    const v = valorizarCarrito(catalogo(palito), OPCIONES, cart([
      { producto_venta_id: 'p-palito', cantidad: 1, descuento_linea_pct: 0, modificadores: [] },
      { producto_venta_id: 'p-palito', cantidad: 3, descuento_linea_pct: 0, modificadores: [] },
    ]));
    expect(v.consumo_total).toEqual([{ articulo_id: 'a-palito', cantidad: 4 }]);
  });

  it('valida el carrito contra el catálogo', () => {
    const c = catalogo(pote(), palito);
    const lin = (over: Partial<Carrito['lineas'][number]> = {}) => cart([{
      producto_venta_id: 'p-pote', cantidad: 1, descuento_linea_pct: 0,
      modificadores: [{ grupo_modificador_id: GRUPO, opcion_ids: ['choco'] }], ...over,
    }]);
    expect(() => valorizarCarrito(c, OPCIONES, cart([]))).toThrow('CARRITO_VACIO');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ producto_venta_id: 'x' }))).toThrow('PRODUCTO_VENTA_NO_ENCONTRADO');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ cantidad: 0 }))).toThrow('CANTIDAD_INVALIDA');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ descuento_linea_pct: 101 }))).toThrow('DESCUENTO_INVALIDO');
    expect(() => valorizarCarrito(c, OPCIONES, cart(lin().lineas, -1))).toThrow('DESCUENTO_INVALIDO');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ modificadores: [] }))).toThrow('MODIFICADOR_MIN');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ modificadores: [{ grupo_modificador_id: GRUPO, opcion_ids: ['choco', 'ddl', 'frut', 'premium'] }] }))).toThrow('MODIFICADOR_MAX');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ modificadores: [{ grupo_modificador_id: GRUPO, opcion_ids: ['choco', 'choco'] }] }))).toThrow('OPCION_DUPLICADA');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ modificadores: [{ grupo_modificador_id: GRUPO, opcion_ids: ['nope'] }] }))).toThrow('OPCION_INVALIDA');
    expect(() => valorizarCarrito(c, OPCIONES, lin({ modificadores: [{ grupo_modificador_id: 'otro', opcion_ids: ['choco'] }] }))).toThrow('GRUPO_NO_PERMITIDO');
  });
});
