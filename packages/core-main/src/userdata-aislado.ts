import fs from 'node:fs';
import path from 'node:path';

/**
 * Variable de entorno que redirige TODOS los datos de la app (BD, backups, config.json, caché) a una
 * carpeta propia. Sirve para probar la app real (`pnpm dev`) sin abrir la base del usuario.
 *
 * `APPDATA` no sirve para esto: Electron resuelve `userData` por la API de Windows, no por el entorno.
 */
export const VAR_USER_DATA = 'GESTION_USER_DATA_DIR';

type EntornoUserData = Readonly<Record<string, string | undefined>>;

/** Ruta pedida por el entorno, o `null` si no se pidió ninguna. Una ruta relativa es un error. */
export function resolverUserDataAislado(env: EntornoUserData): string | null {
  const pedida = env[VAR_USER_DATA]?.trim();
  if (!pedida) return null;
  if (!path.isAbsolute(pedida)) {
    throw new Error(`${VAR_USER_DATA} debe ser una ruta absoluta (recibí "${pedida}")`);
  }
  return path.normalize(pedida);
}

/**
 * Debe ejecutarse ANTES de que cualquier módulo abra la BD (`db/client` calcula su ruta al importarse).
 * Si la variable está puesta pero la carpeta no se puede usar, falla: caer en silencio a los datos
 * reales es justamente lo que esto evita.
 */
export function aplicarUserDataAislado(
  app: { setPath(nombre: 'userData', ruta: string): void },
  env: EntornoUserData,
): string | null {
  const destino = resolverUserDataAislado(env);
  if (destino === null) return null;
  fs.mkdirSync(destino, { recursive: true });
  app.setPath('userData', destino);
  console.log(`[userData] aislado por ${VAR_USER_DATA}: ${destino}`);
  return destino;
}
