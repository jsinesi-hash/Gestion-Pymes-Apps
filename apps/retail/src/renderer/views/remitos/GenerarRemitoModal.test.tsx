import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerarRemitoModal } from './GenerarRemitoModal';

const pendiente = vi.fn();
const crear = vi.fn();
const transportistaList = vi.fn();

beforeEach(() => {
  pendiente.mockReset();
  crear.mockReset();
  transportistaList.mockReset();
  (globalThis as any).ferreteria = {
    remito: { pendiente, crear },
    transportista: { list: transportistaList },
  };
  transportistaList.mockResolvedValue([
    { id: 't1', razon_social: 'Transporte Rex' },
    { id: 't2', razon_social: 'Transporte Otro' },
  ]);
  pendiente.mockResolvedValue({
    lineas: [
      {
        venta_detalle_id: 'd1', producto_id: 'p1', descripcion: 'Martillo', unidad: 'u',
        cantidad_vendida: 10, cantidad_entregada: 4, cantidad_pendiente: 6,
      },
      {
        venta_detalle_id: 'd2', producto_id: 'p2', descripcion: 'Clavos', unidad: 'kg',
        cantidad_vendida: 2, cantidad_entregada: 2, cantidad_pendiente: 0,
      },
    ],
    domicilio_cliente: 'Calle Falsa 123',
  });
});

describe('GenerarRemitoModal', () => {
  it('muestra solo las lineas con pendiente > 0', async () => {
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    expect(await screen.findByText('Martillo')).toBeInTheDocument();
    expect(screen.queryByText('Clavos')).not.toBeInTheDocument();
  });

  it('precarga el domicilio de entrega con el del cliente, editable', async () => {
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    const input = await screen.findByLabelText(/domicilio de entrega/i) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Calle Falsa 123'));

    fireEvent.change(input, { target: { value: 'Otra direccion 456' } });
    expect(input.value).toBe('Otra direccion 456');
  });

  it('emite con las cantidades seleccionadas', async () => {
    crear.mockResolvedValue({ id: 'r1', numero: 'RE-0000001' });
    const onCreado = vi.fn();
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={onCreado} />);

    await screen.findByText('Martillo');
    fireEvent.change(screen.getByLabelText(/cantidad a entregar de martillo/i), { target: { value: '3' } });
    fireEvent.change(await screen.findByLabelText(/transportista/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({
      venta_id: 'v1',
      lineas: [{ venta_detalle_id: 'd1', cantidad_entregada: 3 }],
    })));
    await waitFor(() => expect(onCreado).toHaveBeenCalledWith({ id: 'r1', numero: 'RE-0000001' }));
  });

  it('manda los datos de entrega cuando se completan', async () => {
    crear.mockResolvedValue({ id: 'r1', numero: 'RE-0000001' });
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.change(screen.getByLabelText(/cantidad a entregar de martillo/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/domicilio de entrega/i), { target: { value: 'Av. Siempreviva 742' } });
    fireEvent.change(await screen.findByLabelText(/transportista/i), { target: { value: 't2' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({
      domicilio_entrega: 'Av. Siempreviva 742',
      transportista_id: 't2',
    })));
  });

  it('no deja emitir mas que lo pendiente', async () => {
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.change(screen.getByLabelText(/cantidad a entregar de martillo/i), { target: { value: '99' } });
    fireEvent.change(await screen.findByLabelText(/transportista/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/excede lo pendiente/i);
    expect(crear).not.toHaveBeenCalled();
  });

  it('no deja emitir sin lineas seleccionadas', async () => {
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.change(await screen.findByLabelText(/transportista/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos una linea/i);
    expect(crear).not.toHaveBeenCalled();
  });

  it('no deja emitir sin domicilio de entrega', async () => {
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.change(screen.getByLabelText(/cantidad a entregar de martillo/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/domicilio de entrega/i), { target: { value: '   ' } });
    fireEvent.change(await screen.findByLabelText(/transportista/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/domicilio/i);
    expect(crear).not.toHaveBeenCalled();
  });

  it('no deja emitir sin transportista', async () => {
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.change(screen.getByLabelText(/cantidad a entregar de martillo/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/domicilio de entrega/i), { target: { value: 'Av. Siempreviva 742' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/transportista/i);
    expect(crear).not.toHaveBeenCalled();
  });

  it('muestra el error del backend si la emision falla', async () => {
    crear.mockRejectedValue(new Error('EXCEDE_PENDIENTE:d1:6'));
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.change(screen.getByLabelText(/cantidad a entregar de martillo/i), { target: { value: '2' } });
    fireEvent.change(await screen.findByLabelText(/transportista/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    // ADR-085 (SEC-2): el error del backend ahora pasa por el traductor (ERR-2),
    // que muestra un mensaje humano en vez del código crudo.
    expect(await screen.findByRole('alert')).toHaveTextContent(/supera lo pendiente/i);
  });

  it('rutea el error de validación del backend al campo transportista_id', async () => {
    crear.mockRejectedValue(new Error('VALIDATION:transportista_id:REQUERIDO'));
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.change(screen.getByLabelText(/cantidad a entregar de martillo/i), { target: { value: '2' } });
    fireEvent.change(await screen.findByLabelText(/transportista/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /emitir remito/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('remito-transportista')));
    expect(await screen.findByText(/obligatorio/i)).toBeInTheDocument();
  });

  it('avisa cuando no queda nada pendiente y deshabilita emitir', async () => {
    pendiente.mockResolvedValue({
      lineas: [
        {
          venta_detalle_id: 'd2', producto_id: 'p2', descripcion: 'Clavos', unidad: 'kg',
          cantidad_vendida: 2, cantidad_entregada: 2, cantidad_pendiente: 0,
        },
      ],
      domicilio_cliente: null,
    });
    render(<GenerarRemitoModal ventaId="v1" onClose={vi.fn()} onCreado={vi.fn()} />);

    expect(await screen.findByText(/no hay l[ií]neas pendientes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /emitir remito/i })).toBeDisabled();
  });

  it('cierra con el boton cancelar', async () => {
    const onClose = vi.fn();
    render(<GenerarRemitoModal ventaId="v1" onClose={onClose} onCreado={vi.fn()} />);

    await screen.findByText('Martillo');
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
