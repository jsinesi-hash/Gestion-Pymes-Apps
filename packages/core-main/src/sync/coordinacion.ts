// Coordinación en la terminal (ADR-152 §2, ADR-154 §2; F2 PR5). Renueva el permiso de terminal
// coordinadora que otorga el hub y pide bloques de correlativos antes de quedarse sin números. Genérico:
// cada app declara sus series (Retail: el SKU); el núcleo no sabe qué numera cada una.
//
// Cada serie vive en `parametros_sistema` (valores locales, no sincronizan):
// - `<serie>_proximo_secuencial`: el próximo número a entregar;
// - `<serie>_bloque_hasta`: el último del bloque actual (sin esta clave no hay tope: standalone);
// - `<serie>_bloque_siguiente`: `desde-hasta` del bloque pedido por adelantado, que la reserva usa al
//   agotar el actual.
import type * as BetterSqlite3 from 'better-sqlite3';
import { RUTAS } from '@core/hub';
import { setCoordinadoraHasta } from '../context';
import { cuerpo } from './cliente';
import type { TransporteHub } from './transporte';

export interface SerieBloques {
  /** Nombre de la serie en el hub y prefijo de sus claves (`sku` → `sku_proximo_secuencial`…). */
  readonly serie: string;
  /** Números por bloque. */
  readonly tamano?: number;
  /** Con menos números que esto, se pide el bloque siguiente. */
  readonly umbral?: number;
  /** El mayor número de la serie que la terminal ve en su base (incluye lo que bajó del hub). */
  readonly ultimoUsado?: () => number;
}

export interface CoordinacionTerminal {
  /** Pide o renueva el permiso; devuelve si esta terminal es la coordinadora. */
  renovar(): Promise<boolean>;
  /** Pide el bloque siguiente de cada serie a la que le quedan pocos números. */
  revisarBloques(): Promise<void>;
}

export const TAMANO_BLOQUE = 1000;
export const UMBRAL_BLOQUE = 100;
/** Margen contra la vigencia del hub: la terminal deja de ser coordinadora un poco antes que el hub la libere. */
const MARGEN_PERMISO_MS = 5_000;

export const clavesDeSerie = (serie: string) => ({
  proximo: `${serie}_proximo_secuencial`,
  hasta: `${serie}_bloque_hasta`,
  siguiente: `${serie}_bloque_siguiente`,
});

function leer(sqlite: BetterSqlite3.Database, clave: string): string | undefined {
  return (sqlite.prepare('SELECT "valor" FROM "parametros_sistema" WHERE "clave" = ?').get(clave) as { valor: string } | undefined)?.valor;
}
function escribir(sqlite: BetterSqlite3.Database, clave: string, valor: string, descripcion: string): void {
  sqlite.prepare(
    'INSERT INTO "parametros_sistema" ("clave", "valor", "tipo", "descripcion", "actualizado_en") VALUES (?, ?, \'number\', ?, ?) ' +
    'ON CONFLICT ("clave") DO UPDATE SET "valor" = excluded."valor", "actualizado_en" = excluded."actualizado_en"',
  ).run(clave, valor, descripcion, Math.floor(Date.now() / 1000));
}
function borrar(sqlite: BetterSqlite3.Database, clave: string): void {
  sqlite.prepare('DELETE FROM "parametros_sistema" WHERE "clave" = ?').run(clave);
}

/** `desde-hasta` del bloque guardado por adelantado, o null. */
export function parsearBloque(valor: string | undefined): { desde: number; hasta: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(valor ?? '');
  if (!m) return null;
  const desde = Number(m[1]);
  const hasta = Number(m[2]);
  return hasta >= desde ? { desde, hasta } : null;
}

/** Números que le quedan a la serie (incluido el bloque siguiente), o null si no tiene tope (standalone). */
export function disponiblesDeSerie(sqlite: BetterSqlite3.Database, serie: string): number | null {
  const k = clavesDeSerie(serie);
  const hasta = leer(sqlite, k.hasta);
  if (hasta === undefined) return null;
  const proximo = Number(leer(sqlite, k.proximo) ?? 1);
  const siguiente = parsearBloque(leer(sqlite, k.siguiente));
  return Math.max(0, Number(hasta) - proximo + 1) + (siguiente ? siguiente.hasta - siguiente.desde + 1 : 0);
}

