import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditarRemitoModal } from './EditarRemitoModal';

const obtener = vi.fn();
const pendiente = vi.fn();
const editar = vi.fn();
const transportistaList = vi.fn();

beforeEach(() => {
  obtener.mockReset(); pendiente.mockReset(); editar.mockReset(); transportistaList.mockReset();
  (globalThis as any).ferreteria = {
    remito: { obtener, pendiente, editar },
    transportista: { list: transportistaList },
  };
  obtener.mockResolvedValue({
    id: 'r1', numero: 'RE-0000001', estado: 'emitido',
    venta_id: 'v1', transportista_id: 't1', domicilio_entrega: 'Domicilio actual',
    lineas: [
      { id: 'l1', venta_detalle_id: 'd1', descripcion: 'Martillo', unidad: 'u', cantidad_entregada: 4 },
    ],
  });
  // El modal pide el pendiente con excluir_remito_id=r1, asi que la respuesta NO
  // cuenta las 4 unidades que este remito ya tiene: de las 10 vendidas quedan 10
  // disponibles para el. Ese numero YA es el maximo editable, no hay que sumarle nada.
  pendiente.mockResolvedValue({
    lineas: [
      { venta_detalle_id: 'd1', producto_id: 'p1', descripcion: 'Martillo', unidad: 'u', cantidad_vendida: 10, cantidad_entregada: 0, cantidad_pendiente: 10 },
    ],
    domicilio_cliente: 'Calle Falsa 123',
  });
  transportistaList.mockResolvedValue([
    { id: 't1', razon_social: 'Transporte Rex' },
    { id: 't2', razon_social: 'Transporte Otro' },
  ]);
});

describe('EditarRemitoModal', () => {
  it('precarga domicilio, transportista y cantidades actuales', async () => {
    render(<EditarRemitoModal remitoId="r1" onClose={vi.fn()} onEditado={vi.fn()} />);

    expect(await screen.findByDisplayValue('Domicilio actual')).toBeInTheDocument();
    const cantidad = await screen.findByLabelText(/cantidad a entregar de martillo/i) as HTMLInputElement;
    expect(cantidad.value).toBe('4');
    const select = screen.getByLabelText(/transportista/i) as HTMLSelectElement;
    expect(select.value).toBe('t1');
  });

  it('el maximo editable es el pendiente que ya excluye a este remito, sin sumarle lo propio', async () => {
    render(<EditarRemitoModal remitoId="r1" onClose={vi.fn()} onEditado={vi.fn()} />);

    // El maximo mostrado debe ser 10 (lo que devuelve el pendiente excluyendo r1),
    // no 14 (que seria sumarle otra vez las 4 que r1 ya tiene).
    expect(await screen.findByText(/^10/)).toBeInTheDocument();

    const cantidad = await screen.findByLabelText(/cantidad a entregar de martillo/i);
    fireEvent.change(cantidad, { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/excede/i);
    expect(editar).not.toHaveBeenCalled();
  });

  it('guarda los cambios de cantidad, domicilio y transportista', async () => {
    editar.mockResolvedValue({});
    const onEditado = vi.fn();
    render(<EditarRemitoModal remitoId="r1" onClose={vi.fn()} onEditado={onEditado} />);

    fireEvent.change(await screen.findByLabelText(/cantidad a entregar de martillo/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/domicilio de entrega/i), { target: { value: 'Domicilio nuevo' } });
    fireEvent.change(screen.getByLabelText(/transportista/i), { target: { value: 't2' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(editar).toHaveBeenCalledWith({
      id: 'r1',
      domicilio_entrega: 'Domicilio nuevo',
      transportista_id: 't2',
      lineas: [{ remito_linea_id: 'l1', cantidad_entregada: 6 }],
    }));
    await waitFor(() => expect(onEditado).toHaveBeenCalled());
  });

  it('rutea el error de validación del backend al campo transportista_id', async () => {
    editar.mockRejectedValue(new Error('VALIDATION:transportista_id:REQUERIDO'));
    render(<EditarRemitoModal remitoId="r1" onClose={vi.fn()} onEditado={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/cantidad a entregar de martillo/i), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('editar-remito-transportista')));
    expect(await screen.findByText(/obligatorio/i)).toBeInTheDocument();
  });

  it('cierra con cancelar', async () => {
    const onClose = vi.fn();
    render(<EditarRemitoModal remitoId="r1" onClose={onClose} onEditado={vi.fn()} />);

    await screen.findByDisplayValue('Domicilio actual');
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('cierra con Escape', async () => {
    const onClose = vi.fn();
    render(<EditarRemitoModal remitoId="r1" onClose={onClose} onEditado={vi.fn()} />);

    await screen.findByDisplayValue('Domicilio actual');
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
