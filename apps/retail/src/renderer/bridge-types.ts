import type { canalesRetail } from '../preload/canales';

// Revisión 2026-10-20 (P1): `bridge()` (de @core/ui) devuelve el catálogo universal más lo que
// amplíe cada app por `AppBridgeExtension`. El tipo se DERIVA del preload (`canalesRetail`): un
// canal renombrado o agregado ahí se refleja acá sin mantener una segunda definición.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppBridgeExtension extends ReturnType<typeof canalesRetail> {}
}

export {};
