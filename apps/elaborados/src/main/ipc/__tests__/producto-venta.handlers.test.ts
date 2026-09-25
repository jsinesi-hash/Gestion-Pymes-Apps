import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { runCatalogSeedElaborados } from '../../catalog/seed';
import { articuloCreateHandler } from '../articulo';
import { categoriaVentaCreateHandler } from '../categoria-venta';
import { grupoModificadorCreateHandler, grupoModificadorOpcionSetHandler } from '../grupo-modificador';
import { productoVentaCreateHandler, productoVentaGetHandler, productoVentaListHandler } from '../producto-venta';

type Db = ReturnType<typeof setupDb>;

function base(db: Db) {
  runCatalogSeedElaborados(db);
  const impuesto = db.select().from(schema.impuesto).all()[0];
  const cat = categoriaVentaCreateHandler(db, { nombre: 'Helados', orden: 1 });
  const vasito = articuloCreateHandler(db, { nombre: 'Vasito', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const grupo = grupoModificadorCreateHandler(db, { nombre: 'Sabores' });
  const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
  grupoModificadorOpcionSetHandler(db, {
    grupo_modificador_id: grupo.id,
    opciones: [{ articulo_id: choco.id, nombre: 'Chocolate', recargo_centavos: 0, cantidad: 0, orden: 1 }],
  });
  return { impuesto, cat, vasito, grupo, choco };
}

describe('producto-venta handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('create con componentes fijos y un grupo de modificadores', () => {
    loginAsAdmin(db);
    const { impuesto, cat, vasito, grupo } = base(db);

    const pv = productoVentaCreateHandler(db, {
      nombre: 'Vasito', categoria_venta_id: cat.id, precio_centavos: 250000, impuesto_id: impuesto.id,
      componentes: [{ articulo_id: vasito.id, cantidad: 1 }],
      grupos: [{ grupo_modificador_id: grupo.id, min: 1, max: 1, cantidad_total: 0.15, modo_descuento: 'reparto', orden: 1 }],
    });

    const full = productoVentaGetHandler(db, { id: pv.id });
    expect(full?.nombre).toBe('Vasito');
    expect(full?.componentes).toHaveLength(1);
    expect(full?.grupos).toHaveLength(1);
    expect(full?.grupos[0].modo_descuento).toBe('reparto');
  });

  it('create con impuesto_id inexistente lanza IMPUESTO_NO_ENCONTRADO', () => {
    loginAsAdmin(db);
    const { cat, vasito } = base(db);
    expect(() => productoVentaCreateHandler(db, {
      nombre: 'Vasito', categoria_venta_id: cat.id, precio_centavos: 100, impuesto_id: 'nope',
      componentes: [{ articulo_id: vasito.id, cantidad: 1 }], grupos: [],
    })).toThrow('IMPUESTO_NO_ENCONTRADO');
  });

  it('list devuelve los productos de venta activos', () => {
    loginAsAdmin(db);
    const { impuesto, cat, vasito } = base(db);
    productoVentaCreateHandler(db, {
      nombre: 'Vasito', categoria_venta_id: cat.id, precio_centavos: 250000, impuesto_id: impuesto.id,
      componentes: [{ articulo_id: vasito.id, cantidad: 1 }], grupos: [],
    });
    expect(productoVentaListHandler(db)).toHaveLength(1);
  });
});
