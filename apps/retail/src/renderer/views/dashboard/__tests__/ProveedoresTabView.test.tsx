import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresTabView } from '../proveedores/ProveedoresTabView';
import type { DashboardProveedoresRango, DashboardProveedoresEstado } from '../../../../main/ipc/dashboard-proveedores';
import { calcPeriod } from '../hooks/usePeriod';

const RANGO: DashboardProveedoresRango = {
  ranking: [
    { proveedor_id: 'p1', razon_social: 'Distribuidora Central', gasto: 150000 },
    { proveedor_id: 'p2', razon_social: 'Mayorista Norte',       gasto: 80000 },
  ],
};

const ESTADO: DashboardProveedoresEstado = {
  ocs_pendientes: 3,
  ocs_sugeridas_sin_resolver: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    dashboard: {
      proveedoresRango:  vi.fn().mockResolvedValue(RANGO),
      proveedoresEstado: vi.fn().mockResolvedValue(ESTADO),
    },
  };
});

const period = calcPeriod('mes');

describe('ProveedoresTabView', () => {
  it('muestra KPIs de estado con leyenda "hoy"', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText(/hoy/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('muestra el valor de OCs pendientes', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1));
  });

  it('muestra el ranking de proveedores', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Distribuidora Central')).toBeInTheDocument();
      expect(screen.getByText('Mayorista Norte')).toBeInTheDocument();
    });
  });

  it('llama a proveedoresEstado una sola vez al montar', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect((window as any).ferreteria.dashboard.proveedoresEstado).toHaveBeenCalledTimes(1));
  });

  it('llama a proveedoresRango con el período del prop', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() =>
      expect((window as any).ferreteria.dashboard.proveedoresRango).toHaveBeenCalledWith({
        desde: period.desde, hasta: period.hasta,
      }),
    );
  });
});
