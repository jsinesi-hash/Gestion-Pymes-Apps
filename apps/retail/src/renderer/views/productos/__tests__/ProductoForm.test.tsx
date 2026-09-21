import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProductoForm } from '../ProductoForm';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'new-id' });
  mockUpdate.mockResolvedValue({ id: 'edit-id' });
  mockGet.mockResolvedValue(null);
  (window as any).ferreteria = {
    catalogo: {
      producto: { create: mockCreate, update: mockUpdate, get: mockGet },
      categoria: { list: vi.fn().mockResolvedValue([{ id: 'c1', nombre: 'Herramientas' }]) },
      marca: { list: vi.fn().mockResolvedValue([]) },
      impuesto: { list: vi.fn().mockResolvedValue([{ id: 'i1', nombre: 'IVA 21%' }]) },
      ubicacion: { list: vi.fn().mockResolvedValue([]) },
    },
    unidad: { list: vi.fn().mockResolvedValue([{ id: 'u1', nombre: 'Unidad', abreviatura: 'unidad' }]) },
  };
});

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/productos/nuevo']}>
      <Routes>
        <Route path="/productos/nuevo" element={<ProductoForm />} />
        <Route path="/productos/:id" element={<div>Detalle</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEdit(id = 'edit-id') {
  return render(
    <MemoryRouter initialEntries={[`/productos/${id}/editar`]}>
      <Routes>
        <Route path="/productos/:id/editar" element={<ProductoForm />} />
        <Route path="/productos/:id" element={<div>Detalle</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProductoForm', () => {
  it('modo nuevo: muestra titulo y campo nombre vacio', async () => {
    renderNew();
    await waitFor(() => expect(screen.getByTestId('nombre_corto')).toBeInTheDocument());
    expect(screen.getByText('Nuevo producto')).toBeInTheDocument();
    expect(screen.getByTestId('nombre_corto')).toHaveValue('');
  });

  it('validacion: errores al enviar sin datos requeridos', async () => {
    renderNew();
    await waitFor(() => screen.getByTestId('nombre_corto'));
    fireEvent.submit(screen.getByTestId('producto-form'));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('modo edicion: titulo dice Editar producto', async () => {
    mockGet.mockResolvedValue({
      id: 'edit-id', nombre_corto: 'Taladro', categoria_id: 'c1',
      impuesto_id: 'i1', unidad_venta: 'unidad', precio_venta_lista: 1500, activo: true,
    });
    renderEdit();
    await waitFor(() => expect(screen.getByText('Editar producto')).toBeInTheDocument());
  });

  it('modo edicion: pre-llena nombre_corto', async () => {
    mockGet.mockResolvedValue({
      id: 'edit-id', nombre_corto: 'Taladro', categoria_id: 'c1',
      impuesto_id: 'i1', unidad_venta: 'unidad', precio_venta_lista: 1500, activo: true,
    });
    renderEdit();
    await waitFor(() => expect(screen.getByTestId('nombre_corto')).toHaveValue('Taladro'));
  });
});
