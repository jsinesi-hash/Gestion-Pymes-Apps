import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CtaCteListado } from './CtaCteListado';
import { __resetPersistentListState } from '@core/ui';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockList = vi.fn();

const ROWS = [
  { id: 'cc1', cliente_id: 'c1', saldo_centavos: 5000, limite_credito_centavos: 0,
    nombre_completo: 'Ana Gómez', tipo_documento: 'DNI', numero_documento: '20111' },
  { id: 'cc2', cliente_id: 'c2', saldo_centavos: -2000, limite_credito_centavos: 0,
    nombre_completo: 'Juan Pérez', tipo_documento: 'DNI', numero_documento: '20222' },
];

function renderListado() {
  return render(<MemoryRouter><CtaCteListado /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPersistentListState();
  mockList.mockResolvedValue(ROWS);
  (globalThis as any).ferreteria = { ctacte: { list: mockList } };
});

describe('CtaCteListado — búsqueda unificada (ADR-081 SRCH-2/3)', () => {
  it('el SearchBox filtra por cliente', async () => {
    renderListado();
    await screen.findByText('Ana Gómez');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'juan' } });
    expect(screen.queryByText('Ana Gómez')).toBeNull();
    expect(screen.getByText('20222')).toBeInTheDocument();
  });

  it('la búsqueda persiste al desmontar y remontar', async () => {
    const { unmount } = renderListado();
    await screen.findByText('Ana Gómez');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'juan' } });
    unmount();

    renderListado();
    await screen.findByText('20222');
    expect((screen.getByLabelText('Buscar') as HTMLInputElement).value).toBe('juan');
  });
});
