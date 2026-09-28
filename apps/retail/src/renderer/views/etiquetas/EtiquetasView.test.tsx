import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EtiquetasView } from './EtiquetasView';

const mockToastError = vi.fn();
vi.mock('@core/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/ui')>();
  return { ...actual, useToast: () => ({ success: vi.fn(), error: mockToastError, info: vi.fn() }) };
});

const ITEM = {
  producto_id: 'p1', sku: 'P-0000001-0', gtin_barcode: null, nombre: 'Tornillo', precio_venta_lista_centavos: 1000,
};

function makeFerreteria(overrides: Record<string, any> = {}) {
  return {
    etiquetas: {
      listarProductos: vi.fn().mockResolvedValue([ITEM]),
      imprimir: vi.fn().mockResolvedValue({}),
      exportarPdf: vi.fn().mockResolvedValue({ guardado: true }),
      vistaPrevia: vi.fn().mockResolvedValue({}),
    },
    catalogo: {
      categoria: { list: vi.fn().mockResolvedValue([]) },
      ubicacion: { list: vi.fn().mockResolvedValue([]) },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  (window as any).ferreteria = makeFerreteria();
});

async function renderYSeleccionarItem() {
  render(<MemoryRouter><EtiquetasView /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Seleccionar producto P-0000001-0'));
}

describe('EtiquetasView — acciones de impresión/exportación (antes fallaban en silencio)', () => {
  it('avisa por toast cuando falla "Imprimir" y el botón vuelve a estar disponible', async () => {
    (window as any).ferreteria.etiquetas.imprimir = vi.fn().mockRejectedValue(new Error('IMPRESORA_NO_CONFIGURADA'));
    await renderYSeleccionarItem();

    fireEvent.click(screen.getByRole('button', { name: /^imprimir$/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('IMPRESORA_NO_CONFIGURADA'));
    expect(screen.getByRole('button', { name: /^imprimir$/i })).toBeEnabled();
  });

  it('avisa por toast cuando falla "Vista previa"', async () => {
    (window as any).ferreteria.etiquetas.vistaPrevia = vi.fn().mockRejectedValue(new Error('ERROR_GENERANDO_PDF'));
    await renderYSeleccionarItem();

    fireEvent.click(screen.getByRole('button', { name: /vista previa/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('ERROR_GENERANDO_PDF'));
    expect(screen.getByRole('button', { name: /vista previa/i })).toBeEnabled();
  });

  it('avisa por toast cuando falla "Exportar PDF"', async () => {
    (window as any).ferreteria.etiquetas.exportarPdf = vi.fn().mockRejectedValue(new Error('DISCO_LLENO'));
    await renderYSeleccionarItem();

    fireEvent.click(screen.getByRole('button', { name: /exportar pdf/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('DISCO_LLENO'));
    expect(screen.getByRole('button', { name: /exportar pdf/i })).toBeEnabled();
  });
});
