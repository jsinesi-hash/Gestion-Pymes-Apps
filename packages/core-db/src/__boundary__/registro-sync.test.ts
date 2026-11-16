import { describe, it, expect } from 'vitest';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import * as coreSchema from '../schema';
import { combinarRegistros, registroSyncCore, verificarRegistroSync, type RegistroSync } from './registro-sync';

const sync = {
  version: integer('version').notNull().default(1),
  origin_id: text('origin_id').notNull(),
  sync_state: text('sync_state').notNull().default('pending'),
  updated_at: integer('updated_at').notNull(),
};

const cosa = sqliteTable('cosa', { id: text('id').primaryKey(), saldo: real('saldo'), ...sync });
const movimiento = sqliteTable('movimiento', { id: text('id').primaryKey(), ...sync });
const sinSync = sqliteTable('sin_sync', { id: text('id').primaryKey() });
const idNumerico = sqliteTable('id_numerico', { id: integer('id').primaryKey(), ...sync });

describe('verificarRegistroSync', () => {
  it('sin problemas cuando cada tabla está registrada y cumple su tipo', () => {
    const schema = { cosa, movimiento, sinSync };
    const registro: RegistroSync = {
      cosa: { tipo: 'maestro', proyectadas: ['saldo'] },
      movimiento: { tipo: 'libro' },
      sin_sync: { tipo: 'local' },
    };
    expect(verificarRegistroSync(schema, registro)).toEqual([]);
  });

  it('una tabla del esquema sin entrada en el registro es un problema', () => {
    expect(verificarRegistroSync({ cosa }, {})).toEqual(['sin_registro:cosa']);
  });

  it('una tabla maestro o libro sin id texto o sin campos de sync es un problema (B2)', () => {
    const registro: RegistroSync = { sin_sync: { tipo: 'maestro' }, id_numerico: { tipo: 'libro' } };
    expect(verificarRegistroSync({ sinSync, idNumerico }, registro)).toEqual([
      'sin_campos_sync:id_numerico',
      'sin_campos_sync:sin_sync',
    ]);
  });

  it('una tabla local no necesita campos de sync', () => {
    expect(verificarRegistroSync({ sinSync }, { sin_sync: { tipo: 'local' } })).toEqual([]);
  });

  it('una columna proyectada que no existe es un problema', () => {
    const registro: RegistroSync = { cosa: { tipo: 'maestro', proyectadas: ['saldo', 'no_existe'] } };
    expect(verificarRegistroSync({ cosa }, registro)).toEqual(['proyectada_inexistente:cosa.no_existe']);
  });

  it('una tabla local o libro no puede tener columnas proyectadas', () => {
    const registro: RegistroSync = {
      cosa: { tipo: 'libro', proyectadas: ['saldo'] },
      sin_sync: { tipo: 'local', proyectadas: ['id'] },
    };
    expect(verificarRegistroSync({ cosa, sinSync }, registro)).toEqual([
      'proyectada_fuera_de_maestro:cosa',
      'proyectada_fuera_de_maestro:sin_sync',
    ]);
  });

  it('una entrada del registro sin tabla en el esquema es un problema', () => {
    expect(verificarRegistroSync({}, { fantasma: { tipo: 'maestro' } })).toEqual(['registro_sin_tabla:fantasma']);
  });

  it('ignora lo que no es tabla (funciones y constantes que también exporta el esquema)', () => {
    expect(verificarRegistroSync({ cosa, util: () => 1, lista: ['x'] }, { cosa: { tipo: 'maestro' } })).toEqual([]);
  });
});

describe('combinarRegistros', () => {
  it('une los registros', () => {
    expect(combinarRegistros({ a: { tipo: 'maestro' } }, { b: { tipo: 'libro' } })).toEqual({
      a: { tipo: 'maestro' },
      b: { tipo: 'libro' },
    });
  });

  it('una tabla declarada dos veces lanza REGISTRO_SYNC_DUPLICADO', () => {
    expect(() => combinarRegistros({ a: { tipo: 'maestro' } }, { a: { tipo: 'libro' } })).toThrow(
      'REGISTRO_SYNC_DUPLICADO: a',
    );
  });
});

describe('registroSyncCore', () => {
  it('cubre exactamente las tablas del núcleo', () => {
    expect(verificarRegistroSync(coreSchema, registroSyncCore())).toEqual([]);
  });

  it('los libros del núcleo son los de movimientos (solo inserción)', () => {
    const libros = Object.entries(registroSyncCore())
      .filter(([, e]) => e.tipo === 'libro')
      .map(([t]) => t)
      .sort();
    expect(libros).toEqual(['movimiento_caja', 'movimiento_cuenta_corriente', 'venta_pago']);
  });

  it('el saldo de cuenta corriente es una columna proyectada (ADR-151)', () => {
    expect(registroSyncCore().cuenta_corriente_cliente.proyectadas).toContain('saldo_centavos');
  });
});
