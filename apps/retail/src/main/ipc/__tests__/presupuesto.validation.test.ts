import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { sembrarProducto, sembrarCliente } from './presupuesto.helpers';
import {
  presupuestoCrearHandler,
  presupuestoEditarHandler,
  presupuestoEmitirHandler,
  presupuestoAnularHandler,
  presupuestoPrepararConversionHandler,
} from '../presupuesto';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let userId: string;
let prodId: string;

beforeEach(() => {
  db = setupDb();
  clearSession();
  const admin = loginAsAdmin(db);
  userId = admin.id;
  prodId = sembrarProducto(db, userId, { precio: 100 });
});
afterEach(() => { clearSession(); });

describe('presupuestoCrearHandler — validación de payload (ADR-085)', () => {
  it('rechaza cliente_id de tipo inválido', () => {
    expect(() => presupuestoCrearHandler(db, { cliente_id: 5, lineas: [] } as any))
      .toThrow('VALIDATION:cliente_id:TIPO');
  });

  it('acepta cliente_id null (consumidor final)', () => {
    const r = presupuestoCrearHandler(db, {
      cliente_id: null,
      lineas: [{ producto_id: prodId, cantidad: 1 }],
    } as any);
    expect(r.cliente_id).toBeNull();
  });

  it('rechaza validez_dias de tipo inválido', () => {
    expect(() => presupuestoCrearHandler(db, { validez_dias: 'x', lineas: [] } as any))
      .toThrow('VALIDATION:validez_dias:TIPO');
  });

  it('rechaza validez_dias negativo', () => {
    expect(() => presupuestoCrearHandler(db, { validez_dias: -1, lineas: [] } as any))
      .toThrow('VALIDATION:validez_dias:MIN:0');
  });

  it('rechaza descuento_global_pct de tipo inválido', () => {
    expect(() => presupuestoCrearHandler(db, { descuento_global_pct: 'x', lineas: [] } as any))
      .toThrow('VALIDATION:descuento_global_pct:TIPO');
  });

  it('rechaza descuento_global_pct fuera de rango (>100)', () => {
    expect(() => presupuestoCrearHandler(db, { descuento_global_pct: 150, lineas: [] } as any))
      .toThrow('VALIDATION:descuento_global_pct:MAX:100');
  });

  it('rechaza observaciones de tipo inválido', () => {
    expect(() => presupuestoCrearHandler(db, { observaciones: 5, lineas: [] } as any))
      .toThrow('VALIDATION:observaciones:TIPO');
  });

  it('rechaza lineas ausente/null (no array)', () => {
    expect(() => presupuestoCrearHandler(db, { lineas: null } as any))
      .toThrow('VALIDATION:lineas:TIPO');
    expect(() => presupuestoCrearHandler(db, {} as any))
      .toThrow('VALIDATION:lineas:TIPO');
  });

  it('rechaza producto_id ausente dentro de una linea', () => {
    expect(() => presupuestoCrearHandler(db, { lineas: [{ cantidad: 1 }] } as any))
      .toThrow('VALIDATION:lineas.0.producto_id:TIPO');
  });

  it('rechaza producto_id vacío dentro de una linea', () => {
    expect(() => presupuestoCrearHandler(db, { lineas: [{ producto_id: '', cantidad: 1 }] } as any))
      .toThrow('VALIDATION:lineas.0.producto_id:REQUERIDO');
  });

  it('rechaza cantidad de tipo inválido dentro de una linea', () => {
    expect(() => presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 'x' }] } as any))
      .toThrow('VALIDATION:lineas.0.cantidad:TIPO');
  });

  it('rechaza cantidad negativa dentro de una linea', () => {
    expect(() => presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: -1 }] } as any))
      .toThrow('VALIDATION:lineas.0.cantidad:MIN:0');
  });

  it('rechaza descuento_linea_pct fuera de rango dentro de una linea', () => {
    expect(() => presupuestoCrearHandler(db, {
      lineas: [{ producto_id: prodId, cantidad: 1, descuento_linea_pct: 150 }],
    } as any)).toThrow('VALIDATION:lineas.0.descuento_linea_pct:MAX:100');
  });

  it('rechaza presentacion_id de tipo inválido dentro de una linea', () => {
    expect(() => presupuestoCrearHandler(db, {
      lineas: [{ producto_id: prodId, cantidad: 1, presentacion_id: 5 }],
    } as any)).toThrow('VALIDATION:lineas.0.presentacion_id:TIPO');
  });

  it('acepta payload válido con campos opcionales omitidos (happy path)', () => {
    const r = presupuestoCrearHandler(db, {
      lineas: [{ producto_id: prodId, cantidad: 2 }],
    } as any);
    expect(r.id).toBeTruthy();
    expect(r.estado).toBe('borrador');
    expect(r.lineas).toHaveLength(1);
  });
});

