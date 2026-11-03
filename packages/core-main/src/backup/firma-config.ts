// Proveedor de la clave de firma de los `.fbk`. Vive aparte de `clave-firma.ts` (que usa Electron)
// para que los engines de backup/restore no dependan de Electron y se puedan probar en Node.
//
// `crearBackup` se llama desde varios lados (IPC, backup previo a la migración, backup de seguridad
// antes de un restore, y las dos apps): en vez de pasar la clave por cada llamada, la app registra
// el proveedor una vez al arrancar (`activarFirmaBackup`). Sin proveedor no se firma.

type ProveedorClave = () => Buffer | null;

let proveedor: ProveedorClave = () => null;

export function configurarFirmaBackup(p: ProveedorClave): void {
  proveedor = p;
}

/** Clave actual o `null`. Nunca lanza: un fallo de safeStorage no debe impedir hacer un backup. */
export function claveFirmaActual(): Buffer | null {
  try {
    return proveedor();
  } catch (e) {
    console.error('[backup] no se pudo leer la clave de firma:', (e as Error).message);
    return null;
  }
}
