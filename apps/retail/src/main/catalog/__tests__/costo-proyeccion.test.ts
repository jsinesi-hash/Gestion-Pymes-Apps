import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { cajaAbrirHandler } from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler } from '../../ipc/producto';
import { stockEntradaHandler, stockAjusteHandler } from '../../ipc/stock';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { validarProductos, confirmarProductos } from '../../ipc/importar';
import { runDemoCatalogSeed } from '../../base-seed/demo-catalog';
import { seedCatalog } from '../../dev-seed/catalog';
import {
  diferenciasDeCostoPromedio, proyectarCostoPromedio, recalcularCostoPromedio, recalcularCostosPromedioUnaVez,
  CLAVE_COSTO_PROMEDIO_RECALCULADO,
} from '../stock-proyeccion';

// ADR-151 (corrección de F1 PR1): el costo promedio ponderado se deriva del libro.
// ADR-157 (PR-C3): en centavos enteros, redondeado al centavo en cada entrada.
const CF_ID = 'cf000000-0000-0000-0000-000000000001';

describe('proyección del costo promedio (Retail)', () => {
  let db: ReturnType<typeof setupDb>;
  const cpp = (id: string) => db.select().from(schema.producto).where(eq(schema.producto.id, id)).get()!.precio_costo_promedio_centavos;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function producto(nombre: string, stock_inicial?: { cantidad: number; costo_centavos: number }) {
    const cat = categoriaCreateHandler(db, { nombre: `Cat ${nombre}` });
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    return productoCreateHandler(db, {
      nombre_corto: nombre, categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista_centavos: 100000,
      ...(stock_inicial ? { stock_inicial } : {}),
    });
  }

  it('alta con costo, entradas con y sin costo, ventas y conteos: el guardado coincide con la proyección', () => {
    const a = producto('A', { cantidad: 10, costo_centavos: 10000 });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 10, costo_unitario_centavos: 20000 }); // 15000
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CF_ID,
      lineas: [{ producto_id: a.id, descripcion: 'x', cantidad: 5, precio_unitario_centavos: 100000, descuento_linea: 0, alicuota_iva: 21, subtotal_centavos: 500000 }],
      descuento_global: 0, subtotal_centavos: 500000, importe_iva_centavos: 86777, total_centavos: 500000, ajuste_redondeo_centavos: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 500_000 }],
    });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 5, costo_unitario_centavos: 30000 }); // (15·15000 + 5·30000) / 20
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 3 }); // sin costo: no cambia el promedio
    stockAjusteHandler(db, { producto_id: a.id, cantidad_contada: 4, observaciones: 'conteo' });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 4, costo_unitario_centavos: 10000 }); // (4·18750 + 4·10000) / 8

    expect(cpp(a.id)).toBe(14375);
    expect(proyectarCostoPromedio(db, a.id)).toBe(cpp(a.id));
    expect(diferenciasDeCostoPromedio(db)).toEqual([]);
  });

  it('un producto importado con costo y sin stock deja un movimiento que fija ese costo', () => {
    categoriaCreateHandler(db, { nombre: 'Herramientas' });
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,costo\nPinza,u,900,21,Herramientas,450';
    confirmarProductos(db, { rows: validarProductos(db, { csv }).rows });
    const pinza = db.select().from(schema.producto).where(eq(schema.producto.nombre_corto, 'Pinza')).get()!;
    expect(pinza.precio_costo_promedio_centavos).toBe(45000);
    const movs = db.select().from(schema.movimiento_stock).where(eq(schema.movimiento_stock.producto_id, pinza.id)).all();
    expect(movs).toMatchObject([{ tipo: 'entrada', motivo: 'inicial', cantidad: 0, costo_unitario_centavos: 45000 }]);
    expect(proyectarCostoPromedio(db, pinza.id)).toBe(45000);
    expect(diferenciasDeCostoPromedio(db)).toEqual([]);
  });

  it('redondea al centavo en cada entrada, igual en el handler y en la proyección', () => {
    const a = producto('Tornillo', { cantidad: 3, costo_centavos: 333 });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 7, costo_unitario_centavos: 1001 }); // 800,6 → 801
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 2, costo_unitario_centavos: 999 });  // (10·801 + 2·999) / 12 = 834
    expect(cpp(a.id)).toBe(834);
    expect(Number.isInteger(cpp(a.id))).toBe(true);
    expect(proyectarCostoPromedio(db, a.id)).toBe(834);
  });

  it('recálculo de una sola vez tras migrar a centavos: corrige lo desfasado y marca el parámetro', () => {
    const a = producto('A', { cantidad: 3, costo_centavos: 333 });
    const b = producto('B', { cantidad: 1, costo_centavos: 1000 });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 7, costo_unitario_centavos: 1001 });
    // Lo que deja la migración: ROUND(promedio en pesos sin redondear × 100) puede diferir de la proyección.
    db.update(schema.producto).set({ precio_costo_promedio_centavos: 800 }).where(eq(schema.producto.id, a.id)).run();
    expect(recalcularCostosPromedioUnaVez(db)).toBe(1);
    expect(cpp(a.id)).toBe(801);
    expect(cpp(b.id)).toBe(1000);
    const marca = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, CLAVE_COSTO_PROMEDIO_RECALCULADO)).get();
    expect(marca?.valor).toBe('true');
    // Segunda vez no hace nada, aunque haya un desfasaje nuevo (eso es trabajo del test de integridad).
    db.update(schema.producto).set({ precio_costo_promedio_centavos: 1 }).where(eq(schema.producto.id, b.id)).run();
    expect(recalcularCostosPromedioUnaVez(db)).toBe(0);
    expect(cpp(b.id)).toBe(1);
  });

  it('recalcular corrige un costo desfasado; si cuadra no toca la fila', () => {
    const a = producto('A', { cantidad: 2, costo_centavos: 5000 });
    expect(recalcularCostoPromedio(db, a.id)).toEqual({ guardado: 5000, proyectado: 5000, corregido: false });
    db.update(schema.producto).set({ precio_costo_promedio_centavos: 7700 }).where(eq(schema.producto.id, a.id)).run();
    expect(recalcularCostoPromedio(db, a.id)).toEqual({ guardado: 7700, proyectado: 5000, corregido: true });
    expect(cpp(a.id)).toBe(5000);
  });

  it('el catálogo demo y el seed de desarrollo cuadran', () => {
    runDemoCatalogSeed(db);
    expect(diferenciasDeCostoPromedio(db)).toEqual([]);
    const otra = setupDb();
    runCatalogSeed(otra);
    seedCatalog(otra, false);
    expect(diferenciasDeCostoPromedio(otra)).toEqual([]);
  });
});
