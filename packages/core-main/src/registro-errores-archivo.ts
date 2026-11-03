import path from 'node:path';
import { app } from 'electron';
import { escribirJsonAtomico, leerJsonTolerante } from './archivo-json';
import { registroErrores, type AlmacenErrores } from './registro-errores';

// Persistencia del registro de errores del sistema (ADR-140). Un archivo JSON propio de `userData`,
// no la base: es estado operativo local de la terminal (como `aviso` y el límite de intentos), no se
// sincroniza, no entra en los backups y no necesita una migración.

/** Un archivo ausente o dañado equivale a un registro vacío. */
export function crearAlmacenErroresArchivo(ruta: string): AlmacenErrores {
  return {
    cargar: () => leerJsonTolerante(ruta) ?? [],
    guardar: (errores) => escribirJsonAtomico(ruta, errores),
  };
}

/** Lo llama cada app una vez al arrancar, con `userData` ya resuelto: conecta el registro global al archivo. */
export function activarRegistroErrores(deps: { carpeta?: string } = {}): void {
  const carpeta = deps.carpeta ?? app.getPath('userData');
  registroErrores.persistirEn(crearAlmacenErroresArchivo(path.join(carpeta, 'errores-sistema.json')));
}
