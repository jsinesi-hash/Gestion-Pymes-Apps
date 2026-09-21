import { eq, and, or, lte, isNull, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { despacharAviso } from './aviso-servicio';

type Db = BetterSQLite3Database<typeof schema>;

function leerNum(db: Db, clave: string, def: number): number {
  const v = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get()?.valor;
  const n = v ? Number.parseInt(v, 10) : def;
  return Number.isFinite(n) ? n : def;
}

/**
 * ADR-047 §4: drena avisos pendiente/fallido cuyo proximo_intento_at ya vencio. Reintenta
 * via despacharAviso (incrementa intentos), y al fallar aplica backoff exponencial
 * (base * 2^intentos). Al superar aviso_reintentos_max -> descartado + log. Corre mientras
 * la app esta abierta (setInterval) y al abrir.
 */
export async function drenarReintentos(db: Db, now: Date): Promise<{ intentados: number; descartados: number }> {
  const maxIntentos = leerNum(db, 'aviso_reintentos_max', 5);
  const backoffBase = leerNum(db, 'aviso_backoff_base_seg', 30);

  const pendientes = db.select().from(schema.aviso)
    .where(and(
      inArray(schema.aviso.estado, ['pendiente', 'fallido']),
      or(lte(schema.aviso.proximo_intento_at, now), isNull(schema.aviso.proximo_intento_at)),
    )).all();

  let intentados = 0;
  let descartados = 0;

  for (const aviso of pendientes) {
    // Tope ya alcanzado antes de intentar: descartar sin reintentar.
    if (aviso.intentos >= maxIntentos) {
      db.update(schema.aviso).set({ estado: 'descartado' }).where(eq(schema.aviso.id, aviso.id)).run();
      descartados++;
      console.warn(`[agenda:worker] aviso ${aviso.id} descartado tras ${aviso.intentos} intentos`);
      continue;
    }

    await despacharAviso(db, aviso.id);   // incrementa intentos y setea estado
    intentados++;

    const post = db.select().from(schema.aviso).where(eq(schema.aviso.id, aviso.id)).get();
    if (post && post.estado === 'fallido') {
      if (post.intentos >= maxIntentos) {
        db.update(schema.aviso).set({ estado: 'descartado' }).where(eq(schema.aviso.id, aviso.id)).run();
        descartados++;
        console.warn(`[agenda:worker] aviso ${aviso.id} descartado tras ${post.intentos} intentos`);
      } else {
        const backoffMs = backoffBase * 1000 * Math.pow(2, post.intentos);
        db.update(schema.aviso).set({ proximo_intento_at: new Date(now.getTime() + backoffMs) })
          .where(eq(schema.aviso.id, aviso.id)).run();
      }
    }
  }

  return { intentados, descartados };
}
