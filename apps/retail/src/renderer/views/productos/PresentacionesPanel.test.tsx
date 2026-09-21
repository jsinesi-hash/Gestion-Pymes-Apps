import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PresentacionesPanel } from './PresentacionesPanel';

const mockList = vi.fn();
const mockEliminar = vi.fn();
const mockReactivar = vi.fn();

const PPS = [
  { id: 'd1', unidad_abreviatura: 'u', unidad_nombre: 'Unidad', factor_a_stock: 1,
    gtin_barcode: null, es_default: true, activo: true, sin_confirmar: false },
  { id: 'a1', unidad_abreviatura: 'caja', unidad_nombre: 'Caja', factor_a_stock: 6,
    gtin_barcode: null, es_default: false, activo: true, sin_confirmar: false },
  { id: 'i1', unidad_abreviatura: 'pack', unidad_nombre: 'Pack', factor_a_stock: 3,
    gtin_barcode: null, es_default: false, activo: false, sin_confirmar: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(PPS);
  mockEliminar.mockResolvedValue({ eliminada: true });
  mockReactivar.mockResolvedValue(undefined);
  (window as any).ferreteria = {
    presentacion: {
      listByProducto: mockList, eliminar: mockEliminar, reactivar: mockReactivar,
      create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), desactivar: vi.fn(),
    },
    unidad: { list: vi.fn().mockResolvedValue([]) },
  };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('PresentacionesPanel — ADR-066', () => {
  it('la fila inactiva muestra acción reactivar', async () => {
    render(<PresentacionesPanel productoId="p1" />);
    const btn = await screen.findByLabelText('Reactivar');
    fireEvent.click(btn);
    await waitFor(() => expect(mockReactivar).toHaveBeenCalledWith({ id: 'i1' }));
  });

  it('la fila activa no-default muestra acción eliminar', async () => {
    render(<PresentacionesPanel productoId="p1" />);
    await screen.findByText('caja');
    const eliminarBtns = screen.getAllByLabelText('Eliminar');
    expect(eliminarBtns.length).toBeGreaterThan(0);
    fireEvent.click(eliminarBtns[0]);
    await waitFor(() => expect(mockEliminar).toHaveBeenCalled());
  });

  it('la fila default no muestra eliminar ni desactivar', async () => {
    render(<PresentacionesPanel productoId="p1" />);
    await screen.findByText('Default');
    // a1 (activa) + i1 (inactiva) tienen Eliminar; la default nunca.
    expect(screen.getAllByLabelText('Eliminar').length).toBe(2);
    // Desactivar solo en a1 (activa no-default); nunca en la default.
    expect(screen.getAllByLabelText('Desactivar').length).toBe(1);
  });

  it('eliminar con historial ({eliminada:false}) muestra aviso de baja lógica', async () => {
    mockEliminar.mockResolvedValueOnce({ eliminada: false });
    render(<PresentacionesPanel productoId="p1" />);
    await screen.findByText('caja');
    fireEvent.click(screen.getAllByLabelText('Eliminar')[0]);
    await screen.findByText(/se dio de baja en vez de eliminarse/i);
  });

  it('rutea el error de validación del backend (factor_a_stock) al input y lo enfoca (ADR-085)', async () => {
    (window as any).ferreteria.unidad.list.mockResolvedValue([
      { id: 'u1', nombre: 'Unidad', abreviatura: 'u' },
    ]);
    (window as any).ferreteria.presentacion.create.mockRejectedValue(
      new Error('VALIDATION:factor_a_stock:MIN:0.001'),
    );
    const { container } = render(<PresentacionesPanel productoId="p1" />);
    await screen.findByText('caja');

    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
    const factorInput = document.getElementById('factor_a_stock') as HTMLInputElement;
    expect(factorInput).toBeTruthy();
    fireEvent.change(factorInput, { target: { value: '0' } });

    // fireEvent.submit dispara el submit handler directamente, sin pasar por la
    // validación nativa del navegador (min/required) que bloquearía el click real.
    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('factor_a_stock')));
    expect(await screen.findByText(/ingresá un valor mayor o igual a 0.001/i)).toBeInTheDocument();
  });
});
