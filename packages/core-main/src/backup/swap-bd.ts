import fs from 'node:fs';

// Revisión 2026-10-20 (P0). Extraído de `ejecutarRestoreAtomico` para poder probar el swap.
// Antes: el rollback era `catch {}` vacío (la BD podía quedar ausente sin rastro) y un `unlink`
// fallido tras un swap exitoso disparaba el rollback y revertía el restore.

export type RestoreSwapCodigo = 'RESTORE_SWAP_FALLIDO' | 'RESTORE_ROLLBACK_FALLIDO';

/**
 * Falla del intercambio de la BD. La conexión ya se cerró cuando se lanza: la app no puede seguir
 * operando hasta reiniciarse. `RESTORE_SWAP_FALLIDO` = la BD original quedó en su lugar (reiniciar
 * es seguro). `RESTORE_ROLLBACK_FALLIDO` = no se pudo volver atrás: la copia de la BD original
 * queda en `bakPath` y NO hay que reiniciar la app (abriría una BD vacía).
 */
export class RestoreSwapError extends Error {
  readonly code: RestoreSwapCodigo;
  readonly bakPath: string;
  readonly conexionCerrada = true;

  constructor(code: RestoreSwapCodigo, detalle: string, bakPath: string) {
    super(`${code}: ${detalle}`);
    this.name = 'RestoreSwapError';
    this.code = code;
    this.bakPath = bakPath;
  }
}

export interface SwapOpts {
  dbPath: string;
  /** Copia ya verificada de la BD a restaurar. Ojo: `rename` solo es atómico dentro del mismo volumen. */
  tempPath: string;
  cerrarConexion: () => void;
  renombrar?: (desde: string, hacia: string) => void;
  borrar?: (ruta: string) => void;
  log?: (mensaje: string, detalle?: unknown) => void;
}

function motivo(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function intercambiarBaseDeDatos(opts: SwapOpts): void {
  const renombrar = opts.renombrar ?? fs.renameSync;
  const borrar = opts.borrar ?? fs.unlinkSync;
  const log = opts.log ?? ((m: string, d?: unknown) => console.error(m, d));
  const { dbPath, tempPath } = opts;
  const bakPath = dbPath + '.pre-restore.bak';

  opts.cerrarConexion();

  try {
    renombrar(dbPath, bakPath);
  } catch (e) {
    // La BD original no se movió: sigue en su lugar.
    throw new RestoreSwapError('RESTORE_SWAP_FALLIDO', `no se pudo apartar la BD actual (${motivo(e)})`, bakPath);
  }

  try {
    renombrar(tempPath, dbPath);
  } catch (swapErr) {
    try {
      renombrar(bakPath, dbPath);
    } catch (rollbackErr) {
      log(`[restore] ROLLBACK FALLIDO: la BD original quedó en "${bakPath}" y no se pudo devolver a "${dbPath}"`, {
        swap: motivo(swapErr),
        rollback: motivo(rollbackErr),
      });
      throw new RestoreSwapError(
        'RESTORE_ROLLBACK_FALLIDO',
        `no se pudo restaurar ni volver atrás; la base original está en ${bakPath} (${motivo(swapErr)}; ${motivo(rollbackErr)})`,
        bakPath,
      );
    }
    throw new RestoreSwapError('RESTORE_SWAP_FALLIDO', `no se pudo colocar la BD restaurada (${motivo(swapErr)})`, bakPath);
  }

  // El restore ya se aplicó: borrar el .bak es limpieza. Si falla NO se revierte (hacerlo
  // pisaría la BD restaurada con la anterior).
  try {
    borrar(bakPath);
  } catch (e) {
    log(`[restore] la BD restaurada está en su lugar, pero no se pudo borrar "${bakPath}"`, motivo(e));
  }
}

/** Ruta del archivo de la BD abierta, tomada de la propia conexión (no asume `ferreteria.db`). */
export function rutaDeBaseDeDatos(db: unknown): string {
  const name = (db as { $client?: { name?: unknown } }).$client?.name;
  if (typeof name !== 'string' || name === '' || name === ':memory:') {
    throw new Error('RESTORE_RUTA_BD: la conexión actual no corresponde a un archivo');
  }
  return name;
}
