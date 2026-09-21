import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentaEsperaDrawer } from '../VentaEsperaDrawer';
import type { VentaEsperaItem } from '../../../hooks/usePosSession';

const VENTAS: VentaEsperaItem[] = [
  {
    id: 'v1', alias: 'Juan', en_espera_desde: new Date(), turno_creacion_id: null,
    cliente_id: 'cf', count_items: 3, total: 1500, vencida: false,
  },
];

function renderDrawer(onCerrar = vi.fn()) {
  return { onCerrar, ...render(
    <VentaEsperaDrawer ventas={VENTAS} loading={false} onRetomar={vi.fn()} onDescartar={vi.fn()} onCerrar={onCerrar} />
  ) };
}

describe('VentaEsperaDrawer', () => {
  it('muestra las ventas en espera', () => {
    renderDrawer();
    expect(screen.getByText('Juan')).toBeInTheDocument();
  });

  it('el botón ✕ llama a onCerrar', () => {
    const { onCerrar } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(onCerrar).toHaveBeenCalledOnce();
  });

  it('llama a onCerrar al presionar Escape', () => {
    const { onCerrar } = renderDrawer();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledOnce();
  });
});
