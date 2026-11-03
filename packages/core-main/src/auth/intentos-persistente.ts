import path from 'node:path';
import { app } from 'electron';
import { escribirJsonAtomico, leerJsonTolerante } from '../archivo-json';
import { limiteIntentos, type AlmacenIntentos, type EstadoIntentos } from './intentos';
import { limiteSolicitudesRecuperacion } from './recuperacion';

// Persistencia del límite de intentos (ADR-138). El estado vivía en memoria del proceso: cerrar y
// volver a abrir la app reiniciaba el contador y el bloqueo de 15 minutos. Se guarda en un archivo
// JSON propio de userData y no en la base: es estado operativo local de la terminal (como `aviso`),
// no se sincroniza, no entra en los backups y no necesita una migración.
//
// Límite declarado: quien puede borrar el archivo también puede abrir la base; esto frena la
// adivinanza desde la pantalla de login, no a quien ya tiene acceso al equipo.

/** Archivo JSON con escritura atómica (temporal + renombrar). Un archivo ilegible equivale a vacío. */
export function crearAlmacenArchivo(ruta: string): AlmacenIntentos {
  return {
    cargar() {
      const crudo = leerJsonTolerante(ruta);
      if (crudo === undefined) return {};
      if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
        console.warn(`[lockout] ${path.basename(ruta)} no es un objeto: se ignora`);
        return {};
      }
      return crudo as Record<string, EstadoIntentos>;
    },
    guardar: (estados) => escribirJsonAtomico(ruta, estados),
  };
}

/**
 * Lo llama cada app una vez al arrancar, con `userData` ya resuelto: conecta el límite de login y el
 * de pedidos de recuperación de contraseña a sus archivos y carga lo que había.
 */
export function activarLockoutPersistente(deps: { carpeta?: string } = {}): void {
  const carpeta = deps.carpeta ?? app.getPath('userData');
  limiteIntentos.persistirEn(crearAlmacenArchivo(path.join(carpeta, 'login-lockout.json')));
  limiteSolicitudesRecuperacion.persistirEn(crearAlmacenArchivo(path.join(carpeta, 'recuperacion-pedidos.json')));
}