/**
 * Al emparejar: la serie queda sin números hasta que llegue el primer bloque del hub (los números que la
 * terminal usaría por su cuenta podrían repetirse en otra).
 */
export function prepararSeriesDistribuido(sqlite: BetterSqlite3.Database, series: readonly SerieBloques[]): void {
  sqlite.transaction(() => {
    for (const s of series) {
      const k = clavesDeSerie(s.serie);
      const proximo = Number(leer(sqlite, k.proximo) ?? 1);
      escribir(sqlite, k.hasta, String(proximo - 1), `Último número del bloque de ${s.serie} que asignó el hub (ADR-154 §2).`);
      borrar(sqlite, k.siguiente);
    }
  })();
}

/** Al volver a standalone: sin tope, y el próximo número después de lo último que la terminal vio. */
export function liberarSeries(sqlite: BetterSqlite3.Database, series: readonly SerieBloques[]): void {
  sqlite.transaction(() => {
    for (const s of series) {
      const k = clavesDeSerie(s.serie);
      borrar(sqlite, k.hasta);
      borrar(sqlite, k.siguiente);
      const proximo = Number(leer(sqlite, k.proximo) ?? 1);
      const minimo = (s.ultimoUsado?.() ?? 0) + 1;
      if (minimo > proximo) escribir(sqlite, k.proximo, String(minimo), `Próximo número de ${s.serie}.`);
    }
  })();
}

export function crearCoordinacionTerminal(
  sqlite: BetterSqlite3.Database,
  transporte: TransporteHub,
  series: readonly SerieBloques[],
): CoordinacionTerminal {
  async function renovar(): Promise<boolean> {
    const r = await transporte.pedir('POST', RUTAS.coordinadora);
    const b = cuerpo(r);
    const vigencia = Number(b['vigencia_ms']);
    if (b['coordinadora'] === true && Number.isFinite(vigencia)) {
      // Cuenta desde que salió el pedido: la terminal suelta antes de que el hub lo dé a otra.
      setCoordinadoraHasta(r.enviadoMs + vigencia - MARGEN_PERMISO_MS);
      return true;
    }
    setCoordinadoraHasta(0);
    return false;
  }

  async function revisarSerie(s: SerieBloques): Promise<void> {
    const k = clavesDeSerie(s.serie);
    const hasta = leer(sqlite, k.hasta);
    if (hasta === undefined || leer(sqlite, k.siguiente) !== undefined) return;
    const proximo = Number(leer(sqlite, k.proximo) ?? 1);
    if (Number(hasta) - proximo + 1 >= (s.umbral ?? UMBRAL_BLOQUE)) return;
    const minimo = Math.max(proximo, (s.ultimoUsado?.() ?? 0) + 1, 1);
    const b = cuerpo(await transporte.pedir('POST', RUTAS.bloque, { serie: s.serie, minimo, tamano: s.tamano ?? TAMANO_BLOQUE }));
    const desde = Number(b['desde']);
    const nuevoHasta = Number(b['hasta']);
    if (!Number.isSafeInteger(desde) || !Number.isSafeInteger(nuevoHasta) || nuevoHasta < desde) throw new Error('HUB_RESPUESTA_INVALIDA: bloque');
    sqlite.transaction(() => {
      // Se vuelve a leer: mientras viajaba el pedido se pudieron dar de alta productos.
      const actual = Number(leer(sqlite, k.proximo) ?? 1);
      const tope = Number(leer(sqlite, k.hasta) ?? 0);
      if (actual > tope) {
        escribir(sqlite, k.proximo, String(desde), `Próximo número de ${s.serie}.`);
        escribir(sqlite, k.hasta, String(nuevoHasta), `Último número del bloque de ${s.serie} que asignó el hub (ADR-154 §2).`);
      } else {
        escribir(sqlite, k.siguiente, `${desde}-${nuevoHasta}`, `Bloque siguiente de ${s.serie}, pedido por adelantado (ADR-154 §2).`);
      }
    })();
  }

  return {
    renovar,
    async revisarBloques() {
      for (const s of series) await revisarSerie(s);
    },
  };
}
