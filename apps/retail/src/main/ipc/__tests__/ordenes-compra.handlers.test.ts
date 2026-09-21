import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { proveedorUpsertHandler } from '../proveedor';
import { productoProveedorUpsertHandler, productoProveedorSetPreferidoHandler } from '../producto-proveedor';
import {
  ocCrearHandler,
  ocGetHandler,
  ocListHandler,
  ocAgregarItemHandler,
  ocActualizarItemHandler,
  ocEliminarItemHandler,
  ocEmitirHandler,
  ocAnularHandler,
  ocSugerirHandler,
} from '../ordenes-compra';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let proveedorId: string;
let productoId: string;
let impuestoAlicuota: number;

function setMinimos(productoId: string, minimo: number, maximo?: number) {
  db.update(schema.existencias)
    .set({ stock_minimo: minimo, ...(maximo !== undefined ? { stock_maximo: maximo } : {}) })
    .where(eq(schema.existencias.producto_id, productoId))
    .run();
}

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);

  const cat = categoriaCreateHandler(db, { nombre: 'Test' });
  const imp = db.select().from(schema.impuesto).get()!;
  impuestoAlicuota = imp.alicuota;
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
});

// ── ocCrearHandler ────────────────────────────────────────────────────────────

describe('ocCrearHandler', () => {
  it('crea OC en estado borrador y retorna id + numero_interno', () => {
    const result = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    expect(result.id).toBeTruthy();
    expect(result.numero_interno).toMatch(/^OC-C1-\d{6}$/);
  });

  it('numero_interno incrementa correlativamente', () => {
    const r1 = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const r2 = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const n1 = parseInt(r1.numero_interno.split('-')[2]);
    const n2 = parseInt(r2.numero_interno.split('-')[2]);
    expect(n2).toBe(n1 + 1);
  });

  it('OC creada tiene totales en cero', () => {
    const { id } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const oc = ocGetHandler(db, id);
    expect(oc!.subtotal_centavos).toBe(0);
    expect(oc!.total_centavos).toBe(0);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' }))
      .toThrow('UNAUTHENTICATED');
  });
});

// ── ocGetHandler ──────────────────────────────────────────────────────────────

describe('ocGetHandler', () => {
  it('retorna null para id inexistente', () => {
    expect(ocGetHandler(db, 'no-existe')).toBeNull();
  });

  it('retorna OC con items vacíos tras crear', () => {
    const { id } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const oc = ocGetHandler(db, id);
    expect(oc).not.toBeNull();
    expect(oc!.estado).toBe('borrador');
    expect(oc!.razon_social).toBe('Distribuidora Alfa');
    expect(oc!.items).toHaveLength(0);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocGetHandler(db, 'cualquiera')).toThrow('UNAUTHENTICATED');
  });
});

// ── ocListHandler ─────────────────────────────────────────────────────────────

describe('ocListHandler', () => {
  it('retorna lista vacía sin OCs', () => {
    expect(ocListHandler(db)).toHaveLength(0);
  });

  it('retorna OC con razon_social del proveedor', () => {
    ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const list = ocListHandler(db);
    expect(list).toHaveLength(1);
    expect(list[0].razon_social).toBe('Distribuidora Alfa');
    expect(list[0].estado).toBe('borrador');
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocListHandler(db)).toThrow('UNAUTHENTICATED');
  });
});

// ── ocAgregarItemHandler ──────────────────────────────────────────────────────

