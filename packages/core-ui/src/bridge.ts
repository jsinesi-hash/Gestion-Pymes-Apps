import type { CoreBridgeApi } from '@core/preload';

let clave: string | null = null;
/** La app lo llama UNA vez al arrancar el renderer (y en su test-setup). */
export function configurarBridge(exposeAs: string): void { clave = exposeAs; }

/**
 * Catálogo propio de cada app, que se suma al universal del core.
 *
 * Revisión 2026-10-20 (P1): `bridge()` devolvía `any`, así que un canal renombrado en el preload
 * rompía en ejecución sin que fallara `tsc`. Cada app amplía esta interfaz GLOBAL con el tipo de lo
 * que arma su preload (ver `apps/<app>/src/renderer/bridge-types.ts`); en el propio core-ui está
 * vacía. Es global (y no una ampliación de módulo) porque `@core/ui` reexporta este archivo con
 * `export *` y TypeScript no fusiona ampliaciones sobre reexportaciones.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppBridgeExtension {}
}

/** Lo que ve el renderer: canales universales (`@core/preload`) + los propios de la app. */
export type AppBridge = CoreBridgeApi & AppBridgeExtension;

/**
 * API expuesta por `createBridge`. Los nombres de namespaces y métodos se verifican al compilar;
 * los payloads siguen siendo `unknown` salvo donde el preload los tipe (p. ej. `venta`).
 */
export function bridge(): AppBridge {
  if (!clave) throw new Error('BRIDGE_NO_CONFIGURADO');
  return ((globalThis as any)[clave] ?? {}) as AppBridge;
}
