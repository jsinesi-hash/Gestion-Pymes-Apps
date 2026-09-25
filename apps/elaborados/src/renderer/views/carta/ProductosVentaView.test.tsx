import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosVentaView } from './ProductosVentaView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const PRODUCTOS_BASE = [
  { id: 'p1', nombre: 'Cucurucho simple', categoria_venta_id: 'c1', precio_centavos: 150000, impuesto_id: 'i1', activo: true },
];
const CATEGORIAS_BASE = [{ id: 'c1', nombre: 'Helados', orden: 1, activo: true }];
const ARTICULOS_BASE = [
  { id: 'a1', nombre: 'Vaso descartable', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: false, stock_minimo: null, costo_promedio_centavos: 0, activo: true, stock: 100 },
];
const GRUPOS_BASE = [{ id: 'g1', nombre: 'Sabores' }];
const IMPUESTOS_BASE = [{ id: 'i1', nombre: 'IVA 21%', tipo: 'iva', alicuota: 21, predeterminado: true, activo: true }];

const mockProductoList = vi.fn();
const mockProductoCreate = vi.fn().mockResolvedValue(undefined);
const mockCategoriaList = vi.fn();
const mockArticuloList = vi.fn();
const mockGrupoList = vi.fn();
const mockImpuestoList = vi.fn();

vi.stubGlobal('elaborados', {
  productoVenta: {
    list: mockProductoList,
    get: vi.fn(),
    create: mockProductoCreate,
  },
  categoriaVenta: {
    list: mockCategoriaList,
    create: vi.fn(),
  },
  articulo: {
    list: mockArticuloList,
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  grupoModificador: {
    list: mockGrupoList,
    get: vi.fn(),
    create: vi.fn(),
    opcionSet: vi.fn(),
  },
  impuesto: {
    list: mockImpuestoList,
  },
});

function renderView() {
  return render(<MemoryRouter><ProductosVentaView /></MemoryRouter>);
}

describe('ProductosVentaView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockProductoList.mockResolvedValue(PRODUCTOS_BASE.map((p) => ({ ...p })));
    mockCategoriaList.mockResolvedValue(CATEGORIAS_BASE.map((c) => ({ ...c })));
    mockArticuloList.mockResolvedValue(ARTICULOS_BASE.map((a) => ({ ...a })));
    mockGrupoList.mockResolvedValue(GRUPOS_BASE.map((g) => ({ ...g })));
    mockImpuestoList.mockResolvedValue(IMPUESTOS_BASE.map((i) => ({ ...i })));
    mockProductoCreate.mockResolvedValue(undefined);
  });

  it('muestra los productos de venta cargados con su categoría y precio', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Cucurucho simple')).toBeInTheDocument());
    expect(screen.getByText('Helados')).toBeInTheDocument();
    expect(screen.getByText('$1500.00')).toBeInTheDocument();
  });

  it('oculta "+ Nuevo producto" cuando el usuario no tiene el permiso producto_venta.gestionar', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await waitFor(() => expect(screen.getByText('Cucurucho simple')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /nuevo producto/i })).not.toBeInTheDocument();
  });

  it('al enviar el formulario llama a productoVenta.create con el payload correcto (sin modificadores)', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Cucurucho simple')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nuevo producto/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Cucurucho doble' } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockProductoCreate).toHaveBeenCalledWith({
      nombre: 'Cucurucho doble',
      categoria_venta_id: 'c1',
      precio_centavos: 250000,
      impuesto_id: 'i1',
      componentes: [{ articulo_id: 'a1', cantidad: 1 }],
      grupos: [],
    }));
  });

  it('muestra el mensaje traducido y no cierra el modal cuando la creación falla', async () => {
    mockProductoCreate.mockRejectedValueOnce(new Error('ALGO_INESPERADO'));
    renderView();
    await waitFor(() => expect(screen.getByText('Cucurucho simple')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nuevo producto/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Cucurucho doble' } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo completar la operación/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
