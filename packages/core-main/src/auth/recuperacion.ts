import crypto from 'node:crypto';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { emailValido, generateId, normalizarEmail, validarPoliticaPassword } from '@ferreteria/shared';
import * as schema from '@core/db';
import { hashPassword, verifyPassword } from './hash';
import { crearLimiteIntentos, limiteIntentos } from './intentos';

// Recuperación de contraseña por mail (ADR-137). Código de 6 dígitos enviado al correo del usuario:
// vence a los 15 minutos, sirve una sola vez y tiene tope de intentos; en la base solo queda su hash.
// El pedido responde SIEMPRE lo mismo (no revela qué usuarios existen ni cuáles tienen mail) y el
// confirmar devuelve un único error genérico, con el mismo costo de cómputo para usuarios inexistentes.

type Db = BetterSQLite3Database<typeof schema>;

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
}

/**
 * Lo implementa cada app (Retail con su SMTP). El núcleo no sabe cómo sale el correo: sin enviador
 * la recuperación no está disponible y la pantalla de login no ofrece el enlace.
 */
export interface EnviadorCorreo {
  /** ¿Está configurado (servidor, remitente y credencial) como para poder enviar? */
  disponible(): boolean;
  enviar(mensaje: MensajeCorreo): Promise<void>;
}

export const CODIGO_VIGENCIA_MS = 15 * 60 * 1000;
export const MAX_INTENTOS_CODIGO = 5;
const PURGA_MS = 24 * 60 * 60 * 1000;

/** Tope de pedidos de código por usuario: 3 cada 15 minutos (cada pedido cuenta, exista o no el usuario). */
export const limiteSolicitudesRecuperacion = crearLimiteIntentos({ maxFallos: 3, bloqueoMs: CODIGO_VIGENCIA_MS });

const RESPUESTA_SOLICITUD = { ok: true as const };
const CODIGO_INVALIDO = () => new Error('CODIGO_INVALIDO');

// Hash de relleno para igualar el costo de cómputo cuando no hay código que verificar.
let hashRelleno: string | null = null;
function gastarComoVerificar(codigo: string): void {
  hashRelleno ??= hashPassword('relleno-sin-codigo');
  verifyPassword(codigo, hashRelleno);
}

export function recuperacionDisponibleHandler(enviador: EnviadorCorreo | null): boolean {
  return enviador !== null && enviador.disponible();
}

export async function recuperarSolicitarHandler(
  db: Db,
  payload: { identificador: string },
  enviador: EnviadorCorreo | null,
  ahora: () => Date = () => new Date(),
): Promise<{ ok: true }> {
  const nombre = String(payload?.identificador ?? '').trim();
  if (!nombre || enviador === null || !enviador.disponible()) return RESPUESTA_SOLICITUD;

  // Pasado el tope no se envía más, con la misma respuesta de siempre.
  try { limiteSolicitudesRecuperacion.verificar(nombre); } catch { return RESPUESTA_SOLICITUD; }
  limiteSolicitudesRecuperacion.registrarFallo(nombre);

  const user = db.select().from(schema.usuario)
    .where(and(eq(schema.usuario.nombre_usuario, nombre), eq(schema.usuario.activo, true))).get();
  const email = normalizarEmail(user?.email);
  if (!user || !emailValido(email)) return RESPUESTA_SOLICITUD;

  const now = ahora();
  // Un código nuevo invalida los anteriores; de paso se purgan los viejos.
  db.update(schema.recuperacion_password).set({ usado: true })
    .where(and(eq(schema.recuperacion_password.usuario_id, user.id), eq(schema.recuperacion_password.usado, false))).run();
  db.delete(schema.recuperacion_password)
    .where(lt(schema.recuperacion_password.expira_en, new Date(now.getTime() - PURGA_MS))).run();

  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const id = generateId();
  db.insert(schema.recuperacion_password).values({
    id,
    usuario_id: user.id,
    codigo_hash: hashPassword(codigo),
    expira_en: new Date(now.getTime() + CODIGO_VIGENCIA_MS),
    intentos: 0,
    usado: false,
    creado_en: now,
  }).run();

  try {
    await enviador.enviar({
      para: email,
      asunto: 'Código para recuperar tu contraseña',
      texto: `Tu código para recuperar la contraseña es: ${codigo}\n\n`
        + 'Vence en 15 minutos y sirve una sola vez. '
        + 'Si no lo pediste, ignorá este mensaje: tu contraseña no cambió.',
    });
  } catch (e) {
    // El usuario recibe la misma respuesta (no se revela que existe); el código no queda usable.
    console.error('[recuperacion] no se pudo enviar el código:', (e as Error).message);
    db.update(schema.recuperacion_password).set({ usado: true })
      .where(eq(schema.recuperacion_password.id, id)).run();
  }
  return RESPUESTA_SOLICITUD;
}

/** Cambia la contraseña con el código. No abre sesión: después se inicia sesión con la clave nueva. */
export function recuperarConfirmarHandler(
  db: Db,
  payload: { identificador: string; codigo: string; passwordNueva: string },
  ahora: () => Date = () => new Date(),
): void {
  const nombre = String(payload?.identificador ?? '').trim();
  const codigo = String(payload?.codigo ?? '').trim();

  const user = db.select().from(schema.usuario)
    .where(and(eq(schema.usuario.nombre_usuario, nombre), eq(schema.usuario.activo, true))).get();
  const fila = user
    ? db.select().from(schema.recuperacion_password)
        .where(and(eq(schema.recuperacion_password.usuario_id, user.id), eq(schema.recuperacion_password.usado, false)))
        .orderBy(desc(schema.recuperacion_password.creado_en)).get()
    : undefined;
  const now = ahora();

  if (!user || !fila || fila.intentos >= MAX_INTENTOS_CODIGO || now.getTime() >= fila.expira_en.getTime()) {
    gastarComoVerificar(codigo);
    throw CODIGO_INVALIDO();
  }
  if (!verifyPassword(codigo, fila.codigo_hash)) {
    db.update(schema.recuperacion_password).set({ intentos: fila.intentos + 1 })
      .where(eq(schema.recuperacion_password.id, fila.id)).run();
    throw CODIGO_INVALIDO();
  }

  // La política se aplica DESPUÉS de comprobar el código y ANTES de consumirlo: una clave débil
  // se puede corregir con el mismo código.
  validarPoliticaPassword(payload.passwordNueva, user.nombre_usuario);

  db.transaction((tx) => {
    tx.update(schema.usuario).set({
      hash_password: hashPassword(payload.passwordNueva),
      password_changed_at: now,
      version: user.version + 1, updated_at: now,
      usuario_modificacion_id: user.id, fecha_actualizacion: now,
    }).where(eq(schema.usuario.id, user.id)).run();
    tx.update(schema.recuperacion_password).set({ usado: true })
      .where(eq(schema.recuperacion_password.id, fila.id)).run();
  });
  // Recuperar la clave también levanta el bloqueo por intentos fallidos de login.
  limiteIntentos.registrarExito(user.nombre_usuario);
}
