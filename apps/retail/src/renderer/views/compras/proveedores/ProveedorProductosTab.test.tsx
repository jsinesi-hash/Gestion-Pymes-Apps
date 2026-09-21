import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProveedorProductosTab } from './ProveedorProductosTab';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});
afterEach(() => mockNavigate.mockClear());

const mockListar = vi.fn();
const mockProductoList = vi.fn();
const mockGetParam = vi.fn();
const mockActualizar = vi.fn();

// bruto $10.000, bonif default 10% => neto $9.000
const VINCULO = {
  id: 'pp-1',
  producto_id: 'p1',
  nombre_corto: 'Amoladora',
  sku: 'P-0001042-7',
  costo_centavos: 1000000,
  codigo_proveedor: 'BSH-7700',
  preferido: true,
  bonificacion_pct: null,
  costo_financiero_pct: null,
  flete_pct: null,
  flete_centavos: null,
  otros_costos_centavos: null,
  bonificacion_pct_default: 10,
  costo_financiero_pct_default: 0,
  flete_pct_default: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListar.mockResolvedValue([VINCULO]);
  mockProductoList.mockResolvedValue({ items: [] });
  mockGetParam.mockResolvedValue('true');
  mockActualizar.mockResolvedValue({ id: 'pp-1' });
  (window as any).ferreteria = {
    parametros: { get: mockGetParam },
    catalogo: {
      producto: { list: mockProductoList },
      // ADR-084: la pantalla de alta masiva (montada al tocar "+ Agregar productos") pide marcas/categorías.
      marca: { list: vi.fn().mockResolvedValue([]) },
      categoria: { list: vi.fn().mockResolvedValue([]) },
    },
    compras: { proveedor: { productos: { listar: mockListar, actualizar: mockActualizar } } },
  };
});

describe('ProveedorProductosTab — costo neto efectivo (ADR-049, flag ON)', () => {
  it('muestra la columna Costo neto con el valor efectivo del proveedor', async () => {
    render(<ProveedorProductosTab proveedorId="prov-1" />);
    expect(await screen.findByText('Costo neto')).toBeInTheDocument();
    // bruto 10.000 con bonif heredada 10% => neto 9.000
    expect(await screen.findByText(/9\.000,00/)).toBeInTheDocument();
  });
});

describe('ProveedorProductosTab — flag OFF no muestra costo neto', () => {
  it('sin flag no aparece la columna Costo neto', async () => {
    mockGetParam.mockResolvedValue('false');
    render(<ProveedorProductosTab proveedorId="prov-1" />);
    await screen.findByText('Amoladora');
    expect(screen.queryByText('Costo neto')).not.toBeInTheDocument();
  });
});

describe('ProveedorProductosTab — fila navegable al detalle del producto (ADR-069)', () => {
  it('ADR-069: clic en la fila del vínculo abre el detalle del producto', async () => {
    render(<ProveedorProductosTab proveedorId="prov-1" />);
    const sku = await screen.findByText('P-0001042-7');
    fireEvent.click(sku.closest('tr')!);
    expect(mockNavigate).toHaveBeenCalledWith('/productos/p1');
  });

  it('ADR-069: clic en una acción por-fila no navega', async () => {
    render(<ProveedorProductosTab proveedorId="prov-1" />);
    await screen.findByText('P-0001042-7');
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(mockNavigate).not.toHaveBeenCalledWith('/productos/p1');
  });
});

describe('ProveedorProductosTab — ADR-085 (SEC-2) ruteo del error de validación del backend', () => {
  it('rutea VALIDATION:costo_centavos al input de costo de la fila en edición', async () => {
    mockActualizar.mockRejectedValue(new Error('VALIDATION:costo_centavos:NEGATIVO'));
    render(<ProveedorProductosTab proveedorId="prov-1" />);
    await screen.findByText('P-0001042-7');
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('pp_tab_edit_costo')));
  });
});

describe('ProveedorProductosTab — alta masiva como pantalla (ADR-084)', () => {
  it('"+ Agregar productos" reemplaza la lista por la pantalla de carga, y Volver regresa', async () => {
    render(<ProveedorProductosTab proveedorId="prov-1" />);
    // Lista visible (el vínculo sembrado).
    await screen.findByText('Amoladora');
    fireEvent.click(screen.getByRole('button', { name: /agregar productos/i }));
    // Ahora se ve la pantalla de carga (título + Volver) y ya no el vínculo de la lista.
    expect(await screen.findByRole('heading', { name: /agregar productos al proveedor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
    expect(screen.queryByText('P-0001042-7')).not.toBeInTheDocument();
    // Volver restaura la lista.
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(await screen.findByText('Amoladora')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /agregar productos al proveedor/i })).not.toBeInTheDocument();
  });
});
