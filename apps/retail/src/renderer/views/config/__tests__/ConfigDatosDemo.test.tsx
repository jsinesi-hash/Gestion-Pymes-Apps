import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigDatosDemo } from '../ConfigDatosDemo';

const mockEstado = vi.fn();
const mockCargar = vi.fn();
const mockVaciar = vi.fn();

const VACIO = { totalProductos: 0, productosDemo: 0, hayProductos: false, hayDemo: false };
const CON_DEMO = { totalProductos: 15, productosDemo: 15, hayProductos: true, hayDemo: true };

function setupFerreteria() {
  (window as any).ferreteria = {
    demoCatalog: { estado: mockEstado, cargar: mockCargar, vaciar: mockVaciar },
  };
}

function renderView() {
  return render(<MemoryRouter><ConfigDatosDemo /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEstado.mockResolvedValue(VACIO);
  mockCargar.mockResolvedValue({ sembrados: 15, yaHabiaProductos: false, estado: CON_DEMO });
  mockVaciar.mockResolvedValue({ eliminados: 15, estado: VACIO });
  setupFerreteria();
});

describe('ConfigDatosDemo', () => {
  it('renderiza encabezado y ambos botones', async () => {
    renderView();
    expect(screen.getByText('Datos demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar catálogo demo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vaciar catálogo demo' })).toBeInTheDocument();
  });

  it('con catálogo vacío: habilita Cargar y deshabilita Vaciar', async () => {
    renderView();
    await waitFor(() => expect(screen.getByTestId('demo-estado')).toHaveTextContent('vacío'));
    expect(screen.getByRole('button', { name: 'Cargar catálogo demo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vaciar catálogo demo' })).toBeDisabled();
  });

  it('cargar llama al backend y muestra confirmación', async () => {
    renderView();
    await waitFor(() => expect(mockEstado).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cargar catálogo demo' }));
    await waitFor(() => {
      expect(mockCargar).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status')).toHaveTextContent('Se cargaron 15 productos demo.');
    });
    // tras cargar, el estado pasa a "con demo": Vaciar se habilita, Cargar se deshabilita
    expect(screen.getByRole('button', { name: 'Vaciar catálogo demo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cargar catálogo demo' })).toBeDisabled();
  });

  it('con productos existentes deshabilita Cargar', async () => {
    mockEstado.mockResolvedValue(CON_DEMO);
    renderView();
    await waitFor(() => expect(screen.getByTestId('demo-estado')).toHaveTextContent('demo'));
    expect(screen.getByRole('button', { name: 'Cargar catálogo demo' })).toBeDisabled();
  });

  it('vaciar pide confirmación y llama al backend', async () => {
    mockEstado.mockResolvedValue(CON_DEMO);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderView();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vaciar catálogo demo' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Vaciar catálogo demo' }));
    await waitFor(() => {
      expect(mockVaciar).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status')).toHaveTextContent('Se eliminaron 15 productos demo.');
    });
    confirmSpy.mockRestore();
  });

  it('vaciar cancelado no llama al backend', async () => {
    mockEstado.mockResolvedValue(CON_DEMO);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderView();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vaciar catálogo demo' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Vaciar catálogo demo' }));
    expect(mockVaciar).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
