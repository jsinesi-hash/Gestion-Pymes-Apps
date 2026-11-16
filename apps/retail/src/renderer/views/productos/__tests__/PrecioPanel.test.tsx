import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthContext } from '@core/ui';
import { PrecioPanel } from '../PrecioPanel';

const mockListListas   = vi.fn();
const mockListVigentes = vi.fn();
const mockSetManual    = vi.fn();

const LISTA_A = { id: 'l1', nombre: 'General',   ajuste_porcentual: 0,   predeterminada: true  };
const LISTA_B = { id: 'l2', nombre: 'Mayorista',  ajuste_porcentual: -10, predeterminada: false };

function buildAuth(isSupervisor: boolean) {
  return {
    session: { id: 'u1', nombreCompleto: 'X', rolId: 'r1', rolNombre: '', permisos: [], preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] } },
    can: (codigo: string) => isSupervisor && codigo === 'precio.gestionar',
    login: async () => {},
    logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

function renderPanel(isSupervisor = true, productoId = 'p1', precioVentaLista = 1000) {
  return render(
    <AuthContext.Provider value={buildAuth(isSupervisor)}>
      <PrecioPanel productoId={productoId} precioVentaLista={precioVentaLista} />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListListas.mockResolvedValue([LISTA_A, LISTA_B]);
  mockListVigentes.mockResolvedValue([]);
  mockSetManual.mockResolvedValue({});
  (window as any).ferreteria = {
    precios: {
      lista:  { list: mockListListas },
      valor:  { listarVigentesParaProducto: mockListVigentes, setManual: mockSetManual },
    },
  };
});

describe('PrecioPanel', () => {
  it('muestra todas las listas activas', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());
    expect(screen.getByText('Mayorista')).toBeInTheDocument();
  });

  it('muestra precio fallback calculado cuando no hay vigente', async () => {
    // sin vigentes → fallback: General 0% → $1000.00; Mayorista -10% → $900.00
    renderPanel(true, 'p1', 1000);
    await waitFor(() => expect(screen.getByText('Mayorista')).toBeInTheDocument());
    expect(screen.getByTestId('precio-l1')).toHaveTextContent('1.000');
    expect(screen.getByTestId('precio-l2')).toHaveTextContent('900');
    // debe mostrar badge de fallback
    const badges = screen.getAllByText(/Sin confirmar/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('muestra precio vigente cuando existe', async () => {
    mockListVigentes.mockResolvedValue([
      { lista_id: 'l1', precio_centavos: 120000, fecha_desde: '2024-01-01', origen: 'manual', precio_promocion_centavos: null },
    ]);
    renderPanel(true, 'p1', 1000);
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());
    // debe mostrar $1.200,00 (120000 centavos)
    expect(screen.getByTestId('precio-l1')).toHaveTextContent('1.200');
    // no debe mostrar badge de fallback para l1
    // l2 sigue sin vigente → fallback
    expect(screen.getByTestId('precio-l2')).toHaveTextContent('900');
  });

  it('muestra precio de promo tachando el vigente', async () => {
    mockListVigentes.mockResolvedValue([
      { lista_id: 'l1', precio_centavos: 100000, precio_promocion_centavos: 80000, promo_hasta: '2025-12-31', fecha_desde: '2024-01-01', origen: 'manual' },
    ]);
    renderPanel(true, 'p1', 1000);
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());
    // precio promo en verde
    expect(screen.getByText('$800,00')).toBeInTheDocument();
    // precio tachado
    expect(screen.getByText('$1.000,00')).toBeInTheDocument();
    // texto de promo hasta
    expect(screen.getByText(/En promo hasta/i)).toBeInTheDocument();
  });

  it('Supervisor ve botones de editar', async () => {
    renderPanel(true);
    await waitFor(() => expect(screen.getByText('Mayorista')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /editar/i }).length).toBeGreaterThan(0);
  });

  it('Operador no ve controles de escritura', async () => {
    renderPanel(false);
    await waitFor(() => expect(screen.getByText('Mayorista')).toBeInTheDocument());
    expect(screen.queryAllByRole('button', { name: /editar/i })).toHaveLength(0);
  });

  it('edición manual: al confirmar se llama setManual con precioCentavos correcto', async () => {
    mockListVigentes.mockResolvedValue([
      { lista_id: 'l1', precio_centavos: 100000, fecha_desde: '2024-01-01', origen: 'manual', precio_promocion_centavos: null },
    ]);
    renderPanel(true);
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());

    // Click en botón editar de la primera lista (General)
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);

    // Hay un input de precio — cambiamos el valor
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(mockSetManual).toHaveBeenCalledOnce());
    expect(mockSetManual).toHaveBeenCalledWith(expect.objectContaining({
      listaId: 'l1',
      productoId: 'p1',
      precioCentavos: 150000,
    }));
  });
});
