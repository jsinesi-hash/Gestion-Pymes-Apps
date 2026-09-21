import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { normalizarTermino } from './normalizar';
import { SINONIMO_GRUPOS } from './dataset';

type Db = BetterSQLite3Database<typeof schema>;

// Datos de arranque (igual convención que runCatalogSeed).
const SYNC = { version: 1, origin_id: 'system', sync_state: 'synced' as const };
const AUDIT = { usuario_creacion_id: 'system' };

// ADR-067 — Siembra el dataset base de sinónimos (origen='seed'). Idempotente: si ya hay
// filas de seed, no hace nada. Se invoca desde runBaseSeed (first-run). Los términos de
// cada grupo comparten `grupo_id`; el canónico lleva `es_canonico=true`.
export function runSinonimoSeed(db: Db): void {
  const yaSembrado = db.select({ id: schema.sinonimo.id })
    .from(schema.sinonimo)
    .where(eq(schema.sinonimo.origen, 'seed'))
    .get();
  if (yaSembrado) return;

  const now = new Date();
  db.transaction((tx) => {
    for (const grupo of SINONIMO_GRUPOS) {
      const grupoId = randomUUID();
      const terminos: { termino: string; es_canonico: boolean; es_abreviatura: boolean }[] = [
        { termino: grupo.canonico, es_canonico: true, es_abreviatura: false },
        ...grupo.sinonimos.map(s => ({ termino: s, es_canonico: false, es_abreviatura: false })),
        ...(grupo.abreviaturas ?? []).map(a => ({ termino: a, es_canonico: false, es_abreviatura: true })),
      ];
      // Dedup por término normalizado dentro del grupo (por si canónico ≡ un sinónimo).
      const vistos = new Set<string>();
      for (const t of terminos) {
        const norm = normalizarTermino(t.termino);
        if (!norm || vistos.has(norm)) continue;
        vistos.add(norm);
        tx.insert(schema.sinonimo).values({
          id: randomUUID(),
          grupo_id: grupoId,
          termino: t.termino,
          termino_norm: norm,
          es_canonico: t.es_canonico,
          es_abreviatura: t.es_abreviatura,
          rubro: grupo.rubro ?? null,
          nota: grupo.nota ?? null,
          origen: 'seed',
          activo: true,
          ...AUDIT,
          fecha_creacion: now,
          ...SYNC,
          updated_at: now,
        }).onConflictDoNothing().run();
      }
    }
  });

  console.log(`[seed:sinonimos] ${SINONIMO_GRUPOS.length} grupos de sinónimos sembrados (ADR-067)`);
}
