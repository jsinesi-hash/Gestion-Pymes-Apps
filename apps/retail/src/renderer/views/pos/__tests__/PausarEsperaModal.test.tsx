import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PausarEsperaModal } from '../PausarEsperaModal';

function renderModal(loading = false, onCancelar = vi.fn()) {
  return { onCancelar, ...render(
    <PausarEsperaModal loading={loading} onConfirmar={vi.fn()} onCancelar={onCancelar} />
  ) };
}

describe('PausarEsperaModal', () => {
  it('llama a onCancelar al presionar Escape', () => {
    const { onCancelar } = renderModal();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancelar).toHaveBeenCalledOnce();
  });

  it('NO llama a onCancelar con Escape mientras loading es true', () => {
    const { onCancelar } = renderModal(true);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancelar).not.toHaveBeenCalled();
  });
});
