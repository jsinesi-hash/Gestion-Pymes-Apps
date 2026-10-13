import { eq, and } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '@core/db';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import type { VentaDb, VentaTx, AplicarLineasCtx } from './types';

export type PausarVentaEsperaInput = {
  /** Si viene, actualiza en el lugar esa venta `en_espera` (la app reemplaza las líneas). */
  venta_id?: string;
  caja_id: string;
  cliente_id: string;
  subtotal: number;
  descuento_global: number;
  importe_iva: number;
  total: number;
  ajuste_redondeo: number;
  alias?: string;
  observaciones?: string;
};

export type PausarVentaEsperaHooks = {
  aplicarLineas: (tx: VentaTx, ctx: AplicarLineasCtx) => void;
};

export type VentaEsperaResumen = {
  id: string;
  alias: string | null;
  observaciones: string | null;
  en_espera_desde: Date | null;
  turno_creacion_id: string | null;
  cliente_id: string;
  total: number;
  count_items: number;
  vencida: boolean;
};

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export function pausarVentaEspera(
  db: VentaDb,
  input: PausarVentaEsperaInput,
  hooks: PausarVentaEsperaHooks,
): { venta_id: string } {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  const cajaRow = db.select().from(schema.caja)
    .where(and(eq(schema.caja.id, input.caja_id), eq(schema.caja.estado, 'abierta')))
    .get();
  if (!cajaRow) throw new Error('CAJA_REQUERIDA');

  const now = new Date();
  const terminal = getOriginId();
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };

  // Actualización en el lugar de una venta ya en espera (no aplica el tope máximo).
  if (input.venta_id) {
    const ventaId = input.venta_id;
    const ventaRow = db.select().from(schema.venta)
      .where(eq(schema.venta.id, ventaId))
      .get();
    if (!ventaRow) throw new Error('VENTA_ESPERA_NOT_FOUND');
    if (ventaRow.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');

    db.transaction((tx) => {
      tx.update(schema.venta).set({
        caja_id: input.caja_id,
        cliente_id: input.cliente_id,
        subtotal: input.subtotal,
        descuento_global: input.descuento_global,
        importe_iva: input.importe_iva,
        total: input.total,
        ajuste_redondeo: input.ajuste_redondeo,
        alias: input.alias ?? null,
        observaciones: input.observaciones ?? null,
        usuario_modificacion_id: session.userId,
        fecha_actualizacion: now,
        version: ventaRow.version + 1,
        sync_state: 'pending',
        updated_at: now,
      }).where(eq(schema.venta.id, ventaId)).run();

      hooks.aplicarLineas(tx, { ventaId, now, sync, userId: session.userId, esRetoma: true });
    });

    return { venta_id: ventaId };
  }

  const maxParam = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'pos.ventas_en_espera.max'))
    .get();
  const max = maxParam ? Number.parseInt(maxParam.valor, 10) : 10;

  const enEsperaCount = db.select({ id: schema.venta.id }).from(schema.venta)
    .where(eq(schema.venta.estado, 'en_espera'))
    .all().length;
  if (enEsperaCount >= max) throw new Error('MAX_EN_ESPERA');

  const ventaId = generateId();
  const holdNum = `HOLD:${generateId().slice(0, 8)}`;

  db.transaction((tx) => {
    tx.insert(schema.venta).values({
      id: ventaId,
      numero_interno: holdNum,
      fecha: now,
      cliente_id: input.cliente_id,
      usuario_id: session.userId,
      caja_id: input.caja_id,
      subtotal: input.subtotal,
      descuento_global: input.descuento_global,
      importe_iva: input.importe_iva,
      total: input.total,
      ajuste_redondeo: input.ajuste_redondeo,
      forma_pago: 'efectivo',
      estado: 'en_espera',
      alias: input.alias ?? null,
      observaciones: input.observaciones ?? null,
      en_espera_desde: now,
      turno_creacion_id: input.caja_id,
      usuario_creacion_id: session.userId,
      fecha_creacion: now,
      ...sync,
    }).run();

    hooks.aplicarLineas(tx, { ventaId, now, sync, userId: session.userId, esRetoma: false });
  });

  return { venta_id: ventaId };
}

export function descartarVentaEspera(db: VentaDb, ventaId: string): { ok: boolean } {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  const ventaRow = db.select().from(schema.venta)
    .where(eq(schema.venta.id, ventaId))
    .get();
  if (!ventaRow) throw new Error('VENTA_ESPERA_NOT_FOUND');
  if (ventaRow.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');

  const now = new Date();
  db.update(schema.venta).set({
    estado: 'descartada',
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
    version: ventaRow.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.venta.id, ventaId)).run();

  return { ok: true };
}

export function listarVentasEspera(
  db: VentaDb,
  contarItems: (ventaId: string) => number,
): VentaEsperaResumen[] {
  requireSession();

  const ttlParam = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'pos.ventas_en_espera.ttl_horas'))
    .get();
  const ttlHoras = ttlParam ? Number.parseInt(ttlParam.valor, 10) : 24;

  const ventas = db.select().from(schema.venta)
    .where(eq(schema.venta.estado, 'en_espera'))
    .all();

  const now = Date.now();

  return ventas.map(v => {
    const fechaMs = v.en_espera_desde instanceof Date
      ? v.en_espera_desde.getTime()
      : typeof v.en_espera_desde === 'number'
        ? v.en_espera_desde
        : 0;
    const edadMs = fechaMs ? now - fechaMs : 0;
    const vencida = edadMs > ttlHoras * 60 * 60 * 1000;

    return {
      id: v.id,
      alias: v.alias ?? null,
      observaciones: v.observaciones ?? null,
      en_espera_desde: v.en_espera_desde instanceof Date
        ? v.en_espera_desde
        : v.en_espera_desde
          ? new Date(v.en_espera_desde as number)
          : null,
      turno_creacion_id: v.turno_creacion_id ?? null,
      cliente_id: v.cliente_id,
      total: v.total,
      count_items: contarItems(v.id),
      vencida,
    };
  }).sort((a, b) => {
    const ta = a.en_espera_desde?.getTime() ?? 0;
    const tb = b.en_espera_desde?.getTime() ?? 0;
    return ta - tb;
  });
}
