import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ImportarCatalogoProveedorView } from './ImportarCatalogoProveedorView';

function mockFerreteria() {
  (window as any).ferreteria = {
    compras: { proveedor: { list: vi.fn().mockResolvedValue([{ id: 'p1', razon_social: 'Prov Uno', codigo: 'PROV-0001', activo: true }]) } },
    importacionCatalogo: {
      parseArchivo: vi.fn(),
      revalidarFila: vi.fn(),
      confirmar: vi.fn(),
      buscarProductos: vi.fn().mockResolvedValue([]),
    },
    dialog: { seleccionarArchivoImportCosto: vi.fn() },
  };
}

const PREVIEW = {
  filas: [
    { fila_num: 1, gtin_archivo: '7791234567890', codigo_producto_prov: 'A-100', codigo_interno_archivo: null, producto_id: 'prod-1', nombre_producto: 'Tornillo', sku_producto: 'P-0000001-1', matched_by: 'gtin', costo_centavos: 12000, costo_anterior_centavos: null, accion: 'crear', motivo: null, datos: { EAN: '7791234567890', COD_PRODUCTO_PROV: 'A-100', COSTO: '120.00' } },
    { fila_num: 2, gtin_archivo: '0000000000000', codigo_producto_prov: 'A-200', codigo_interno_archivo: null, producto_id: null, nombre_producto: null, sku_producto: null, matched_by: null, costo_centavos: 5000, costo_anterior_centavos: null, accion: 'sin_matchear', motivo: 'El producto no está en el catálogo — creá el producto primero.', datos: { EAN: '0000000000000', COD_PRODUCTO_PROV: 'A-200', COSTO: '50.00' } },
  ],
  total_crear: 1,
  total_actualizar: 0,
};

function renderView() {
  return render(<MemoryRouter><ImportarCatalogoProveedorView /></MemoryRouter>);
}

async function llegarAlPreview() {
  (window as any).ferreteria.importacionCatalogo.parseArchivo.mockResolvedValue(PREVIEW);
  (window as any).ferreteria.dialog.seleccionarArchivoImportCosto.mockResolvedValue('/tmp/catalogo.csv');
  renderView();
  await screen.findByText(/columnas esperadas/i);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } });
  fireEvent.click(screen.getByRole('button', { name: /seleccionar archivo csv o xlsx/i }));
  await screen.findByText('/tmp/catalogo.csv');
  fireEvent.click(screen.getByText('Siguiente →'));
  await screen.findByText(/confirmar \(1\)/i);
}

