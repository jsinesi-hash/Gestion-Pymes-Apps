import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrdenCompraDetalle } from '../OrdenCompraDetalle';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'oc1' }) };
});

const OC_BASE = {
  id: 'oc1',
  numero_interno: 'OC-C1-000001',
  proveedor_id: 'prov1',
  razon_social: 'Distribuidora SA',
  tipo: 'manual',
  estado: 'borrador',
  fecha: Date.now(),
  subtotal_centavos: 0,
  importe_iva_centavos: 0,
  total_centavos: 0,
  observaciones: null,
  items: [],
};

function setup() {
  (globalThis as any).ferreteria = {
    compras: {
      oc: {
        get: vi.fn().mockResolvedValue(OC_BASE),
      },
    },
    catalogo: {
      producto: {
        list: vi.fn().mockResolvedValue({ items: [] }),
        quickCreate: vi.fn().mockResolvedValue({ id: 'np', sku: 'P-0000001-1', nombre_corto: 'Nuevo' }),
      },
    },
  };
}

function renderView() {
  return render(<MemoryRouter><OrdenCompraDetalle /></MemoryRouter>);
}

describe('OrdenCompraDetalle — alta express de producto (PROD-3)', () => {
  beforeEach(() => setup());

  it('permite crear un producto nuevo desde "Agregar ítem" y lo deja seleccionado', async () => {
    renderView();

    fireEvent.click(await screen.findByText(/agregar ítem/i));
    fireEvent.click(await screen.findByRole('button', { name: /nuevo producto/i }));

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Nuevo' } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear producto$/i }));

    await waitFor(() => expect((globalThis as any).ferreteria.catalogo.producto.quickCreate).toHaveBeenCalled());

    const select = await screen.findByLabelText('Producto') as HTMLSelectElement;
    await waitFor(() => expect(screen.getByRole('option', { name: /nuevo/i })).toBeInTheDocument());
    expect(select.value).toBe('np');
  });
});

describe('OrdenCompraDetalle — validación de payload al agregar ítem (ADR-085/SEC-2)', () => {
  beforeEach(() => setup());

  it('rutea el error de validación del backend al campo costo unitario', async () => {
    (globalThis as any).ferreteria.catalogo.producto.list.mockResolvedValue({
      items: [{ id: 'p1', nombre_corto: 'Tornillo', sku: 'P-0000001-1' }],
    });
    (globalThis as any).ferreteria.compras.oc.agregarItem = vi.fn()
      .mockRejectedValue(new Error('VALIDATION:costo_unitario_centavos:NEGATIVO'));
    renderView();

    fireEvent.click(await screen.findByText(/agregar ítem/i));
    const select = await screen.findByLabelText('Producto') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar$/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('add_costo_unitario_centavos')));
    expect(await screen.findByText(/no puede ser negativo/i)).toBeInTheDocument();
  });
});
