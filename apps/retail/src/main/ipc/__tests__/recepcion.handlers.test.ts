import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import { productoProveedorUpsertHandler, productoProveedorSetPreferidoHandler } from '../producto-proveedor';
import { ocCrearHandler, ocAgregarItemHandler, ocEmitirHandler, ocGetHandler } from '../ordenes-compra';
import {
  recepcionCrearHandler,
  recepcionListByOCHandler,
  recepcionGetHandler,
} from '../recepcion';
import { listaPrecioCreateHandler } from '../lista-precio';
import { reglaPrecioUpsertHandler } from '../regla-precio';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let productoId: string;
let proveedorId: string;
let ocId: string;
let itemOcId: string;

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);

  const cat = categoriaCreateHandler(db, { nombre: 'Test' });
  const imp = db.select().from(schema.impuesto).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Tornillo',
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: 'u',
    precio_venta_lista: 100,
  });
  productoId = prod.id;

  const prov = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT', numero_documento: '20111111112',
    razon_social: 'Distribuidora Alfa', condicion_fiscal: 'Responsable Inscripto',
  });
  proveedorId = prov.id;

  const pp = productoProveedorUpsertHandler(db, {
    producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 800,
  });
  productoProveedorSetPreferidoHandler(db, pp.id);

  const oc = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
  ocId = oc.id;
  const item = ocAgregarItemHandler(db, {
    orden_compra_id: ocId,
    producto_id: productoId,
    descripcion: 'Tornillo',
    cantidad_pedida: 10,
    costo_unitario_centavos: 800,
    alicuota_iva: 21,
  });
  itemOcId = item.id;
  ocEmitirHandler(db, ocId);
});

// ── recepcionCrearHandler ─────────────────────────────────────────────────────

describe('recepcionCrearHandler', () => {
  it('crea recepcion y retorna id', () => {
    const result = recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10 }],
    });
    expect(result.id).toBeTruthy();
  });

  it('aumenta el stock del producto recibido', () => {
    const antesEx = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, productoId)).get()!;
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10 }],
    });
    const despuesEx = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, productoId)).get()!;
    expect(despuesEx.stock_fisico).toBe(antesEx.stock_fisico + 10);
  });

  it('crea movimiento_stock con motivo recepcion_compra', () => {
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10 }],
    });
    const movs = db.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.producto_id, productoId)).all();
    const recepcionMov = movs.find(m => m.motivo === 'recepcion_compra');
    expect(recepcionMov).toBeDefined();
    expect(recepcionMov!.cantidad).toBe(10);
  });

  it('actualiza cantidad_recibida del item_oc', () => {
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 6 }],
    });
    const item = db.select().from(schema.item_oc).where(eq(schema.item_oc.id, itemOcId)).get()!;
    expect(item.cantidad_recibida).toBe(6);
  });

  it('cambia OC a recibida_parcial cuando la recepcion es parcial', () => {
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 5 }],
    });
    expect(ocGetHandler(db, ocId)!.estado).toBe('recibida_parcial');
  });

  it('cambia OC a recibida_total cuando se reciben todas las unidades', () => {
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10 }],
    });
    expect(ocGetHandler(db, ocId)!.estado).toBe('recibida_total');
  });

  it('actualiza CPP del producto cuando se provee costo real', () => {
    const anteProd = db.select().from(schema.producto)
      .where(eq(schema.producto.id, productoId)).get()!;
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10, costo_unitario_real_centavos: 1000 }],
    });
    const desProd = db.select().from(schema.producto)
      .where(eq(schema.producto.id, productoId)).get()!;
    // CPP should update: new cost = 10 pesos (1000 centavos)
    expect(desProd.precio_costo_promedio).toBeGreaterThan(anteProd.precio_costo_promedio);
  });

  it('actualiza producto_proveedor.costo_centavos cuando el costo real difiere', () => {
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10, costo_unitario_real_centavos: 1200 }],
    });
    const pp = db.select().from(schema.producto_proveedor)
      .where(
        eq(schema.producto_proveedor.producto_id, productoId)
      ).get()!;
    expect(pp.costo_centavos).toBe(1200);
  });

  it('lanza OC_NO_EMITIDA si la OC está en borrador', () => {
    const ocBorrador = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const itemB = ocAgregarItemHandler(db, {
      orden_compra_id: ocBorrador.id, producto_id: productoId,
      descripcion: 'X', cantidad_pedida: 1, costo_unitario_centavos: 100, alicuota_iva: 21,
    });
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocBorrador.id,
      items: [{ item_oc_id: itemB.id, cantidad_recibida: 1 }],
    })).toThrow('OC_NO_EMITIDA');
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 1 }],
    })).toThrow('UNAUTHENTICATED');
  });

  // ── ADR-049 §7: cierre del circuito de costo ──────────────────────────────

  it('recepción con costo real distinto dispara un batch en la lista en modo margen_costo', () => {
    const lista = listaPrecioCreateHandler(db, { nombre: 'MC', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
    reglaPrecioUpsertHandler(db, { lista_precio_id: lista.id, tipo: 'lista', objetivo_id: null, margen_pct: 40 });

    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10, costo_unitario_real_centavos: 1200 }],
    });

    const batches = db.select().from(schema.price_batch)
      .where(eq(schema.price_batch.lista_precio_id, lista.id)).all();
    expect(batches).toHaveLength(1);
    expect(batches[0].origen).toBe('PROVIDER_COST_UPDATE');
    expect(batches[0].proveedor_id).toBe(proveedorId);
  });

  it('recepción sin costo real (nulo) no dispara ningún batch', () => {
    const lista = listaPrecioCreateHandler(db, { nombre: 'MC', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
    reglaPrecioUpsertHandler(db, { lista_precio_id: lista.id, tipo: 'lista', objetivo_id: null, margen_pct: 40 });

    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10 }],
    });

    const batches = db.select().from(schema.price_batch)
      .where(eq(schema.price_batch.lista_precio_id, lista.id)).all();
    expect(batches).toHaveLength(0);
  });
});

// ── recepcionListByOCHandler ──────────────────────────────────────────────────

describe('recepcionListByOCHandler', () => {
  it('retorna lista vacía para OC sin recepciones', () => {
    expect(recepcionListByOCHandler(db, ocId)).toHaveLength(0);
  });

  it('retorna recepciones de la OC', () => {
    recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 5 }],
    });
    const list = recepcionListByOCHandler(db, ocId);
    expect(list).toHaveLength(1);
    expect(list[0].orden_compra_id).toBe(ocId);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => recepcionListByOCHandler(db, ocId)).toThrow('UNAUTHENTICATED');
  });
});

// ── recepcionGetHandler ───────────────────────────────────────────────────────

describe('recepcionGetHandler', () => {
  it('retorna null para id inexistente', () => {
    expect(recepcionGetHandler(db, 'no-existe')).toBeNull();
  });

  it('retorna recepcion con sus detalles', () => {
    const { id } = recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      remito_proveedor: 'R-0001',
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 8, costo_unitario_real_centavos: 950 }],
    });
    const rec = recepcionGetHandler(db, id);
    expect(rec).not.toBeNull();
    expect(rec!.remito_proveedor).toBe('R-0001');
    expect(rec!.detalles).toHaveLength(1);
    expect(rec!.detalles[0].cantidad_recibida).toBe(8);
    expect(rec!.detalles[0].costo_unitario_real_centavos).toBe(950);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => recepcionGetHandler(db, 'x')).toThrow('UNAUTHENTICATED');
  });
});
