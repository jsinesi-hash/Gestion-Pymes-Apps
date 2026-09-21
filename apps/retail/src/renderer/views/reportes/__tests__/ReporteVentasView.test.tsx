import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type SessionData } from '../../../context/AuthContext';
import { ReporteVentasView, fmtFecha } from '../ReporteVentasView';

const SESSION: SessionData = {
  id: 'u1',
  nombreCompleto: 'Admin',
  rolId: 'r1',
  rolNombre: 'Supervisor',
  permisos: ['dashboard.ver', 'export.supervisor'],
  preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] },
};

const mockDetalleVentas = vi.fn();
const mockClienteList = vi.fn();
const mockCategoriaList = vi.fn();
const mockUsuarioList = vi.fn();
const mockProductoList = vi.fn();

function setup(can?: (p: string) => boolean) {
  (window as any).ferreteria = {
    reportes: { detalleVentas: mockDetalleVentas },
    cliente:  { list: mockClienteList },
    catalogo: {
      categoria: { list: mockCategoriaList },
      producto:  { list: mockProductoList },
    },
    usuario:  { list: mockUsuarioList },
    exportar: { ejecutar: vi.fn() },
  };
  const mockCan = can ?? ((p: string) => SESSION.permisos.includes(p));
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ session: SESSION, can: mockCan, login: vi.fn(), logout: vi.fn(), actualizarPreferencias: vi.fn() }}>
        <ReporteVentasView />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

const emptyResult = { rows: [], total: 0, totalImporte: 0, page: 1, totalPages: 1 };
const oneVenta = {
  rows: [{
    id: 'v1', numero_interno: 'V-C1-000001', fecha: Math.floor(Date.now() / 1000),
    cliente_nombre_completo: 'Constructora ABC', vendedor_nombre: 'María G.',
    medios_pago: 'efectivo', subtotal: 1000, importe_iva: 174.38, total: 1000,
  }],
  total: 1, totalImporte: 1000, page: 1, totalPages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClienteList.mockResolvedValue([]);
  mockCategoriaList.mockResolvedValue([]);
  mockUsuarioList.mockResolvedValue([]);
  mockProductoList.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
  mockDetalleVentas.mockResolvedValue(emptyResult);
});

describe('ReporteVentasView', () => {
  it('carga automáticamente las ventas del día al montar', async () => {
    setup();
    await waitFor(() => expect(mockDetalleVentas).toHaveBeenCalled());
    const [filtros] = mockDetalleVentas.mock.calls[0];
    expect(filtros.fechaDesde).toBeInstanceOf(Date);
    expect(filtros.fechaHasta).toBeInstanceOf(Date);
    expect(screen.getByText(/sin ventas/i)).toBeInTheDocument();
  });

  it('sin permiso dashboard.ver muestra mensaje de acceso denegado', () => {
    setup(() => false);
    expect(screen.getByText(/sin acceso/i)).toBeInTheDocument();
    expect(mockDetalleVentas).not.toHaveBeenCalled();
  });

  it('click en Buscar llama al IPC con filtros y muestra resultados', async () => {
    mockDetalleVentas.mockResolvedValue(oneVenta);
    setup();
    await waitFor(() => expect(mockDetalleVentas).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => expect(screen.getByText('V-C1-000001')).toBeInTheDocument());
    expect(screen.getByText('Constructora ABC')).toBeInTheDocument();
    expect(screen.getByText(/1 venta/i)).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay resultados', async () => {
    setup();
    await waitFor(() => expect(mockDetalleVentas).toHaveBeenCalled());
    expect(screen.getByText(/sin ventas/i)).toBeInTheDocument();
  });

  it('click en Limpiar re-busca con los filtros del día', async () => {
    setup();
    await waitFor(() => expect(mockDetalleVentas).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));

    await waitFor(() => expect(mockDetalleVentas).toHaveBeenCalledTimes(2));
    const [filtros] = mockDetalleVentas.mock.calls[1];
    expect(filtros.fechaDesde).toBeInstanceOf(Date);
    expect(filtros.sortCol).toBe('fecha');
    expect(filtros.sortDir).toBe('desc');
  });

  it('click en número de venta abre VentaDetalleModal', async () => {
    mockDetalleVentas.mockResolvedValue(oneVenta);
    setup();
    const mockVentaGet = vi.fn().mockResolvedValue({
      venta: { ...oneVenta.rows[0], estado: 'confirmada', forma_pago: 'efectivo',
        descuento_global: 0, ajuste_redondeo: 0, importe_iva: 0 },
      detalles: [], comprobante: null, cliente: { nombre_completo: 'Constructora ABC' },
    });
    (window as any).ferreteria.venta = { get: mockVentaGet, anular: vi.fn() };

    await waitFor(() => expect(screen.getByText('V-C1-000001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'V-C1-000001' }));
    await waitFor(() => expect(mockVentaGet).toHaveBeenCalledWith({ id: 'v1' }));
  });

  it('ADR-069: fmtFecha usa 24h (sin AM/PM)', () => {
    const ts = Math.floor(new Date(2026, 0, 2, 13, 5, 0).getTime() / 1000); // 13:05 local
    expect(fmtFecha(ts)).toMatch(/13:05/);
    expect(fmtFecha(ts)).not.toMatch(/a\.?\s?m|p\.?\s?m|AM|PM/i);
  });

  it('ADR-069: clic en la fila abre el detalle de la venta', async () => {
    mockDetalleVentas.mockResolvedValue(oneVenta);
    setup();
    const mockVentaGet = vi.fn().mockResolvedValue({
      venta: { ...oneVenta.rows[0], estado: 'confirmada', forma_pago: 'efectivo',
        descuento_global: 0, ajuste_redondeo: 0, importe_iva: 0 },
      detalles: [], comprobante: null, cliente: { nombre_completo: 'Constructora ABC' },
    });
    (window as any).ferreteria.venta = { get: mockVentaGet, anular: vi.fn() };

    const nro = await screen.findByText('V-C1-000001');
    fireEvent.click(nro.closest('tr')!);
    await waitFor(() => expect(mockVentaGet).toHaveBeenCalledWith({ id: 'v1' }));
  });

  it('paginación: botón Siguiente llama al IPC con page+1', async () => {
    const page1 = { rows: [oneVenta.rows[0]], total: 3, totalImporte: 3000, page: 1, totalPages: 3 };
    const page2 = { rows: [{ ...oneVenta.rows[0], id: 'v2', numero_interno: 'V-C1-000002' }], total: 3, totalImporte: 3000, page: 2, totalPages: 3 };
    mockDetalleVentas.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    setup();

    await waitFor(() => expect(screen.getByText('V-C1-000001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByText('V-C1-000002')).toBeInTheDocument());
    expect(mockDetalleVentas).toHaveBeenLastCalledWith(expect.anything(), 2, 100);
  });
});
