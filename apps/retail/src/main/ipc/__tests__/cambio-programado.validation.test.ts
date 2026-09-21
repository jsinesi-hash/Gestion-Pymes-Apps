import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  crearCambioProgramadoHandler,
  cancelarCambioProgramadoHandler,
} from '../cambio-programado';
import { randomUUID } from 'node:crypto';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

// ADR-085 (SEC-2): validación en el borde de los handlers de cambios programados de precio.

describe('cambioProgramado — validación (ADR-085)', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => { db = setupDb(); loginAsAdmin(db); });
  afterEach(() => clearSession());

  function seedLista(db: ReturnType<typeof setupDb>) {
    const now = new Date();
    const sync = { version: 1, origin_id: 'T1', sync_state: 'pending' as const, updated_at: now };
    const listaId = randomUUID();
    db.insert(schema.lista_precio).values({
      id: listaId, nombre: 'General-' + listaId.slice(0, 8), tipo: 'general', ajuste_porcentual: 0,
      predeterminada: true, activo: true,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    return listaId;
  }

  function baseParams(listaId: string, overrides: Record<string, unknown> = {}) {
    return {
      lista_precio_id: listaId,
      porcentaje: 10,
      base_calculo: 'precio_lista',
      alcance: 'catalogo',
      fecha_aplicacion: new Date(Date.now() + 86400000),
      ...overrides,
    };
  }

  it('crear con payload completo y válido inserta con estado pendiente (happy path)', () => {
    const listaId = seedLista(db);
    const result = crearCambioProgramadoHandler(db, baseParams(listaId, {
      alcance: 'rubro',
      alcance_id: randomUUID(),
      excluir_manuales_dias: 30,
    }));
    const row = db.select().from(schema.cambio_programado)
      .where(eq(schema.cambio_programado.id, result.id)).get();
    expect(row!.estado).toBe('pendiente');
    expect(row!.alcance).toBe('rubro');
    expect(row!.excluir_manuales_dias).toBe(30);
  });

  it('crear sin fecha_aplicacion (omitido) → VALIDATION:fecha_aplicacion:TIPO', () => {
    const listaId = seedLista(db);
    const payload = baseParams(listaId);
    delete (payload as Record<string, unknown>)['fecha_aplicacion'];
    expect(() => crearCambioProgramadoHandler(db, payload))
      .toThrow('VALIDATION:fecha_aplicacion:TIPO');
  });

  it('crear con fecha_aplicacion inválida → VALIDATION:fecha_aplicacion:TIPO', () => {
    const listaId = seedLista(db);
    expect(() => crearCambioProgramadoHandler(db, baseParams(listaId, {
      fecha_aplicacion: 'no-es-una-fecha',
    }))).toThrow('VALIDATION:fecha_aplicacion:TIPO');
  });

  it('crear con lista_precio_id vacío → VALIDATION:lista_precio_id:REQUERIDO', () => {
    const listaId = seedLista(db);
    expect(() => crearCambioProgramadoHandler(db, baseParams(listaId, {
      lista_precio_id: '',
    }))).toThrow('VALIDATION:lista_precio_id:REQUERIDO');
  });

  it('crear con lista_precio_id omitido → VALIDATION:lista_precio_id:TIPO', () => {
    const listaId = seedLista(db);
    const payload = baseParams(listaId);
    delete (payload as Record<string, unknown>)['lista_precio_id'];
    expect(() => crearCambioProgramadoHandler(db, payload))
      .toThrow('VALIDATION:lista_precio_id:TIPO');
  });

  it('crear con base_calculo inválido → VALIDATION:base_calculo:ENUM', () => {
    const listaId = seedLista(db);
    expect(() => crearCambioProgramadoHandler(db, baseParams(listaId, {
      base_calculo: 'no_valido',
    }))).toThrow('VALIDATION:base_calculo:ENUM');
  });

  it('crear con alcance inválido → VALIDATION:alcance:ENUM', () => {
    const listaId = seedLista(db);
    expect(() => crearCambioProgramadoHandler(db, baseParams(listaId, {
      alcance: 'no_valido',
    }))).toThrow('VALIDATION:alcance:ENUM');
  });

  it('crear con porcentaje no numérico → VALIDATION:porcentaje:TIPO', () => {
    const listaId = seedLista(db);
    expect(() => crearCambioProgramadoHandler(db, baseParams(listaId, {
      porcentaje: 'diez' as any,
    }))).toThrow('VALIDATION:porcentaje:TIPO');
  });

  it('crear con excluir_manuales_dias negativo → VALIDATION:excluir_manuales_dias:MIN:0', () => {
    const listaId = seedLista(db);
    expect(() => crearCambioProgramadoHandler(db, baseParams(listaId, {
      excluir_manuales_dias: -5,
    }))).toThrow('VALIDATION:excluir_manuales_dias:MIN:0');
  });

  it('cancelar con id vacío → VALIDATION:id:REQUERIDO', () => {
    expect(() => cancelarCambioProgramadoHandler(db, ''))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('cancelar con id de tipo inválido → VALIDATION:id:TIPO', () => {
    expect(() => cancelarCambioProgramadoHandler(db, 123 as any))
      .toThrow('VALIDATION:id:TIPO');
  });
});