describe('ImportarCatalogoProveedorView', () => {
  beforeEach(() => { mockFerreteria(); });

  it('el paso 1 muestra las columnas esperadas con COD_PRODUCTO_PROV obligatorio', async () => {
    renderView();
    await screen.findByText(/columnas esperadas/i);
    expect(screen.getByText('COD_PRODUCTO_PROV')).toBeDefined();
    expect(screen.getByText('EAN')).toBeDefined();
    expect(screen.getByText('COD_INTERNO')).toBeDefined();
  });

  it('parsea y muestra las filas con su acción (crear / sin identificar)', async () => {
    await llegarAlPreview();
    expect((window as any).ferreteria.importacionCatalogo.parseArchivo).toHaveBeenCalledWith({ filePath: '/tmp/catalogo.csv', proveedorId: 'p1' });
    expect(screen.getByText('Tornillo', { exact: false })).toBeDefined();
    expect(screen.getByText(/no está en el catálogo/i)).toBeDefined();
    // el botón confirmar cuenta solo las aplicables (1 crear)
    expect(screen.getByText(/confirmar \(1\)/i)).toBeDefined();
  });

  it('muestra nombre y código del proveedor arriba en el preview', async () => {
    await llegarAlPreview();
    expect(screen.getByText('Prov Uno')).toBeDefined();
    expect(screen.getByText('PROV-0001')).toBeDefined();
  });

  it('editar una celda re-valida contra el backend', async () => {
    (window as any).ferreteria.importacionCatalogo.revalidarFila.mockResolvedValue({
      gtin_archivo: '7799999999999', codigo_producto_prov: 'A-200', codigo_interno_archivo: null,
      producto_id: 'prod-2', nombre_producto: 'Otro', sku_producto: 'P-0000002-2', matched_by: 'gtin',
      costo_centavos: 5000, costo_anterior_centavos: null, accion: 'crear', motivo: null,
    });
    await llegarAlPreview();
    const celda = screen.getByText('0000000000000');
    celda.textContent = '7799999999999';
    fireEvent.blur(celda);
    await waitFor(() => {
      expect((window as any).ferreteria.importacionCatalogo.revalidarFila).toHaveBeenCalled();
    });
    expect(await screen.findByText('Otro', { exact: false })).toBeDefined();
  });

  it('confirmar abre el modal y luego aplica, mostrando el resumen', async () => {
    (window as any).ferreteria.importacionCatalogo.confirmar.mockResolvedValue({
      ok: true, importacion_id: 'i1',
      creados: 1, actualizados: 0, sin_identificar: 1, errores: 0, preferidos_asignados: 1,
      filas: PREVIEW.filas.map(f => ({ ...f, preferido_asignado: f.accion === 'crear' })),
    });
    await llegarAlPreview();
    fireEvent.click(screen.getByText(/confirmar \(1\)/i));
    const modal = within(await screen.findByRole('dialog', { name: /confirmar catálogo/i }));
    fireEvent.click(modal.getByRole('button', { name: /^confirmar$/i }));
    await screen.findByText(/catálogo aplicado/i);
    // ADR-054: ahora se envía nombreArchivo (basename del archivo elegido).
    expect((window as any).ferreteria.importacionCatalogo.confirmar).toHaveBeenCalledWith({ proveedorId: 'p1', nombreArchivo: 'catalogo.csv', filas: PREVIEW.filas });
    expect(screen.getByText(/vínculos creados/i)).toBeDefined();
  });

  it('el buscador Consultar productos busca contra el backend (ADR-054)', async () => {
    (window as any).ferreteria.importacionCatalogo.buscarProductos.mockResolvedValue([
      { id: 'x', sku: 'P-1', gtin_barcode: '779', nombre_corto: 'Bulón', codigo_proveedor: 'A-9' },
    ]);
    await llegarAlPreview();
    fireEvent.click(screen.getByRole('button', { name: /consultar productos/i }));
    fireEvent.change(await screen.findByPlaceholderText(/nombre.*sku.*ean/i), { target: { value: 'Bul' } });
    expect(await screen.findByText('Bulón')).toBeDefined();
    expect((window as any).ferreteria.importacionCatalogo.buscarProductos).toHaveBeenCalledWith({ proveedorId: 'p1', busqueda: 'Bul' });
  });

  it('al finalizar muestra los impactados con chips y permite exportar (ADR-054)', async () => {
    (window as any).ferreteria.importacionCatalogo.confirmar.mockResolvedValue({
      ok: true, importacion_id: 'i1',
      creados: 1, actualizados: 0, sin_identificar: 1, errores: 0, preferidos_asignados: 1,
      filas: [
        { fila_num: 1, gtin_archivo: '779', codigo_producto_prov: 'A-100', codigo_interno_archivo: null, producto_id: 'prod-1', nombre_producto: 'Tornillo', sku_producto: 'P-1', matched_by: 'gtin', costo_centavos: 12000, costo_anterior_centavos: null, accion: 'crear', motivo: null, preferido_asignado: true, datos: { EAN: '779', COD_PRODUCTO_PROV: 'A-100', COSTO: '120.00' } },
        { fila_num: 2, gtin_archivo: '000', codigo_producto_prov: 'A-200', codigo_interno_archivo: null, producto_id: null, nombre_producto: null, sku_producto: null, matched_by: null, costo_centavos: 5000, costo_anterior_centavos: null, accion: 'sin_matchear', motivo: 'no existe', preferido_asignado: false, datos: { EAN: '000', COD_PRODUCTO_PROV: 'A-200', COSTO: '50.00' } },
      ],
    });
    await llegarAlPreview();
    fireEvent.click(screen.getByText(/confirmar \(1\)/i));
    const modal = within(await screen.findByRole('dialog', { name: /confirmar catálogo/i }));
    fireEvent.click(modal.getByRole('button', { name: /^confirmar$/i }));
    await screen.findByText(/catálogo aplicado/i);
    // La tabla de impactados muestra el producto creado
    expect(await screen.findByText('Tornillo', { exact: false })).toBeDefined();
    // Chip "Preferido" filtra a 1 fila
    fireEvent.click(screen.getByRole('button', { name: /preferido/i }));
    expect(screen.getByText('Tornillo', { exact: false })).toBeDefined();
    // Botón exportar
    expect(screen.getByRole('button', { name: /exportar/i })).toBeDefined();
  });
});
