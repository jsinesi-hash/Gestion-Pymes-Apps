// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { configurarBridge, bridge } from './bridge';

describe('bridge()', () => {
  beforeEach(() => { delete (globalThis as any).miApp; });
  it('lee globalThis[clave] en cada llamada (tests pueden reasignar el mock)', () => {
    configurarBridge('miApp');
    // `a` no existe en el catálogo tipado: se lee a través de un tipo ad hoc.
    const leer = () => (bridge() as unknown as { a: number }).a;
    (globalThis as any).miApp = { a: 1 };
    expect(leer()).toBe(1);
    (globalThis as any).miApp = { a: 2 };
    expect(leer()).toBe(2);
  });
  it('sin bridge expuesto devuelve undefined-safe (objeto vacío)', () => {
    configurarBridge('miApp');
    expect(bridge().auth?.whoami).toBeUndefined();
  });
});

// Revisión 2026-10-20 (P1): `bridge()` devolvía `any`. Ahora devuelve el catálogo tipado (núcleo +
// lo que cada app agrega por `AppBridgeExtension`) y estas líneas se verifican en COMPILACIÓN:
// un `@ts-expect-error` que deja de ser un error rompe `tsc`.
export function _verificacionDeTipos(): void {
  void bridge().auth.login({ nombreUsuario: 'x', password: 'y' });
  void bridge().caja.abrir({ monto_inicial: 0 });
  void bridge().usuario.desactivar({ userId: 'u' });

  // @ts-expect-error — el namespace no existe en el catálogo
  void bridge().namespaceInexistente.algo();
  // @ts-expect-error — el método no existe
  void bridge().caja.metodoInexistente();
}
