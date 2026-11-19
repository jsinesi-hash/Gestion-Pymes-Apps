// Datos del hub guardados al emparejar (ADR-150 §2, ADR-158 §3). La URL, el certificado fijado y su
// huella van en `sync-hub.json` de userData; la credencial, cifrada con safeStorage en un archivo
// aparte, igual que la contraseña SMTP (ADR-048): nunca en la base ni en un backup.
import fs from 'node:fs';
import path from 'node:path';

export interface DatosHub {
  /** `https://<host>:<puerto>` del hub. */
  readonly url: string;
  readonly certPem: string;
  readonly huella: string;
  /** `origin_id` que el hub asignó a esta terminal. */
  readonly origin_id: string;
  readonly nombre: string;
  readonly emparejado_en: number;
}

export interface DepsHubGuardado {
  readonly safeStorage: {
    isEncryptionAvailable(): boolean;
    encryptString(texto: string): Buffer;
    decryptString(datos: Buffer): string;
  };
  /** Carpeta de datos del usuario (userData). */
  readonly carpeta: string;
}

const ARCHIVO_DATOS = 'sync-hub.json';
const ARCHIVO_CREDENCIAL = 'sync-credencial.bin';

export function guardarHub(deps: DepsHubGuardado, datos: DatosHub, credencial: string): void {
  if (!deps.safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_NO_DISPONIBLE');
  fs.writeFileSync(path.join(deps.carpeta, ARCHIVO_CREDENCIAL), deps.safeStorage.encryptString(credencial), { mode: 0o600 });
  fs.writeFileSync(path.join(deps.carpeta, ARCHIVO_DATOS), JSON.stringify(datos, null, 2), 'utf-8');
}

/** Los datos y la credencial, o `null` si la terminal no está emparejada o no se pueden leer. */
export function leerHub(deps: DepsHubGuardado): { datos: DatosHub; credencial: string } | null {
  const rutaDatos = path.join(deps.carpeta, ARCHIVO_DATOS);
  const rutaCredencial = path.join(deps.carpeta, ARCHIVO_CREDENCIAL);
  if (!fs.existsSync(rutaDatos) || !fs.existsSync(rutaCredencial)) return null;
  if (!deps.safeStorage.isEncryptionAvailable()) return null;
  try {
    const datos = JSON.parse(fs.readFileSync(rutaDatos, 'utf-8')) as DatosHub;
    const credencial = deps.safeStorage.decryptString(fs.readFileSync(rutaCredencial));
    if (!datos.url || !datos.certPem || !datos.huella || !credencial) return null;
    return { datos, credencial };
  } catch {
    return null;
  }
}

export function borrarHub(deps: DepsHubGuardado): void {
  for (const a of [ARCHIVO_DATOS, ARCHIVO_CREDENCIAL]) fs.rmSync(path.join(deps.carpeta, a), { force: true });
}
