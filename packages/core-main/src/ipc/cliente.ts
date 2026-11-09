import { eq, asc, sql } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { requirePermission } from '../auth/guard';
import { str, optStr, optId, oneOf, bool } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

const TIPO_DOC = ['DNI', 'CUIT', 'CUIL'] as const;
const COND_FISCAL = ['Responsable Inscripto', 'Monotributo', 'Consumidor Final', 'Exento'] as const;

export type ClienteUpsertPayload = {
  id?: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  nombre: string;
  apellido: string;
  condicion_fiscal: 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  nombre_fantasia?: string;
  telefono?: string;
  telefono_adicional?: string;
  email?: string;
  habilita_cuenta_corriente?: boolean;
  domicilio?: string;
  calle?: string;
  numero?: string;
  aclaracion?: string;
  localidad_id?: string;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string;
  lista_precio_id?: string | null;
};

export function clienteUpsertHandler(db: Db, payload: unknown) {
  const session = getSession()!;
  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  // ADR-082 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = optId(p['id'], 'id');
  const v_nombre = str(p['nombre'], 'nombre', { max: 120 });
  const v_apellido = str(p['apellido'], 'apellido', { max: 120 });
  const v_tipo_documento = oneOf(p['tipo_documento'], 'tipo_documento', TIPO_DOC);
  // numero_documento es opcional en el form (ClienteForm valida sólo si viene no vacío) y la
  // columna es NOT NULL → validamos el tipo pero permitimos vacío, normalizado a ''.
  const v_numero_documento = optStr(p['numero_documento'], 'numero_documento', 20) ?? '';
  const v_condicion_fiscal = oneOf(p['condicion_fiscal'], 'condicion_fiscal', COND_FISCAL);
  const v_nombre_fantasia = optStr(p['nombre_fantasia'], 'nombre_fantasia', 120);
  const v_email = optStr(p['email'], 'email', 120);
  const v_telefono = optStr(p['telefono'], 'telefono', 40);
  const v_telefono_adicional = optStr(p['telefono_adicional'], 'telefono_adicional', 40);
  const v_domicilio = optStr(p['domicilio'], 'domicilio', 200);
  const v_calle = optStr(p['calle'], 'calle', 120);
  const v_numero = optStr(p['numero'], 'numero', 20);
  const v_aclaracion = optStr(p['aclaracion'], 'aclaracion', 120);
  const v_localidad = optStr(p['localidad'], 'localidad', 120);
  const v_provincia = optStr(p['provincia'], 'provincia', 120);
  const v_codigo_postal = optStr(p['codigo_postal'], 'codigo_postal', 20);
  const v_localidad_id = optId(p['localidad_id'], 'localidad_id');
  const v_lista_precio_id = optId(p['lista_precio_id'], 'lista_precio_id');
  const v_habilita_cc = p['habilita_cuenta_corriente'] == null
    ? undefined
    : bool(p['habilita_cuenta_corriente'], 'habilita_cuenta_corriente');

  let clienteId: string;

  if (v_id) {
    db.update(schema.cliente).set({
      nombre: v_nombre,
      apellido: v_apellido,
      nombre_fantasia: v_nombre_fantasia ?? null,
      condicion_fiscal: v_condicion_fiscal,
      telefono: v_telefono ?? null,
      email: v_email ?? null,
      habilita_cuenta_corriente: v_habilita_cc ?? false,
      domicilio: v_domicilio ?? null,
      calle:              v_calle              ?? null,
      numero:             v_numero             ?? null,
      aclaracion:         v_aclaracion         ?? null,
      telefono_adicional: v_telefono_adicional ?? null,
      localidad_id: v_localidad_id ?? null,
      lista_precio_id: v_lista_precio_id ?? null,
      localidad: v_localidad ?? null,
      provincia: v_provincia ?? null,
      codigo_postal: v_codigo_postal ?? null,
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
      ...sync,
    }).where(eq(schema.cliente.id, v_id)).run();
    clienteId = v_id;
  } else {
    clienteId = generateId();
    db.insert(schema.cliente).values({
      id: clienteId,
      tipo_documento: v_tipo_documento,
      numero_documento: v_numero_documento,
      nombre: v_nombre,
      apellido: v_apellido,
      condicion_fiscal: v_condicion_fiscal,
      nombre_fantasia: v_nombre_fantasia ?? null,
      telefono: v_telefono ?? null,
      telefono_adicional: v_telefono_adicional ?? null,
      email: v_email ?? null,
      habilita_cuenta_corriente: v_habilita_cc ?? false,
      domicilio: v_domicilio ?? null,
      calle:              v_calle              ?? null,
      numero:             v_numero             ?? null,
      aclaracion:         v_aclaracion         ?? null,
      localidad_id: v_localidad_id ?? null,
      lista_precio_id: v_lista_precio_id ?? null,
      localidad: v_localidad ?? null,
      provincia: v_provincia ?? null,
      codigo_postal: v_codigo_postal ?? null,
      activo: true,
      usuario_creacion_id: session.userId,
      fecha_creacion: now,
      ...sync,
    }).run();
  }

  // ADR P3.6-01: auto-crear CCC idempotente; bloquear si saldo≠0 al deshabilitar
  if (v_habilita_cc === true) {
    const existe = db.select({ id: schema.cuenta_corriente_cliente.id })
      .from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, clienteId))
      .get();
    if (!existe) {
      db.insert(schema.cuenta_corriente_cliente).values({
        id: generateId(),
        cliente_id: clienteId,
        saldo_centavos: 0,
        limite_credito_centavos: 0,
        activo: true,
        ...sync,
      }).run();
    }
  }

  if (v_habilita_cc === false) {
    const ccc = db.select({ saldo_centavos: schema.cuenta_corriente_cliente.saldo_centavos })
      .from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, clienteId))
      .get();
    if (ccc && ccc.saldo_centavos !== 0) throw new Error('CCC_CON_SALDO');
  }

  return { id: clienteId };
}

