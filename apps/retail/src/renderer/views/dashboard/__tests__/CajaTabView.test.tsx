import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CajaTabView } from '../caja/CajaTabView';
import type { DashboardCajaRango } from '../../../../main/ipc/dashboard-caja-rango';
import { calcPeriod } from '../hooks/usePeriod';

vi.mock('recharts', () => ({
  BarChart:            ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar:                 () => null,
  XAxis:               () => null,
  YAxis:               () => null,
  Tooltip:             () => null,
  Legend:              () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

const DATA: DashboardCajaRango = {
  turnos: [
    { caja_id: 'c1', usuario_nombre: 'Ana', fecha_apertura: new Date(), ingresos: 5000, egresos: 1000 },
  ],
  por_medio_pago: [
    { medio_pago: 'efectivo',  monto_total: 3000, recargo_total: 0 },
    { medio_pago: 'tarjeta',   monto_total: 2000, recargo_total: 100 },
  ],
  recargo_tarjeta_total: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    dashboard: { cajaRango: vi.fn().mockResolvedValue(DATA) },
  };
});

const period = calcPeriod('hoy');

describe('CajaTabView', () => {
  it('muestra KPIs de ingresos, egresos y recargo tarjeta', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/ingresos/i)).toBeInTheDocument();
      expect(screen.getByText(/egresos/i)).toBeInTheDocument();
      expect(screen.getByText(/recargo/i)).toBeInTheDocument();
    });
  });

  it('renderiza el gráfico de barras', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('bar-chart')).toBeInTheDocument());
  });

  it('muestra tabla de medios de pago con efectivo y tarjeta', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/efectivo/i)).toBeInTheDocument();
      expect(screen.getByText(/tarjeta/i)).toBeInTheDocument();
    });
  });

  it('llama a cajaRango con el período del prop', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() =>
      expect((window as any).ferreteria.dashboard.cajaRango).toHaveBeenCalledWith({
        desde: period.desde, hasta: period.hasta,
      }),
    );
  });

  it('muestra estado de carga mientras espera', () => {
    (window as any).ferreteria.dashboard.cajaRango = vi.fn(() => new Promise(() => {}));
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
