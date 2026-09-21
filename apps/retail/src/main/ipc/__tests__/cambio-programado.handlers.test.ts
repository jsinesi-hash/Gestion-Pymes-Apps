import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  crearCambioProgramadoHandler,
  cancelarCambioProgramadoHandler,
  listarCambioProgramadoHandler,
} from '../cambio-programado';
import { randomUUID } from 'node:crypto';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('cambioProgramado', () => {
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

  it('crear inserta con estado pendiente', () => {
    const listaId = seedLista(db);
    const fechaFutura = new Date(Date.now() + 86400000);
    const result = crearCambioProgramadoHandler(db, {
      lista_precio_id: listaId,
      porcentaje: 10,
      base_calculo: 'precio_lista',
      alcance: 'catalogo',
      fecha_aplicacion: fechaFutura,
    });
    const row = db.select().from(schema.cambio_programado)
      .where(eq(schema.cambio_programado.id, result.id)).get();
    expect(row!.estado).toBe('pendiente');
    expect(row!.porcentaje).toBe(10);
  });

  it('crear rechaza fecha_aplicacion en el pasado', () => {
    const listaId = seedLista(db);
    expect(() => crearCambioProgramadoHandler(db, {
      lista_precio_id: listaId, porcentaje: 5,
      base_calculo: 'precio_lista', alcance: 'catalogo',
      fecha_aplicacion: new Date(Date.now() - 1000),
    })).toThrow('FECHA_PASADA');
  });

  it('cancelar con compare-and-swap', () => {
    const listaId = seedLista(db);
    const { id } = crearCambioProgramadoHandler(db, {
      lista_precio_id: listaId, porcentaje: 5,
      base_calculo: 'precio_lista', alcance: 'catalogo',
      fecha_aplicacion: new Date(Date.now() + 86400000),
    });
    const result = cancelarCambioProgramadoHandler(db, id);
    expect(result.cancelado).toBe(true);
    const row = db.select().from(schema.cambio_programado)
      .where(eq(schema.cambio_programado.id, id)).get();
    expect(row!.estado).toBe('cancelado');
  });

  it('cancelar devuelve cancelado=false si ya fue aplicado (race condition)', () => {
    const listaId = seedLista(db);
    const { id } = crearCambioProgramadoHandler(db, {
      lista_precio_id: listaId, porcentaje: 5,
      base_calculo: 'precio_lista', alcance: 'catalogo',
      fecha_aplicacion: new Date(Date.now() + 86400000),
    });
    db.update(schema.cambio_programado)
      .set({ estado: 'aplicado' })
      .where(eq(schema.cambio_programado.id, id))
      .run();
    const result = cancelarCambioProgramadoHandler(db, id);
    expect(result.cancelado).toBe(false);
  });

  it('listar devuelve pendientes de la lista', () => {
    const listaId = seedLista(db);
    crearCambioProgramadoHandler(db, {
      lista_precio_id: listaId, porcentaje: 5,
      base_calculo: 'precio_lista', alcance: 'catalogo',
      fecha_aplicacion: new Date(Date.now() + 86400000),
    });
    const rows = listarCambioProgramadoHandler(db, listaId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].lista_precio_id).toBe(listaId);
  });
});
