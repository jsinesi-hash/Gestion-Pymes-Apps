import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscapeToClose } from './useEscapeToClose';

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

describe('useEscapeToClose', () => {
  it('llama a onClose al presionar Escape', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose));

    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no llama a onClose con enabled=false', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose, false));

    pressEscape();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('no llama a onClose con otras teclas', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('remueve el listener al desmontar', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeToClose(onClose));

    unmount();
    pressEscape();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('respeta un cambio de enabled de true a false', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useEscapeToClose(onClose, enabled),
      { initialProps: { enabled: true } }
    );

    rerender({ enabled: false });
    pressEscape();

    expect(onClose).not.toHaveBeenCalled();
  });
});
