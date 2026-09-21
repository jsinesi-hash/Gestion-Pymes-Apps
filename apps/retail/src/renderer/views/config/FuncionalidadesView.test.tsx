import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/toast/ToastProvider';
import { FuncionalidadesView } from './FuncionalidadesView';

const mockListFlags = vi.fn();
const mockSet = vi.fn();

const FLAGS = [
  { clave: 'hub_precios_habilitado', valor: 'true', descripcion: 'Hub Precios/Costos' },
  { clave: 'sinonimos_habilitado', valor: 'false', descripcion: 'Sinónimos' },
];

function setup() {
  (globalThis as any).ferreteria = {
    parametros: { listFlags: mockListFlags, set: mockSet },
  };
}

const renderView = () => render(
  <ToastProvider>
    <MemoryRouter>
      <FuncionalidadesView />
    </MemoryRouter>
  </ToastProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  mockListFlags.mockResolvedValue(FLAGS);
  mockSet.mockResolvedValue(undefined);
  setup();
});

describe('FuncionalidadesView', () => {
  it('renderiza una fila por flag con su descripción y el estado reflejando `valor`', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Hub Precios/Costos')).toBeInTheDocument());
    expect(screen.getByText('Sinónimos')).toBeInTheDocument();

    const onCheckbox = screen.getByLabelText('Hub Precios/Costos') as HTMLInputElement;
    const offCheckbox = screen.getByLabelText('Sinónimos') as HTMLInputElement;
    expect(onCheckbox.checked).toBe(true);
    expect(offCheckbox.checked).toBe(false);
  });

  it('al apagar un flag encendido llama a parametros.set con valor "false"', async () => {
    renderView();
    const onCheckbox = await screen.findByLabelText('Hub Precios/Costos');
    fireEvent.click(onCheckbox);
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith({ clave: 'hub_precios_habilitado', valor: 'false' }));
  });

  it('al prender un flag apagado llama a parametros.set con valor "true"', async () => {
    renderView();
    const offCheckbox = await screen.findByLabelText('Sinónimos');
    fireEvent.click(offCheckbox);
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith({ clave: 'sinonimos_habilitado', valor: 'true' }));
  });
});
