import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PosScanBar } from '../PosScanBar';

function setFerreteria(similares: any[]) {
  (globalThis as any).ferreteria = {
    parametros: { get: vi.fn().mockResolvedValue('true') },
    presentacion: { buscarPorGtin: vi.fn().mockResolvedValue(null) },
    catalogo: {
      producto: {
        list: vi.fn().mockResolvedValue({ items: [] }),
        buscarSimilares: vi.fn().mockResolvedValue(similares),
      },
    },
  };
}

describe('PosScanBar — modo Buscar similares', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('ordena stock-primero y deshabilita agregar los sin stock; agrega los que tienen stock', async () => {
    setFerreteria([
      { producto_id: 'sin', sku: 'P-2', nombre_corto: 'Pincel 3x8 Marca B', marca_nombre: 'B',
        precio_final_centavos: 20000, precio_origen: 'vigente', stock_fisico: 0, score: 0.99 },
      { producto_id: 'con', sku: 'P-1', nombre_corto: 'Pincel 3x8 Marca A', marca_nombre: 'A',
        precio_final_centavos: 15000, precio_origen: 'vigente', stock_fisico: 4, score: 0.90 },
    ]);
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<PosScanBar onAdd={onAdd} clienteId={'c1'} />);

    fireEvent.click(await screen.findByRole('button', { name: /buscar similares/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'pincel 3x8' } });

    const filas = await screen.findAllByTestId('similar-row');
    expect(filas[0]).toHaveTextContent('Marca A'); // stock 4 primero pese a menor score
    expect(filas[1]).toHaveTextContent('Marca B');

    fireEvent.click(filas[1]); // sin stock (disabled) → no agrega
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.click(filas[0]); // con stock → agrega
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('con'));
  });
});
