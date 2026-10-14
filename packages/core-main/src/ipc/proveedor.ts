import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { requirePermission } from '../auth/guard';
import { str, optStr, optId, oneOf } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

/**
 * ADR-106: CRUD universal de proveedor. Lo que es de cada app (p. ej. Retail genera lotes de precio
 * cuando cambian los defaults comerciales) se inyecta por hook; el core no conoce `producto_proveedor`
 * ni el motor de precios. Un error del hook no rompe el upsert (se loguea).
 */
export type ProveedorHooks = {
  onProveedorActualizado?: (db: Db, ctx: { id: string; userId: string; cambioDefaults: boolean }) => void;
};

const TIPO_DOC = ['DNI', 'CUIT', 'CUIL'] as const;
const COND_FISCAL = ['Responsable Inscripto', 'Monotributo', 'Consumidor Final', 'Exento'] as const;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

function queryProveedoresActivos(db: Db) {
  return db.select().from(schema.proveedor).where(eq(schema.proveedor.activo, true)).all();
}

export type ProveedorUpsertPayload = {
  id?: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  razon_social: string;
  condicion_fiscal: 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  nombre_fantasia?: string;
  domicilio?: string;
  calle?: string;
  numero?: string;
  aclaracion?: string;
  localidad_id?: string;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string;
  telefono?: string;
  telefono_adicional?: string;
  email?: string;
  persona_contacto?: string;
  observaciones?: string;
  codigo?: string;
  // ADR-049 §1 — defaults comerciales para el costo neto.
  bonificacion_pct_default?: number;
  costo_financiero_pct_default?: number;
  flete_pct_default?: number;
  // ADR-063 Lote 4 — umbral opt-in de pre-selección por similitud (0-100). null = desactivado.
  match_umbral_preseleccion?: number | null;
};

