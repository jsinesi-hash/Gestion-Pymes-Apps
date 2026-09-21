import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EtiquetasView } from '../EtiquetasView';
import type { EtiquetaItem } from '@ferreteria/shared';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const ITEMS: EtiquetaItem[] = [
  { producto_id: 'p1', sku: 'SKU-0001', nombre: 'Tornillo', precio_venta_lista_centavos: 1500, gtin_barcode: '7790001234567' },
  { producto_id: 'p2', sku: 'SKU-0002', nombre: 'Clavo',    precio_venta_lista_centavos: 500,  gtin_barcode: null },
];

function setup() {
  const mock = {
    etiquetas: {
      listarProductos: vi.fn().mockResolvedValue(ITEMS),
      generarPdf:      vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      imprimir:        vi.fn().mockResolvedValue(undefined),
      exportarPdf:     vi.fn().mockResolvedValue({ guardado: true, ruta: '/tmp/etiquetas.pdf' }),
      vistaPrevia:     vi.fn().mockResolvedValue({ ok: true }),
    },
    catalogo: {
      categoria: { list: vi.fn().mockResolvedValue([]) },
      ubicacion: { list: vi.fn().mockResolvedValue([]) },
    },
  };
  (globalThis as any).ferreteria = mock;
  return mock;
}

function renderView() {
  return render(<MemoryRouter><EtiquetasView /></MemoryRouter>);
}

