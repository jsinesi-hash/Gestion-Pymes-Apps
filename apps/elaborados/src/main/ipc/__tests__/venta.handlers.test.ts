import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { runCatalogSeedElaborados } from '../../catalog/seed';
import { articuloCreateHandler } from '../articulo';
import { categoriaVentaCreateHandler } from '../categoria-venta';
import { grupoModificadorCreateHandler, grupoModificadorOpcionSetHandler } from '../grupo-modificador';
import { productoVentaCreateHandler } from '../producto-venta';
import { movimientoArticuloCreateHandler } from '../movimiento-articulo';
import { ventaCotizarHandler } from '../venta';

type Db = ReturnType<typeof setupDb>;

/** Heladería mínima: pote 1/4 (envase fijo + 1..3 sabores en reparto), palito de reventa que bloquea. */
function catalogo(db: Db) {
  runCatalogSeedElaborados(db);
  const impuesto = db.select().from(schema.impuesto).all()[0];
  const cat = categoriaVentaCreateHandler(db, { nombre: 'Helados', orden: 1 });
  const envase = articuloCreateHandler(db, { nombre: 'Envase 1/4', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const palitoArt = articuloCreateHandler(db, { nombre: 'Palito', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
  const ddl = articuloCreateHandler(db, { nombre: 'Dulce de leche', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
  const grupo = grupoModificadorCreateHandler(db, { nombre: 'Sabores' });
  grupoModificadorOpcionSetHandler(db, {
    grupo_modificador_id: grupo.id,
    opciones: [
      { articulo_id: choco.id, nombre: 'Chocolate', recargo_centavos: 0, cantidad: 0, orden: 1 },
      { articulo_id: ddl.id, nombre: 'Dulce de leche', recargo_centavos: 20000, cantidad: 0, orden: 2 },
    ],
  });
  const opciones = db.select().from(schema.grupo_modificador_opcion).all();
  const opChoco = opciones.find((o) => o.articulo_id === choco.id)!;
  const opDdl = opciones.find((o) => o.articulo_id === ddl.id)!;
  const pote = productoVentaCreateHandler(db, {
    nombre: 'Pote 1/4', categoria_venta_id: cat.id, precio_centavos: 150000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: envase.id, cantidad: 1 }],
    grupos: [{ grupo_modificador_id: grupo.id, min: 1, max: 3, cantidad_total: 0.25, modo_descuento: 'reparto', orden: 1 }],
  });
  const palito = productoVentaCreateHandler(db, {
    nombre: 'Palito', categoria_venta_id: cat.id, precio_centavos: 100000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: palitoArt.id, cantidad: 1 }], grupos: [],
  });
  const stock = (articulo_id: string, cantidad: number) =>
    movimientoArticuloCreateHandler(db, { articulo_id, motivo: 'compra', cantidad, costo_unitario_centavos: 100 });
  stock(envase.id, 10); stock(palitoArt.id, 2); stock(choco.id, 5); stock(ddl.id, 5);
  return { pote, palito, grupo, opChoco, opDdl, envase, palitoArt, choco, ddl };
}

function stockDe(db: Db, articulo_id: string) {
  return db.select().from(schema.existencia_articulo)
    .where(eq(schema.existencia_articulo.articulo_id, articulo_id)).get()!.stock;
}

describe('venta handlers (Elaborados)', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  describe('ventaCotizarHandler', () => {
    it('valoriza el carrito desde el catálogo sin persistir nada', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const r = ventaCotizarHandler(db, {
        lineas: [{ producto_venta_id: c.pote.id, cantidad: 1,
          modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id, c.opDdl.id] }] }],
      });
      expect(r.lineas[0].precio_unitario_centavos).toBe(170000);
      expect(r.total_centavos).toBe(170000);
      expect(r.bloqueos).toEqual([]);
      expect(r.advertencias).toEqual([]);
      expect(db.select().from(schema.venta).all()).toHaveLength(0);
    });

    it('informa bloqueos (reventa sin stock) y advertencias (granel que quedaría en negativo)', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const r = ventaCotizarHandler(db, {
        lineas: [
          { producto_venta_id: c.palito.id, cantidad: 3 }, // stock 2, bloquea
          { producto_venta_id: c.pote.id, cantidad: 1, // 0.25 kg repartido: queda dentro del stock
            modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id] }] },
        ],
      });
      expect(r.bloqueos.map((b) => b.nombre)).toEqual(['Palito']);
      const grande = ventaCotizarHandler(db, {
        lineas: [{ producto_venta_id: c.pote.id, cantidad: 30,
          modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id] }] }],
      });
      expect(grande.advertencias.map((a) => a.nombre)).toContain('Chocolate'); // 30 × 0.25 = 7.5 > 5, no bloquea
    });

    it('rechaza sin sesión y payload mal formado', () => {
      expect(() => ventaCotizarHandler(db, { lineas: [] })).toThrow('UNAUTHENTICATED');
      loginAsAdmin(db);
      expect(() => ventaCotizarHandler(db, { lineas: 'x' })).toThrow();
      expect(() => ventaCotizarHandler(db, { lineas: [] })).toThrow('CARRITO_VACIO');
    });
  });
});
