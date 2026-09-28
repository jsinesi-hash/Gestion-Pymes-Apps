import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OcSugeridaView } from './OcSugeridaView';

const sugerencia = {
  grupos: [{
    proveedor_id: 'prov1',
    razon_social: 'Proveedor Uno',
    items: [{
      producto_id: 'p1', nombre_corto: 'Tornillo', cantidad_sugerida_uv: 10,
      costo_centavos: 5000, codigo_proveedor: 'C1', stock_minimo: 20, stock_fisico: 5,
      unidad_compra: 'caja',
    }],
  }],
  sin_proveedor: [{
    producto_id: 'p2', nombre_corto: 'Clavo', cantidad_sugerida_uv: 100,
    stock_minimo: 50, stock_fisico: 0, unidad_compra: 'kg',
  }],
};

function makeFerreteria(overrides: Record<string, any> = {}) {
  return {
    compras: {
      oc: {
        sugerir: vi.fn().mockResolvedValue(sugerencia),
        crear: vi.fn().mockResolvedValue({ id: 'oc1' }),
        agregarItem: vi.fn().mockResolvedValue({}),
      },
      proveedor: { list: vi.fn().mockResolvedValue([{ id: 'prov2', razon_social: 'Proveedor Dos' }]) },
      pp: { upsert: vi.fn().mockResolvedValue({ id: 'pp1' }), setPreferido: vi.fn().mockResolvedValue({}) },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = makeFerreteria();
});

function renderView() {
  return render(<MemoryRouter><OcSugeridaView /></MemoryRouter>);
}

describe('OcSugeridaView — feedback de error (antes fallaba en silencio)', () => {
  it('muestra el error traducido cuando falla la creación de la OC', async () => {
    (window as any).ferreteria.compras.oc.crear = vi.fn().mockRejectedValue(new Error('PROVEEDOR_INACTIVO'));
    renderView();
    await waitFor(() => expect(screen.getByText('Proveedor Uno')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /crear oc y editar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('PROVEEDOR_INACTIVO'));
    // el botón vuelve a estar disponible, no queda colgado en "Creando..."
    expect(screen.getByRole('button', { name: /crear oc y editar/i })).toBeEnabled();
  });

  it('muestra el error traducido cuando falla la asignación de proveedor', async () => {
    (window as any).ferreteria.compras.pp.upsert = vi.fn().mockRejectedValue(new Error('COSTO_INVALIDO'));
    renderView();
    await waitFor(() => expect(screen.getByText('Clavo')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Clavo'));
    await waitFor(() => expect(screen.getByLabelText('Proveedor')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'prov2' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('COSTO_INVALIDO'));
  });
});
