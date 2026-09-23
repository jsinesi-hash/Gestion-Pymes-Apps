import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientesListado } from '@core/ui';
import { __resetPersistentListState } from '@core/ui';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockList = vi.fn();

const CLIENTES = [
  { id: 'c1', tipo_documento: 'DNI', numero_documento: '20111', nombre: 'Ana', apellido: 'Gómez',
    condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: false, telefono: null, email: null, activo: true },
  { id: 'c2', tipo_documento: 'DNI', numero_documento: '20222', nombre: 'Juan', apellido: 'Pérez',
    condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: false, telefono: null, email: null, activo: true },
];

function renderListado() {
  return render(<MemoryRouter><ClientesListado /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPersistentListState();
  mockList.mockResolvedValue(CLIENTES);
  (globalThis as any).ferreteria = { cliente: { list: mockList } };
});

describe('ClientesListado — búsqueda unificada (ADR-081 SRCH-2/3)', () => {
  it('el SearchBox filtra la tabla', async () => {
    renderListado();
    await screen.findByText('Ana Gómez');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'juan' } });
    expect(screen.queryByText('Ana Gómez')).toBeNull();
    // La fila de Juan queda; su documento (no resaltado) lo confirma.
    expect(screen.getByText('20222')).toBeInTheDocument();
  });

  it('la búsqueda persiste al desmontar y remontar (volver de un detalle)', async () => {
    const { unmount } = renderListado();
    await screen.findByText('Ana Gómez');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'juan' } });
    unmount();

    renderListado();
    await screen.findByText('20222');
    expect((screen.getByLabelText('Buscar') as HTMLInputElement).value).toBe('juan');
    expect(screen.queryByText('Ana Gómez')).toBeNull();
  });
});