describe('ocAgregarItemHandler', () => {
  it('agrega ítem y recalcula totales de la OC', () => {
    const { id: ocId } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    ocAgregarItemHandler(db, {
      orden_compra_id: ocId,
      producto_id: productoId,
      descripcion: 'Tornillo 6mm',
      cantidad_pedida: 10,
      costo_unitario_centavos: 500,
      alicuota_iva: 21,
    });
    const oc = ocGetHandler(db, ocId)!;
    expect(oc.items).toHaveLength(1);
    expect(oc.subtotal_centavos).toBe(5000);               // 10 * 500
    expect(oc.importe_iva_centavos).toBe(1050);            // 5000 * 0.21
    expect(oc.total_centavos).toBe(6050);
  });

  it('acumula totales al agregar múltiples ítems', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat2' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod2 = productoCreateHandler(db, {
      nombre_corto: 'Tuerca', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 50,
    });
    const { id: ocId } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId,
      descripcion: 'Tornillo', cantidad_pedida: 10, costo_unitario_centavos: 500, alicuota_iva: 21,
    });
    ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: prod2.id,
      descripcion: 'Tuerca', cantidad_pedida: 20, costo_unitario_centavos: 200, alicuota_iva: 21,
    });
    const oc = ocGetHandler(db, ocId)!;
    expect(oc.items).toHaveLength(2);
    expect(oc.subtotal_centavos).toBe(9000);               // 5000 + 4000
    expect(oc.importe_iva_centavos).toBe(1890);            // 9000 * 0.21
    expect(oc.total_centavos).toBe(10890);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: 'oc-1', producto_id: productoId,
      descripcion: 'X', cantidad_pedida: 1, costo_unitario_centavos: 100, alicuota_iva: 21,
    })).toThrow('UNAUTHENTICATED');
  });
});

// ── ocActualizarItemHandler ───────────────────────────────────────────────────

describe('ocActualizarItemHandler', () => {
  it('actualiza cantidad y recalcula totales', () => {
    const { id: ocId } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const { id: itemId } = ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId,
      descripcion: 'Tornillo', cantidad_pedida: 5, costo_unitario_centavos: 1000, alicuota_iva: 21,
    });
    ocActualizarItemHandler(db, { item_id: itemId, cantidad_pedida: 10 });
    const oc = ocGetHandler(db, ocId)!;
    expect(oc.subtotal_centavos).toBe(10000);  // 10 * 1000
    expect(oc.total_centavos).toBe(12100);
  });

  it('actualiza alicuota_iva y recalcula importe_iva', () => {
    const { id: ocId } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const { id: itemId } = ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId,
      descripcion: 'Tornillo', cantidad_pedida: 10, costo_unitario_centavos: 1000, alicuota_iva: 21,
    });
    ocActualizarItemHandler(db, { item_id: itemId, alicuota_iva: 10.5 });
    const oc = ocGetHandler(db, ocId)!;
    expect(oc.items[0].alicuota_iva).toBe(10.5);
    expect(oc.importe_iva_centavos).toBe(1050); // 10000 * 0.105
    expect(oc.total_centavos).toBe(11050);       // 10000 + 1050
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocActualizarItemHandler(db, { item_id: 'x', cantidad_pedida: 1 }))
      .toThrow('UNAUTHENTICATED');
  });
});

// ── ocEliminarItemHandler ─────────────────────────────────────────────────────

describe('ocEliminarItemHandler', () => {
  it('elimina ítem y recalcula totales a cero', () => {
    const { id: ocId } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    const { id: itemId } = ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId,
      descripcion: 'Tornillo', cantidad_pedida: 5, costo_unitario_centavos: 1000, alicuota_iva: 21,
    });
    ocEliminarItemHandler(db, itemId);
    const oc = ocGetHandler(db, ocId)!;
    expect(oc.items).toHaveLength(0);
    expect(oc.subtotal_centavos).toBe(0);
    expect(oc.total_centavos).toBe(0);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocEliminarItemHandler(db, 'x')).toThrow('UNAUTHENTICATED');
  });
});

// ── ocEmitirHandler ───────────────────────────────────────────────────────────

describe('ocEmitirHandler', () => {
  it('cambia estado de borrador a emitida', () => {
    const { id } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    ocEmitirHandler(db, id);
    expect(ocGetHandler(db, id)!.estado).toBe('emitida');
  });

  it('lanza ERROR si OC no está en borrador', () => {
    const { id } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    ocEmitirHandler(db, id);
    expect(() => ocEmitirHandler(db, id)).toThrow('OC_NO_BORRADOR');
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocEmitirHandler(db, 'x')).toThrow('UNAUTHENTICATED');
  });
});

