import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import { ocCrearHandler, ocAgregarItemHandler, ocActualizarItemHandler } from '../ordenes-compra';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let proveedorId: string;
let productoId: string;

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
});

describe('ocCrearHandler — validación de payload (ADR-085)', () => {
  it('rechaza proveedor_id ausente', () => {
    expect(() => ocCrearHandler(db, { tipo: 'manual' } as any))
      .toThrow('VALIDATION:proveedor_id:TIPO');
  });

  it('rechaza proveedor_id vacío', () => {
    expect(() => ocCrearHandler(db, { proveedor_id: '', tipo: 'manual' } as any))
      .toThrow('VALIDATION:proveedor_id:REQUERIDO');
  });

  it('rechaza tipo inválido', () => {
    expect(() => ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'x' } as any))
      .toThrow('VALIDATION:tipo:ENUM');
  });

  it('rechaza tipo ausente', () => {
    expect(() => ocCrearHandler(db, { proveedor_id: proveedorId } as any))
      .toThrow('VALIDATION:tipo:ENUM');
  });

  it('rechaza observaciones de tipo inválido', () => {
    expect(() => ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual', observaciones: 5 } as any))
      .toThrow('VALIDATION:observaciones:TIPO');
  });

  it('acepta payload válido con observaciones omitidas', () => {
    const result = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' } as any);
    expect(result.id).toBeTruthy();
    expect(result.numero_interno).toMatch(/^OC-C1-\d{6}$/);
  });

  it('acepta tipo "sugerida"', () => {
    const result = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'sugerida' } as any);
    expect(result.id).toBeTruthy();
  });
});

describe('ocAgregarItemHandler — validación de payload (ADR-085)', () => {
  let ocId: string;

  beforeEach(() => {
    ocId = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' }).id;
  });

  it('rechaza orden_compra_id ausente', () => {
    expect(() => ocAgregarItemHandler(db, {
      producto_id: productoId, descripcion: 'Tornillo',
      cantidad_pedida: 10, costo_unitario_centavos: 500, alicuota_iva: 21,
    } as any)).toThrow('VALIDATION:orden_compra_id:TIPO');
  });

  it('rechaza producto_id ausente', () => {
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: ocId, descripcion: 'Tornillo',
      cantidad_pedida: 10, costo_unitario_centavos: 500, alicuota_iva: 21,
    } as any)).toThrow('VALIDATION:producto_id:TIPO');
  });

  it('rechaza descripcion ausente', () => {
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId,
      cantidad_pedida: 10, costo_unitario_centavos: 500, alicuota_iva: 21,
    } as any)).toThrow('VALIDATION:descripcion:TIPO');
  });

  it('rechaza descripcion vacía', () => {
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId, descripcion: '',
      cantidad_pedida: 10, costo_unitario_centavos: 500, alicuota_iva: 21,
    } as any)).toThrow('VALIDATION:descripcion:REQUERIDO');
  });

  it('rechaza cantidad_pedida negativa', () => {
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId, descripcion: 'Tornillo',
      cantidad_pedida: -1, costo_unitario_centavos: 500, alicuota_iva: 21,
    } as any)).toThrow('VALIDATION:cantidad_pedida:MIN:0');
  });

  it('rechaza costo_unitario_centavos negativo', () => {
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId, descripcion: 'Tornillo',
      cantidad_pedida: 10, costo_unitario_centavos: -1, alicuota_iva: 21,
    } as any)).toThrow('VALIDATION:costo_unitario_centavos:NEGATIVO');
  });

  it('rechaza costo_unitario_centavos no entero', () => {
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId, descripcion: 'Tornillo',
      cantidad_pedida: 10, costo_unitario_centavos: 5.5, alicuota_iva: 21,
    } as any)).toThrow('VALIDATION:costo_unitario_centavos:NO_ENTERO');
  });

  it('rechaza alicuota_iva fuera de rango', () => {
    expect(() => ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId, descripcion: 'Tornillo',
      cantidad_pedida: 10, costo_unitario_centavos: 500, alicuota_iva: 150,
    } as any)).toThrow('VALIDATION:alicuota_iva:MAX:100');
  });

  it('acepta payload válido', () => {
    const result = ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId, descripcion: 'Tornillo 6mm',
      cantidad_pedida: 10, costo_unitario_centavos: 500, alicuota_iva: 21,
    } as any);
    expect(result.id).toBeTruthy();
  });
});

describe('ocActualizarItemHandler — validación de payload (ADR-085)', () => {
  let itemId: string;

  beforeEach(() => {
    const ocId = ocCrearHandler(db, { proveedor_id: proveedorId, tipo: 'manual' }).id;
    itemId = ocAgregarItemHandler(db, {
      orden_compra_id: ocId, producto_id: productoId, descripcion: 'Tornillo',
      cantidad_pedida: 5, costo_unitario_centavos: 1000, alicuota_iva: 21,
    }).id;
  });

  it('rechaza item_id ausente', () => {
    expect(() => ocActualizarItemHandler(db, { cantidad_pedida: 10 } as any))
      .toThrow('VALIDATION:item_id:TIPO');
  });

  it('rechaza item_id vacío', () => {
    expect(() => ocActualizarItemHandler(db, { item_id: '', cantidad_pedida: 10 } as any))
      .toThrow('VALIDATION:item_id:REQUERIDO');
  });

  it('rechaza cantidad_pedida negativa cuando viene presente', () => {
    expect(() => ocActualizarItemHandler(db, { item_id: itemId, cantidad_pedida: -1 } as any))
      .toThrow('VALIDATION:cantidad_pedida:MIN:0');
  });

  it('rechaza costo_unitario_centavos negativo cuando viene presente', () => {
    expect(() => ocActualizarItemHandler(db, { item_id: itemId, costo_unitario_centavos: -1 } as any))
      .toThrow('VALIDATION:costo_unitario_centavos:NEGATIVO');
  });

  it('rechaza alicuota_iva fuera de rango cuando viene presente', () => {
    expect(() => ocActualizarItemHandler(db, { item_id: itemId, alicuota_iva: 101 } as any))
      .toThrow('VALIDATION:alicuota_iva:MAX:100');
  });

  it('acepta payload sólo con item_id (los tres campos son opcionales)', () => {
    const result = ocActualizarItemHandler(db, { item_id: itemId } as any);
    expect(result.id).toBe(itemId);
  });

  it('acepta actualización parcial válida', () => {
    const result = ocActualizarItemHandler(db, { item_id: itemId, cantidad_pedida: 10 } as any);
    expect(result.id).toBe(itemId);
  });
});
