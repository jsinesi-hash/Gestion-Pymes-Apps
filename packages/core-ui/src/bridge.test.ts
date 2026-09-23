// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { configurarBridge, bridge } from './bridge';

describe('bridge()', () => {
  beforeEach(() => { delete (globalThis as any).miApp; });
  it('lee globalThis[clave] en cada llamada (tests pueden reasignar el mock)', () => {
    configurarBridge('miApp');
    (globalThis as any).miApp = { a: 1 };
    expect(bridge().a).toBe(1);
    (globalThis as any).miApp = { a: 2 };
    expect(bridge().a).toBe(2);
  });
  it('sin bridge expuesto devuelve undefined-safe (objeto vacío)', () => {
    configurarBridge('miApp');
    expect(bridge().auth?.whoami).toBeUndefined();
  });
});
