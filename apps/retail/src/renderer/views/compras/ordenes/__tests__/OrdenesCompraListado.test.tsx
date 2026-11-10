import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrdenesCompraListado } from '../OrdenesCompraListado';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});


let mockCan: (codigo: string) => boolean = () => true;
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: (c: string) => mockCan(c) }),
}));
const sinGestionarProveedores = (c: string) => c !== 'proveedor.gestionar';

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
  beforeEach(() => { setup(); mockCan = () => true; });
  afterEach(() => mockNavigate.mockClear());

  it('clic en la fila abre el detalle de la OC (ADR-069)', async () => {
    renderView();
    const filaCelda = await screen.findByText('Distribuidora SA');
    fireEvent.click(filaCelda.closest('tr')!);
    expect(mockNavigate).toHaveBeenCalledWith('/compras/ordenes/oc-1');
  });

  it('con permiso de gestionar proveedores ofrece OC sugerida y manual', async () => {
    renderView();
    await screen.findByText('Distribuidora SA');
    expect(screen.getByRole('button', { name: /oc sugerida/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nueva oc manual/i })).toBeInTheDocument();
  });

  it('sin ese permiso (Operador) lista las OC pero no ofrece crearlas', async () => {
    mockCan = sinGestionarProveedores;
    renderView();
    expect(await screen.findByText('Distribuidora SA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /oc sugerida/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nueva oc manual/i })).not.toBeInTheDocument();
  });
});