describe('EtiquetasView', () => {
  beforeEach(() => {
    setup();
    sessionStorage.clear();
    mockNavigate.mockClear();
  });

  it('muestra la tabla con los productos cargados', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Tornillo')).toBeInTheDocument();
      expect(screen.getByText('Clavo')).toBeInTheDocument();
    });
  });

  it('checkbox individual selecciona el producto', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
    const checkboxes = screen.getAllByRole('checkbox');
    const tornilloCheck = checkboxes[1];
    fireEvent.click(tornilloCheck);
    expect(tornilloCheck).toBeChecked();
  });

  it('no muestra botón "Seleccionar todos" — la checkbox del header lo reemplaza', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /seleccionar todos/i })).not.toBeInTheDocument();
  });

  it('checkbox del header (seleccionar todos) marca todos los productos', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes[0] = header, checkboxes[1..n] = rows
    fireEvent.click(checkboxes[0]);
    checkboxes.slice(1).forEach(cb => expect(cb).toBeChecked());
  });

  it('muestra los 8 perfiles predefinidos sin llamar a listarPerfiles', async () => {
    const mock = setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
    expect(screen.getByText('Rollo 30×15')).toBeInTheDocument();
    expect(screen.getByText('Rollo 50×25')).toBeInTheDocument();
    expect(screen.getByText('Rollo 70×40')).toBeInTheDocument();
    expect(screen.getByText('A4 · 2×6 (12 etiq.)')).toBeInTheDocument();
    expect(screen.getByText('A4 · 2×8 (16 etiq.)')).toBeInTheDocument();
    expect(screen.getByText('A4 · 3×8 (24 etiq.)')).toBeInTheDocument();
    expect(screen.getByText('A4 · 3×10 (30 etiq.)')).toBeInTheDocument();
    expect(screen.getByText('A4 · 4×10 (40 etiq.)')).toBeInTheDocument();
    expect(mock.etiquetas.listarProductos).toHaveBeenCalled();
  });

  it('el perfil por defecto es a4-3x8', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
    expect(screen.getByDisplayValue('A4 · 3×8 (24 etiq.)')).toBeInTheDocument();
  });

  it('campo celda-inicio visible solo para perfil tipo hoja', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());

    // Default es a4-3x8 (hoja) → celda-inicio SÍ visible
    expect(screen.getByLabelText(/omitir primeras celdas/i)).toBeInTheDocument();

    // Cambiar a rollo → celda-inicio desaparece
    const profileSelect = screen.getByDisplayValue('A4 · 3×8 (24 etiq.)');
    fireEvent.change(profileSelect, { target: { value: 'rollo-30x15' } });
    await waitFor(() => expect(screen.queryByLabelText(/omitir primeras celdas/i)).not.toBeInTheDocument());

    // Volver a hoja → celda-inicio reaparece
    fireEvent.change(profileSelect, { target: { value: 'a4-2x6' } });
    await waitFor(() => expect(screen.getByLabelText(/omitir primeras celdas/i)).toBeInTheDocument());
  });

  it('dropdown tipo de código siempre visible', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
    expect(screen.getByDisplayValue('QR')).toBeInTheDocument();
  });

  it('cambiar a rollo-30x15 resetea barcodeTipo a CODE128 (barras)', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());

    const profileSelect = screen.getByDisplayValue('A4 · 3×8 (24 etiq.)');
    fireEvent.change(profileSelect, { target: { value: 'rollo-30x15' } });

    await waitFor(() =>
      expect(screen.getByDisplayValue('CODE128 (barras)')).toBeInTheDocument(),
    );
  });

  it('muestra el contador de productos seleccionados', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
    expect(screen.getByText(/0 producto/i)).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    await waitFor(() => expect(screen.getByText(/1 producto/i)).toBeInTheDocument());
  });

  describe('Sorting', () => {
    it('ordena por SKU asc por defecto (SKU-0001 antes que SKU-0002)', async () => {
      renderView();
      await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
      const rows = document.querySelectorAll('tbody tr');
      expect(rows[0]).toHaveTextContent('SKU-0001');
      expect(rows[1]).toHaveTextContent('SKU-0002');
    });

    it('click en SKU invierte a desc (SKU-0002 antes que SKU-0001)', async () => {
      renderView();
      await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('columnheader', { name: /SKU/ }));
      const rows = document.querySelectorAll('tbody tr');
      expect(rows[0]).toHaveTextContent('SKU-0002');
      expect(rows[1]).toHaveTextContent('SKU-0001');
    });

    it('click en Nombre ordena asc (Clavo antes que Tornillo)', async () => {
      renderView();
      await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('columnheader', { name: /Nombre/ }));
      const rows = document.querySelectorAll('tbody tr');
      expect(rows[0]).toHaveTextContent('Clavo');
      expect(rows[1]).toHaveTextContent('Tornillo');
    });

    it('click en Precio ordena asc (Clavo $5 antes que Tornillo $15)', async () => {
      renderView();
      await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('columnheader', { name: /Precio/ }));
      const rows = document.querySelectorAll('tbody tr');
      expect(rows[0]).toHaveTextContent('Clavo');
      expect(rows[1]).toHaveTextContent('Tornillo');
    });
  });

  describe('ADR-069', () => {
    it('el SKU no usa la clase gris p-code', async () => {
      renderView();
      const sku = await screen.findByText('SKU-0001');
      expect(sku).not.toHaveClass('p-code');
    });

    it('hay columna EAN con el gtin del producto', async () => {
      renderView();
      expect(await screen.findByText('EAN')).toBeInTheDocument();
      expect(await screen.findByText('7790001234567')).toBeInTheDocument();
    });

    it('clic en la fila navega al detalle del producto', async () => {
      renderView();
      const sku = await screen.findByText('SKU-0001');
      fireEvent.click(sku.closest('tr')!);
      expect(mockNavigate).toHaveBeenCalledWith('/productos/p1');
    });

    it('clic en el checkbox selecciona pero NO navega', async () => {
      renderView();
      const cb = await screen.findByLabelText('Seleccionar producto SKU-0001');
      fireEvent.click(cb);
      expect(cb).toBeChecked();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('la selección persiste al desmontar y volver a montar', async () => {
      const { unmount } = renderView();
      const cb = await screen.findByLabelText('Seleccionar producto SKU-0001');
      fireEvent.click(cb);
      unmount();
      renderView();
      expect(await screen.findByLabelText('Seleccionar producto SKU-0001')).toBeChecked();
    });
  });
});
