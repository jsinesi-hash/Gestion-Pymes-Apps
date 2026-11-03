import fs from 'node:fs';
import path from 'node:path';

// Lectura y escritura de pequeños archivos JSON de estado local en `userData` (límite de intentos de
// login, registro de errores del sistema). Antes la escritura atómica estaba escrita a mano en el
// primero; acá queda una sola vez.

/**
 * El contenido parseado, o `undefined` si el archivo no existe o está dañado (en ese caso avisa por
 * consola y no lanza: un estado ilegible equivale a no tener estado).
 */
export function leerJsonTolerante(ruta: string): unknown {
  if (!fs.existsSync(ruta)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    console.warn(`[archivo] ${path.basename(ruta)} está dañado: se ignora`);
    return undefined;
  }
}

/** Crea la carpeta si falta y escribe de forma atómica (archivo temporal + renombrar), modo 0600. */
export function escribirJsonAtomico(ruta: string, valor: unknown): void {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(valor), { mode: 0o600 });
  fs.renameSync(temporal, ruta);
}
