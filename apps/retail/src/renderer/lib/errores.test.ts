import { describe, it, expect } from 'vitest';
import { traducirError } from '@core/ui';

describe('traducirError (ERR-2 / ADR-077)', () => {
  it('EAN/GTIN duplicado → mensaje sobre código de barras', () => {
    const e = new Error("UNIQUE constraint failed: producto.gtin_barcode");
    expect(traducirError(e).mensaje).toMatch(/código de barras/i);
  });

  it('reconoce el error aunque venga envuelto por el bridge IPC', () => {
    // Electron envuelve el error del main: "Error invoking remote method '…': Error: …".
    const e = new Error(
      "Error invoking remote method 'producto:create': Error: UNIQUE constraint failed: producto.gtin_barcode",
    );
    expect(traducirError(e).mensaje).toMatch(/código de barras/i);
  });

  it('UNIQUE genérico → mensaje de valor único', () => {
    const e = new Error('UNIQUE constraint failed: marca.nombre');
    expect(traducirError(e).mensaje).toMatch(/ya existe/i);
    expect(traducirError(e).mensaje).not.toMatch(/código de barras/i);
  });

  it('NOT NULL → falta un dato obligatorio', () => {
    const e = new Error('NOT NULL constraint failed: producto.nombre_corto');
    expect(traducirError(e).mensaje).toMatch(/obligatorio/i);
  });

  it('FOREIGN KEY → dato referenciado', () => {
    const e = new Error('FOREIGN KEY constraint failed');
    expect(traducirError(e).mensaje).toMatch(/referenciado|en uso/i);
  });

  it('error desconocido → fallback legible, nunca el texto técnico crudo', () => {
    const e = new Error('SQLITE_BUSY: database is locked');
    const { mensaje } = traducirError(e);
    expect(mensaje).toMatch(/no se pudo/i);
    expect(mensaje).not.toMatch(/SQLITE_BUSY/);
  });

  it('acepta string, objeto con message y valores nulos sin romper', () => {
    expect(traducirError('boom').mensaje).toBeTruthy();
    expect(traducirError({ message: 'x' }).mensaje).toBeTruthy();
    expect(traducirError(null).mensaje).toBeTruthy();
    expect(traducirError(undefined).mensaje).toBeTruthy();
  });
});

describe('catálogo de códigos de dominio (ADR-082)', () => {
  it('traduce códigos transversales', () => {
    expect(traducirError(new Error('UNAUTHENTICATED')).mensaje).toMatch(/sesión/i);
    expect(traducirError(new Error('FORBIDDEN')).mensaje).toMatch(/permiso|autoriz/i);
    expect(traducirError(new Error('NOT_FOUND')).mensaje).toMatch(/no se encontró|no existe/i);
  });

  it('traduce códigos de venta/stock', () => {
    expect(traducirError(new Error('STOCK_INSUFICIENTE')).mensaje).toMatch(/stock/i);
    expect(traducirError(new Error('SALDO_PENDIENTE')).mensaje).toMatch(/pago|saldo|falta/i);
    expect(traducirError(new Error('LIMITE_CREDITO_EXCEDIDO')).mensaje).toMatch(/límite|crédito/i);
    expect(traducirError(new Error('PRODUCTO_INACTIVO')).mensaje).toMatch(/inactivo/i);
    expect(traducirError(new Error('CAJA_REQUERIDA')).mensaje).toMatch(/caja/i);
  });

  it('reconoce el código aunque venga envuelto por el bridge', () => {
    const e = new Error("Error invoking remote method 'venta:confirmar': Error: STOCK_INSUFICIENTE");
    expect(traducirError(e).mensaje).toMatch(/stock/i);
  });

  it('formatea códigos con argumento', () => {
    expect(traducirError(new Error('TIENE_PRODUCTOS:5')).mensaje).toMatch(/5/);
    expect(traducirError(new Error('YA_EXISTE:A-01-03')).mensaje).toMatch(/A-01-03/);
  });

  it('formatea montos en centavos como pesos', () => {
    const m = traducirError(new Error('TIENE_SALDO_CC:150000')).mensaje;
    expect(m).toMatch(/1\.500|1500/);
  });

  it('VALIDATION:campo:detalle → mensaje humano + campo', () => {
    const r = traducirError(new Error('VALIDATION:precio_venta_lista:MIN:1'));
    expect(r.campo).toBe('precio_venta_lista');
    expect(r.mensaje).toMatch(/mayor|mínimo|1/i);
    const req = traducirError(new Error('VALIDATION:nombre:REQUERIDO'));
    expect(req.campo).toBe('nombre');
    expect(req.mensaje).toMatch(/obligatorio|requerido|complet/i);
  });

  it('código desconocido cae al fallback, sin texto crudo', () => {
    const r = traducirError(new Error('ALGO_RARISIMO_XYZ'));
    expect(r.mensaje).toMatch(/no se pudo/i);
    expect(r.mensaje).not.toMatch(/XYZ/);
  });

  it('tokens del prototipo no rompen el lookup (caen al fallback, sin throw)', () => {
    for (const token of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
      const r = traducirError(new Error(token));
      expect(r.mensaje).toMatch(/no se pudo/i);
    }
  });

  it('doble envoltura del bridge igual resuelve el código real', () => {
    expect(traducirError(new Error('Error: Error: STOCK_INSUFICIENTE')).mensaje).toMatch(/stock/i);
  });

  it('CODIGO:arg (STOCK_INSUFICIENTE:Palito) resuelve el código y los códigos de venta de Elaborados traducen', () => {
    expect(traducirError(new Error("Error invoking remote method 'venta:confirmar': Error: STOCK_INSUFICIENTE:Palito")).mensaje).toMatch(/stock/i);
    for (const c of ['CARRITO_VACIO','PRODUCTO_VENTA_NO_ENCONTRADO','DESCUENTO_INVALIDO','GRUPO_NO_PERMITIDO','OPCION_INVALIDA','OPCION_DUPLICADA','MODIFICADOR_MIN','MODIFICADOR_MAX']) {
      expect(traducirError(new Error(c)).mensaje).not.toMatch(/no se pudo/i);
    }
  });

  it('código con argumento faltante no renderiza "undefined"', () => {
    expect(traducirError(new Error('TIENE_PRODUCTOS')).mensaje).not.toMatch(/undefined/);
    expect(traducirError(new Error('YA_EXISTE')).mensaje).not.toMatch(/undefined/);
    expect(traducirError(new Error('TIENE_SALDO_CC')).mensaje).not.toMatch(/undefined/);
  });
});
