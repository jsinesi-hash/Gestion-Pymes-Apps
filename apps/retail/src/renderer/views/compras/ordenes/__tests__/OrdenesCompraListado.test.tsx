import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrdenesCompraListado } from '../OrdenesCompraListado';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: () => true }),
}));

const OCS = [
  {
    id: 'oc-1',
    numero_interno: 'OC-C1-000001',
    razon_social: 'Distribuidora SA',
    tipo: 'manual',
    estado: 'emitida',
    fecha: '2026-08-01',
    total_centavos: 150000,
  },
];

function setup() {
  (globalThis as any).ferreteria = {
    compras: {
      oc: {
        list: vi.fn().mockResolvedValue(OCS),
      },
    },
  };
}

function renderView() {
  return render(<MemoryRouter><OrdenesCompraListado /></MemoryRouter>);
}

describe('OrdenesCompraListado', () => {
  beforeEach(() => setup());
  afterEach(() => mockNavigate.mockClear());

  it('clic en la fila abre el detalle de la OC (ADR-069)', async () => {
    renderView();
    const filaCelda = await screen.findByText('Distribuidora SA');
    fireEvent.click(filaCelda.closest('tr')!);
    expect(mockNavigate).toHaveBeenCalledWith('/compras/ordenes/oc-1');
  });
});
