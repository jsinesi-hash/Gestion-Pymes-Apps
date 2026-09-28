import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProduccionView } from './ProduccionView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const PRODUCCIONES_BASE = [
  { id: '1', numero: 'PR-C1-000001', articulo_id: '2', cantidad_producida: 5, costo_total_centavos: 12345, estado: 'confirmada', fecha: 1700000000, observaciones: null },
  { id: '2', numero: 'PR-C1-000002', articulo_id: '2', cantidad_producida: 3, costo_total_centavos: 6000, estado: 'anulada', fecha: 1700000100, observaciones: null },
];

const ARTICULOS_BASE = [
  { id: '1', nombre: 'Harina 000', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: true, stock_minimo: 5, costo_promedio_centavos: 100, activo: true, stock: 20 },
  { id: '2', nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false, stock_minimo: null, costo_promedio_centavos: 500, activo: true, stock: 10 },
];

const mockListProduccion = vi.fn();
const mockCrear = vi.fn().mockResolvedValue(undefined);
const mockAnular = vi.fn().mockResolvedValue(undefined);
const mockListArticulos = vi.fn();

vi.stubGlobal('elaborados', {
  produccion: {
    list: mockListProduccion,
    crear: mockCrear,
    anular: mockAnular,
  },
  recetaProduccion: {
    get: vi.fn(),
    set: vi.fn(),
  },
  articulo: {
    list: mockListArticulos,
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  movimientoArticulo: {
    list: vi.fn(),
    create: vi.fn(),
  },
});

function renderView() {
  return render(<MemoryRouter><ProduccionView /></MemoryRouter>);
}

describe('ProduccionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockListProduccion.mockResolvedValue(PRODUCCIONES_BASE.map((p) => ({ ...p })));
    mockListArticulos.mockResolvedValue(ARTICULOS_BASE.map((a) => ({ ...a })));
    mockCrear.mockResolvedValue(undefined);
    mockAnular.mockResolvedValue(undefined);
  });

  it('muestra el listado de producciones', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());
    expect(screen.getByText('PR-C1-000002')).toBeInTheDocument();
  });

  it('oculta "+ Nueva producción" cuando el usuario no tiene el permiso', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /nueva producción/i })).not.toBeInTheDocument();
  });

  it('no muestra el botón "Anular" en filas con estado anulada', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());

    const filaAnulada = screen.getByText('PR-C1-000002').closest('tr')!;
    expect(within(filaAnulada).queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();

    const filaConfirmada = screen.getByText('PR-C1-000001').closest('tr')!;
    expect(within(filaConfirmada).getByRole('button', { name: /anular/i })).toBeInTheDocument();
  });

  it('"+ Nueva producción" abre el modal y al enviar llama a produccion.crear con el payload correcto', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/sabor \/ elaborado/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/cantidad producida/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/observaciones/i), { target: { value: 'Lote de prueba' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar producción/i }));

    await waitFor(() => expect(mockCrear).toHaveBeenCalledWith({
      articulo_id: '2',
      cantidad_producida: 4,
      observaciones: 'Lote de prueba',
    }));
  });

  it('"Anular" abre el modal y al enviar llama a produccion.anular con las credenciales de supervisor', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());

    const filaConfirmada = screen.getByText('PR-C1-000001').closest('tr')!;
    fireEvent.click(within(filaConfirmada).getByRole('button', { name: /anular/i }));

    const dialogMotivo = screen.getByRole('dialog');
    fireEvent.change(within(dialogMotivo).getByLabelText(/motivo/i), { target: { value: 'Error de carga' } });
    fireEvent.click(within(dialogMotivo).getByRole('button', { name: /continuar/i }));

    const dialogAuth = screen.getByRole('dialog');
    fireEvent.change(within(dialogAuth).getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(within(dialogAuth).getByLabelText(/contraseña supervisor/i), { target: { value: 'secreta123' } });
    fireEvent.click(within(dialogAuth).getByRole('button', { name: /^autorizar$/i }));

    await waitFor(() => expect(mockAnular).toHaveBeenCalledWith({
      id: '1',
      motivo: 'Error de carga',
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'secreta123' },
    }));
  });

  it('cancelar en el paso de credenciales de "Anular" vuelve al paso motivo preservando el valor', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());

    const filaConfirmada = screen.getByText('PR-C1-000001').closest('tr')!;
    fireEvent.click(within(filaConfirmada).getByRole('button', { name: /anular/i }));

    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Error de carga' } });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByLabelText(/usuario supervisor/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(mockAnular).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/motivo/i)).toHaveValue('Error de carga');
    expect(screen.queryByLabelText(/usuario supervisor/i)).not.toBeInTheDocument();
  });
});
