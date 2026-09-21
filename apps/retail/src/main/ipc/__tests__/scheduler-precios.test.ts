import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { applyPendingCambiosProgramados } from '../../scheduler/precios';
import { randomUUID } from 'node:crypto';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('applyPendingCambiosProgramados', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => { db = setupDb(); loginAsAdmin(db); });
  afterEach(() => clearSession());

  function seedCambio(db: ReturnType<typeof setupDb>, fechaAplicacion: Date) {
    const now = new Date();
    const sync = { version: 1, origin_id: 'T1', sync_state: 'pending' as const, updated_at: now };
    const impId = randomUUID();
    db.insert(schema.impuesto).values({
      id: impId, nombre: 'IVA-' + impId.slice(0, 6), tipo: 'iva', alicuota: 21,
      predeterminado: true, activo: true,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    const listaId = randomUUID();
    db.insert(schema.lista_precio).values({
      id: listaId, nombre: 'General-' + listaId.slice(0, 8), tipo: 'general', ajuste_porcentual: 0,
      predeterminada: true, activo: true,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    const catId = randomUUID();
    db.insert(schema.categoria).values({
      id: catId, nombre: 'Cat-' + catId.slice(0, 6), activo: true,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    const productoId = randomUUID();
    db.insert(schema.producto).values({
      id: productoId, sku: 'P-S-' + productoId.slice(0, 6), sku_secuencial: 1,
      nombre_corto: 'Prod', nombre_largo: 'Prod',
      unidad_venta: 'und', factor_conversion: 1, permite_fraccion: false,
      precio_costo_promedio: 0, precio_venta_lista: 100,
      impuesto_id: impId, moneda: 'ARS', categoria_id: catId, activo: true,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    const cambioId = randomUUID();
    db.insert(schema.cambio_programado).values({
      id: cambioId, lista_precio_id: listaId,
      porcentaje: 20, base_calculo: 'precio_lista', alcance: 'catalogo',
      base_lista_id: null, base_valor_centavos: null, alcance_id: null, excluir_manuales_dias: null,
      recalculo_masivo_id: null, usuario_creacion_id: 'admin', fecha_creacion: now,
      usuario_modificacion_id: null, fecha_actualizacion: null,
      fecha_aplicacion: fechaAplicacion, estado: 'pendiente',
      ...sync,
    }).run();
    return { listaId, productoId, cambioId };
  }

  it('aplica cambios con fecha_aplicacion <= now', () => {
    const pasado = new Date(Date.now() - 1000);
    const { listaId, cambioId } = seedCambio(db, pasado);
    applyPendingCambiosProgramados(db);
    const cambio = db.select().from(schema.cambio_programado)
      .where(eq(schema.cambio_programado.id, cambioId)).get();
    expect(cambio!.estado).toBe('aplicado');
    const lpv = db.select().from(schema.lista_precio_valor)
      .where(eq(schema.lista_precio_valor.lista_precio_id, listaId)).get();
    // precio_venta_lista = 100 → base = 100 * 100 = 10000 centavos → +20% = 12000
    expect(lpv!.precio_centavos).toBe(12000);
  });

  it('no aplica cambios futuros', () => {
    const futuro = new Date(Date.now() + 86400000);
    const { cambioId } = seedCambio(db, futuro);
    applyPendingCambiosProgramados(db);
    const cambio = db.select().from(schema.cambio_programado)
      .where(eq(schema.cambio_programado.id, cambioId)).get();
    expect(cambio!.estado).toBe('pendiente');
  });

  it('cancela (no crash-loop) un cambio con base_calculo=lista sin base_lista_id', () => {
    // Bug pre-ADR-049: RecalcularModal deja elegir "Otra lista de precios" como base pero
    // nunca envía base_lista_id — cualquier fila así queda inválida para siempre.
    const pasado = new Date(Date.now() - 1000);
    const { cambioId } = seedCambio(db, pasado);
    db.update(schema.cambio_programado)
      .set({ base_calculo: 'lista', base_lista_id: null })
      .where(eq(schema.cambio_programado.id, cambioId))
      .run();
    expect(() => applyPendingCambiosProgramados(db)).not.toThrow();
    const cambio = db.select().from(schema.cambio_programado)
      .where(eq(schema.cambio_programado.id, cambioId)).get();
    expect(cambio!.estado).toBe('cancelado');
  });

  it('no falla si el cambio fue cancelado antes de la ejecución (race)', () => {
    const pasado = new Date(Date.now() - 1000);
    const { cambioId } = seedCambio(db, pasado);
    db.update(schema.cambio_programado)
      .set({ estado: 'cancelado' })
      .where(eq(schema.cambio_programado.id, cambioId))
      .run();
    expect(() => applyPendingCambiosProgramados(db)).not.toThrow();
    const lpvRows = db.select().from(schema.lista_precio_valor).all();
    expect(lpvRows).toHaveLength(0);
  });
});
