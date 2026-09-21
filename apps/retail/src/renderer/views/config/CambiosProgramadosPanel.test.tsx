import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CambiosProgramadosPanel } from './CambiosProgramadosPanel';

// ADR-085 (SEC-2): cancelarCambioProgramado ahora pasa por useCallIpc — verifica que un
// error de validación del backend caiga en el mensaje general (no hay campo ruteable acá,
// el panel solo cancela por id), que el camino feliz muestre el toast de éxito, y que la
// carrera del compare-and-swap (ya aplicado) NO muestre el toast de éxito — sólo pasó la
// promesa sin rechazar, no significa que se haya cancelado.

const mockToastSuccess = vi.fn();
vi.mock('../../components/toast/useToast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: vi.fn(), info: vi.fn() }),
}));

const ROWS = [
  { id: 'cp1', lista_precio_id: 'l1', fecha_aplicacion: new Date().toISOString(),
    base_calculo: 'precio_lista', porcentaje: 10, alcance: 'catalogo', alcance_id: null, estado: 'pendiente' },
];

const mockListar = vi.fn();
const mockCancelar = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockListar.mockResolvedValue(ROWS);
  (globalThis as any).ferreteria = {
    precios: { cambioProgramado: { listar: mockListar, cancelar: mockCancelar } },
  };
});

describe('CambiosProgramadosPanel — cancelar (ADR-085)', () => {
  it('cancelar exitoso no muestra error y dispara el toast de éxito', async () => {
    mockCancelar.mockResolvedValue({ cancelado: true });
    render(<CambiosProgramadosPanel listaId="l1" />);
    await waitFor(() => expect(screen.getByText('pendiente')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(mockCancelar).toHaveBeenCalledWith('cp1'));
    expect(screen.queryByText(/no se pudo/i)).not.toBeInTheDocument();
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Cambio cancelado'));
  });

  it('un error de validación del backend cae en el mensaje general y NO muestra el toast de éxito', async () => {
    mockCancelar.mockRejectedValue(new Error('VALIDATION:id:REQUERIDO'));
    render(<CambiosProgramadosPanel listaId="l1" />);
    await waitFor(() => expect(screen.getByText('pendiente')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(await screen.findByText(/obligatorio/i)).toBeInTheDocument();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('race condition: ya aplicado, revierte, avisa y NO muestra el toast de éxito', async () => {
    mockCancelar.mockResolvedValue({ cancelado: false });
    render(<CambiosProgramadosPanel listaId="l1" />);
    await waitFor(() => expect(screen.getByText('pendiente')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(await screen.findByText(/el cambio ya fue aplicado/i)).toBeInTheDocument();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
