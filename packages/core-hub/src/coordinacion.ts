// Coordinación entre terminales (ADR-152 §2, ADR-154 §2; F2 PR5). El hub no corre lógica de dominio
// (ADR-149 §1): solo otorga el permiso de terminal coordinadora, con vencimiento, y reparte bloques de
// correlativos por serie. Qué hace la coordinadora y qué numera cada serie lo decide la app.
import type * as BetterSqlite3 from 'better-sqlite3';

export interface PermisoCoordinadora {
  /** ¿La terminal que pidió es la coordinadora? */
  readonly coordinadora: boolean;
  /** Terminal que tiene el permiso. */
  readonly origin_id: string;
  /** Cuánto le queda al permiso vigente, en ms (la terminal no compara relojes con el hub). */
  readonly vigencia_ms: number;
}

export interface BloqueAsignado { readonly serie: string; readonly desde: number; readonly hasta: number }
export interface BloqueHub extends BloqueAsignado { readonly origin_id: string; readonly asignado_en: number }

export interface CoordinacionHub {
  /** Otorga o renueva el permiso si está libre, vencido o ya es de esa terminal. */
  pedirCoordinadora(origen: string, ahoraMs?: number): PermisoCoordinadora;
  /** Libera el permiso si es de esa terminal (al desemparejar o revocar). */
  soltarCoordinadora(origen: string): void;
  /**
   * Siguiente bloque de la serie: empieza después del último repartido y nunca antes de `minimo` (el
   * próximo número que la terminal sabe libre, por lo que ya vio en su base).
   */
  asignarBloque(serie: string, origen: string, p: { minimo: number; tamano: number }, ahoraMs?: number): BloqueAsignado;
  bloques(): BloqueHub[];
}

export const VIGENCIA_COORDINADORA_MS = 120_000;
const SERIE_VALIDA = /^[a-z][a-z0-9_]{0,31}$/;
const TAMANO_MAXIMO = 100_000;

export function abrirCoordinacion(sqlite: BetterSqlite3.Database, o: { vigenciaMs?: number } = {}): CoordinacionHub {
  const vigencia = o.vigenciaMs ?? VIGENCIA_COORDINADORA_MS;
  const stActual = sqlite.prepare('SELECT origin_id, vence_en_ms FROM hub_coordinadora WHERE id = 1');
  const stOtorgar = sqlite.prepare(
    'INSERT INTO hub_coordinadora (id, origin_id, vence_en_ms) VALUES (1, ?, ?) ' +
    'ON CONFLICT (id) DO UPDATE SET origin_id = excluded.origin_id, vence_en_ms = excluded.vence_en_ms',
  );
  const stUltimo = sqlite.prepare('SELECT MAX(hasta) AS hasta FROM hub_bloque WHERE serie = ?');
  const stInsertar = sqlite.prepare('INSERT INTO hub_bloque (serie, desde, hasta, origin_id, asignado_en) VALUES (?, ?, ?, ?, ?)');

  const pedir = sqlite.transaction((origen: string, ahora: number): PermisoCoordinadora => {
    const actual = stActual.get() as { origin_id: string; vence_en_ms: number } | undefined;
    if (actual && actual.origin_id !== origen && actual.vence_en_ms > ahora) {
      return { coordinadora: false, origin_id: actual.origin_id, vigencia_ms: actual.vence_en_ms - ahora };
    }
    stOtorgar.run(origen, ahora + vigencia);
    return { coordinadora: true, origin_id: origen, vigencia_ms: vigencia };
  });

  const asignar = sqlite.transaction((serie: string, origen: string, minimo: number, tamano: number, ahora: number): BloqueAsignado => {
    const ultimo = (stUltimo.get(serie) as { hasta: number | null }).hasta ?? 0;
    const desde = Math.max(ultimo + 1, minimo);
    const hasta = desde + tamano - 1;
    stInsertar.run(serie, desde, hasta, origen, ahora);
    return { serie, desde, hasta };
  });

  return {
    pedirCoordinadora: (origen, ahoraMs = Date.now()) => pedir(origen, ahoraMs),
    soltarCoordinadora(origen) {
      sqlite.prepare('DELETE FROM hub_coordinadora WHERE id = 1 AND origin_id = ?').run(origen);
    },
    asignarBloque(serie, origen, p, ahoraMs = Date.now()) {
      const entero = (n: unknown, min: number, max: number) => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
      if (!SERIE_VALIDA.test(serie) || !entero(p.tamano, 1, TAMANO_MAXIMO) || !entero(p.minimo, 1, Number.MAX_SAFE_INTEGER - TAMANO_MAXIMO)) {
        throw new Error('BLOQUE_INVALIDO');
      }
      return asignar(serie, origen, p.minimo, p.tamano, ahoraMs);
    },
    bloques() {
      return sqlite.prepare('SELECT serie, desde, hasta, origin_id, asignado_en FROM hub_bloque ORDER BY serie, desde').all() as BloqueHub[];
    },
  };
}
