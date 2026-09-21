import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistorialCatalogosView } from './HistorialCatalogosView';

const HIST = [
  { id: 'i1', proveedor: 'Prov Uno', nombre_archivo: 'cat.csv', fecha_importacion: Date.now(), filas_totales: 3, creados: 2, actualizados: 0, sin_match: 1, errores: 0, preferidos_asignados: 2, estado: 'confirmado' },
  { id: 'i2', proveedor: 'Alfa', nombre_archivo: 'a.csv', fecha_importacion: Date.now() - 1000, filas_totales: 1, creados: 1, actualizados: 0, sin_match: 0, errores: 0, preferidos_asignados: 1, estado: 'confirmado' },
];
const DET = [
  { detalle_id: 'd1', fila_num: 1, datos: { EAN: '779', COD_PRODUCTO_PROV: 'A-1' }, nombre_producto: 'Tornillo', sku_producto: 'P-1', codigo_producto_prov: 'A-1', costo_centavos: 12000, costo_anterior_centavos: null, estado: 'crear', preferido_asignado: true },
  { detalle_id: 'd2', fila_num: 2, datos: { EAN: '000', COD_PRODUCTO_PROV: 'A-2' }, nombre_producto: null, sku_producto: null, codigo_producto_prov: 'A-2', costo_centavos: 5000, costo_anterior_centavos: null, estado: 'sin_matchear', preferido_asignado: false },
];

function mockApi() {
  (window as any).ferreteria = { importacionCatalogo: {
    getHistorial: vi.fn().mockResolvedValue(HIST),
    getHistorialDetalle: vi.fn().mockResolvedValue(DET),
  } };
}

describe('HistorialCatalogosView', () => {
  beforeEach(mockApi);

  it('lista las importaciones de catálogo', async () => {
    render(<HistorialCatalogosView />);
    expect(await screen.findByText('cat.csv')).toBeDefined();
    // "Prov Uno" está como celda de fila y como <option> del filtro: se apunta a la celda.
    expect(screen.getByRole('cell', { name: 'Prov Uno' })).toBeDefined();
    expect(screen.getByText('a.csv')).toBeDefined();
  });

  it('abre el detalle al hacer clic en una fila', async () => {
    render(<HistorialCatalogosView />);
    fireEvent.click(await screen.findByText('cat.csv'));
    expect(await screen.findByText('Tornillo', { exact: false })).toBeDefined();
  });

  it('filtra el listado por proveedor', async () => {
    render(<HistorialCatalogosView />);
    await screen.findByText('cat.csv');
    fireEvent.change(screen.getByLabelText(/filtrar por proveedor/i), { target: { value: 'Alfa' } });
    expect(screen.getByText('a.csv')).toBeDefined();
    expect(screen.queryByText('cat.csv')).toBeNull();
  });

  it('ordena por la cabecera Proveedor (asc/desc)', async () => {
    render(<HistorialCatalogosView />);
    await screen.findByText('cat.csv');
    const header = screen.getByRole('columnheader', { name: /proveedor/i });
    fireEvent.click(header); // asc → Alfa primero
    let filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].textContent).toContain('Alfa');
    fireEvent.click(header); // desc → Prov Uno primero
    filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].textContent).toContain('Prov Uno');
  });
});
