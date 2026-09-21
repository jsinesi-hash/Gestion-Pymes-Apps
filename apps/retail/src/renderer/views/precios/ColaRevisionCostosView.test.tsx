import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ColaRevisionCostosView } from './ColaRevisionCostosView';

const getColaRevision = vi.fn();
const resolverFila = vi.fn();
const descartarFila = vi.fn();
const actualizarFila = vi.fn();

vi.mock('../../hooks/useImportacionCosto', () => ({
  useImportacionCosto: () => ({ getColaRevision, resolverFila, descartarFila, actualizarFila }),
}));

function fila(over: Partial<any> = {}) {
  return {
    detalle_id: 'd1', importacion_id: 'i1', estado: 'sin_matchear', costo_nuevo_centavos: 10000,
    fila_original: JSON.stringify({ fila_num: 1, datos: { NOMBRE: 'Pinza universal', COSTO: '100' } }),
    nombre_archivo: 'lista.csv', fecha_importacion: new Date(), proveedor_id: 'prov1', razon_social: 'Prov Uno',
    nombre_producto_archivo: 'Pinza universal',
    candidatos: [{ producto_id: 'p1', sku: 'P-0000001-0', nombre_corto: 'Alicate universal 8', score: 0.9 }],
    preseleccion: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolverFila.mockResolvedValue({ ok: true });
  (window as any).ferreteria = { catalogo: { producto: { list: vi.fn().mockResolvedValue({ items: [] }) } } };
});

describe('ColaRevisionCostosView — sugerencias por similitud (ADR-063 Lote 4)', () => {
  it('muestra el candidato con su % y lo acepta como similitud', async () => {
    getColaRevision.mockResolvedValue([fila()]);
    render(<ColaRevisionCostosView />);
    await waitFor(() => expect(screen.getByText('Alicate universal 8')).toBeInTheDocument());
    expect(screen.getByText('90%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(resolverFila).toHaveBeenCalledWith(
      expect.objectContaining({ detalleId: 'd1', productoId: 'p1', proveedorId: 'prov1', origen: 'similitud' }),
    ));
  });

  it('marca "sugerido" cuando llega pre-seleccionado por umbral', async () => {
    getColaRevision.mockResolvedValue([fila({ preseleccion: { producto_id: 'p1', score: 0.9 } })]);
    render(<ColaRevisionCostosView />);
    await waitFor(() => expect(screen.getByText('sugerido')).toBeInTheDocument());
  });

  it('sin candidatos no rompe y no ofrece aceptar', async () => {
    getColaRevision.mockResolvedValue([fila({ candidatos: [], nombre_producto_archivo: null })]);
    render(<ColaRevisionCostosView />);
    await waitFor(() => expect(screen.getByText('Prov Uno')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument();
  });
});
