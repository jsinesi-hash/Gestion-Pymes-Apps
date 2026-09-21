import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UploadStep } from './UploadStep';

function mockPlantilla(info: any) {
  (window as any).ferreteria = {
    importar: { plantilla: vi.fn().mockResolvedValue(info) },
  };
}

describe('UploadStep — mini-preview de columnas (ADR-051 C.1)', () => {
  beforeEach(() => {
    mockPlantilla({
      csv: 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,3200,21,Ferretería\n',
      columnas: ['nombre', 'unidad_medida', 'precio_venta', 'iva_alicuota', 'rubro'],
      ejemplo: ['Martillo', 'u', '3200', '21', 'Ferretería'],
      obligatorias: ['nombre', 'unidad_medida', 'precio_venta', 'iva_alicuota', 'rubro'],
    });
  });

  it('la mini-preview de columnas aparece ANTES que la zona de selección de archivo', async () => {
    render(<UploadStep entidad="productos" onFile={vi.fn()} loading={false} />);
    const columnasHeader = await screen.findByText('nombre');
    const selectorArchivo = screen.getByRole('button', { name: /seleccionar archivo csv/i });
    // eslint-disable-next-line no-bitwise
    expect(columnasHeader.compareDocumentPosition(selectorArchivo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marca las columnas obligatorias con asterisco', async () => {
    render(<UploadStep entidad="productos" onFile={vi.fn()} loading={false} />);
    await screen.findByText('nombre');
    expect(screen.getAllByText('*').length).toBeGreaterThan(0);
  });

  it('stock inicial muestra la nota "sku o gtin_barcode" en vez de asteriscos en ambas columnas', async () => {
    mockPlantilla({
      csv: 'sku,gtin_barcode,cantidad,costo_unitario,observaciones\n00001,,50,120,\n',
      columnas: ['sku', 'gtin_barcode', 'cantidad', 'costo_unitario', 'observaciones'],
      ejemplo: ['00001', '', '50', '120', ''],
      obligatorias: ['cantidad'],
      orNote: 'sku o gtin_barcode (al menos una)',
    });
    render(<UploadStep entidad="stockInicial" onFile={vi.fn()} loading={false} />);
    expect(await screen.findByText(/sku o gtin_barcode/i)).toBeDefined();
  });
});
