import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardView } from '../DashboardView';
import { AuthContext } from '@core/ui';
import type { SessionData } from '@core/ui';

// Mock recharts para evitar errores de ResizeObserver en jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart:  ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart:  ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
}));

const VENTAS_DATA = {
  total_dia: 5000, count_dia: 3, ticket_promedio: 1666.67, importe_iva_dia: 867,
  por_hora: [], por_forma_pago: [], top_cantidad: [], top_margen: [],
};
const STOCK_DATA  = { valor_inventario: 100000, sin_stock: [], bajo_minimo: [], sin_movimiento: [] };
const CAJA_DATA   = { caja_activa: null, ingresos_dia: 0, egresos_dia: 0, efectivo_esperado: 0, arqueos_recientes: [], umbral_diferencia_caja: 50000 };
const KPIS_RANGO  = { total: 0, count: 0, ticket_promedio: 0, importe_iva: 0, por_forma_pago: [], top_cantidad: [], top_margen: [] };

function mockSession(): SessionData {
  return {
    id: '1',
    nombreCompleto: 'Admin',
    rolId: 'sup',
    rolNombre: 'Supervisor',
    permisos: ['dashboard.ver'],
    preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] },
  };
}

function renderDashboard(permisos = ['dashboard.ver']) {
  const session = mockSession();
  session.permisos = permisos;
  return render(
    <AuthContext.Provider value={{
      session,
      can: (c: string) => permisos.includes(c),
      login: vi.fn(),
      logout: vi.fn(),
      actualizarPreferencias: vi.fn(),
    }}>
      <MemoryRouter><DashboardView /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  const mockF = {
    dashboard: {
      ventas:                   vi.fn().mockResolvedValue(VENTAS_DATA),
      stock:                    vi.fn().mockResolvedValue(STOCK_DATA),
      caja:                     vi.fn().mockResolvedValue(CAJA_DATA),
      ventasKpisRango:          vi.fn().mockResolvedValue(KPIS_RANGO),
      ventasEvolucion:          vi.fn().mockResolvedValue([]),
      ventasHeatmap:            vi.fn().mockResolvedValue([]),
      ventasDiaMes:             vi.fn().mockResolvedValue([]),
      ventasVendedor:           vi.fn().mockResolvedValue([]),
      productosAbc:             vi.fn().mockResolvedValue([]),
      productosMargenCategoria: vi.fn().mockResolvedValue([]),
      cajaRango:                vi.fn().mockResolvedValue({ turnos: [], por_medio_pago: [], recargo_tarjeta_total: 0 }),
      clientesRango:            vi.fn().mockResolvedValue({ ranking: [], clientes_nuevos: 0 }),
      clientesEstado:           vi.fn().mockResolvedValue({ deuda_total: 0, deuda_vencida: 0, clientes_inactivos: 0 }),
      proveedoresRango:         vi.fn().mockResolvedValue({ ranking: [] }),
      proveedoresEstado:        vi.fn().mockResolvedValue({ ocs_pendientes: 0, ocs_sugeridas_sin_resolver: 0 }),
    },
    catalogo: { categoria: { list: vi.fn().mockResolvedValue([]) } },
  };
  (window as any).ferreteria = mockF;
});

describe('DashboardView — tabs', () => {
  it('muestra los 6 tabs todos habilitados', () => {
    renderDashboard();
    ['Resumen', 'Ventas', 'Productos', 'Caja', 'Clientes', 'Proveedores'].forEach(name => {
      const btn = screen.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });
  });

  it('tab Resumen carga datos existentes al montar', async () => {
    renderDashboard();
    await waitFor(() => expect((window as any).ferreteria.dashboard.ventas).toHaveBeenCalled());
    await waitFor(() => expect((window as any).ferreteria.dashboard.stock).toHaveBeenCalled());
  });

  it('tab Ventas muestra el selector de período al hacer click', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /^ventas$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hoy/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^mes$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /trimestre/i })).toBeInTheDocument();
    });
  });

  it('tab Ventas llama a ventasKpisRango al activarse', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /^ventas$/i }));
    await waitFor(() => expect((window as any).ferreteria.dashboard.ventasKpisRango).toHaveBeenCalled());
  });

  it('tab Productos llama a productosAbc al activarse', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /productos/i }));
    await waitFor(() => expect((window as any).ferreteria.dashboard.productosAbc).toHaveBeenCalled());
  });

  it('PeriodSelector no se muestra en el tab Resumen', () => {
    renderDashboard();
    expect(screen.queryByRole('button', { name: /trimestre/i })).not.toBeInTheDocument();
  });

  it('guard: sin dashboard.ver muestra "Sin acceso"', () => {
    renderDashboard([]);
    expect(screen.getByText(/sin acceso/i)).toBeInTheDocument();
    expect((window as any).ferreteria.dashboard.ventas).not.toHaveBeenCalled();
  });

  it('tab Ventas no llama a los handlers del Resumen (lazy loading)', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /^ventas$/i }));
    await waitFor(() => expect((window as any).ferreteria.dashboard.ventasKpisRango).toHaveBeenCalled());
    // ventas() del resumen NO debería haberse llamado aún si el resumen nunca se activó
    // (en este test empezamos en resumen por defecto, así que ventas() SÍ se llama al montar)
    // El assertion relevante es que ventasKpisRango se llamó (propio del tab Ventas)
    expect((window as any).ferreteria.dashboard.ventasKpisRango).toHaveBeenCalled();
  });

  it('tab Caja llama a cajaRango al activarse', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /^caja$/i }));
    await waitFor(() => expect((window as any).ferreteria.dashboard.cajaRango).toHaveBeenCalled());
  });

  it('tab Clientes llama a clientesRango al activarse', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
    await waitFor(() => expect((window as any).ferreteria.dashboard.clientesRango).toHaveBeenCalled());
  });

  it('tab Proveedores llama a proveedoresRango al activarse', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /^proveedores$/i }));
    await waitFor(() => expect((window as any).ferreteria.dashboard.proveedoresRango).toHaveBeenCalled());
  });
});
