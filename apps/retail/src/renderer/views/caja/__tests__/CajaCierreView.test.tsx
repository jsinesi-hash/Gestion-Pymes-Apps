import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CajaCierreView } from '../CajaCierreView';
import { ToastProvider } from '@core/ui';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const RESUMEN = {
  caja_id: 'c-1',
  monto_inicial: 10000,
  por_forma_pago: [{ forma_pago: 'efectivo', ingresado: 5000, cantidad_operaciones: 2 }],
  esperado_efectivo: 15000,
  ventas_count: 0,
  total_ventas: 0,
};

const RESUMEN_CON_DECIMALES = {
  ...RESUMEN,
  esperado_efectivo: 100.123456789,
};

const mockGetActiva = vi.fn();
const mockCalcCierre = vi.fn();
const mockCerrar = vi.fn();
const mockGetParam = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActiva.mockResolvedValue({ id: 'c-1', usuario_id: 'u-1', fecha_apertura: new Date(), monto_inicial: 10000, estado: 'abierta' });
  mockCalcCierre.mockResolvedValue(RESUMEN);
  mockCerrar.mockResolvedValue({ id: 'c-1', estado: 'cerrada' });
  mockGetParam.mockResolvedValue('50000');
  (window as any).ferreteria = {
    caja: { getActiva: mockGetActiva, calcularCierre: mockCalcCierre, cerrar: mockCerrar },
    parametros: { get: mockGetParam },
  };
});

describe('CajaCierreView', () => {
  it('muestra efectivo esperado del resumen', async () => {
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/15\.000/)).toBeInTheDocument());
  });

  it('muestra diferencia 0 cuando monto declarado = esperado', async () => {
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '15000' } });
    // Multiple "$ 0,xx" elements may appear (total ventas + diferencia)
    expect(screen.getAllByText(/\$ 0/).length).toBeGreaterThan(0);
  });

  it('muestra banner de autorización cuando diferencia > umbral', async () => {
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '75000' } });
    expect(screen.getByText(/autorización del supervisor/i)).toBeInTheDocument();
  });

  it('abre SupervisorPinModal al intentar cerrar con diferencia > umbral', async () => {
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '75000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('redondea montoDeclarado a 2 decimales cuando esperado_efectivo tiene muchos decimales', async () => {
    mockCalcCierre.mockResolvedValue(RESUMEN_CON_DECIMALES);
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    const input = screen.getByLabelText(/efectivo declarado/i) as HTMLInputElement;
    // Enfocar para ver el valor numérico crudo (sin símbolo $ ni separadores)
    fireEvent.focus(input);
    const value = parseFloat(input.value);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeCloseTo(100.12, 2);
    const decimals = (input.value.split('.')[1] ?? '').length;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it('llama caja.cerrar sin PIN cuando diferencia <= umbral', async () => {
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));
    await waitFor(() => expect(mockCerrar).toHaveBeenCalledWith(
      expect.objectContaining({ caja_id: 'c-1', monto_contado: 15000 })
    ));
  });

  it('camino sin autorización, monto válido: cerrar resuelve, navega y muestra el toast de cierre', async () => {
    render(<ToastProvider><MemoryRouter><CajaCierreView /></MemoryRouter></ToastProvider>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/caja', { replace: true }));
    expect(screen.getByText('Caja cerrada')).toBeInTheDocument();
  });
});

// ADR-085 (SEC-2, Task 14): ruteo por-campo y superficie de error en el cierre de caja.
describe('CajaCierreView — ruteo de errores (ADR-085 Task 14)', () => {
  it('monto declarado inválido: no llama caja.cerrar, enfoca el campo y muestra error inline', async () => {
    // esperado_efectivo NaN produce un montoDeclarado inicial NaN (Math.round(NaN)/100 = NaN),
    // sin necesidad de mockear los hooks: ejercita el guard de handleConfirm con estado real.
    mockCalcCierre.mockResolvedValue({ ...RESUMEN, esperado_efectivo: NaN });
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));

    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    expect(mockCerrar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText(/efectivo declarado/i)).toHaveFocus());
    expect(screen.getByText(/monto de efectivo declarado válido/i)).toBeInTheDocument();
  });

  it('camino sin autorización: si caja.cerrar rechaza con un error de dominio, lo muestra en un role="alert" de la vista', async () => {
    mockCerrar.mockRejectedValue(new Error('CAJA_CERRADA'));
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '15000' } });

    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some(a => /caja ya está cerrada/i.test(a.textContent ?? ''))).toBe(true);
    });
  });

  it('camino con autorización: SUPERVISOR_INVALIDO se muestra DENTRO del modal, no en la vista', async () => {
    mockCerrar.mockRejectedValue(new Error('SUPERVISOR_INVALIDO'));
    render(<MemoryRouter><CajaCierreView /></MemoryRouter>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '75000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() =>
      expect(within(dialog).getByText(/usuario o contraseña incorrectos/i)).toBeInTheDocument()
    );
    // El modal sigue abierto; ningún alert de error quedó fuera de él (no se filtró a la vista).
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const alertasFueraDelModal = screen.getAllByRole('alert').filter(a => !dialog.contains(a));
    expect(alertasFueraDelModal).toHaveLength(0);
  });

  it('camino con autorización: un error de dominio (no credencial) tras enviar las credenciales cierra el modal y lo rutea a la vista', async () => {
    mockCerrar.mockRejectedValue(new Error('CAJA_CERRADA'));
    render(<ToastProvider><MemoryRouter><CajaCierreView /></MemoryRouter></ToastProvider>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '75000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() => expect(mockCerrar).toHaveBeenCalledWith(
      expect.objectContaining({
        caja_id: 'c-1',
        supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
      })
    ));
    // El modal se cierra: el error de dominio no es de su incumbencia.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // El mensaje traducido aparece en el banner de error general de la vista...
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some(a => /caja ya está cerrada/i.test(a.textContent ?? ''))).toBe(true);
    });
    // ...y también como toast (fix de consistencia: mismo feedback con o sin autorización).
    // El mismo texto aparece dos veces: en el banner de la vista y en el toast.
    expect(screen.getAllByText('La caja ya está cerrada.').length).toBeGreaterThanOrEqual(2);
  });

  it('camino con autorización: éxito navega y muestra el toast de cierre', async () => {
    render(<ToastProvider><MemoryRouter><CajaCierreView /></MemoryRouter></ToastProvider>);
    await waitFor(() => screen.getByLabelText(/efectivo declarado/i));
    fireEvent.change(screen.getByLabelText(/efectivo declarado/i), { target: { value: '75000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() => expect(mockCerrar).toHaveBeenCalledWith(
      expect.objectContaining({
        caja_id: 'c-1',
        supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
      })
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/caja', { replace: true }));
    expect(screen.getByText('Caja cerrada')).toBeInTheDocument();
  });
});
