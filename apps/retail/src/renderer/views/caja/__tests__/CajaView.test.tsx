import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CajaView } from '@core/ui';

const mockGetActiva = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    caja: { getActiva: mockGetActiva, abrir: vi.fn(), listMovimientos: vi.fn().mockResolvedValue([]) },
    venta: { listByCaja: vi.fn().mockResolvedValue([]) },
  };
});

describe('CajaView', () => {
  it('muestra AperturaForm cuando no hay caja activa', async () => {
    mockGetActiva.mockResolvedValue(null);
    render(<MemoryRouter><CajaView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /abrir caja/i })).toBeInTheDocument());
  });

  it('muestra dashboard con info de turno cuando hay caja activa', async () => {
    mockGetActiva.mockResolvedValue({
      id: 'c-1',
      usuario_id: 'u-1',
      fecha_apertura: new Date('2026-06-11T08:00:00'),
      monto_inicial: 10000,
      estado: 'abierta',
    });
    render(<MemoryRouter><CajaView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/10\.000/)).toBeInTheDocument());
  });

  it('muestra estado de carga inicial (no muestra botones)', () => {
    mockGetActiva.mockResolvedValue(null);
    render(<MemoryRouter><CajaView /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /abrir caja/i })).not.toBeInTheDocument();
  });
});
