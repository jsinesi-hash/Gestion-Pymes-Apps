import { describe, it, expect } from 'vitest';
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { columnasRealesNoDeclaradas } from './columnas-reales';

// ADR-157 (PR-C4): el dinero va en centavos enteros. Una columna REAL solo puede ser una cantidad,
// un factor o un porcentaje, y cada app la declara a mano para que una nueva no pase sin revisión.
const articulo = sqliteTable('articulo', {
  id: text('id').primaryKey(),
  precio_centavos: integer('precio_centavos').notNull(),
  cantidad: real('cantidad').notNull(),
  descuento_pct: real('descuento_pct'),
});
const schema = { articulo, otraCosa: 'no es tabla' };

describe('columnasRealesNoDeclaradas', () => {
  it('sin problemas cuando toda columna REAL está declarada', () => {
    expect(columnasRealesNoDeclaradas(schema, ['articulo.cantidad', 'articulo.descuento_pct'])).toEqual([]);
  });

  it('marca la columna REAL que nadie declaró (posible dinero en pesos)', () => {
    expect(columnasRealesNoDeclaradas(schema, ['articulo.cantidad'])).toEqual(['real_no_declarada:articulo.descuento_pct']);
  });

  it('marca una declaración que ya no corresponde a una columna REAL', () => {
    expect(columnasRealesNoDeclaradas(schema, ['articulo.cantidad', 'articulo.descuento_pct', 'articulo.precio_centavos', 'viejo.monto']))
      .toEqual(['declarada_sin_real:articulo.precio_centavos', 'declarada_sin_real:viejo.monto']);
  });
});
