// Hub de sync de Retail (ADR-158 §1): el núcleo genérico (`@core/hub`) con el esquema, el registro de
// sync y las migraciones de esta app. Corre con el mismo `electron.exe` en modo Node, sin ventana.
import path from 'node:path';
import { carpetaDatosPorDefecto, type OpcionesHub } from '@core/hub';
import * as schema from '../db/schema';
import { registroSyncRetail } from '../db/registro-sync';

/** Migraciones de la app: las mismas que aplica cada terminal (el hub tiene sus mismas tablas). */
export const MIGRACIONES_APP = path.resolve(__dirname, '../db/migrations');

export function opcionesHub(carpeta = carpetaDatosPorDefecto('ferreteria-client'), migracionesApp = MIGRACIONES_APP): OpcionesHub {
  return { nombre: 'hub-retail', schema, registro: registroSyncRetail(), migracionesApp, carpeta };
}
