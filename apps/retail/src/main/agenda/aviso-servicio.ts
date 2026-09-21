import { eq, and, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getAdapter } from './canales/registry';
import type { Canal } from './canales/tipos';

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// ADR-047 §7: contrato de aviso.emitir(comando). Los modulos de dominio lo llaman sin
// conocer canales.
export interface ComandoAviso {
  origen_tipo: string;
  origen_id?: string | null;
  agenda_evento_id?: string | null;
  titulo: string;
  cuerpo: string;
  datos?: unknown;
  destinatario: { tipo: 'usuario' | 'rol'; id?: string | undefined; rol?: string | undefined };
  canales?: Canal[];              // default ['in_app']
  dedupe_clave?: string | null;   // idempotencia (ADR-003)
  severidad?: 'normal' | 'alerta';   // ADR-048: default 'normal'
}

// Mapa origen_tipo -> flag notif_*_email de parametros_sistema. Si el origen no esta
// mapeado, el canal email se respeta tal cual venga en el comando.
const FLAG_EMAIL_POR_ORIGEN: Record<string, string> = {
  cierre_caja: 'notif_cierre_caja_email',
  recepcion: 'notif_recepcion_email',
  bajo_minimo: 'notif_bajo_minimo_email',
};

function leerFlag(db: Db | Tx, clave: string): boolean {
  const row = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  return row?.valor === 'true';
}

/** Expande rol->usuarios activos; usuario->[ese usuario]. Congela el contacto (email). */
function resolverDestinatarios(
  db: Db | Tx,
  dest: ComandoAviso['destinatario'],
): Array<{ id: string; email: string | null }> {
  if (dest.tipo === 'usuario') {
    if (!dest.id) return [];
    const u = db.select().from(schema.usuario).where(eq(schema.usuario.id, dest.id)).get();
    return u ? [{ id: u.id, email: u.email ?? null }] : [];
  }
  // Match del nombre de rol case-insensitive: el seed crea 'SUPERVISOR'/'OPERADOR' en
  // mayusculas, pero los destinatarios (parametros, ADR-048) pueden venir en minusculas.
  const rolBuscado = (dest.rol ?? '').toLowerCase();
  const rol = db.select().from(schema.rol)
    .where(sql`lower(${schema.rol.nombre}) = ${rolBuscado}`).get();
  if (!rol) return [];
  return db.select().from(schema.usuario)
    .where(and(eq(schema.usuario.rol_id, rol.id), eq(schema.usuario.activo, true)))
    .all().map((u) => ({ id: u.id, email: u.email ?? null }));
}

/**
 * ADR-047 §6 (regla clave): inserta las filas `aviso` DENTRO de la transaccion del hecho
 * de negocio. Resuelve destinatarios, congela contacto, respeta flags notif_*, deduplica
 * y snapshotea el payload. Devuelve los ids insertados. NO envia (eso es fuera de tx).
 */
export function insertarAvisos(tx: Tx, cmd: ComandoAviso, now: Date): string[] {
  const canales: Canal[] = cmd.canales && cmd.canales.length > 0 ? cmd.canales : ['in_app'];
  const destinatarios = resolverDestinatarios(tx, cmd.destinatario);
  const payload = JSON.stringify({ titulo: cmd.titulo, cuerpo: cmd.cuerpo, datos: cmd.datos ?? null });
  const ids: string[] = [];

  for (const dest of destinatarios) {
    for (const canal of canales) {
      if (canal === 'email') {
        const flag = FLAG_EMAIL_POR_ORIGEN[cmd.origen_tipo];
        if (flag && !leerFlag(tx, flag)) continue;   // flag apagado -> no se genera el aviso email
      }
      // dedupe_clave compuesta con canal+usuario para no colisionar en el UNIQUE global.
      const dedupe = cmd.dedupe_clave ? `${cmd.dedupe_clave}:${canal}:${dest.id}` : null;
      if (dedupe) {
        const dup = tx.select().from(schema.aviso)
          .where(eq(schema.aviso.dedupe_clave, dedupe)).get();
        if (dup) continue;   // idempotencia: ya emitido
      }
      const id = generateId();
      tx.insert(schema.aviso).values({
        id,
        agenda_evento_id: cmd.agenda_evento_id ?? null,
        origen_tipo: cmd.origen_tipo,
        origen_id: cmd.origen_id ?? null,
        canal,
        destinatario_usuario_id: dest.id,
        destinatario_contacto: canal === 'email' ? dest.email : null,
        payload,
        severidad: cmd.severidad ?? 'normal',
        estado: 'pendiente',
        intentos: 0,
        proximo_intento_at: now,
        dedupe_clave: dedupe,
        generado_at: now,
      }).run();
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Envio best-effort de UN aviso, FUERA de transaccion. Llama al adapter, actualiza estado
 * e incrementa intentos. NUNCA lanza (captura todo): no debe bloquear al productor.
 */
export async function despacharAviso(db: Db, avisoId: string): Promise<void> {
  const aviso = db.select().from(schema.aviso).where(eq(schema.aviso.id, avisoId)).get();
  if (!aviso || (aviso.estado !== 'pendiente' && aviso.estado !== 'fallido')) return;
  const intentos = aviso.intentos + 1;
  const adapter = getAdapter(aviso.canal);
  if (!adapter) {
    db.update(schema.aviso).set({ estado: 'fallido', intentos, ultimo_error: 'CANAL_DESCONOCIDO' })
      .where(eq(schema.aviso.id, avisoId)).run();
    return;
  }
  try {
    const res = await adapter.enviar({
      id: aviso.id,
      canal: aviso.canal,
      destinatario_usuario_id: aviso.destinatario_usuario_id,
      destinatario_contacto: aviso.destinatario_contacto,
      payload: JSON.parse(aviso.payload),
    });
    if (res.ok) {
      db.update(schema.aviso)
        .set({ estado: 'enviado', enviado_at: new Date(), intentos, ultimo_error: null })
        .where(eq(schema.aviso.id, avisoId)).run();
    } else {
      db.update(schema.aviso)
        .set({ estado: 'fallido', intentos, ultimo_error: res.error ?? 'ERROR' })
        .where(eq(schema.aviso.id, avisoId)).run();
    }
  } catch (e) {
    db.update(schema.aviso)
      .set({ estado: 'fallido', intentos, ultimo_error: (e as Error).message })
      .where(eq(schema.aviso.id, avisoId)).run();
  }
}

/**
 * Orquestador para productores de dominio. Inserta en su propia transaccion y dispara
 * el envio FUERA de ella, best-effort. En un productor real se llama sin await bloqueante
 * (el envio no debe frenar el hecho de negocio); aca await-eamos el despacho para poder
 * observar el resultado en tests. despacharAviso nunca lanza.
 */
export async function emitirAviso(db: Db, cmd: ComandoAviso): Promise<string[]> {
  const now = new Date();
  const ids = db.transaction((tx) => insertarAvisos(tx, cmd, now));
  for (const id of ids) { await despacharAviso(db, id); }
  return ids;
}
