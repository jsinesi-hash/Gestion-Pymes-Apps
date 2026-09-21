import { describe, it, expect, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { productoCreateHandler, productoUpdateHandler } from '../producto';

describe('producto validación (ADR-082)', () => {
  afterEach(() => clearSession());

  // NOTA: la validación dispara ANTES de los lookups de FK, así que ids inexistentes
  // ("x"/"y") alcanzan para los tests RED de validación.
  it('rechaza nombre_corto vacío', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => productoCreateHandler(db, { nombre_corto: '', categoria_id: 'x', unidad_venta: 'unidad', impuesto_id: 'y', precio_venta_lista: 10 } as any))
      .toThrow(/VALIDATION:nombre_corto:REQUERIDO/);
  });

  it('rechaza precio_venta_lista no numérico', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => productoCreateHandler(db, { nombre_corto: 'Martillo', categoria_id: 'x', unidad_venta: 'unidad', impuesto_id: 'y', precio_venta_lista: 'caro' } as any))
      .toThrow(/VALIDATION:precio_venta_lista:TIPO/);
  });

  it('rechaza categoria_id faltante', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => productoCreateHandler(db, { nombre_corto: 'Martillo', unidad_venta: 'unidad', impuesto_id: 'y', precio_venta_lista: 10 } as any))
      .toThrow(/VALIDATION:categoria_id:(REQUERIDO|TIPO)/);
  });

  it('rechaza precio_venta_lista negativo', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => productoCreateHandler(db, { nombre_corto: 'Martillo', categoria_id: 'x', unidad_venta: 'unidad', impuesto_id: 'y', precio_venta_lista: -1 } as any))
      .toThrow(/VALIDATION:precio_venta_lista:MIN/);
  });

  it('update rechaza id faltante', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => productoUpdateHandler(db, { nombre_corto: 'X' } as any))
      .toThrow(/VALIDATION:id:(REQUERIDO|TIPO)/);
  });

  it('update rechaza precio_venta_lista no numérico cuando se envía', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => productoUpdateHandler(db, { id: 'algun-id', precio_venta_lista: 'caro' } as any))
      .toThrow(/VALIDATION:precio_venta_lista:TIPO/);
  });
});
