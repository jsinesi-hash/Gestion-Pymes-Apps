import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PosTopBar } from '../PosTopBar';

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    catalogo: {
      producto: { list: vi.fn().mockResolvedValue({ items: [] }), get: vi.fn() },
      existencias: { get: vi.fn() },
      impuesto: { list: vi.fn().mockResolvedValue([]) },
    },
    cliente: { list: vi.fn().mockResolvedValue([]) },
    parametros: { get: vi.fn().mockResolvedValue('false') },
  };
});

function renderTopBar() {
  return render(
    <PosTopBar
      onAdd={vi.fn()}
      disabled={false}
      clienteInfo={null}
      onSeleccionarCliente={vi.fn()}
      clienteId={null}
    />,
  );
}

describe('PosTopBar', () => {
  it('renderiza el input de scan', () => {
    renderTopBar();
    expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument();
  });

  it('ya no renderiza el segmento de medios de pago', () => {
    renderTopBar();
    expect(screen.queryByRole('button', { name: /efectivo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /transf\./i })).toBeNull();
    expect(screen.queryByRole('button', { name: /tarjeta/i })).toBeNull();
  });
});