function generarCodigoProveedor(db: Db): string {
  const rows = db.select({ codigo: schema.proveedor.codigo }).from(schema.proveedor).all();
  let max = 0;
  for (const row of rows) {
    const m = row.codigo?.match(/^PROV-(\d{4})$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return `PROV-${String(max + 1).padStart(4, '0')}`;
}

export function proveedorListHandler(db: Db) {
  requireSession();
  return queryProveedoresActivos(db);
}

export function proveedorGetHandler(db: Db, id: string) {
  requireSession();
  return db.select().from(schema.proveedor).where(eq(schema.proveedor.id, id)).get() ?? null;
}

export function proveedorUpsertHandler(db: Db, payload: unknown, hooks: ProveedorHooks = {}) {
  const session = requireSession();
  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  // ADR-082 (SEC-2): validar en el borde, antes de tocar la BD.
  // razon_social primero para que su ausencia gane el mensaje de error.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = optId(p['id'], 'id');
  const v_razon_social = str(p['razon_social'], 'razon_social', { max: 160 });
  const v_tipo_documento = oneOf(p['tipo_documento'], 'tipo_documento', TIPO_DOC);
  // numero_documento es opcional en el form (ProveedorForm valida sólo si viene no vacío) y la
  // columna es NOT NULL → validamos el tipo pero permitimos vacío, normalizado a ''.
  const v_numero_documento = optStr(p['numero_documento'], 'numero_documento', 20) ?? '';
  const v_condicion_fiscal = oneOf(p['condicion_fiscal'], 'condicion_fiscal', COND_FISCAL);
  const v_nombre_fantasia = optStr(p['nombre_fantasia'], 'nombre_fantasia', 120);
  const v_domicilio = optStr(p['domicilio'], 'domicilio', 200);
  const v_calle = optStr(p['calle'], 'calle', 120);
  const v_numero = optStr(p['numero'], 'numero', 20);
  const v_aclaracion = optStr(p['aclaracion'], 'aclaracion', 120);
  const v_localidad = optStr(p['localidad'], 'localidad', 120);
  const v_provincia = optStr(p['provincia'], 'provincia', 120);
  const v_codigo_postal = optStr(p['codigo_postal'], 'codigo_postal', 20);
  const v_telefono = optStr(p['telefono'], 'telefono', 40);
  const v_telefono_adicional = optStr(p['telefono_adicional'], 'telefono_adicional', 40);
  const v_email = optStr(p['email'], 'email', 120);
  const v_persona_contacto = optStr(p['persona_contacto'], 'persona_contacto', 120);
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 500);
  const v_codigo = optStr(p['codigo'], 'codigo', 40);
  const v_localidad_id = optId(p['localidad_id'], 'localidad_id');
  // Campos numéricos (defaults comerciales / umbral): pasan tal cual, sin coerción.
  const v_bonificacion_pct_default     = p['bonificacion_pct_default']     as number | undefined;
  const v_costo_financiero_pct_default = p['costo_financiero_pct_default'] as number | undefined;
  const v_flete_pct_default            = p['flete_pct_default']            as number | undefined;
  const v_match_umbral_preseleccion    = p['match_umbral_preseleccion']    as number | null | undefined;

  if (v_id) {
    const existente = db.select({
      bonificacion_pct_default: schema.proveedor.bonificacion_pct_default,
      costo_financiero_pct_default: schema.proveedor.costo_financiero_pct_default,
      flete_pct_default: schema.proveedor.flete_pct_default,
    }).from(schema.proveedor).where(eq(schema.proveedor.id, v_id)).get();
    const cambioDefaults = !!existente && (
      (v_bonificacion_pct_default     !== undefined && v_bonificacion_pct_default     !== existente.bonificacion_pct_default) ||
      (v_costo_financiero_pct_default !== undefined && v_costo_financiero_pct_default !== existente.costo_financiero_pct_default) ||
      (v_flete_pct_default            !== undefined && v_flete_pct_default            !== existente.flete_pct_default)
    );

    db.update(schema.proveedor).set({
      tipo_documento:   v_tipo_documento,
      numero_documento: v_numero_documento,
      razon_social:     v_razon_social,
      condicion_fiscal: v_condicion_fiscal,
      nombre_fantasia:  v_nombre_fantasia  ?? null,
      domicilio:          v_domicilio          ?? null,
      calle:              v_calle              ?? null,
      numero:             v_numero             ?? null,
      aclaracion:         v_aclaracion         ?? null,
      localidad_id:       v_localidad_id       ?? null,
      localidad:          v_localidad          ?? null,
      provincia:          v_provincia          ?? null,
      codigo_postal:      v_codigo_postal      ?? null,
      telefono:           v_telefono           ?? null,
      telefono_adicional: v_telefono_adicional ?? null,
      email:              v_email              ?? null,
      persona_contacto:   v_persona_contacto   ?? null,
      observaciones:      v_observaciones      ?? null,
      ...(v_codigo ? { codigo: v_codigo } : {}),
      ...(v_bonificacion_pct_default     !== undefined && { bonificacion_pct_default:     v_bonificacion_pct_default }),
      ...(v_costo_financiero_pct_default !== undefined && { costo_financiero_pct_default: v_costo_financiero_pct_default }),
      ...(v_flete_pct_default            !== undefined && { flete_pct_default:            v_flete_pct_default }),
      ...(v_match_umbral_preseleccion    !== undefined && { match_umbral_preseleccion:    v_match_umbral_preseleccion }),
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
      ...sync,
    }).where(eq(schema.proveedor.id, v_id)).run();

    if (hooks.onProveedorActualizado) {
      try {
        hooks.onProveedorActualizado(db, { id: v_id, userId: session.userId, cambioDefaults });
      } catch (e) {
        console.error('[proveedor] Error en onProveedorActualizado:', e);
      }
    }

    return { id: v_id };
  }

  const id = generateId();
  const codigo = v_codigo || generarCodigoProveedor(db);
  db.insert(schema.proveedor).values({
    id,
    tipo_documento:   v_tipo_documento,
    numero_documento: v_numero_documento,
    razon_social:     v_razon_social,
    condicion_fiscal: v_condicion_fiscal,
    nombre_fantasia:  v_nombre_fantasia  ?? null,
    domicilio:          v_domicilio          ?? null,
    calle:              v_calle              ?? null,
    numero:             v_numero             ?? null,
    aclaracion:         v_aclaracion         ?? null,
    localidad_id:       v_localidad_id       ?? null,
    localidad:          v_localidad          ?? null,
    provincia:          v_provincia          ?? null,
    codigo_postal:      v_codigo_postal      ?? null,
    telefono:           v_telefono           ?? null,
    telefono_adicional: v_telefono_adicional ?? null,
    email:              v_email              ?? null,
    persona_contacto:   v_persona_contacto   ?? null,
    observaciones:      v_observaciones      ?? null,
    codigo,
    match_umbral_preseleccion:    v_match_umbral_preseleccion    ?? null,
    bonificacion_pct_default:     v_bonificacion_pct_default     ?? 0,
    costo_financiero_pct_default: v_costo_financiero_pct_default ?? 0,
    flete_pct_default:            v_flete_pct_default            ?? 0,
    activo: true,
    usuario_creacion_id: session.userId,
    fecha_creacion: now,
    ...sync,
  }).run();
  return { id };
}

export function proveedorDeactivateHandler(db: Db, id: string) {
  const session = requireSession();
  const now = new Date();
  db.update(schema.proveedor).set({
    activo: false,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
    updated_at: now,
  }).where(eq(schema.proveedor.id, id)).run();
  return { id };
}

export function proveedorQueryAll(db: Db) {
  requireSession();
  return queryProveedoresActivos(db);
}

export function registerProveedorHandlers(ipcMain: IpcMain, db: Db, hooks: ProveedorHooks = {}): void {
  const guard = requirePermission('proveedor.gestionar');
  ipcMain.handle('proveedor:list',       guard(async () => proveedorListHandler(db)));
  ipcMain.handle('proveedor:get',        guard(async (_e, id) => proveedorGetHandler(db, id)));
  ipcMain.handle('proveedor:upsert',     guard(async (_e, p) => proveedorUpsertHandler(db, p, hooks)));
  ipcMain.handle('proveedor:deactivate', guard(async (_e, id) => proveedorDeactivateHandler(db, id)));
}
