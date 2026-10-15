import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigDatosDemo } from './ConfigDatosDemo';

const VACIO = { hayCatalogo: false, hayDemo: false, articulosDemo: 0, productosDemo: 0, enUso: [] as string[] };
const CON_DEMO = { hayCatalogo: true, hayDemo: true, articulosDemo: 28, productosDemo: 8, enUso: [] as string[] };

describe('ConfigDatosDemo', () => {
  let estado: ReturnType<typeof vi.fn>;
  let seedHeladeria: ReturnType<typeof vi.fn>;
  let vaciar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    estado = vi.fn().mockResolvedValue(VACIO);
    seedHeladeria = vi.fn();
    vaciar = vi.fn();
    vi.stubGlobal('elaborados', { demoCatalog: { estado, seedHeladeria, vaciar } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('catálogo vacío: Cargar habilitado, Vaciar deshabilitado', async () => {
    render(<ConfigDatosDemo />);
    expect(await screen.findByRole('button', { name: 'Cargar catálogo demo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vaciar datos demo' })).toBeDisabled();
  });

  it('cargar siembra, refresca el estado y avisa', async () => {
    seedHeladeria.mockResolvedValue({ cargado: true, yaHabiaCatalogo: false, estado: CON_DEMO });
    render(<ConfigDatosDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar catálogo demo' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/cargó/i);
    expect(screen.getByRole('button', { name: 'Cargar catálogo demo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vaciar datos demo' })).toBeEnabled();
    expect(screen.getByText(/28 artículos/)).toBeInTheDocument();
  });

  it('con un catálogo propio no deja cargar y lo explica', async () => {
    estado.mockResolvedValue({ ...VACIO, hayCatalogo: true });
    render(<ConfigDatosDemo />);
    expect(await screen.findByRole('button', { name: 'Cargar catálogo demo' })).toBeDisabled();
    expect(screen.getByText(/solo se carga sobre un catálogo vacío/i)).toBeInTheDocument();
  });

  it('vaciar pide confirmación antes de borrar', async () => {
    estado.mockResolvedValue(CON_DEMO);
    vaciar.mockResolvedValue({ eliminados: 36, estado: VACIO });
    render(<ConfigDatosDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vaciar datos demo' }));
    expect(vaciar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vaciado' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/36/);
    expect(vaciar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Vaciar datos demo' })).toBeDisabled();
  });

  it('cancelar la confirmación no borra', async () => {
    estado.mockResolvedValue(CON_DEMO);
    render(<ConfigDatosDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vaciar datos demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(vaciar).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirmar vaciado' })).toBeNull();
  });

  it('DEMO_EN_USO se muestra traducido en un alert', async () => {
    estado.mockResolvedValue({ ...CON_DEMO, enUso: ['ventas'] });
    vaciar.mockRejectedValue(new Error('DEMO_EN_USO:ventas'));
    render(<ConfigDatosDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vaciar datos demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vaciado' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/ventas/);
    expect(alerta).not.toHaveTextContent('DEMO_EN_USO');
  });

  it('si no se puede leer el estado muestra el error', async () => {
    estado.mockRejectedValue(new Error('FORBIDDEN'));
    render(<ConfigDatosDemo />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
