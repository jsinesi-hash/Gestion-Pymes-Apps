import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OcSugeridaView } from '../OcSugeridaView';

const SUGERENCIA = {
  grupos: [
    {
      proveedor_id: 'prov-1',
      razon_social: 'Distribuidora SA',
      items: [
        { producto_id: 'prod-1', nombre_corto: 'Tornillo 4mm', cantidad_sugerida_uv: 100, costo_centavos: 5000, codigo_proveedor: 'T4', stock_minimo: 10, stock_fisico: 2, unidad_compra: null },
        { producto_id: 'prod-2', nombre_corto: 'Clavo 3in',    cantidad_sugerida_uv:  50, costo_centavos: 3000, codigo_proveedor: null, stock_minimo: 20, stock_fisico: 5, unidad_compra: null },
      ],
    },
  ],
  sin_proveedor: [
    { producto_id: 'prod-3', nombre_corto: 'Llave inglesa',  cantidad_sugerida_uv: 20, stock_minimo: 5, stock_fisico: 0, unidad_compra: null },
    { producto_id: 'prod-4', nombre_corto: 'Destornillador', cantidad_sugerida_uv: 80, stock_minimo: 8, stock_fisico: 3, unidad_compra: null },
  ],
};

function setup() {
  const mock = {
    compras: {
      oc: {
        sugerir: vi.fn().mockResolvedValue(SUGERENCIA),
        crear:   vi.fn().mockResolvedValue({ id: 'oc-1' }),
        agregarItem: vi.fn().mockResolvedValue({}),
      },
      proveedor: {
        list: vi.fn().mockResolvedValue([
          { id: 'prov-1', razon_social: 'Distribuidora SA' },
          { id: 'prov-2', razon_social: 'Ferromax SRL' },
        ]),
      },
      pp: {
        upsert:       vi.fn().mockResolvedValue({ id: 'pp-1' }),
        setPreferido: vi.fn().mockResolvedValue({ id: 'pp-1' }),
      },
    },
  };
  (globalThis as any).ferreteria = mock;
  return mock;
}

function renderView() {
  return render(<MemoryRouter><OcSugeridaView /></MemoryRouter>);
}

describe('OcSugeridaView', () => {
  beforeEach(() => setup());

  it('muestra los grupos con sus productos', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Distribuidora SA')).toBeInTheDocument());
    expect(screen.getByText('Tornillo 4mm')).toBeInTheDocument();
    expect(screen.getByText('Clavo 3in')).toBeInTheDocument();
  });

  it('muestra los productos sin proveedor', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Llave inglesa')).toBeInTheDocument());
    expect(screen.getByText('Destornillador')).toBeInTheDocument();
  });

  it('muestra input de búsqueda cuando hay datos', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo 4mm')).toBeInTheDocument());
    expect(screen.getByLabelText(/buscar producto/i)).toBeInTheDocument();
  });

  it('búsqueda filtra productos en el grupo', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo 4mm')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/buscar producto/i), { target: { value: 'tornillo' } });
    await waitFor(() => {
      expect(screen.getByText('Tornillo 4mm')).toBeInTheDocument();
      expect(screen.queryByText('Clavo 3in')).not.toBeInTheDocument();
    });
  });

  it('búsqueda filtra productos sin proveedor', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Llave inglesa')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/buscar producto/i), { target: { value: 'llave' } });
    await waitFor(() => {
      expect(screen.getByText('Llave inglesa')).toBeInTheDocument();
      expect(screen.queryByText('Destornillador')).not.toBeInTheDocument();
    });
  });

  it('por defecto ordena por cant. sugerida desc (100 antes que 50)', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo 4mm')).toBeInTheDocument());
    const rows = screen.getAllByRole('row');
    const grupRows = rows.filter(r => r.textContent?.includes('4mm') || r.textContent?.includes('3in'));
    expect(grupRows[0]).toHaveTextContent('Tornillo 4mm');
    expect(grupRows[1]).toHaveTextContent('Clavo 3in');
  });

  it('click en "Sugerida" invierte el orden (50 antes que 100)', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo 4mm')).toBeInTheDocument());
    const headers = screen.getAllByRole('columnheader', { name: /Sugerida/ });
    fireEvent.click(headers[0]);
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      const grupRows = rows.filter(r => r.textContent?.includes('4mm') || r.textContent?.includes('3in'));
      expect(grupRows[0]).toHaveTextContent('Clavo 3in');
      expect(grupRows[1]).toHaveTextContent('Tornillo 4mm');
    });
  });

  it('click en fila sin proveedor muestra formulario de asignación', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Llave inglesa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Llave inglesa').closest('tr')!);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Proveedor' })).toBeInTheDocument());
    expect(screen.getByLabelText(/costo unitario/i)).toBeInTheDocument();
  });

  it('click nuevamente en la fila cierra el formulario', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Llave inglesa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Llave inglesa').closest('tr')!);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Proveedor' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('Llave inglesa').closest('tr')!);
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Proveedor' })).not.toBeInTheDocument());
  });

  it('muestra el encabezado Subtotal en la tabla del grupo', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Distribuidora SA')).toBeInTheDocument());
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
  });

  it('muestra el subtotal por fila (costo_unit × cant)', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Tornillo 4mm')).toBeInTheDocument());
    // Tornillo: costo_centavos=5000 ($50) × cant=100 → $5.000
    // fmtARS(5000*100) = (500000/100).toLocaleString('es-AR',…) ≈ "5.000,00"
    expect(screen.getByText(/5[\.,]000/)).toBeInTheDocument();
  });

  it('guardar asignación llama pp.upsert y pp.setPreferido', async () => {
    const mock = setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Llave inglesa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Llave inglesa').closest('tr')!);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Proveedor' })).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox', { name: 'Proveedor' }), { target: { value: 'prov-2' } });
    fireEvent.change(screen.getByLabelText(/costo unitario/i), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mock.compras.pp.upsert).toHaveBeenCalledWith(expect.objectContaining({
        producto_id:  'prod-3',
        proveedor_id: 'prov-2',
        costo_centavos: 150000,
      }));
      expect(mock.compras.pp.setPreferido).toHaveBeenCalledWith('pp-1');
    });
  });

  it('muestra columnas Mínimo, Faltante y U.compra en la tabla de grupos', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Distribuidora SA')).toBeInTheDocument());
    // Headers
    expect(screen.getAllByText('Mínimo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Faltante').length).toBeGreaterThan(0);
    expect(screen.getAllByText('U. compra').length).toBeGreaterThan(0);
    // Faltante = stock_minimo - stock_fisico: Tornillo: 10-2=8, Clavo: 20-5=15
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);   // faltante Tornillo
    expect(screen.getByText('15')).toBeInTheDocument();           // faltante Clavo
  });

  it('muestra columnas Mínimo y Faltante en la tabla sin proveedor', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Llave inglesa')).toBeInTheDocument());
    // Llave inglesa: stock_minimo=5, stock_fisico=0 → faltante=5
    // Destornillador: stock_minimo=8, stock_fisico=3 → faltante=5
    const faltantes = screen.getAllByText('5');
    expect(faltantes.length).toBeGreaterThanOrEqual(1);
  });
});
