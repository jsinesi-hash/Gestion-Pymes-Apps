import { eq, and, desc, ne } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { id as vId, optId, num, int, oneOf, ValidationError } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

const BASE_CALCULOS = ['precio_lista', 'costo_proveedor', 'lista'] as const;
const ALCANCES = ['catalogo', 'rubro', 'marca', 'proveedor'] as const;

// ── crearCambioProgramado ─────────────────────────────────────────────────────

export function crearCambioProgramadoHandler(
  db: Db,
  rawPayload: unknown,
): { id: string } {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  const v_lista_precio_id = vId(p['lista_precio_id'], 'lista_precio_id');
  const v_porcentaje = num(p['porcentaje'], 'porcentaje');
  const v_base_calculo = oneOf(p['base_calculo'], 'base_calculo', BASE_CALCULOS);
  const v_alcance = oneOf(p['alcance'], 'alcance', ALCANCES);
  const v_base_lista_id = optId(p['base_lista_id'], 'base_lista_id');
  const v_alcance_id = optId(p['alcance_id'], 'alcance_id');
  const v_excluir_manuales_dias = p['excluir_manuales_dias'] == null
    ? undefined
    : int(p['excluir_manuales_dias'], 'excluir_manuales_dias', { min: 0 });

  // fecha_aplicacion no tiene primitiva en core.ts (no hay tipo Date): validación manual.
  const rawFecha = p['fecha_aplicacion'];
  const v_fecha_aplicacion = rawFecha instanceof Date ? rawFecha : new Date(rawFecha as any);
  if (!(v_fecha_aplicacion instanceof Date) || Number.isNaN(v_fecha_aplicacion.getTime())) {
    throw new ValidationError('fecha_aplicacion', 'TIPO');
  }

  if (v_fecha_aplicacion <= new Date()) throw new Error('FECHA_PASADA');

  const now = new Date();
  const nuevoId = generateId();

  db.insert(schema.cambio_programado).values({
    id: nuevoId,
    lista_precio_id:       v_lista_precio_id,
    porcentaje:            v_porcentaje,
    base_calculo:          v_base_calculo,
    base_lista_id:         v_base_lista_id ?? null,
    base_valor_centavos:   null,
    alcance:               v_alcance,
    alcance_id:            v_alcance_id ?? null,
    excluir_manuales_dias: v_excluir_manuales_dias ?? null,
    fecha_aplicacion:      v_fecha_aplicacion,
    estado:                'pendiente',
    recalculo_masivo_id:   null,
    usuario_creacion_id:   session.userId,
    fecha_creacion:        now,
    usuario_modificacion_id: null,
    fecha_actualizacion:   null,
    version:               1,
    origin_id:             getOriginId(),
    sync_state:            'pending',
    updated_at:            now,
  }).run();

  return { id: nuevoId };
}

// ── cancelarCambioProgramado ──────────────────────────────────────────────────

export function cancelarCambioProgramadoHandler(
  db: Db,
  idArg: unknown,
): { cancelado: boolean } {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const v_id = vId(idArg, 'id');

  const now = new Date();

  // Compare-and-swap: only cancel if still 'pendiente'
  const result = db.update(schema.cambio_programado)
    .set({ estado: 'cancelado', updated_at: now })
    .where(and(
      eq(schema.cambio_programado.id, v_id),
      eq(schema.cambio_programado.estado, 'pendiente'),
    ))
    .run();

  return { cancelado: result.changes > 0 };
}

// ── listarCambioProgramado ────────────────────────────────────────────────────

export function listarCambioProgramadoHandler(
  db: Db,
  listaId: string,
) {
  const pendientes = db.select().from(schema.cambio_programado)
    .where(and(
      eq(schema.cambio_programado.lista_precio_id, listaId),
      eq(schema.cambio_programado.estado, 'pendiente'),
    ))
    .orderBy(desc(schema.cambio_programado.fecha_aplicacion))
    .all();

  const historial = db.select().from(schema.cambio_programado)
    .where(and(
      eq(schema.cambio_programado.lista_precio_id, listaId),
      ne(schema.cambio_programado.estado, 'pendiente'),
    ))
    .orderBy(desc(schema.cambio_programado.fecha_aplicacion))
    .limit(10)
    .all();

  return [...pendientes, ...historial];
}

// ── registerCambioProgramadoHandlers ─────────────────────────────────────────

export function registerCambioProgramadoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('cambioProgramado:crear',    async (_e, p)       => crearCambioProgramadoHandler(db, p));
  ipcMain.handle('cambioProgramado:cancelar', async (_e, id)      => cancelarCambioProgramadoHandler(db, id));
  ipcMain.handle('cambioProgramado:listar',   async (_e, listaId) => listarCambioProgramadoHandler(db, listaId));
}
