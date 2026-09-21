import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProveedorAgregarProductosPanel } from './ProveedorAgregarProductosPanel';

const mockProductoList = vi.fn();
const mockMarcaList = vi.fn();
const mockCategoriaList = vi.fn();
const mockAsociarLote = vi.fn();

const PRODUCTOS = [
  { id: 'p1', sku: 'P-0000001-1', nombre_corto: 'Amoladora', categoria_id: 'c1', marca_id: 'm1' },
  { id: 'p2', sku: 'P-0000002-2', nombre_corto: 'Taladro',   categoria_id: 'c2', marca_id: 'm2' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockProductoList.mockResolvedValue({ items: PRODUCTOS });
  mockMarcaList.mockResolvedValue([{ id: 'm1', nombre: 'Bosch' }, { id: 'm2', nombre: 'Dewalt' }]);
  mockCategoriaList.mockResolvedValue([{ id: 'c1', nombre: 'Herramientas' }, { id: 'c2', nombre: 'Eléctrica' }]);
  mockAsociarLote.mockResolvedValue({ asociados: 1 });
  (globalThis as any).ferreteria = {
    catalogo: { producto: { list: mockProductoList }, marca: { list: mockMarcaList }, categoria: { list: mockCategoriaList } },
    compras: { proveedor: { productos: { asociarLote: mockAsociarLote } } },
  };
});

describe('ADR-084 — pantalla de alta masiva', () => {
  it('lista los productos con checkbox y marca los ya asociados como "ya cargado"', async () => {
    render(<ProveedorAgregarProductosPanel proveedorId="prov-1" asociadosIds={new Set(['p2'])} onClose={vi.fn()} />);
    expect(await screen.findByText('Amoladora')).toBeInTheDocument();
    expect(screen.getByText(/ya cargado/i)).toBeInTheDocument(); // p2
  });

  it('agrega los seleccionados con costo/código inline', async () => {
    const onClose = vi.fn();
    render(<ProveedorAgregarProductosPanel proveedorId="prov-1" asociadosIds={new Set()} onClose={onClose} />);
    fireEvent.click(await screen.findByLabelText(/seleccionar Amoladora/i));
    fireEvent.change(screen.getByLabelText(/costo de Amoladora/i), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar seleccionados/i }));
    await waitFor(() => expect(mockAsociarLote).toHaveBeenCalledWith({
      proveedor_id: 'prov-1',
      items: [{ producto_id: 'p1', costo_centavos: 9900, codigo_proveedor: undefined }],
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
  });

  it('el filtro de marca acota la lista', async () => {
    render(<ProveedorAgregarProductosPanel proveedorId="prov-1" asociadosIds={new Set()} onClose={vi.fn()} />);
    await screen.findByText('Amoladora');
    fireEvent.change(screen.getByLabelText(/filtrar por marca/i), { target: { value: 'm2' } });
    expect(screen.queryByText('Amoladora')).not.toBeInTheDocument();
    expect(screen.getByText('Taladro')).toBeInTheDocument();
  });

  it('desmarcar "Mostrar ya asociados" oculta los productos ya cargados', async () => {
    render(<ProveedorAgregarProductosPanel proveedorId="prov-1" asociadosIds={new Set(['p2'])} onClose={vi.fn()} />);
    await screen.findByText('Amoladora');
    expect(screen.getByText('Taladro')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/mostrar ya asociados/i));
    expect(screen.queryByText('Taladro')).not.toBeInTheDocument();
    expect(screen.getByText('Amoladora')).toBeInTheDocument();
  });

  it('agrega múltiples seleccionados con costo distinto por producto', async () => {
    const onClose = vi.fn();
    render(<ProveedorAgregarProductosPanel proveedorId="prov-1" asociadosIds={new Set()} onClose={onClose} />);
    fireEvent.click(await screen.findByLabelText(/seleccionar Amoladora/i));
    fireEvent.click(screen.getByLabelText(/seleccionar Taladro/i));
    fireEvent.change(screen.getByLabelText(/costo de Amoladora/i), { target: { value: '99' } });
    fireEvent.change(screen.getByLabelText(/costo de Taladro/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar seleccionados/i }));
    await waitFor(() => expect(mockAsociarLote).toHaveBeenCalledWith({
      proveedor_id: 'prov-1',
      items: [
        { producto_id: 'p1', costo_centavos: 9900, codigo_proveedor: undefined },
        { producto_id: 'p2', costo_centavos: 15000, codigo_proveedor: undefined },
      ],
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
  });

  it('el botón Volver cierra con onClose(false) sin asociar', async () => {
    const onClose = vi.fn();
    render(<ProveedorAgregarProductosPanel proveedorId="prov-1" asociadosIds={new Set()} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: /volver/i }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(mockAsociarLote).not.toHaveBeenCalled();
  });

  it('no se renderiza como modal (sin overlay que cierre al hacer click afuera)', async () => {
    const { container } = render(<ProveedorAgregarProductosPanel proveedorId="prov-1" asociadosIds={new Set()} onClose={vi.fn()} />);
    await screen.findByText('Amoladora');
    expect(container.querySelector('.modal-overlay')).toBeNull();
  });
});
