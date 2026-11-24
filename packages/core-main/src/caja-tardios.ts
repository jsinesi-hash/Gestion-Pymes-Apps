// Movimientos que llegan después del cierre de un turno (F3 PR5, ADR-155 §5). En caja compartida, una caja
// que estaba sin conexión puede subir movimientos del turno después de que otra lo cerró. Se aceptan (son
// hechos) y quedan en ese turno, pero la diferencia del arqueo no se recalcula: el esperado guardado es la
// foto del cierre. Un turno los tiene si su esperado de hoy ya no coincide con esa foto (cubre un movimiento
// hecho sin conexión antes del cierre que llegó después) o si tiene movimientos con fecha posterior al cierre.
import { and, eq, gt, gte } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { cajaCalcularCierreHandler } from './ipc/caja';

type Db = BetterSQLite3Database<typeof schema>;

export interface CajaConTardios {
  readonly caja_id: string;
  readonly fecha_cierre: Date;
  /** Efectivo esperado guardado al cerrar (la foto del arqueo). */
  readonly esperado_cierre_centavos: number;
  /** Efectivo esperado con todo lo que llegó hasta ahora. */
  readonly esperado_actual_centavos: number;
  /** Movimientos con fecha posterior al cierre. */
  readonly posteriores: number;
}

/** Días hacia atrás que se revisan: un movimiento tardío llega cuando la caja que estaba sin conexión vuelve. */
export const DIAS_REVISION_TARDIOS = 7;

/** ¿El turno cerrado tiene movimientos que llegaron después de su cierre? null si no. */
export function movimientosTardiosDe(db: Db, caja: typeof schema.caja.$inferSelect): CajaConTardios | null {
  if (caja.estado !== 'cerrada' || !caja.fecha_cierre || caja.monto_esperado_centavos == null) return null;
  const actual = cajaCalcularCierreHandler(db, { caja_id: caja.id }).esperado_efectivo_centavos;
  const posteriores = db.select({ id: schema.movimiento_caja.id }).from(schema.movimiento_caja)
    .where(and(eq(schema.movimiento_caja.caja_id, caja.id), gt(schema.movimiento_caja.fecha, caja.fecha_cierre)))
    .all().length;
  if (actual === caja.monto_esperado_centavos && posteriores === 0) return null;
  return {
    caja_id: caja.id,
    fecha_cierre: caja.fecha_cierre,
    esperado_cierre_centavos: caja.monto_esperado_centavos,
    esperado_actual_centavos: actual,
    posteriores,
  };
}

/** Turnos cerrados en los últimos días con movimientos que llegaron después del cierre. */
export function cajasConMovimientosTardios(db: Db, ahora: Date = new Date(), dias = DIAS_REVISION_TARDIOS): CajaConTardios[] {
  const desde = new Date(ahora.getTime() - dias * 86_400_000);
  return db.select().from(schema.caja)
    .where(and(eq(schema.caja.estado, 'cerrada'), gte(schema.caja.fecha_cierre, desde)))
    .all()
    .map((c) => movimientosTardiosDe(db, c))
    .filter((x): x is CajaConTardios => x !== null);
}
