import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { getOriginId } from './context';

/**
 * Configuración del negocio vs. de la terminal (ADR-155 §1, F1 PR7). Las claves del negocio viven
 * en `configuracion_negocio` (sincroniza: son las mismas en todas las terminales); las de cada
 * terminal, en `parametros_sistema` (correlativos, bloque de SKU, backups, SMTP, estado del seed).
 * Todo acceso pasa por acá: quien lee no tiene que saber en qué tabla está cada clave.
 */
type DbConfig = Pick<BetterSQLite3Database<typeof schema>, 'select' | 'insert' | 'update'>;

/** Claves del negocio que lee el núcleo. Cada app declara las suyas (baranda de PR7). */
export const CLAVES_NEGOCIO_CORE = [
  'caja_modo',
  'umbral_diferencia_caja',
  'pos.ventas_en_espera.max',
  'pos.ventas_en_espera.ttl_horas',
  'bloqueo_inactividad_habilitado',
  'bloqueo_inactividad_minutos',
] as const;

/** Valor de una clave: primero la configuración del negocio, después la de la terminal. */
export function leerParametro(db: DbConfig, clave: string): string | null {
  const negocio = db.select({ valor: schema.configuracion_negocio.valor }).from(schema.configuracion_negocio)
    .where(eq(schema.configuracion_negocio.id, clave)).get();
  if (negocio) return negocio.valor;
  const local = db.select({ valor: schema.parametros_sistema.valor }).from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  return local?.valor ?? null;
}

/** Lee una clave numérica; si falta o no es un número, devuelve `def`. */
export function leerParametroNumero(db: DbConfig, clave: string, def: number): number {
  const v = leerParametro(db, clave);
  const n = v == null ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Lee un flag: true solo si la clave existe y vale `'true'`. */
export function leerFlag(db: DbConfig, clave: string): boolean {
  return leerParametro(db, clave) === 'true';
}

/**
 * Escribe una clave en la tabla donde vive. En el negocio sube `version`, marca `pending` y deja
 * quién la cambió (viaja a las demás terminales). Una clave que no existe en ninguna se crea en la
 * terminal: así nacen los correlativos; una clave nueva del negocio se siembra por migración.
 */
export function escribirParametro(db: DbConfig, clave: string, valor: string, usuarioId?: string): void {
  const now = new Date();
  const negocio = db.select().from(schema.configuracion_negocio)
    .where(eq(schema.configuracion_negocio.id, clave)).get();
  if (negocio) {
    db.update(schema.configuracion_negocio).set({
      valor, version: negocio.version + 1, sync_state: 'pending', updated_at: now,
      usuario_modificacion_id: usuarioId ?? negocio.usuario_modificacion_id, fecha_actualizacion: now,
    }).where(eq(schema.configuracion_negocio.id, clave)).run();
    return;
  }
  const local = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  if (local) {
    db.update(schema.parametros_sistema)
      .set({ valor, actualizado_en: now, ...(usuarioId ? { actualizado_por: usuarioId } : {}) })
      .where(eq(schema.parametros_sistema.clave, clave)).run();
    return;
  }
  db.insert(schema.parametros_sistema).values({ clave, valor, tipo: 'number', actualizado_en: now }).run();
}

/** Todas las claves de las dos tablas con su tipo y descripción (pantalla de Funcionalidades). */
export function listarParametros(db: DbConfig): { clave: string; valor: string; tipo: string; descripcion: string | null; ambito: 'negocio' | 'terminal' }[] {
  const negocio = db.select().from(schema.configuracion_negocio).all()
    .map((r) => ({ clave: r.id, valor: r.valor, tipo: r.tipo, descripcion: r.descripcion ?? null, ambito: 'negocio' as const }));
  const local = db.select().from(schema.parametros_sistema).all()
    .map((r) => ({ clave: r.clave, valor: r.valor, tipo: r.tipo, descripcion: r.descripcion ?? null, ambito: 'terminal' as const }));
  return [...negocio, ...local];
}

/** Valores de sync para sembrar una fila de configuración del negocio desde código (tests, seeds). */
export function syncConfiguracion(now = new Date()) {
  return { version: 1, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
}
