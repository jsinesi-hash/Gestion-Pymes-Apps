// Caja compartida (F3 PR4, ADR-155 §3 y §4), lado de la caja. En modo `compartida` hay un único turno
// abierto en el negocio: abrirlo y cerrarlo pasa por el hub (que guarda cuál está abierto), y vender,
// retirar o aportar sigue funcionando sin conexión contra el turno que la caja ya conoce.
import type * as BetterSqlite3 from 'better-sqlite3';
import { RUTAS } from '@core/hub';
import { getModoTerminal } from '../context';
import { leerParametro, type DbConfig } from '../configuracion';
import { cuerpo, esErrorDeConexion } from './cliente';
import type { TransporteHub } from './transporte';

export type ModoCaja = 'por_terminal' | 'compartida';

/** Modo de caja vigente. En standalone siempre es por terminal (ADR-155 §6). */
export function modoCaja(db: DbConfig): ModoCaja {
  if (getModoTerminal() !== 'distribuido') return 'por_terminal';
  return leerParametro(db, 'caja_modo') === 'compartida' ? 'compartida' : 'por_terminal';
}

export interface TurnoDelHub { readonly caja_id: string; readonly origin_id: string; readonly abierta_en_ms: number }

export interface CajaCompartidaTerminal {
  /** Reserva en el hub el turno `cajaId` antes de escribirlo. Lanza si hay otro abierto o sin conexión. */
  reservar(cajaId: string): Promise<void>;
  /** Libera el turno en el hub después de cerrarlo acá. */
  liberar(cajaId: string): Promise<void>;
  /** El turno abierto según el hub (null = ninguno). Lanza sin conexión. */
  actual(): Promise<TurnoDelHub | null>;
}

export function crearCajaCompartidaTerminal(sqlite: BetterSqlite3.Database, transporte: TransporteHub): CajaCompartidaTerminal {
  async function pedir(metodo: 'GET' | 'POST', ruta: string, datos?: unknown): Promise<Record<string, unknown>> {
    try {
      return cuerpo(await transporte.pedir(metodo, ruta, datos));
    } catch (e) {
      // Abrir y cerrar un turno compartido exigen conexión con el hub (ADR-155 §4).
      if (esErrorDeConexion(e)) throw new Error('CAJA_COMPARTIDA_SIN_CONEXION');
      throw e;
    }
  }

  const cerradaAca = (cajaId: string) =>
    (sqlite.prepare('SELECT "estado" FROM "caja" WHERE "id" = ?').get(cajaId) as { estado: string } | undefined)?.estado === 'cerrada';

  async function intentar(cajaId: string): Promise<{ abierta: boolean; caja_id: string }> {
    const r = await pedir('POST', RUTAS.cajaAbrir, { caja_id: cajaId });
    return { abierta: r['abierta'] === true, caja_id: String(r['caja_id'] ?? '') };
  }

  return {
    async reservar(cajaId) {
      let r = await intentar(cajaId);
      // El hub todavía tiene un turno que esta caja ya ve cerrado (se cortó la conexión después del cierre):
      // se libera y se vuelve a intentar.
      if (!r.abierta && r.caja_id && cerradaAca(r.caja_id)) {
        await pedir('POST', RUTAS.cajaCerrar, { caja_id: r.caja_id });
        r = await intentar(cajaId);
      }
      if (!r.abierta) throw new Error('CAJA_COMPARTIDA_YA_ABIERTA');
    },
    async liberar(cajaId) {
      const r = await pedir('POST', RUTAS.cajaCerrar, { caja_id: cajaId });
      if (r['cerrada'] !== true) throw new Error('CAJA_COMPARTIDA_OTRO_TURNO');
    },
    async actual() {
      const r = await pedir('GET', RUTAS.caja);
      return (r['caja'] as TurnoDelHub | null) ?? null;
    },
  };
}
