import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LotesPreciosView } from '../LotesPreciosView';

const mockListar = vi.fn();

function renderView() {
  return render(<MemoryRouter><LotesPreciosView /></MemoryRouter>);
}

const BATCH = {
  id: 'batch-1234abcd', lista_nombre: 'General', proveedor_id: null, origen: 'MARGIN_UPDATE',
  estado: 'validado', productos_ok: 3, advertencias: 1, errores: 0, excluidas: 0,
  impacto_incremento_centavos: 150000, fecha_creacion: Date.now(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListar.mockResolvedValue([BATCH]);
  (window as any).ferreteria = { precios: { batch: { listar: mockListar } } };
});

describe('LotesPreciosView', () => {
  it('lista los lotes y por defecto pide los activos', async () => {
    renderView();
    expect(await screen.findByText('General')).toBeInTheDocument();
    expect(mockListar).toHaveBeenCalledWith({ soloActivos: true });
  });

  it('cambiar el filtro de estado repide con el estado elegido', async () => {
    renderView();
    await screen.findByText('General');
    fireEvent.change(screen.getByLabelText(/filtro estado/i), { target: { value: 'publicado' } });
    await waitFor(() => expect(mockListar).toHaveBeenCalledWith({ estado: 'publicado' }));
  });
});
