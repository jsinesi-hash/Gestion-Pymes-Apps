import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import { productoProveedorUpsertHandler, productoProveedorSetPreferidoHandler } from '../producto-proveedor';
import { ocCrearHandler, ocAgregarItemHandler, ocEmitirHandler } from '../ordenes-compra';
import { recepcionCrearHandler } from '../recepcion';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

let db: Db;
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

  const prov = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT', numero_documento: '20111111112',
    razon_social: 'Distribuidora Alfa', condicion_fiscal: 'Responsable Inscripto',
  });

  const pp = productoProveedorUpsertHandler(db, {
    producto_id: prod.id, proveedor_id: prov.id, costo_centavos: 800,
  });
  productoProveedorSetPreferidoHandler(db, pp.id);

  const oc = ocCrearHandler(db, { proveedor_id: prov.id, tipo: 'manual' });
  ocId = oc.id;
  const item = ocAgregarItemHandler(db, {
    orden_compra_id: ocId,
    producto_id: prod.id,
    descripcion: 'Tornillo',
    cantidad_pedida: 10,
    costo_unitario_centavos: 800,
    alicuota_iva: 21,
  });
  itemOcId = item.id;
  ocEmitirHandler(db, ocId);
});

describe('recepcionCrearHandler — validación de payload (ADR-085)', () => {
  it('rechaza orden_compra_id ausente', () => {
    expect(() => recepcionCrearHandler(db, { items: [] } as any))
      .toThrow('VALIDATION:orden_compra_id:TIPO');
  });

  it('rechaza orden_compra_id vacío', () => {
    expect(() => recepcionCrearHandler(db, { orden_compra_id: '', items: [] } as any))
      .toThrow('VALIDATION:orden_compra_id:REQUERIDO');
  });

  it('rechaza items ausente (no array)', () => {
    expect(() => recepcionCrearHandler(db, { orden_compra_id: ocId } as any))
      .toThrow('VALIDATION:items:TIPO');
  });

  it('rechaza item_oc_id de tipo inválido dentro de items', () => {
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: 5, cantidad_recibida: 1 }],
    } as any)).toThrow('VALIDATION:items.0.item_oc_id:TIPO');
  });

  it('rechaza cantidad_recibida de tipo inválido', () => {
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 'x' }],
    } as any)).toThrow('VALIDATION:items.0.cantidad_recibida:TIPO');
  });

  it('rechaza cantidad_recibida negativa', () => {
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: -1 }],
    } as any)).toThrow('VALIDATION:items.0.cantidad_recibida:MIN:0');
  });

  it('rechaza costo_unitario_real_centavos de tipo inválido', () => {
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 1, costo_unitario_real_centavos: 'x' }],
    } as any)).toThrow('VALIDATION:items.0.costo_unitario_real_centavos:TIPO');
  });

  it('rechaza costo_unitario_real_centavos negativo', () => {
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 1, costo_unitario_real_centavos: -100 }],
    } as any)).toThrow('VALIDATION:items.0.costo_unitario_real_centavos:NEGATIVO');
  });

  it('rechaza remito_proveedor de tipo inválido', () => {
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      remito_proveedor: 5,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 1 }],
    } as any)).toThrow('VALIDATION:remito_proveedor:TIPO');
  });

  it('rechaza observaciones de tipo inválido', () => {
    expect(() => recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      observaciones: 5,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 1 }],
    } as any)).toThrow('VALIDATION:observaciones:TIPO');
  });

  it('acepta payload válido con campos opcionales omitidos', () => {
    const result = recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 10 }],
    } as any);
    expect(result.id).toBeTruthy();
  });

  it('acepta cantidad_recibida en 0 (MIN inclusivo)', () => {
    const result = recepcionCrearHandler(db, {
      orden_compra_id: ocId,
      items: [{ item_oc_id: itemOcId, cantidad_recibida: 0 }],
    } as any);
    expect(result.id).toBeTruthy();
  });
});
