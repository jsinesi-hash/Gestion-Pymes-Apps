import { and, eq, lte } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { recalcularMasivoHandler, type RecalcularMasivoParams } from '../ipc/lista-precio-valor';

type Db = BetterSQLite3Database<typeof schema>;

/**
 * ADR-034: aplica todos los cambios programados con fecha_aplicacion <= now.
 * Usa compare-and-swap para tolerar race conditions (cancelación concurrente).
 * Llamar al arrancar la app y cada 1 hora vía setInterval.
 */
export function applyPendingCambiosProgramados(db: Db): void {
  const now = new Date();

  const pendientes = db.select().from(schema.cambio_programado)
    .where(and(
      eq(schema.cambio_programado.estado, 'pendiente'),
      lte(schema.cambio_programado.fecha_aplicacion, now),
    ))
    .all();

  for (const cambio of pendientes) {
    // Datos incompletos (p. ej. base_calculo='lista' sin base_lista_id, bug pre-ADR-049 de
    // RecalcularModal): no reintentar por siempre — cancelar con motivo en vez de crash-loop.
    if (cambio.base_calculo === 'lista' && !cambio.base_lista_id) {
      db.update(schema.cambio_programado)
        .set({ estado: 'cancelado', updated_at: now })
        .where(and(
          eq(schema.cambio_programado.id, cambio.id),
          eq(schema.cambio_programado.estado, 'pendiente'),
        ))
        .run();
      console.error(`[scheduler/precios] Cambio ${cambio.id} cancelado: base_calculo=lista sin base_lista_id.`);
      continue;
    }

    try {
      db.transaction((tx) => {
        // Compare-and-swap: solo procede si sigue en 'pendiente'
        const updateResult = tx.update(schema.cambio_programado)
          .set({ estado: 'aplicado', updated_at: now })
          .where(and(
            eq(schema.cambio_programado.id, cambio.id),
            eq(schema.cambio_programado.estado, 'pendiente'),
          ))
          .run();

        if (updateResult.changes === 0) return; // cancelado en carrera

        const params: RecalcularMasivoParams = {
          lista_precio_id:       cambio.lista_precio_id,
          porcentaje:            cambio.porcentaje,
          base_calculo:          cambio.base_calculo as RecalcularMasivoParams['base_calculo'],
          base_lista_id:         cambio.base_lista_id ?? undefined,
          alcance:               cambio.alcance as RecalcularMasivoParams['alcance'],
          alcance_id:            cambio.alcance_id ?? undefined,
          excluir_manuales_dias: cambio.excluir_manuales_dias ?? undefined,
        };

        // Pasamos usuario_creacion_id como callerUserId ya que el scheduler no tiene sesión activa
        const { recalculo_masivo_id } = recalcularMasivoHandler(
          tx as Db,
          params,
          cambio.usuario_creacion_id,
        );

        // Vincular el cambio con el recalculo_masivo generado
        tx.update(schema.cambio_programado)
          .set({ recalculo_masivo_id, updated_at: now })
          .where(eq(schema.cambio_programado.id, cambio.id))
          .run();
      });
    } catch (err) {
      console.error(`[scheduler/precios] Error aplicando cambio ${cambio.id}:`, err);
    }
  }
}
