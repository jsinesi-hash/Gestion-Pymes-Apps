import { eq, and, ne } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  generateId, validarPoliticaPassword, passwordVencida, diasRestantesPassword, emailValido, normalizarEmail,
} from '@ferreteria/shared';
import * as schema from '@core/db';
import { verifyPassword, hashPassword } from '../auth/hash';
import { limiteIntentos } from '../auth/intentos';
import { getSession, setSession, clearSession, getSessionData } from '../auth/session';
import type { SessionData } from '../auth/session';
import { getOriginId } from '../context';
import {
  recuperacionDisponibleHandler, recuperarSolicitarHandler, recuperarConfirmarHandler, type EnviadorCorreo,
} from '../auth/recuperacion';

type Db = BetterSQLite3Database<typeof schema>;

type LoginPayload = {
  nombreUsuario: string;
  password: string;
};

const CREDENCIALES_INVALIDAS = new Error('Credenciales inválidas');
const LAST_SUPERVISOR_ERROR = new Error('LAST_SUPERVISOR');

const PERMISO_ADMINISTRAR = 'usuario.administrar';

/** ¿El rol (activo) tiene `usuario.administrar`? (ADR-146: la regla mira el permiso, no el nombre). */
function rolAdministraUsuarios(db: Db, rolId: string): boolean {
  return !!db
    .select({ id: schema.rol_permiso.id })
    .from(schema.rol_permiso)
    .innerJoin(schema.rol, eq(schema.rol.id, schema.rol_permiso.rol_id))
    .innerJoin(schema.permiso, eq(schema.permiso.id, schema.rol_permiso.permiso_id))
    .where(and(
      eq(schema.rol_permiso.rol_id, rolId),
      eq(schema.rol.activo, true),
      eq(schema.permiso.codigo, PERMISO_ADMINISTRAR),
    ))
    .get();
}

/** ¿Queda otro usuario activo, distinto de `excluirId`, que administre usuarios? */
function hayOtroAdministrador(db: Db, excluirId: string): boolean {
  const otros = db
    .select({ id: schema.usuario.id, rol_id: schema.usuario.rol_id })
    .from(schema.usuario)
    .where(and(eq(schema.usuario.activo, true), ne(schema.usuario.id, excluirId)))
    .all();
  return otros.some(u => rolAdministraUsuarios(db, u.rol_id));
}

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

type Usuario = typeof schema.usuario.$inferSelect;

/**
 * Verifica nombre de usuario y contraseña con el límite de intentos (3 fallos bloquean 15 minutos;
 * los usuarios inexistentes también acumulan, para no revelar si el nombre existe). No abre sesión.
 * Lo usan el login y los dos pasos previos a la sesión (cambio de clave vencida y carga del mail).
 */
function verificarCredenciales(db: Db, nombreUsuario: string, password: string): Usuario {
  limiteIntentos.verificar(nombreUsuario);

  const user = db
    .select()
    .from(schema.usuario)
    .where(
      and(
        eq(schema.usuario.nombre_usuario, nombreUsuario),
        eq(schema.usuario.activo, true)
      )
    )
    .get();

  if (!user) {
    limiteIntentos.registrarFallo(nombreUsuario);
    throw CREDENCIALES_INVALIDAS;
  }

  if (!verifyPassword(password, user.hash_password)) {
    limiteIntentos.registrarFallo(nombreUsuario);
    throw CREDENCIALES_INVALIDAS;
  }
  limiteIntentos.registrarExito(nombreUsuario);
  return user;
}

const tieneEmail = (user: Usuario): boolean => normalizarEmail(user.email) !== '';

/**
 * ADR-136: sin sesión no hay forma de saltearse el bloqueo. Con la clave vencida o sin mail el login
 * verifica las credenciales pero NO crea la sesión: el renderer muestra el paso que corresponde y
 * vuelve a enviar las credenciales a `auth:cambiarPasswordVencida` o `auth:completarEmail`.
 */
function exigirCuentaAlDia(user: Usuario): void {
  if (passwordVencida(user.password_changed_at)) throw new Error('PASSWORD_VENCIDA');
  if (!tieneEmail(user)) throw new Error('EMAIL_REQUERIDO');
}

function abrirSesion(db: Db, user: Usuario): SessionData {
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
    passwordDiasRestantes: diasRestantesPassword(user.password_changed_at),
  };

  setSession(currentSession, sessionData);
  return sessionData;
}

export function loginHandler(db: Db, payload: LoginPayload): SessionData {
  const user = verificarCredenciales(db, payload.nombreUsuario, payload.password);
  exigirCuentaAlDia(user);
  return abrirSesion(db, user);
}

/**
 * Paso previo a la sesión cuando la contraseña venció (ADR-136). Solo sirve si de verdad venció:
 * no es una forma de cambiar contraseñas sin sesión.
 */
export function cambiarPasswordVencidaHandler(db: Db, payload: {
  nombreUsuario: string; passwordActual: string; passwordNueva: string;
}): SessionData {
  const user = verificarCredenciales(db, payload.nombreUsuario, payload.passwordActual);
  if (!passwordVencida(user.password_changed_at)) throw new Error('PASSWORD_NO_VENCIDA');
  if (payload.passwordNueva === payload.passwordActual) throw new Error('PASSWORD_IGUAL_A_LA_ACTUAL');
  validarPoliticaPassword(payload.passwordNueva, user.nombre_usuario);
  const now = new Date();
  db.update(schema.usuario).set({
    hash_password: hashPassword(payload.passwordNueva),
    password_changed_at: now,
    version: user.version + 1, updated_at: now,
    usuario_modificacion_id: user.id, fecha_actualizacion: now,
  }).where(eq(schema.usuario.id, user.id)).run();
  const actualizado = db.select().from(schema.usuario).where(eq(schema.usuario.id, user.id)).get()!;
  // La clave ya quedó cambiada; si además falta el mail, el renderer sigue con `auth:completarEmail`.
  if (!tieneEmail(actualizado)) throw new Error('EMAIL_REQUERIDO');
  return abrirSesion(db, actualizado);
}

