// Hub de sync de Elaborados (ADR-158 §1): el núcleo genérico (`@core/hub`) con el esquema, el registro de
// sync y las migraciones de esta app. Corre con el mismo `electron.exe` en modo Node, sin ventana.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { carpetaDatosPorDefecto, type OpcionesHub } from '@core/hub';
import type { OpcionesHubLocal } from '@core/main';
import * as schema from '../db/schema';
import { registroSyncElaborados } from '../db/registro-sync';

const ID = 'elaborados-client';
const NOMBRE = 'Heladería';

// En el build (`.vite/build`, también empaquetado) las migraciones viajan al lado de la entrada: las de la
// app en `migrations` y las del hub en `hub-migrations` (F2 PR6). Corriendo desde el código (tsx, tests)
// se usan las de `src` y las del paquete `@core/hub`.
const EN_BUILD = fs.existsSync(path.join(__dirname, 'migrations'));

/** Migraciones de la app: las mismas que aplica cada terminal (el hub tiene sus mismas tablas). */
export const MIGRACIONES_APP = EN_BUILD ? path.join(__dirname, 'migrations') : path.resolve(__dirname, '../db/migrations');
const MIGRACIONES_HUB = EN_BUILD ? path.join(__dirname, 'hub-migrations') : undefined;

export function opcionesHub(carpeta = carpetaDatosPorDefecto(ID), migracionesApp = MIGRACIONES_APP): OpcionesHub {
  return {
    nombre: 'hub-elaborados', schema, registro: registroSyncElaborados(), migracionesApp, carpeta,
    ...(MIGRACIONES_HUB ? { migracionesHub: MIGRACIONES_HUB } : {}),
  };
}

/**
 * Cómo se registra el hub como servicio desde la consola (`instalar-servicio`, F2 PR6): el mismo ejecutable
 * y la misma entrada con la que corre ahora. Solo desde el build: el código fuente necesita tsx.
 */
export function servicioDesdeConsola(script = process.argv[1] ?? ''): OpcionesHub['servicio'] {
  if (!script.endsWith('.js')) return undefined;
  return { id: ID, nombre: NOMBRE, ejecutable: process.execPath, args: [script], usuario: os.userInfo().username };
}

/**
 * «Usar esta PC como servidor» desde la app (F2 PR6): el main de la app y la entrada del hub (`cli.js`)
 * están en la misma carpeta del build; el ejecutable es el de la app, en modo Node.
 */
export function hubLocalElaborados(carpetaBuild = __dirname): OpcionesHubLocal {
  return { id: ID, nombre: NOMBRE, ejecutable: process.execPath, args: [path.join(carpetaBuild, 'cli.js')], opcionesHub: (c) => opcionesHub(c) };
}
