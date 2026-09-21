import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EquivalenciasPanel } from './EquivalenciasPanel';

const listResult = {
  equivalentes: [{ id: 'r1', producto_id: 'b', sku: 'P-2', nombre_corto: 'Pincel 3x8 B', marca_nombre: 'B',
    precio_final_centavos: 15000, precio_origen: 'vigente', stock_fisico: 4, discontinuado: false, nota: null }],
  reemplazado_por: [],
  reemplaza_a: [],
};

function setFerreteria(flag: string) {
  (window as any).ferreteria = {
    parametros: { get: vi.fn().mockResolvedValue(flag) },
    catalogo: {
      producto: {
        list: vi.fn().mockResolvedValue({ items: [] }),
        setDiscontinuado: vi.fn().mockResolvedValue({}),
        equivalencia: {
          list: vi.fn().mockResolvedValue(listResult),
          add: vi.fn().mockResolvedValue({ id: 'rX' }),
          remove: vi.fn().mockResolvedValue({ ok: true }),
        },
      },
    },
  };
}

function renderPanel() {
  return render(<MemoryRouter><EquivalenciasPanel productoId="a" discontinuado={false} /></MemoryRouter>);
}

describe('EquivalenciasPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con el flag apagado no renderiza nada', async () => {
    setFerreteria('false');
    const { container } = renderPanel();
    await waitFor(() => expect((window as any).ferreteria.parametros.get).toHaveBeenCalled());
    expect(container.textContent).not.toMatch(/equivalentes/i);
  });

  it('con el flag encendido lista los equivalentes enriquecidos', async () => {
    setFerreteria('true');
    renderPanel();
    expect(await screen.findByText('Pincel 3x8 B')).toBeInTheDocument();
    expect(screen.getByText('$ 150,00')).toBeInTheDocument();
    expect(screen.getByText(/stock 4/i)).toBeInTheDocument();
  });

  it('quitar una relación llama a remove y refresca', async () => {
    setFerreteria('true');
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /quitar/i }));
    await waitFor(() => expect((window as any).ferreteria.catalogo.producto.equivalencia.remove)
      .toHaveBeenCalledWith({ id: 'r1' }));
  });

  it('rutea el error de validación del backend (tipo) al select y lo enfoca (ADR-085)', async () => {
    setFerreteria('true');
    (window as any).ferreteria.catalogo.producto.list.mockResolvedValue({
      items: [{ id: 'z', nombre_corto: 'Pincel 3x8 Z', sku: 'P-9' }],
    });
    (window as any).ferreteria.catalogo.producto.equivalencia.add.mockRejectedValue(
      new Error('VALIDATION:tipo:ENUM'),
    );
    renderPanel();

    const buscador = await screen.findByPlaceholderText(/buscar producto a relacionar/i);
    fireEvent.change(buscador, { target: { value: 'pincel z' } });
    fireEvent.click(await screen.findByText('Pincel 3x8 Z'));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('tipo')));
    expect(await screen.findByText(/valor elegido no es válido/i)).toBeInTheDocument();
  });
});