// ── ocAnularHandler ───────────────────────────────────────────────────────────

describe('ocAnularHandler', () => {
  it('cambia estado a anulada desde borrador', () => {
    const { id } = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' });
    ocAnularHandler(db, id);
    expect(ocGetHandler(db, id)!.estado).toBe('anulada');
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocAnularHandler(db, 'x')).toThrow('UNAUTHENTICATED');
  });
});

// ── ocSugerirHandler ──────────────────────────────────────────────────────────

describe('ocSugerirHandler', () => {
  it('retorna grupos vacíos cuando no hay productos bajo mínimo', () => {
    const result = ocSugerirHandler(db);
    expect(result.grupos).toHaveLength(0);
    expect(result.sin_proveedor).toHaveLength(0);
  });

  it('agrupa producto con proveedor preferido en su grupo', () => {
    setMinimos(productoId, 10);
    const pp = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 500,
    });
    productoProveedorSetPreferidoHandler(db, pp.id);

    const result = ocSugerirHandler(db);
    expect(result.grupos).toHaveLength(1);
    expect(result.grupos[0].proveedor_id).toBe(proveedorId);
    expect(result.grupos[0].razon_social).toBe('Distribuidora Alfa');
    expect(result.grupos[0].items).toHaveLength(1);
    expect(result.grupos[0].items[0].producto_id).toBe(productoId);
    expect(result.sin_proveedor).toHaveLength(0);
  });

  it('envía a sin_proveedor los productos sin proveedor preferido', () => {
    setMinimos(productoId, 10);
    const result = ocSugerirHandler(db);
    expect(result.grupos).toHaveLength(0);
    expect(result.sin_proveedor).toHaveLength(1);
    expect(result.sin_proveedor[0].producto_id).toBe(productoId);
  });

  it('usa stock_minimo como cantidad_sugerida_uv cuando no hay stock_maximo', () => {
    setMinimos(productoId, 5); // minimo=5, sin maximo
    const pp = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 500,
    });
    productoProveedorSetPreferidoHandler(db, pp.id);
    const result = ocSugerirHandler(db);
    expect(result.grupos[0].items[0].cantidad_sugerida_uv).toBe(5);
  });

  it('usa stock_maximo - stock_fisico cuando hay stock_maximo', () => {
    setMinimos(productoId, 5, 20); // minimo=5, maximo=20; stock_fisico=0
    const pp = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 500,
    });
    productoProveedorSetPreferidoHandler(db, pp.id);
    const result = ocSugerirHandler(db);
    expect(result.grupos[0].items[0].cantidad_sugerida_uv).toBe(20); // 20 - 0
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => ocSugerirHandler(db)).toThrow('UNAUTHENTICATED');
  });

  it('incluye stock_minimo, stock_fisico y unidad_compra en items de grupo', () => {
    setMinimos(productoId, 8);
    const pp = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 500,
    });
    productoProveedorSetPreferidoHandler(db, pp.id);

    const result = ocSugerirHandler(db);
    const item = result.grupos[0].items[0];
    expect(item.stock_minimo).toBe(8);
    expect(item.stock_fisico).toBe(0);
    expect(item.unidad_compra).toBeNull(); // producto sin unidad_compra definida
  });

  it('incluye stock_minimo, stock_fisico y unidad_compra en sin_proveedor', () => {
    setMinimos(productoId, 6);
    const result = ocSugerirHandler(db);
    const sp = result.sin_proveedor[0];
    expect(sp.stock_minimo).toBe(6);
    expect(sp.stock_fisico).toBe(0);
    expect(sp.unidad_compra).toBeNull();
  });

  it('incluye unidad_compra cuando está definida en el producto', () => {
    db.update(schema.producto)
      .set({ unidad_compra: 'caja' })
      .where(eq(schema.producto.id, productoId))
      .run();
    setMinimos(productoId, 3);

    const result = ocSugerirHandler(db);
    const sp = result.sin_proveedor[0];
    expect(sp.unidad_compra).toBe('caja');
  });
});
