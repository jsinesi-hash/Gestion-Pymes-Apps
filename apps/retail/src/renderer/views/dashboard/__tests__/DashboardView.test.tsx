import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardView } from '../DashboardView';
import { AuthContext, type SessionData } from '@core/ui';

const mockVentas = vi.fn();
const mockStock  = vi.fn();
const mockCaja   = vi.fn();

const VENTAS_DATA = {
  total_dia_centavos: 500000, count_dia: 3, ticket_promedio_centavos: 166667, importe_iva_dia_centavos: 86777,
  por_hora: [{ hora: 10, total_centavos: 500000 }],
  por_forma_pago: [{ forma_pago: 'efectivo', total_centavos: 500000, count: 3 }],
  top_cantidad: [], top_margen: [],
};
const STOCK_DATA = { valor_inventario: 100000, sin_stock: [], bajo_minimo: [], sin_movimiento: [] };
const CAJA_DATA  = {
  caja_activa: { id: 'c1', fecha_apertura: new Date(), monto_inicial_centavos: 100000 },
  ingresos_dia_centavos: 500000, egresos_dia_centavos: 20000, efectivo_esperado_centavos: 580000,
  arqueos_recientes: [], umbral_diferencia_caja_centavos: 5000000,
};

function mockSession(permisos: string[]): SessionData {
  return {
    id: '1', nombreCompleto: 'Admin', rolId: 'sup', rolNombre: '',
    permisos,
    preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] },
  };
}

function renderDashboard(permisos: string[] = ['dashboard.ver']) {
  const session = mockSession(permisos);
  return render(
    <AuthContext.Provider value={{ session, can: (c) => permisos.includes(c), login: vi.fn(), logout: vi.fn(), actualizarPreferencias: vi.fn() }}>
      <MemoryRouter><DashboardView /></MemoryRouter>
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVentas.mockResolvedValue(VENTAS_DATA);
  mockStock.mockResolvedValue(STOCK_DATA);
  mockCaja.mockResolvedValue(CAJA_DATA);
  (window as any).ferreteria = { dashboard: { ventas: mockVentas, stock: mockStock, caja: mockCaja } };
});

describe('DashboardView', () => {
  it('muestra loading mientras cargan los paneles', () => {
    mockVentas.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getAllByText(/cargando/i).length).toBeGreaterThan(0);
  });

  it('si stock falla, ventas y caja se renderizan igualmente', async () => {
    mockStock.mockRejectedValue(new Error('DB error'));
    renderDashboard();
    await waitFor(() => expect(mockVentas).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText(/5[\.,]000/).length).toBeGreaterThan(0));
  });

  it('guard: sin dashboard.ver muestra "Sin acceso"', () => {
    renderDashboard([]);
    expect(screen.getByText(/sin acceso/i)).toBeInTheDocument();
    expect(mockVentas).not.toHaveBeenCalled();
  });
});

const STOCK_CON_ALERTAS = {
  valor_inventario: 100000,
  sin_stock:   [{ producto_id: 'p1', sku: 'SKU-001', nombre_corto: 'Tornillo M6', stock_fisico: 0, stock_minimo: 10, dias_hasta_agotar: null }],
  bajo_minimo: [{ producto_id: 'p2', sku: 'SKU-002', nombre_corto: 'Pintura Blanca', stock_fisico: 3, stock_minimo: 10, dias_hasta_agotar: 5 }],
  sin_movimiento: [],
};

describe('StockPanel — expansión de alertas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVentas.mockResolvedValue(VENTAS_DATA);
    mockStock.mockResolvedValue(STOCK_CON_ALERTAS);
    mockCaja.mockResolvedValue(CAJA_DATA);
    (window as any).ferreteria = { dashboard: { ventas: mockVentas, stock: mockStock, caja: mockCaja } };
  });

  it('click en alerta expande la lista de productos', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('alert-sin-stock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('alert-sin-stock'));
    expect(screen.getByText('Tornillo M6')).toBeInTheDocument();
  });

  it('click en segunda alerta cierra la primera', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('alert-sin-stock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('alert-sin-stock'));
    expect(screen.getByText('Tornillo M6')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('alert-bajo-minimo'));
    expect(screen.queryByText('Tornillo M6')).not.toBeInTheDocument();
    expect(screen.getByText('Pintura Blanca')).toBeInTheDocument();
  });
});

const CAJA_SIN_ACTIVA = {
  caja_activa: null, ingresos_dia_centavos: 0, egresos_dia_centavos: 0, efectivo_esperado_centavos: 0,
  arqueos_recientes: [], umbral_diferencia_caja_centavos: 5000000,
};
const CAJA_CON_ARQUEO = {
  caja_activa: { id: 'c1', fecha_apertura: new Date(), monto_inicial_centavos: 100000 },
  ingresos_dia_centavos: 500000, egresos_dia_centavos: 20000, efectivo_esperado_centavos: 580000,
  arqueos_recientes: [
    { caja_id: 'c0', usuario_nombre: 'Ana García', fecha_cierre: new Date(), diferencia_centavos: 50000, posterior_al_cierre: false },
    { caja_id: 'c9', usuario_nombre: 'Caja compartida', fecha_cierre: new Date(), diferencia_centavos: 0, posterior_al_cierre: true },
  ],
  umbral_diferencia_caja_centavos: 5000000,
};

describe('CajaPanel', () => {
  it('sin caja activa muestra "Sin caja abierta"', async () => {
    vi.clearAllMocks();
    mockVentas.mockResolvedValue(VENTAS_DATA);
    mockStock.mockResolvedValue(STOCK_DATA);
    mockCaja.mockResolvedValue(CAJA_SIN_ACTIVA);
    (window as any).ferreteria = { dashboard: { ventas: mockVentas, stock: mockStock, caja: mockCaja } };
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/sin caja abierta/i)).toBeInTheDocument());
  });

  it('arqueo con diferencia > 0 muestra badge warn (data-testid)', async () => {
    vi.clearAllMocks();
    mockVentas.mockResolvedValue(VENTAS_DATA);
    mockStock.mockResolvedValue(STOCK_DATA);
    mockCaja.mockResolvedValue(CAJA_CON_ARQUEO);
    (window as any).ferreteria = { dashboard: { ventas: mockVentas, stock: mockStock, caja: mockCaja } };
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Ana García')).toBeInTheDocument());
    const badge = screen.getByTestId('arqueo-diferencia-c0');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('500');
    // F3 PR5: solo el turno con movimientos posteriores al cierre lleva la marca.
    expect(screen.queryByTestId('arqueo-tardio-c0')).toBeNull();
    expect(screen.getByTestId('arqueo-tardio-c9')).toHaveAttribute('title', expect.stringMatching(/después del cierre/));
  });
});
