import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PosAtajoCtx } from '../../../../common/posAtajos';
import { usePosHotkeys, type PosHotkeysOpts } from '../usePosHotkeys';

const CTX: PosAtajoCtx = { lineas: 2, loading: false, cantidadEnEspera: 1, canOverride: true, multiplicadorPendiente: false };

function setup(ctx: Partial<PosAtajoCtx> = {}, over: Partial<PosHotkeysOpts> = {}) {
  const handlers = {
    onEnfocarBuscador: vi.fn(),
    onCobrar: vi.fn(),
    onDescuentoUltimaLinea: vi.fn(),
    onVentasEspera: vi.fn(),
    onPonerEspera: vi.fn(),
    onCancelarMultiplicador: vi.fn(),
  };
  const opts: PosHotkeysOpts = { ctx: { ...CTX, ...ctx }, bloqueado: false, ...handlers, ...over };
  const r = renderHook((o: PosHotkeysOpts) => usePosHotkeys(o), { initialProps: opts });
  return { handlers, ...r };
}

function key(k: string) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
  return ev;
}

describe('usePosHotkeys', () => {
  it('F2 enfoca el buscador y hace preventDefault', () => {
    const { handlers } = setup();
    const ev = key('F2');
    expect(handlers.onEnfocarBuscador).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('F4 cobra solo con líneas y sin loading', () => {
    const a = setup();
    key('F4');
    expect(a.handlers.onCobrar).toHaveBeenCalledTimes(1);
    const b = setup({ lineas: 0 });
    key('F4');
    expect(b.handlers.onCobrar).not.toHaveBeenCalled();
    const c = setup({ loading: true });
    key('F4');
    expect(c.handlers.onCobrar).not.toHaveBeenCalled();
  });

  it('F6 solo con precio.override y líneas', () => {
    const a = setup();
    key('F6');
    expect(a.handlers.onDescuentoUltimaLinea).toHaveBeenCalledTimes(1);
    a.unmount(); // un hook montado aparte haría preventDefault y ensuciaría la aserción
    const b = setup({ canOverride: false });
    const ev = key('F6');
    expect(b.handlers.onDescuentoUltimaLinea).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    const c = setup({ lineas: 0 });
    key('F6');
    expect(c.handlers.onDescuentoUltimaLinea).not.toHaveBeenCalled();
  });

  it('F8 solo si hay ventas en espera', () => {
    const a = setup();
    key('F8');
    expect(a.handlers.onVentasEspera).toHaveBeenCalledTimes(1);
    const b = setup({ cantidadEnEspera: 0 });
    key('F8');
    expect(b.handlers.onVentasEspera).not.toHaveBeenCalled();
  });

  it('F9 solo con líneas y sin loading', () => {
    const a = setup();
    key('F9');
    expect(a.handlers.onPonerEspera).toHaveBeenCalledTimes(1);
    const b = setup({ lineas: 0 });
    key('F9');
    expect(b.handlers.onPonerEspera).not.toHaveBeenCalled();
    const c = setup({ loading: true });
    key('F9');
    expect(c.handlers.onPonerEspera).not.toHaveBeenCalled();
  });

  it('Esc cancela el multiplicador solo si está pendiente', () => {
    const a = setup();
    key('Escape');
    expect(a.handlers.onCancelarMultiplicador).not.toHaveBeenCalled();
    const b = setup({ multiplicadorPendiente: true });
    const ev = key('Escape');
    expect(b.handlers.onCancelarMultiplicador).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('con modal/drawer abierto (bloqueado) no hace nada', () => {
    const { handlers } = setup({ multiplicadorPendiente: true }, { bloqueado: true });
    for (const k of ['F2', 'F4', 'F6', 'F8', 'F9', 'Escape']) key(k);
    for (const h of Object.values(handlers)) expect(h).not.toHaveBeenCalled();
  });

  it('limpia el listener al desmontar', () => {
    const { handlers, unmount } = setup();
    unmount();
    key('F2');
    expect(handlers.onEnfocarBuscador).not.toHaveBeenCalled();
  });

  it('usa los handlers más recientes tras un re-render', () => {
    const { handlers, rerender } = setup();
    const nuevo = vi.fn();
    rerender({ ctx: CTX, bloqueado: false, ...handlers, onCobrar: nuevo });
    key('F4');
    expect(nuevo).toHaveBeenCalledTimes(1);
    expect(handlers.onCobrar).not.toHaveBeenCalled();
  });
});
