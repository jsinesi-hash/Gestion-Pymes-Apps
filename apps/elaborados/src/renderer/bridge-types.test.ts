import { describe, it, expect } from 'vitest';
import { bridge } from '@core/ui';
import './bridge-types';

// Revisión 2026-10-20 (P1): ver apps/retail/src/renderer/bridge-types.test.ts. Las líneas
// `@ts-expect-error` se verifican en COMPILACIÓN (`tsc --noEmit`).
export function _verificacionDeTipos(): void {
  // universales (core)
  void bridge().auth.whoami();
  // propios de Elaborados (preload de la app)
  void bridge().articulo.list();
  void bridge().ventaEspera.listar();

  // @ts-expect-error — namespace inexistente
  void bridge().namespaceInexistente.algo();
  // @ts-expect-error — método inexistente en un namespace de la app
  void bridge().articulo.metodoInexistente();
}

describe('bridge-types (Elaborados)', () => {
  it('el módulo de tipos se importa sin efectos en ejecución', () => {
    expect(typeof bridge).toBe('function');
  });
});
