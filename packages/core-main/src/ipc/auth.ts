import { eq, and } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '@core/db';
import { verifyPassword, hashPassword } from '../auth/hash';
import { getSession, setSession, clearSession, getSessionData } from '../auth/session';
import type { SessionData } from '../auth/session';
import { getOriginId } from '../context';

type Db = BetterSQLite3Database<typeof schema>;

type LoginPayload = {
  nombreUsuario: string;
  password: string;
};

const CREDENCIALES_INVALIDAS = new Error('Credenciales inválidas');
const LAST_SUPERVISOR_ERROR = new Error('LAST_SUPERVISOR');

const DEFAULT_PREFS: SessionData['preferencias'] = {
  tema: 'claro',
  acento: 'amber',
  ui_font: 'Hanken Grotesk',
  densidad: 'comfortable',
  skin: 'actual',
  pantalla_inicio: null,
  favoritos: [],
};

function parseFavoritos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function loginHandler(db: Db, payload: LoginPayload): SessionData {
  const user = db
    .select()
    .from(schema.usuario)
    .where(
      and(
        eq(schema.usuario.nombre_usuario, payload.nombreUsuario),
        eq(schema.usuario.activo, true)
      )
    )
    .get();

  if (!user) throw CREDENCIALES_INVALIDAS;

  if (!verifyPassword(payload.password, user.hash_password)) throw CREDENCIALES_INVALIDAS;

  // Cargar permisos del rol
  const rolPermisos = db
    .select({ permiso_id: schema.rol_permiso.permiso_id })
    .from(schema.rol_permiso)
    .where(eq(schema.rol_permiso.rol_id, user.rol_id))
    .all();

  const permisoIds = new Set(rolPermisos.map(rp => rp.permiso_id));
  let codigos: string[] = [];
  if (permisoIds.size > 0) {
    codigos = db
      .select({ id: schema.permiso.id, codigo: schema.permiso.codigo })
      .from(schema.permiso)
      .all()
      .filter(p => permisoIds.has(p.id))
      .map(p => p.codigo);
  }

  // Cargar preferencias
  const prefs = db
    .select()
    .from(schema.usuario_preferencias)
    .where(eq(schema.usuario_preferencias.usuario_id, user.id))
    .get();

  const preferencias: SessionData['preferencias'] = prefs
    ? {
        tema: prefs.tema,
        acento: prefs.acento,
        ui_font: prefs.ui_font,
        densidad: prefs.densidad,
        skin: prefs.skin,
        pantalla_inicio: prefs.pantalla_inicio ?? null,
        favoritos: parseFavoritos(prefs.favoritos),
      }
    : DEFAULT_PREFS;

  // Actualizar ultimo_acceso
  db.update(schema.usuario)
    .set({ ultimo_acceso: new Date() })
    .where(eq(schema.usuario.id, user.id))
    .run();

  const rolRow = db.select({ nombre: schema.rol.nombre })
    .from(schema.rol)
    .where(eq(schema.rol.id, user.rol_id))
    .get();

  const currentSession = {
    userId: user.id,
    rolId: user.rol_id,
    permisos: new Set(codigos),
  };

  const sessionData: SessionData = {
    id: user.id,
    nombreCompleto: user.nombre_completo,
    rolId: user.rol_id,
    rolNombre: rolRow?.nombre ?? '',
    permisos: codigos,
    preferencias,
  };

  setSession(currentSession, sessionData);
  return sessionData;
}

export function logoutHandler(): void {
  clearSession();
}

export function whoamiHandler(): SessionData | null {
  return getSessionData();
}

// SEC-3 (ADR-079): verifica la contraseña del usuario de la sesión actual, para desbloquear
// la terminal tras auto-bloqueo por inactividad. No recrea sesión ni toca ultimo_acceso.
export function verifyPasswordHandler(db: Db, payload: { password: string }): boolean {
  const session = getSession();
  if (!session) return false;
  const user = db.select().from(schema.usuario)
    .where(eq(schema.usuario.id, session.userId)).get();
  if (!user) return false;
  return verifyPassword(payload.password, user.hash_password);
}

