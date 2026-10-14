import { describe, it, expect } from 'vitest';
import { traducirError } from './errores';

describe('traducirError — códigos de dominio de Elaborados (ADR-102)', () => {
  it('STOCK_INSUFICIENTE con nombre lo muestra', () => {
    expect(traducirError(new Error('STOCK_INSUFICIENTE:Palito')).mensaje).toContain('Palito');
  });
  it('STOCK_INSUFICIENTE sin nombre mantiene el mensaje genérico', () => {
    expect(traducirError(new Error('STOCK_INSUFICIENTE')).mensaje).toBe('No hay stock suficiente para completar la operación.');
  });
  it.each([
    'RECETA_NO_DEFINIDA', 'RINDE_INVALIDO', 'ARTICULO_NO_ELABORADO', 'CANTIDAD_PRODUCIDA_INVALIDA',
    'ANULACION_REQUIERE_AUTORIZACION', 'YA_ANULADA',
  ])('%s tiene mensaje propio (no cae al genérico)', (codigo) => {
    const m = traducirError(new Error(`Error invoking remote method 'x': Error: ${codigo}`)).mensaje;
    expect(m).not.toMatch(/No se pudo completar la operación/);
  });
});