/** Paso previo a la sesión para usuarios sin mail (ADR-136). Solo sirve si el mail está vacío. */
export function completarEmailHandler(db: Db, payload: {
  nombreUsuario: string; password: string; email: string;
}): SessionData {
  const user = verificarCredenciales(db, payload.nombreUsuario, payload.password);
  if (passwordVencida(user.password_changed_at)) throw new Error('PASSWORD_VENCIDA');
  if (tieneEmail(user)) throw new Error('EMAIL_YA_CARGADO');
  const email = normalizarEmail(payload.email);
  if (!emailValido(email)) throw new Error('EMAIL_INVALIDO');
  const now = new Date();
  db.update(schema.usuario).set({
    email,
    version: user.version + 1, updated_at: now,
    usuario_modificacion_id: user.id, fecha_actualizacion: now,
  }).where(eq(schema.usuario.id, user.id)).run();
  return abrirSesion(db, db.select().from(schema.usuario).where(eq(schema.usuario.id, user.id)).get()!);
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
  limiteIntentos.verificar(user.nombre_usuario);
  const ok = verifyPassword(payload.password, user.hash_password);
  if (ok) limiteIntentos.registrarExito(user.nombre_usuario);
  else limiteIntentos.registrarFallo(user.nombre_usuario);
  return ok;
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

  if (user.activo && rolAdministraUsuarios(db, user.rol_id) && !hayOtroAdministrador(db, user.id)) {
    throw LAST_SUPERVISOR_ERROR;
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
  // Revisión 2026-10-20 (P1): política de contraseña (8+, mayúscula, número, carácter especial).
  validarPoliticaPassword(payload.password, payload.nombre_usuario);
  // ADR-136: el mail es obligatorio (recuperación de contraseña) y se guarda normalizado.
  const email = normalizarEmail(payload.email);
  if (!email) throw new Error('EMAIL_REQUERIDO');
  if (!emailValido(email)) throw new Error('EMAIL_INVALIDO');
  const existing = db.select({ id: schema.usuario.id }).from(schema.usuario)
    .where(eq(schema.usuario.nombre_usuario, payload.nombre_usuario)).get();
  if (existing) throw new Error('USUARIO_DUPLICADO');
  const now = new Date();
  const id = generateId();
  db.insert(schema.usuario).values({
    id, nombre_usuario: payload.nombre_usuario, nombre_completo: payload.nombre_completo,
    email, hash_password: hashPassword(payload.password), password_changed_at: now,
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
  if (payload.email !== undefined) {
    // ADR-136: el mail es obligatorio, no se puede vaciar.
    const email = normalizarEmail(payload.email);
    if (!email) throw new Error('EMAIL_REQUERIDO');
    if (!emailValido(email)) throw new Error('EMAIL_INVALIDO');
    updates.email = email;
  }
  if (payload.rol_id !== undefined && canAdmin) {
    // ADR-146: cambiar el rol del último administrador a uno sin usuario.administrar dejaría el
    // sistema sin nadie que pueda gestionar usuarios.
    if (payload.rol_id !== user.rol_id && user.activo && rolAdministraUsuarios(db, user.rol_id)
        && !rolAdministraUsuarios(db, payload.rol_id) && !hayOtroAdministrador(db, user.id)) {
      throw LAST_SUPERVISOR_ERROR;
    }
    updates.rol_id = payload.rol_id;
  }
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
    limiteIntentos.verificar(user.nombre_usuario);
    if (!verifyPassword(payload.current_password, user.hash_password)) {
      limiteIntentos.registrarFallo(user.nombre_usuario);
      throw new Error('PASSWORD_INCORRECTA');
    }
    limiteIntentos.registrarExito(user.nombre_usuario);
  }
  // Revisión 2026-10-20 (P1): política de contraseña también al cambiarla.
  validarPoliticaPassword(payload.new_password, user.nombre_usuario);
  const now = new Date();
  db.update(schema.usuario).set({
    hash_password: hashPassword(payload.new_password),
    // ADR-136: el propio usuario reinicia el plazo; si un Supervisor restablece la clave de otro,
    // queda vencida (NULL) y esa persona debe cambiarla al ingresar.
    password_changed_at: isSelf ? now : null,
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

export function registerAuthHandlers(ipcMain: IpcMain, db: Db, enviadorCorreo: EnviadorCorreo | null = null): void {
  ipcMain.handle('auth:login', async (_event, payload: LoginPayload) =>
    loginHandler(db, payload)
  );
  ipcMain.handle('auth:cambiarPasswordVencida', async (_e, p) => cambiarPasswordVencidaHandler(db, p));
  ipcMain.handle('auth:completarEmail', async (_e, p) => completarEmailHandler(db, p));
  // ADR-137: recuperación de contraseña por mail (pre-sesión; sin enviador no está disponible).
  ipcMain.handle('auth:recuperacionDisponible', async () => recuperacionDisponibleHandler(enviadorCorreo));
  ipcMain.handle('auth:recuperarSolicitar', async (_e, p) => recuperarSolicitarHandler(db, p, enviadorCorreo));
  ipcMain.handle('auth:recuperarConfirmar', async (_e, p) => recuperarConfirmarHandler(db, p));
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