export function desactivarUsuarioHandler(
  db: Db,
  payload: { userId: string }
): void {
  // Revisión 2026-10-20 (P0): era el único handler de gestión de usuarios sin guard.
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');

  const user = db
    .select()
    .from(schema.usuario)
    .where(eq(schema.usuario.id, payload.userId))
    .get();

  if (!user) throw new Error('NOT_FOUND');

  const supervisorRol = db
    .select()
    .from(schema.rol)
    .where(eq(schema.rol.nombre, 'SUPERVISOR'))
    .get();

  if (supervisorRol && user.rol_id === supervisorRol.id) {
    const activeSupervisors = db
      .select({ id: schema.usuario.id })
      .from(schema.usuario)
      .where(
        and(
          eq(schema.usuario.rol_id, supervisorRol.id),
          eq(schema.usuario.activo, true)
        )
      )
      .all();

    if (activeSupervisors.length === 1) throw LAST_SUPERVISOR_ERROR;
  }

  if (user.id === session.userId) throw new Error('AUTO_DESACTIVACION');

  db.update(schema.usuario)
    .set({ activo: false })
    .where(eq(schema.usuario.id, payload.userId))
    .run();
}

export function usuarioListHandler(db: Db) {
  const session = getSession();
  if (!session?.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  return db.select({
    id: schema.usuario.id,
    nombre_usuario: schema.usuario.nombre_usuario,
    nombre_completo: schema.usuario.nombre_completo,
    email: schema.usuario.email,
    activo: schema.usuario.activo,
    ultimo_acceso: schema.usuario.ultimo_acceso,
    rol_id: schema.usuario.rol_id,
    rol_nombre: schema.rol.nombre,
  }).from(schema.usuario)
    .innerJoin(schema.rol, eq(schema.usuario.rol_id, schema.rol.id))
    .orderBy(schema.usuario.nombre_completo)
    .all();
}

export function usuarioCreateHandler(db: Db, payload: {
  nombre_usuario: string; nombre_completo: string; email?: string;
  password: string; rol_id: string;
}) {
  const session = getSession();
  if (!session?.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  const existing = db.select({ id: schema.usuario.id }).from(schema.usuario)
    .where(eq(schema.usuario.nombre_usuario, payload.nombre_usuario)).get();
  if (existing) throw new Error('USUARIO_DUPLICADO');
  const now = new Date();
  const id = generateId();
  db.insert(schema.usuario).values({
    id, nombre_usuario: payload.nombre_usuario, nombre_completo: payload.nombre_completo,
    email: payload.email ?? null, hash_password: hashPassword(payload.password),
    rol_id: payload.rol_id, activo: true,
    usuario_creacion_id: session!.userId, fecha_creacion: now,
    version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
  }).run();
  return db.select({ id: schema.usuario.id, nombre_usuario: schema.usuario.nombre_usuario,
    nombre_completo: schema.usuario.nombre_completo, email: schema.usuario.email,
    activo: schema.usuario.activo, rol_id: schema.usuario.rol_id,
  }).from(schema.usuario).where(eq(schema.usuario.id, id)).get()!;
}

export function usuarioUpdateHandler(db: Db, payload: {
  id: string; nombre_completo?: string; email?: string; rol_id?: string;
}) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const isSelf = session.userId === payload.id;
  const canAdmin = session.permisos.has('usuario.administrar');
  if (!(isSelf || canAdmin)) throw new Error('FORBIDDEN');
  const user = db.select().from(schema.usuario).where(eq(schema.usuario.id, payload.id)).get();
  if (!user) throw new Error('NOT_FOUND');
  const now = new Date();
  const updates: Record<string, unknown> = {
    version: user.version + 1, updated_at: now,
    usuario_modificacion_id: session.userId, fecha_actualizacion: now,
  };
  if (payload.nombre_completo !== undefined) updates.nombre_completo = payload.nombre_completo;
  if (payload.email !== undefined) updates.email = payload.email || null;
  if (payload.rol_id !== undefined && canAdmin) updates.rol_id = payload.rol_id;
  db.update(schema.usuario).set(updates).where(eq(schema.usuario.id, payload.id)).run();
}

export function usuarioChangePasswordHandler(db: Db, payload: {
  target_user_id: string; current_password?: string; new_password: string;
}) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const isSelf = session.userId === payload.target_user_id;
  const canAdmin = session.permisos.has('usuario.administrar');
  if (!(isSelf || canAdmin)) throw new Error('FORBIDDEN');
  const user = db.select().from(schema.usuario).where(eq(schema.usuario.id, payload.target_user_id)).get();
  if (!user) throw new Error('NOT_FOUND');
  if (isSelf) {
    if (!payload.current_password) throw new Error('PASSWORD_REQUERIDA');
    if (!verifyPassword(payload.current_password, user.hash_password)) throw new Error('PASSWORD_INCORRECTA');
  }
  const now = new Date();
  db.update(schema.usuario).set({
    hash_password: hashPassword(payload.new_password),
    version: user.version + 1, updated_at: now,
    usuario_modificacion_id: session.userId, fecha_actualizacion: now,
  }).where(eq(schema.usuario.id, payload.target_user_id)).run();
}

