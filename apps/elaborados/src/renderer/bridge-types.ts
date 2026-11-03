import type { canalesElaborados } from '../preload/canales';

// Revisión 2026-10-20 (P1): ver apps/retail/src/renderer/bridge-types.ts. El tipo de `bridge()` se
// deriva del preload de Elaborados (`canalesElaborados`).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppBridgeExtension extends ReturnType<typeof canalesElaborados> {}
}

export {};
