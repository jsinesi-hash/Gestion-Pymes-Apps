import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RemitoDetalleModal } from './RemitoDetalleModal';

const obtener = vi.fn();
const ventaGet = vi.fn();

beforeEach(() => {
  obtener.mockReset();
  ventaGet.mockReset();
  (globalThis as any).ferreteria = {
    remito: { obtener },
    venta: { get: ventaGet },
  };
  obtener.mockResolvedValue({
    id: 'r1', numero: 'RE-0000002', estado: 'emitido',
    fecha_emision: new Date('2026-07-19T12:00:00Z').getTime(), fecha_entrega: null,
    recibido_por: null, transportista: 'Rex', domicilio_entrega: 'Av. Siempreviva 742',
    observaciones: 'Entregar por la mañana', motivo_anulacion: null,
    venta_id: 'v1', venta_numero_interno: 'V-C1-000010',
    cliente_nombre_completo: 'Ferreteria Sur', cliente_domicilio: null,
    lineas: [{ id: 'l1', descripcion: 'Martillo', unidad: 'u', cantidad_entregada: 3 }],
  });
});

describe('RemitoDetalleModal', () => {
  it('muestra los datos del remito', async () => {
    render(<RemitoDetalleModal remitoId="r1" onClose={vi.fn()} />);

    expect(await screen.findByText('RE-0000002')).toBeInTheDocument();
    expect(screen.getByText('Martillo')).toBeInTheDocument();
    expect(screen.getByText('Rex')).toBeInTheDocument();
    expect(screen.getByText('Av. Siempreviva 742')).toBeInTheDocument();
    expect(screen.getByText('Ferreteria Sur')).toBeInTheDocument();
  });

  it('abre el detalle de la venta/factura al clickear el numero de venta', async () => {
    ventaGet.mockResolvedValue({
      venta: { id: 'v1', numero_interno: 'V-C1-000010', fecha: Date.now(), estado: 'confirmada', total: 100, descuento_global: 0, ajuste_redondeo: 0, forma_pago: 'efectivo' },
      detalles: [],
      comprobante: { tipo: 'ticket_interno' },
      cliente: { nombre_completo: 'Ferreteria Sur' },
    });
    render(<RemitoDetalleModal remitoId="r1" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText('V-C1-000010'));

    await waitFor(() => expect(ventaGet).toHaveBeenCalledWith({ id: 'v1' }));
    expect(await screen.findByText(/detalle de venta/i)).toBeInTheDocument();
  });

  it('muestra error si el remito no existe', async () => {
    obtener.mockRejectedValue(new Error('NOT_FOUND'));
    render(<RemitoDetalleModal remitoId="r1" onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('NOT_FOUND');
  });

  it('cierra con el boton cerrar', async () => {
    const onClose = vi.fn();
    render(<RemitoDetalleModal remitoId="r1" onClose={onClose} />);

    fireEvent.click(await screen.findByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('cierra con Escape', async () => {
    const onClose = vi.fn();
    render(<RemitoDetalleModal remitoId="r1" onClose={onClose} />);
    await screen.findByText('RE-0000002');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('NO llama onClose con Escape mientras el detalle de venta (submodal) esta abierto', async () => {
    ventaGet.mockResolvedValue({
      venta: { id: 'v1', numero_interno: 'V-C1-000010', fecha: Date.now(), estado: 'confirmada', total: 100, descuento_global: 0, ajuste_redondeo: 0, forma_pago: 'efectivo' },
      detalles: [],
      comprobante: { tipo: 'ticket_interno' },
      cliente: { nombre_completo: 'Ferreteria Sur' },
    });
    const onClose = vi.fn();
    render(<RemitoDetalleModal remitoId="r1" onClose={onClose} />);

    fireEvent.click(await screen.findByText('V-C1-000010'));
    expect(await screen.findByText(/detalle de venta/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