export function usuarioReactivarHandler(db: Db, payload: { userId: string }) {
  const session = getSession();
  if (!session?.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  const user = db.select().from(schema.usuario).where(eq(schema.usuario.id, payload.userId)).get();
  if (!user) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.usuario).set({
    activo: true, version: user.version + 1, updated_at: now,
    usuario_modificacion_id: session!.userId, fecha_actualizacion: now,
  }).where(eq(schema.usuario.id, payload.userId)).run();
}

export function rolListHandler(db: Db) {
  return db.select({ id: schema.rol.id, nombre: schema.rol.nombre }).from(schema.rol)
    .where(eq(schema.rol.activo, true)).all();
}

// ADR-087 (PERF-3 opción A): matriz RBAC de solo lectura. Devuelve roles activos, todos los
// permisos (con módulo y descripción) y, por rol, los códigos de permiso asignados. La UI la
// arma leyendo esto + `etiquetaPermiso` de @ferreteria/shared. Sin escritura.
export function permisoMatrizHandler(db: Db) {
  const session = getSession();
  if (!session?.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  const roles = db.select({ id: schema.rol.id, nombre: schema.rol.nombre })
    .from(schema.rol).where(eq(schema.rol.activo, true))
    .orderBy(schema.rol.nombre).all();
  const permisos = db.select({
    codigo: schema.permiso.codigo,
    descripcion: schema.permiso.descripcion,
    modulo: schema.permiso.modulo,
  }).from(schema.permiso).orderBy(schema.permiso.modulo, schema.permiso.codigo).all();
  const asignaciones = db.select({
    rol_id: schema.rol_permiso.rol_id,
    codigo: schema.permiso.codigo,
  }).from(schema.rol_permiso)
    .innerJoin(schema.permiso, eq(schema.rol_permiso.permiso_id, schema.permiso.id))
    .all();
  const porRol: Record<string, string[]> = {};
  for (const r of roles) porRol[r.id] = [];
  for (const a of asignaciones) (porRol[a.rol_id] ??= []).push(a.codigo);
  return { roles, permisos, porRol };
}

export function registerAuthHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('auth:login', async (_event, payload: LoginPayload) =>
    loginHandler(db, payload)
  );
  ipcMain.handle('auth:logout', async () => logoutHandler());
  ipcMain.handle('auth:whoami', async () => whoamiHandler());
  ipcMain.handle('auth:verifyPassword', async (_e, p) => verifyPasswordHandler(db, p));
  ipcMain.handle('usuario:desactivar',      async (_e, p) => desactivarUsuarioHandler(db, p));
  ipcMain.handle('usuario:list',            async ()      => usuarioListHandler(db));
  ipcMain.handle('usuario:create',          async (_e, p) => usuarioCreateHandler(db, p));
  ipcMain.handle('usuario:update',          async (_e, p) => usuarioUpdateHandler(db, p));
  ipcMain.handle('usuario:changePassword',  async (_e, p) => usuarioChangePasswordHandler(db, p));
  ipcMain.handle('usuario:reactivar',       async (_e, p) => usuarioReactivarHandler(db, p));
  ipcMain.handle('rol:list',                async ()      => rolListHandler(db));
  ipcMain.handle('permiso:matriz',          async ()      => permisoMatrizHandler(db));
}
