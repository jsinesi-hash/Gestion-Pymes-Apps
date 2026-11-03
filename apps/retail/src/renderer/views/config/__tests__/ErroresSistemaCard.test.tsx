import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ErroresSistemaCard } from '@core/ui';

// ADR-140: tarjeta de «Backup y restauración» con los errores de los jobs programados y los errores
// no capturados del proceso, que antes solo iban al log. Solo la ve un Supervisor (el main exige
// el permiso de backup).
const mockListar = vi.fn();
const mockLimpiar = vi.fn();

const ERRORES = [
  { id: 'e2', fecha: new Date('2026-11-03T15:30:00').getTime(), origen: 'main:uncaughtException', mensaje: 'caída inesperada', detalle: 'Error: caída inesperada\n    at x (y.ts:1:1)' },
  { id: 'e1', fecha: new Date('2026-11-03T10:00:00').getTime(), origen: 'tarea:avisos-reintentos', mensaje: 'SMTP caído', detalle: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListar.mockResolvedValue(ERRORES);
  mockLimpiar.mockResolvedValue({ ok: true });
  (window as any).ferreteria = { sistema: { erroresListar: mockListar, erroresLimpiar: mockLimpiar } };
});
afterEach(() => { delete (window as any).ferreteria; });

describe('ErroresSistemaCard', () => {
  it('lista los errores con un nombre legible del origen', async () => {
    render(<ErroresSistemaCard />);
    expect(await screen.findByText('caída inesperada')).toBeInTheDocument();
    expect(screen.getByText('SMTP caído')).toBeInTheDocument();
    expect(screen.getByText('Error inesperado')).toBeInTheDocument();
    expect(screen.getByText('Avisos (reintentos)')).toBeInTheDocument();
  });

  it('un origen desconocido se muestra tal cual', async () => {
    mockListar.mockResolvedValue([{ id: 'x', fecha: Date.now(), origen: 'tarea:nueva-cosa', mensaje: 'm', detalle: null }]);
    render(<ErroresSistemaCard />);
    expect(await screen.findByText('tarea:nueva-cosa')).toBeInTheDocument();
  });

  it('sin errores muestra el estado vacío y no ofrece limpiar', async () => {
    mockListar.mockResolvedValue([]);
    render(<ErroresSistemaCard />);
    expect(await screen.findByText(/sin errores registrados/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar registro' })).toBeDisabled();
  });

  it('mientras carga lo avisa', () => {
    mockListar.mockReturnValue(new Promise(() => {}));
    render(<ErroresSistemaCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('el detalle (stack) se muestra y se oculta a pedido; si no hay, no hay botón', async () => {
    render(<ErroresSistemaCard />);
    await screen.findByText('caída inesperada');
    const botones = screen.getAllByRole('button', { name: /ver detalle/i });
    expect(botones).toHaveLength(1);
    expect(screen.queryByText(/at x \(y\.ts/)).not.toBeInTheDocument();
    fireEvent.click(botones[0]!);
    expect(screen.getByText(/at x \(y\.ts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ocultar detalle/i }));
    expect(screen.queryByText(/at x \(y\.ts/)).not.toBeInTheDocument();
  });

  it('Actualizar vuelve a pedir la lista', async () => {
    render(<ErroresSistemaCard />);
    await screen.findByText('caída inesperada');
    mockListar.mockResolvedValue([ERRORES[1]]);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(screen.queryByText('caída inesperada')).not.toBeInTheDocument());
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it('Limpiar registro vacía la lista tras confirmar', async () => {
    render(<ErroresSistemaCard />);
    await screen.findByText('caída inesperada');
    mockListar.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar registro' }));
    // Pide confirmación antes de borrar: es irreversible.
    expect(mockLimpiar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, limpiar' }));
    await waitFor(() => expect(mockLimpiar).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/sin errores registrados/i)).toBeInTheDocument();
  });

  it('cancelar la confirmación no borra nada', async () => {
    render(<ErroresSistemaCard />);
    await screen.findByText('caída inesperada');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar registro' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(mockLimpiar).not.toHaveBeenCalled();
    expect(screen.getByText('caída inesperada')).toBeInTheDocument();
  });

  it('si el main rechaza la consulta (p. ej. sin permiso) muestra el error traducido', async () => {
    mockListar.mockRejectedValue(new Error('FORBIDDEN'));
    render(<ErroresSistemaCard />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('si falla limpiar muestra el error y conserva la lista', async () => {
    mockLimpiar.mockRejectedValue(new Error('FORBIDDEN'));
    render(<ErroresSistemaCard />);
    await screen.findByText('caída inesperada');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar registro' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, limpiar' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('caída inesperada')).toBeInTheDocument();
  });

  it('con un main anterior, sin el canal, no muestra errores ni rompe', async () => {
    (window as any).ferreteria = {};
    render(<ErroresSistemaCard />);
    expect(await screen.findByText(/sin errores registrados/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el título explica de dónde salen los errores', async () => {
    render(<ErroresSistemaCard />);
    await screen.findByText('caída inesperada');
    const tarjeta = screen.getByText('Errores del sistema').closest('.card') as HTMLElement;
    expect(within(tarjeta).getByText(/tareas en segundo plano/i)).toBeInTheDocument();
  });
});
