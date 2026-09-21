import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Kardex } from '../Kardex';

const mockExistenciasGet = vi.fn();
const mockMovimientosList = vi.fn();
const mockProductoGet = vi.fn();

const MOVIMIENTOS = [
  {
    id: 'm-1',
    producto_id: 'p-1',
    tipo: 'entrada',
    motivo: 'entrada_manual',
    cantidad: 5,
    stock_resultante: 15,
    costo_unitario: 100,
    referencia_tipo: null,
    referencia_id: null,
    usuario_id: 'u-1',
    fecha: '2026-01-15T10:00:00.000Z',
    observaciones: 'Reposicion',
  },
  {
    id: 'm-2',
    producto_id: 'p-1',
    tipo: 'salida',
    motivo: 'venta',
    cantidad: -2,
    stock_resultante: 13,
    costo_unitario: null,
    referencia_tipo: null,
    referencia_id: null,
    usuario_id: 'u-1',
    fecha: '2026-01-16T12:00:00.000Z',
    observaciones: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockExistenciasGet.mockResolvedValue({
    id: 'ex-1',
    producto_id: 'p-1',
    stock_fisico: 42,
    stock_minimo: 10,
    stock_maximo: null,
    ultima_fecha_movimiento: null,
  });
  mockMovimientosList.mockResolvedValue(MOVIMIENTOS);
  mockProductoGet.mockResolvedValue({ nombre_corto: 'Martillo 500g', nombre_largo: 'Martillo carpintero 500g' });
  (window as any).ferreteria = {
    catalogo: {
      existencias: { get: mockExistenciasGet },
      movimientoStock: { list: mockMovimientosList },
      producto: { get: mockProductoGet },
    },
  };
});

function renderKardex(productoId = 'p-1') {
  return render(
    <MemoryRouter initialEntries={[`/stock/${productoId}/kardex`]}>
      <Routes>
        <Route path="/stock/:id/kardex" element={<Kardex />} />
        <Route path="/stock" element={<div>Stock</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Kardex', () => {
  it('shows stock actual in the strip', async () => {
    renderKardex();
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText(/Stock actual/i)).toBeInTheDocument();
  });

  it('renders movement rows with motivo text visible', async () => {
    renderKardex();
    // "Entrada manual" only appears in the table row, not in filters
    await waitFor(() => expect(screen.getByText('Entrada manual')).toBeInTheDocument());
    // "Venta" appears as a filter <option> AND as a table row td — use getAllByText
    expect(screen.getAllByText('Venta').length).toBeGreaterThanOrEqual(1);
    // Confirm the td cell specifically
    const ventaCells = screen.getAllByText('Venta');
    const hasTableCell = ventaCells.some(el => el.tagName === 'TD');
    expect(hasTableCell).toBe(true);
  });

  it('renders tipo badges for each movement', async () => {
    renderKardex();
    // "Entrada" appears in button + badge + option — just check it appears at all
    await waitFor(() => expect(screen.getAllByText('Entrada').length).toBeGreaterThanOrEqual(1));
    // "Salida" appears in badge + option — use getAllByText
    expect(screen.getAllByText('Salida').length).toBeGreaterThanOrEqual(1);
    // Confirm at least one span badge for Salida
    const salidaElements = screen.getAllByText('Salida');
    const hasSpanBadge = salidaElements.some(el => el.tagName === 'SPAN');
    expect(hasSpanBadge).toBe(true);
  });

  it('links the product name back to its detail page', async () => {
    renderKardex();
    const link = await screen.findByRole('link', { name: /ver detalle del producto/i });
    expect(link).toHaveAttribute('href', '/productos/p-1');
  });
});
