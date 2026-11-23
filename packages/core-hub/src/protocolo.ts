// Protocolo terminal ↔ hub (ADR-150). Lo comparten el servidor (este paquete) y el cliente de la
// terminal (F2 PR3): versiones, rutas y forma de cada respuesta.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CambioEntrante, CambioRegistrado, ConflictoHub, PaginaConflictos, ResolucionConflicto, ResultadoCambio, Snapshot } from './almacen';
import type { TerminalHub } from './terminales';

/**
 * Versión del protocolo. Sube cuando cambia la forma de un pedido o de una respuesta.
 * 2 (F3 PR1): el push puede devolver `en_espera`; rutas de conflictos y de terminales.
 */
export const PROTOCOLO_VERSION = 2;

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
  semilla: '/v1/semilla',
  coordinadora: '/v1/coordinadora',
  bloque: '/v1/bloque',
  estado: '/v1/estado',
  conflictos: '/v1/conflictos',
  resolverConflicto: '/v1/conflictos/resolver',
  terminales: '/v1/terminales',
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
/**
 * Semilla de la primera terminal (ADR-150 §10): su base entera, en partes. El hub las junta y las aplica
 * en un solo lote al recibir `fin` (las FK se verifican sobre el total). `inicio` descarta partes
 * anteriores de un intento cortado. Solo se acepta con el hub vacío.
 */
export interface PedidoSemilla { readonly cambios: readonly CambioEntrante[]; readonly inicio?: boolean; readonly fin?: boolean }
export interface RespuestaSemilla extends ConHora { readonly recibidos: number; readonly cursor: number; readonly rechazados?: ResultadoCambio[] }
/** ADR-152 §2: pedir o renovar el permiso de coordinadora (sin cuerpo; la terminal sale de la credencial). */
export interface RespuestaCoordinadora extends ConHora { readonly coordinadora: boolean; readonly origin_id: string; readonly vigencia_ms: number }
/** ADR-154 §2: el próximo bloque de correlativos de una serie. `minimo` = el próximo número que la terminal sabe libre. */
export interface PedidoBloque { readonly serie: string; readonly minimo: number; readonly tamano: number }
export interface RespuestaBloque extends ConHora { readonly serie: string; readonly desde: number; readonly hasta: number }
export interface RespuestaEstado extends ConHora { readonly origin_id: string; readonly cursor: number; readonly versiones: Versiones }
/** F3 PR1 (ADR-159): `GET /v1/conflictos?pendientes=1&tipo=&antes=&limite=&id=`. */
export type RespuestaConflictos = ConHora & PaginaConflictos;
/** `por` = quien resolvió (el usuario de la caja); el hub le agrega la caja de la credencial. */
export interface PedidoResolverConflicto { readonly id: number; readonly resolucion: ResolucionConflicto; readonly por: string }
export interface RespuestaResolverConflicto extends ConHora { readonly conflicto: ConflictoHub }
/** Las cajas emparejadas, sin credenciales: último contacto y versiones de cada una. */
export interface RespuestaTerminales extends ConHora { readonly terminales: TerminalHub[] }
export interface RespuestaError extends Partial<ConHora> { readonly error: string; readonly versiones?: Versiones }
