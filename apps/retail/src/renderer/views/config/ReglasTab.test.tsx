import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReglasTab } from './ReglasTab';

// ADR-071 Task 3 — filtro de texto en el tab Reglas: matchea objetivo (nombre), tipo
// y, para reglas de tipo 'producto', el SKU/EAN del producto objetivo.

const PRODUCTOS = [
  { id: 'pA', nombre_corto: 'Martillo', sku: 'P-0000001-9', gtin_barcode: '7790001000011' },
  { id: 'pB', nombre_corto: 'Cinta', sku: 'P-0000005-5', gtin_barcode: null },
];

const MARCAS = [{ id: 'm1', nombre: 'Stanley' }];

const REGLAS = [
  {
    id: 'r1', tipo: 'producto', objetivo_id: 'pA',
    margen_pct: 40, margen_min_pct: null, margen_max_pct: null,
    redondeo_modo: 'ninguno', redondeo_valor: null, prioridad: 100,
  },
  {
    id: 'r2', tipo: 'marca', objetivo_id: 'm1',
    margen_pct: 35, margen_min_pct: null, margen_max_pct: null,
    redondeo_modo: 'ninguno', redondeo_valor: null, prioridad: 100,
  },
];

beforeEach(() => {
  (globalThis as any).ferreteria = {
    precios: { reglas: { listByLista: vi.fn().mockResolvedValue(REGLAS), upsert: vi.fn(), remove: vi.fn() } },
    catalogo: {
      marca: { list: vi.fn().mockResolvedValue(MARCAS) },
      categoria: { list: vi.fn().mockResolvedValue([]) },
      producto: { list: vi.fn().mockResolvedValue({ items: PRODUCTOS }) },
    },
    compras: { proveedor: { list: vi.fn().mockResolvedValue([]) } },
  };
});

describe('ReglasTab — filtro por objetivo / SKU / EAN', () => {
  it('muestra ambas reglas inicialmente', async () => {
    render(<ReglasTab listaId="l1" />);
    await waitFor(() => expect(screen.getByText('Martillo')).toBeInTheDocument());
    expect(screen.getByText('Stanley')).toBeInTheDocument();
  });

  it('filtra por SKU del producto objetivo', async () => {
    render(<ReglasTab listaId="l1" />);
    await waitFor(() => expect(screen.getByText('Martillo')).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/buscar por objetivo, sku o ean/i);
    fireEvent.change(input, { target: { value: 'P-0000001-9' } });

    expect(screen.getByText('Martillo')).toBeInTheDocument();
    expect(screen.queryByText('Stanley')).not.toBeInTheDocument();
  });

  it('filtra por EAN del producto objetivo', async () => {
    render(<ReglasTab listaId="l1" />);
    await waitFor(() => expect(screen.getByText('Martillo')).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/buscar por objetivo, sku o ean/i);
    fireEvent.change(input, { target: { value: '7790001000011' } });

    expect(screen.getByText('Martillo')).toBeInTheDocument();
    expect(screen.queryByText('Stanley')).not.toBeInTheDocument();
  });

  it('filtra por nombre de objetivo (marca)', async () => {
    render(<ReglasTab listaId="l1" />);
    await waitFor(() => expect(screen.getByText('Martillo')).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/buscar por objetivo, sku o ean/i);
    fireEvent.change(input, { target: { value: 'stan' } });

    expect(screen.queryByText('Martillo')).not.toBeInTheDocument();
    expect(screen.getByText('Stanley')).toBeInTheDocument();
  });
});

// ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
describe('ReglasTab — ruteo de error de validación (ADR-085)', () => {
  it('rutea VALIDATION:margen_pct:TIPO al input de margen y lo enfoca', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('VALIDATION:margen_pct:TIPO'));
    (globalThis as any).ferreteria.precios.reglas.upsert = upsert;
    render(<ReglasTab listaId="l1" />);
    await waitFor(() => expect(screen.getByText('Martillo')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('margen_pct')));
    expect(await screen.findByText(/formato inválido/i)).toBeInTheDocument();
  });

  it('rutea VALIDATION:tipo:ENUM al select de tipo y lo enfoca', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('VALIDATION:tipo:ENUM'));
    (globalThis as any).ferreteria.precios.reglas.upsert = upsert;
    render(<ReglasTab listaId="l1" />);
    await waitFor(() => expect(screen.getByText('Martillo')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('tipo')));
    expect(await screen.findByText(/no es válido/i)).toBeInTheDocument();
  });

  it('un error de campo no ruteable (lista_precio_id) cae en el error general del modal', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('VALIDATION:lista_precio_id:TIPO'));
    (globalThis as any).ferreteria.precios.reglas.upsert = upsert;
    render(<ReglasTab listaId="l1" />);
    await waitFor(() => expect(screen.getByText('Martillo')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getAllByText(/formato inválido/i).length).toBeGreaterThan(0));
    expect(document.activeElement).not.toBe(document.getElementById('margen_pct'));
  });
});
