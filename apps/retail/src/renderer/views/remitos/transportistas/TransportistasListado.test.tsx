import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TransportistasListado } from './TransportistasListado';
import { __resetPersistentListState } from '@core/ui';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});
afterEach(() => mockNavigate.mockClear());

const list = vi.fn();

beforeEach(() => {
  __resetPersistentListState();
  list.mockReset();
  (globalThis as any).ferreteria = { transportista: { list } };
  list.mockResolvedValue([
    { id: 't1', razon_social: 'Transporte Rex', telefono: '111', email: null, activo: true },
    { id: 't2', razon_social: 'Transporte Otro', telefono: null, email: 'otro@x.com', activo: false },
  ]);
});

function renderListado() {
  return render(<MemoryRouter><TransportistasListado /></MemoryRouter>);
}

describe('TransportistasListado', () => {
  it('lista los transportistas activos por defecto', async () => {
    renderListado();

    expect(await screen.findByText('Transporte Rex')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ incluirInactivos: true });
  });

  it('filtra por texto de busqueda', async () => {
    renderListado();
    await screen.findByText('Transporte Rex');

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'otro' } });

    expect(screen.queryByText('Transporte Rex')).not.toBeInTheDocument();
    // "Otro" queda resaltado (parte el texto); el email de la fila, no resaltado, la confirma.
    expect(screen.getByText('otro@x.com')).toBeInTheDocument();
  });

  it('muestra el estado activo/inactivo', async () => {
    renderListado();
    await waitFor(() => expect(screen.getAllByText(/activo|inactivo/i).length).toBeGreaterThan(0));
  });

  it('ADR-069: clic en la fila abre el form de edición del transportista', async () => {
    renderListado();
    const email = await screen.findByText('otro@x.com');
    fireEvent.click(email.closest('tr')!);
    expect(mockNavigate).toHaveBeenCalledWith('/remitos/transportistas/t2/editar');
  });

  it('ADR-069: la primera columna usa .p-name (densidad estándar)', async () => {
    renderListado();
    const nombre = await screen.findByText('Transporte Rex');
    expect(nombre).toHaveClass('p-name');
  });
});