describe('presupuestoEditarHandler — validación de payload (ADR-085)', () => {
  it('rechaza id ausente', () => {
    expect(() => presupuestoEditarHandler(db, { lineas: [] } as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('rechaza id vacío', () => {
    expect(() => presupuestoEditarHandler(db, { id: '', lineas: [] } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza lineas ausente (no array)', () => {
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 1 }] } as any);
    expect(() => presupuestoEditarHandler(db, { id: p.id } as any))
      .toThrow('VALIDATION:lineas:TIPO');
  });

  it('rechaza cantidad negativa dentro de una linea', () => {
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 1 }] } as any);
    expect(() => presupuestoEditarHandler(db, {
      id: p.id, lineas: [{ producto_id: prodId, cantidad: -1 }],
    } as any)).toThrow('VALIDATION:lineas.0.cantidad:MIN:0');
  });

  it('acepta payload válido (happy path)', () => {
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 1 }] } as any);
    const editado = presupuestoEditarHandler(db, {
      id: p.id, lineas: [{ producto_id: prodId, cantidad: 3 }],
    } as any);
    expect(editado.lineas[0].cantidad).toBe(3);
  });
});

describe('presupuestoEmitirHandler — validación de payload (ADR-085)', () => {
  it('rechaza id ausente', () => {
    expect(() => presupuestoEmitirHandler(db, {} as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('rechaza id vacío', () => {
    expect(() => presupuestoEmitirHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza validez_dias de tipo inválido', () => {
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 1 }] } as any);
    expect(() => presupuestoEmitirHandler(db, { id: p.id, validez_dias: 'x' } as any))
      .toThrow('VALIDATION:validez_dias:TIPO');
  });

  it('acepta payload válido (happy path)', () => {
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 1 }] } as any);
    const emitido = presupuestoEmitirHandler(db, { id: p.id, validez_dias: 10 } as any);
    expect(emitido.estado).toBe('emitido');
  });
});

describe('presupuestoAnularHandler — validación de payload (ADR-085)', () => {
  it('rechaza id ausente', () => {
    expect(() => presupuestoAnularHandler(db, {} as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('rechaza id vacío', () => {
    expect(() => presupuestoAnularHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('acepta payload válido (happy path)', () => {
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 1 }] } as any);
    const anulado = presupuestoAnularHandler(db, { id: p.id } as any);
    expect(anulado.estado).toBe('anulado');
  });
});

describe('presupuestoPrepararConversionHandler — validación de payload (ADR-085)', () => {
  it('rechaza id ausente', () => {
    expect(() => presupuestoPrepararConversionHandler(db, {} as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('rechaza id vacío', () => {
    expect(() => presupuestoPrepararConversionHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('acepta payload válido (happy path)', () => {
    const cliente = sembrarCliente(db, userId);
    const p = presupuestoCrearHandler(db, { cliente_id: cliente, lineas: [{ producto_id: prodId, cantidad: 1 }] } as any);
    presupuestoEmitirHandler(db, { id: p.id } as any);
    const conv = presupuestoPrepararConversionHandler(db, { id: p.id } as any);
    expect(conv.vencido).toBe(false);
  });
});
