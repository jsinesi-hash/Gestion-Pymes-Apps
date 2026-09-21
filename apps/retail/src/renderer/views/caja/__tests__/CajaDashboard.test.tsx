import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CajaDashboard } from '../CajaDashboard';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ can: mockCan }),
}));

vi.mock('../../../components/export/ExportarButton', () => ({
  ExportarButton: () => null,
}));

const mockCaja = {
  id: 'caja-1',
  usuario_id: 'u-1',
  fecha_apertura: new Date('2026-07-14T08:00:00'),
  monto_inicial: 0,
  estado: 'abierta' as const, observaciones: null,
};

const ventaMock = {
  id: 'v-1',
  numero_interno: 'V-C1-000001',
  fecha: new Date('2026-07-14T09:42:00'),
  total: 4850,
  estado: 'confirmada',
  forma_pago: 'efectivo',
  cliente_nombre: 'Consumidor Final',
};

const mockVentaGet = vi.fn().mockResolvedValue({
  venta: { ...ventaMock, descuento_global: 0, ajuste_redondeo: 0 },
  detalles: [{ id: 'd-1', descripcion: 'Tornillo', cantidad: 1, precio_unitario: 4850, subtotal: 4850 }],
  comprobante: { tipo: 'ticket_interno' },
  cliente: { nombre_completo: 'Consumidor Final' },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  vi.stubGlobal('ferreteria', {
    venta: { listByCaja: vi.fn().mockResolvedValue([ventaMock]), get: mockVentaGet },
    caja: { listMovimientos: vi.fn().mockResolvedValue([]) },
    catalogo: { print: { html: vi.fn() } },
  });
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <CajaDashboard caja={mockCaja} onRefetch={vi.fn()} />
    </MemoryRouter>
  );
}

describe('CajaDashboard — número de venta como link', () => {
  it('el numero_interno es un botón clickeable', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
  });

  it('click en numero_interno abre VentaDetalleModal', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    fireEvent.click(screen.getByRole('button', { name: 'V-C1-000001' }));
    await waitFor(() => expect(mockVentaGet).toHaveBeenCalledWith({ id: 'v-1' }));
    await waitFor(() => expect(screen.getByText('Detalle de venta')).toBeInTheDocument());
  });

  it('ADR-069: clic en la fila de la venta abre el detalle', async () => {
    renderDashboard();
    const numero = await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    fireEvent.click(numero.closest('tr')!);
    await waitFor(() => expect(mockVentaGet).toHaveBeenCalledWith({ id: 'v-1' }));
    await waitFor(() => expect(screen.getByText('Detalle de venta')).toBeInTheDocument());
  });

  it('no muestra botón Anular en la fila de venta', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    expect(screen.queryByTitle('Anular')).not.toBeInTheDocument();
  });
});

describe('CajaDashboard — columnas Cliente y Forma de pago', () => {
  it('muestra las columnas Cliente y Forma de pago en el encabezado', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    expect(screen.getByRole('columnheader', { name: 'Cliente' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Forma de pago' })).toBeInTheDocument();
  });

  it('muestra el nombre del cliente y la forma de pago de la venta', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    expect(screen.getByText('Consumidor Final')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
  });

  it('muestra la forma de pago "Cuenta corriente" con etiqueta legible', async () => {
    vi.stubGlobal('ferreteria', {
      venta: {
        listByCaja: vi.fn().mockResolvedValue([{ ...ventaMock, forma_pago: 'cuenta_corriente' }]),
        get: mockVentaGet,
      },
      caja: { listMovimientos: vi.fn().mockResolvedValue([]) },
      catalogo: { print: { html: vi.fn() } },
    });
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    expect(screen.getByText('Cuenta corriente')).toBeInTheDocument();
  });
});
