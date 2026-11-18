// Protocolo terminal ↔ hub (ADR-150). Lo comparten el servidor (este paquete) y el cliente de la
// terminal (F2 PR3): versiones, rutas y forma de cada respuesta.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CambioEntrante, CambioRegistrado, ResultadoCambio, Snapshot } from './almacen';

/** Versión del protocolo. Sube cuando cambia la forma de un pedido o de una respuesta. */
export const PROTOCOLO_VERSION = 1;

export interface Versiones {
  readonly protocolo: number;
  /** Cantidad de migraciones de la app: el hub y la terminal la calculan igual. */
  readonly esquema: number;
}

/** Versión de esquema de una app: la cantidad de entradas de su journal de migraciones. */
export function versionEsquema(carpetaMigraciones: string): number {
  const journal = JSON.parse(readFileSync(path.join(carpetaMigraciones, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
  return journal.entries.length;
}

/**
 * ADR-150 §8: el hub acepta su versión y la anterior. Una terminal más nueva que el hub no sincroniza
 * (se actualiza primero el hub) y sigue vendiendo con el aviso.
 */
export function versionesCompatibles(hub: Versiones, terminal: Versiones): boolean {
  const ok = (h: number, t: number) => t === h || t === h - 1;
  return ok(hub.protocolo, terminal.protocolo) && ok(hub.esquema, terminal.esquema);
}

export const RUTAS = {
  emparejar: '/v1/emparejar',
  push: '/v1/push',
  pull: '/v1/pull',
  snapshot: '/v1/snapshot',
  estado: '/v1/estado',
} as const;

/** Cabeceras que lleva todo pedido de la terminal. */
export const CABECERA_PROTOCOLO = 'x-protocolo';
export const CABECERA_ESQUEMA = 'x-esquema';

/** Toda respuesta lleva la hora del hub (ADR-150 §9): la terminal mide el desfasaje de su reloj. */
export interface ConHora { readonly hora_hub_ms: number }

export interface PedidoEmparejar { readonly codigo: string; readonly nombre: string; readonly origin_id_propuesto?: string }
export interface RespuestaEmparejar extends ConHora { readonly origin_id: string; readonly credencial: string; readonly versiones: Versiones }
export interface PedidoPush { readonly cambios: readonly CambioEntrante[] }
export interface RespuestaPush extends ConHora { readonly resultados: ResultadoCambio[] }
export interface RespuestaPull extends ConHora { readonly cambios: CambioRegistrado[]; readonly hasta: number; readonly hayMas: boolean }
export type RespuestaSnapshot = ConHora & Snapshot;
export interface RespuestaEstado extends ConHora { readonly origin_id: string; readonly cursor: number; readonly versiones: Versiones }
export interface RespuestaError extends Partial<ConHora> { readonly error: string; readonly versiones?: Versiones }