export function clienteListHandler(db: Db, payload?: { incluirInactivos?: boolean }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const q = db.select({
    id:                        schema.cliente.id,
    tipo_documento:            schema.cliente.tipo_documento,
    numero_documento:          schema.cliente.numero_documento,
    nombre:                    schema.cliente.nombre,
    apellido:                  schema.cliente.apellido,
    condicion_fiscal:          schema.cliente.condicion_fiscal,
    habilita_cuenta_corriente: schema.cliente.habilita_cuenta_corriente,
    telefono:                  schema.cliente.telefono,
    email:                     schema.cliente.email,
    activo:                    schema.cliente.activo,
  }).from(schema.cliente);
  if (!payload?.incluirInactivos) {
    return q.where(eq(schema.cliente.activo, true)).orderBy(asc(schema.cliente.nombre), asc(schema.cliente.apellido)).all();
  }
  return q.orderBy(asc(schema.cliente.nombre), asc(schema.cliente.apellido)).all();
}

export function clienteGetHandler(db: Db, id: string) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return db.select().from(schema.cliente)
    .where(eq(schema.cliente.id, id))
    .get() ?? null;
}

/** Used by the export module — retains saldo_cuenta placeholder (R3) */
export function clienteQueryAll(db: Db) {
  return db.select({
    nombre:           schema.cliente.nombre,
    apellido:         schema.cliente.apellido,
    numero_documento: schema.cliente.numero_documento,
    condicion_fiscal: schema.cliente.condicion_fiscal,
    telefono:         schema.cliente.telefono,
    email:            schema.cliente.email,
    saldo_cuenta:     sql<number>`0`,
  })
    .from(schema.cliente)
    .where(eq(schema.cliente.activo, true))
    .all();
}

export function clienteDesactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session?.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  const cliente = db.select().from(schema.cliente).where(eq(schema.cliente.id, payload.id)).get();
  if (!cliente) throw new Error('NOT_FOUND');
  const ccc = db.select({ saldo: schema.cuenta_corriente_cliente.saldo_centavos })
    .from(schema.cuenta_corriente_cliente)
    .where(eq(schema.cuenta_corriente_cliente.cliente_id, payload.id))
    .get();
  if (ccc && ccc.saldo !== 0) throw new Error(`TIENE_SALDO_CC:${ccc.saldo}`);
  const now = new Date();
  db.update(schema.cliente).set({
    activo: false,
    version: cliente.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  }).where(eq(schema.cliente.id, payload.id)).run();
}

export function clienteReactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session?.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  const cliente = db.select().from(schema.cliente).where(eq(schema.cliente.id, payload.id)).get();
  if (!cliente) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.cliente).set({
    activo: true,
    version: cliente.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  }).where(eq(schema.cliente.id, payload.id)).run();
}

export function registerClienteHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('ctacte.cobrar');
  ipcMain.handle('cliente:upsert',     guard(async (_e, p)   => clienteUpsertHandler(db, p as ClienteUpsertPayload)));
  ipcMain.handle('cliente:list',       guard(async (_e, p)   => clienteListHandler(db, p as { incluirInactivos?: boolean } | undefined)));
  ipcMain.handle('cliente:get',        guard(async (_e, id)  => clienteGetHandler(db, id as string)));
  // Baja y reactivación: las gatea usuario.administrar dentro del handler (ADR-145).
  ipcMain.handle('cliente:desactivar', async (_e, p)   => clienteDesactivarHandler(db, p as { id: string }));
  ipcMain.handle('cliente:reactivar',  async (_e, p)   => clienteReactivarHandler(db, p as { id: string }));
}
