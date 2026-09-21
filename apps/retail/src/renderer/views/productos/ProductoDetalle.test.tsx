import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProductoDetalle } from './ProductoDetalle';

const mockGet = vi.fn();
const mockPrint = vi.fn();
const mockExistenciasGet = vi.fn();

function renderDetalle(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/productos/${id}`]}>
      <Routes>
        <Route path="/productos/:id" element={<ProductoDetalle />} />
      </Routes>
    </MemoryRouter>
  );
}

const BASE_PRODUCTO = {
  id: 'p1', sku: '00001', nombre_corto: 'Taladro', nombre_largo: 'Taladro percutor',
  gtin_barcode: null, precio_venta_lista: 5000,
  unidad_venta: 'unidad', descripcion_tecnica: null, activo: true,
  ubicacion_id: null, ubicacion_codigo: null,
  ubicacion_sector: null, ubicacion_estante: null, ubicacion_posicion: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(BASE_PRODUCTO);
  mockPrint.mockResolvedValue(undefined);
  mockExistenciasGet.mockResolvedValue({
    id: 'ex-1', producto_id: 'p1', stock_fisico: 0, stock_minimo: 0,
    stock_maximo: null, ultima_fecha_movimiento: null,
  });
  (window as any).ferreteria = {
    catalogo: {
      producto: { get: mockGet },
      print: { productLabel: mockPrint },
      existencias: { get: mockExistenciasGet },
      stock: {
        entrada: vi.fn(),
        ajuste: vi.fn(),
        merma: vi.fn(),
      },
    },
    precios: {
      lista:  { list: vi.fn().mockResolvedValue([]) },
      valor:  { listarVigentesParaProducto: vi.fn().mockResolvedValue([]) },
    },
    compras: {
      pp:        { listByProducto: vi.fn().mockResolvedValue([]) },
      proveedor: { list: vi.fn().mockResolvedValue([]) },
    },
  };
});

describe('ProductoDetalle — checklist "Para vender falta" (PROD-2, ADR-078)', () => {
  it('muestra la card cuando falta costo (precio_costo_promedio === 0), con stock cargado', async () => {
    mockGet.mockResolvedValue({ ...BASE_PRODUCTO, precio_costo_promedio: 0 });
    mockExistenciasGet.mockResolvedValue({
      id: 'ex-1', producto_id: 'p1', stock_fisico: 5, stock_minimo: 0,
      stock_maximo: null, ultima_fecha_movimiento: null,
    });
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Taladro percutor')).toBeInTheDocument());
    expect(screen.getByText('Para vender falta:')).toBeInTheDocument();
    expect(screen.getByText('Cargar costo')).toBeInTheDocument();
    expect(screen.queryByText('Cargar stock')).toBeNull();
  });

  it('muestra la card cuando falta stock (stockFisico === 0), con costo cargado', async () => {
    mockGet.mockResolvedValue({ ...BASE_PRODUCTO, precio_costo_promedio: 100 });
    mockExistenciasGet.mockResolvedValue({
      id: 'ex-1', producto_id: 'p1', stock_fisico: 0, stock_minimo: 0,
      stock_maximo: null, ultima_fecha_movimiento: null,
    });
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Taladro percutor')).toBeInTheDocument());
    expect(screen.getByText('Para vender falta:')).toBeInTheDocument();
    expect(screen.getByText('Cargar stock')).toBeInTheDocument();
    expect(screen.queryByText('Cargar costo')).toBeNull();
  });

  it('NO muestra la card cuando hay costo y stock cargados', async () => {
    mockGet.mockResolvedValue({ ...BASE_PRODUCTO, precio_costo_promedio: 100 });
    mockExistenciasGet.mockResolvedValue({
      id: 'ex-1', producto_id: 'p1', stock_fisico: 10, stock_minimo: 0,
      stock_maximo: null, ultima_fecha_movimiento: null,
    });
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Taladro percutor')).toBeInTheDocument());
    expect(screen.queryByText('Para vender falta:')).toBeNull();
  });

  it('muestra la card con ambos botones cuando faltan costo y stock', async () => {
    mockGet.mockResolvedValue({ ...BASE_PRODUCTO, precio_costo_promedio: 0 });
    mockExistenciasGet.mockResolvedValue({
      id: 'ex-1', producto_id: 'p1', stock_fisico: 0, stock_minimo: 0,
      stock_maximo: null, ultima_fecha_movimiento: null,
    });
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Taladro percutor')).toBeInTheDocument());
    expect(screen.getByText('Para vender falta:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar stock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar costo' })).toBeInTheDocument();
  });
});

describe('ProductoDetalle — bloque ubicación', () => {
  it('muestra "Sin ubicación asignada" cuando ubicacion_id es null', async () => {
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Taladro percutor')).toBeInTheDocument());
    expect(screen.getByText('Sin ubicación asignada')).toBeInTheDocument();
  });

  it('muestra codigo y datos de ubicacion cuando existe', async () => {
    mockGet.mockResolvedValue({
      ...BASE_PRODUCTO,
      ubicacion_id: 'u1',
      ubicacion_codigo: 'A-01-01',
      ubicacion_sector: 'A',
      ubicacion_estante: '01',
      ubicacion_posicion: '01',
    });
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Taladro percutor')).toBeInTheDocument());
    expect(screen.getByText('A-01-01')).toBeInTheDocument();
    expect(screen.getByText(/Sector A/)).toBeInTheDocument();
  });
});
