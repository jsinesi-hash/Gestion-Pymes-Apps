import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientesTabView } from '../clientes/ClientesTabView';
import type { DashboardClientesRango, DashboardClientesEstado } from '../../../../main/ipc/dashboard-clientes';
import { calcPeriod } from '../hooks/usePeriod';

const RANGO: DashboardClientesRango = {
  ranking: [
    { cliente_id: 'c1', nombre_completo: 'Ferretería Norte', total_facturado: 50000, count_ventas: 5 },
    { cliente_id: 'c2', nombre_completo: 'Construcciones Sur', total_facturado: 30000, count_ventas: 3 },
  ],
  clientes_nuevos: 4,
};

const ESTADO: DashboardClientesEstado = {
  deuda_total: 150000,
  deuda_vencida: 50000,
  clientes_inactivos: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    dashboard: {
      clientesRango:  vi.fn().mockResolvedValue(RANGO),
      clientesEstado: vi.fn().mockResolvedValue(ESTADO),
    },
  };
});

const period = calcPeriod('mes');

describe('ClientesTabView', () => {
  it('muestra KPIs de estado con leyenda "hoy"', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText(/hoy/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('muestra deuda total formateada', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/deuda total/i)).toBeInTheDocument());
  });

  it('muestra ranking de clientes del período', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Ferretería Norte')).toBeInTheDocument();
      expect(screen.getByText('Construcciones Sur')).toBeInTheDocument();
    });
  });

  it('clientes nuevos muestra el valor del rango', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1));
  });

  it('llama a clientesEstado una sola vez al montar', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect((window as any).ferreteria.dashboard.clientesEstado).toHaveBeenCalledTimes(1));
  });

  it('llama a clientesRango con el período del prop', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() =>
      expect((window as any).ferreteria.dashboard.clientesRango).toHaveBeenCalledWith({
        desde: period.desde, hasta: period.hasta,
      }),
    );
  });
});
