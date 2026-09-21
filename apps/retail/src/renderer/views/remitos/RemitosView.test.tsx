import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RemitosView } from './RemitosView';
import { __resetPersistentListState } from '../../hooks/usePersistentListState';

const listar = vi.fn();
const anular = vi.fn();
const conformar = vi.fn();
const imprimir = vi.fn();
const obtener = vi.fn();
const editar = vi.fn();

const FILAS = [
  {
    id: 'r1', numero: 'RE-0000002', numero_secuencial: 2, estado: 'emitido',
    fecha_emision: new Date('2026-07-19T12:00:00Z').getTime(), fecha_entrega: null,
    venta_id: 'v1', venta_numero_interno: 'V-C1-000010',
    cliente_nombre_completo: 'Ferreteria Sur', transportista: null, recibido_por: null,
  },
  {
    id: 'r2', numero: 'RE-0000001', numero_secuencial: 1, estado: 'anulado',
    fecha_emision: new Date('2026-07-18T12:00:00Z').getTime(), fecha_entrega: null,
    venta_id: 'v2', venta_numero_interno: 'V-C1-000009',
    cliente_nombre_completo: 'Obra SRL', transportista: 'Rex', recibido_por: null,
  },
];

beforeEach(() => {
  __resetPersistentListState();
  listar.mockReset(); anular.mockReset(); conformar.mockReset(); imprimir.mockReset(); obtener.mockReset(); editar.mockReset();
  (globalThis as any).ferreteria = { remito: { listar, anular, conformar, imprimir, obtener, editar } };
  listar.mockResolvedValue(FILAS);
});

describe('RemitosView', () => {
  it('lista los remitos con numero, cliente y estado', async () => {
    render(<RemitosView />);

    expect(await screen.findByText('RE-0000002')).toBeInTheDocument();
    expect(screen.getByText('Ferreteria Sur')).toBeInTheDocument();
    expect(screen.getByText('RE-0000001')).toBeInTheDocument();
    expect(screen.getByText('Obra SRL')).toBeInTheDocument();
  });

  it('ADR-057: abre filtrado por estado "Emitido"', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    // El listado se pide por default con estado 'emitido'...
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'emitido' }));
    // ...y el select refleja "Emitido" como valor seleccionado.
    expect((screen.getByLabelText(/estado/i) as HTMLSelectElement).value).toBe('emitido');
  });

  it('filtra por estado', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.change(screen.getByLabelText(/estado/i), { target: { value: 'anulado' } });

    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'anulado' }),
    ));
  });

  it('muestra vacio cuando no hay remitos', async () => {
    listar.mockResolvedValue([]);
    render(<RemitosView />);

    expect(await screen.findByText(/no hay remitos/i)).toBeInTheDocument();
  });

  it('ofrece conformar solo en remitos emitidos', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    // Solo la fila emitida (RE-0000002) tiene accion de conformar
    expect(screen.getAllByRole('button', { name: /conformar/i })).toHaveLength(1);
  });

  it('ofrece editar solo en remitos emitidos', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    expect(screen.getAllByRole('button', { name: /^editar$/i })).toHaveLength(1);
  });

  it('conforma pidiendo quien recibio', async () => {
    conformar.mockResolvedValue({});
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getByRole('button', { name: /conformar/i }));
    fireEvent.change(screen.getByLabelText(/recibido por/i), { target: { value: 'Juan Perez' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar entrega/i }));

    await waitFor(() => expect(conformar).toHaveBeenCalledWith({ id: 'r1', recibido_por: 'Juan Perez' }));
  });

  it('anula pidiendo motivo', async () => {
    anular.mockResolvedValue({});
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getByRole('button', { name: /anular/i }));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Error de carga' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar anulaci/i }));

    await waitFor(() => expect(anular).toHaveBeenCalledWith({ id: 'r1', motivo: 'Error de carga' }));
  });

  it('rutea el error de validación del backend al input de motivo al anular', async () => {
    anular.mockRejectedValue(new Error('VALIDATION:motivo:REQUERIDO'));
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getByRole('button', { name: /anular/i }));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar anulaci/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('accion-valor')));
    expect(await screen.findByText(/obligatorio/i)).toBeInTheDocument();
  });

  it('cierra el modal de conformar/anular con Escape', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getByRole('button', { name: /anular/i }));
    expect(screen.getByLabelText(/motivo/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByLabelText(/motivo/i)).not.toBeInTheDocument();
  });

  it('muestra el error si el listado falla', async () => {
    listar.mockRejectedValue(new Error('BOOM'));
    render(<RemitosView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('BOOM');
  });

  it('imprime el remito de la fila', async () => {
    imprimir.mockResolvedValue({ guardado: true });
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getAllByRole('button', { name: /imprimir/i })[0]);

    await waitFor(() => expect(imprimir).toHaveBeenCalledWith({ id: 'r1' }));
  });

  it('filtra por texto libre (cliente, numero de remito o venta)', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.change(screen.getByPlaceholderText(/buscar por cliente/i), { target: { value: 'obra' } });

    expect(screen.queryByText('RE-0000002')).not.toBeInTheDocument();
    expect(screen.getByText('RE-0000001')).toBeInTheDocument();
  });

  it('abre el detalle del remito al hacer click en la fila', async () => {
    obtener.mockResolvedValue({
      id: 'r1', numero: 'RE-0000002', estado: 'emitido',
      fecha_emision: new Date('2026-07-19T12:00:00Z').getTime(), fecha_entrega: null,
      recibido_por: null, transportista: null, domicilio_entrega: null,
      observaciones: null, motivo_anulacion: null,
      venta_id: 'v1', venta_numero_interno: 'V-C1-000010',
      cliente_nombre_completo: 'Ferreteria Sur', cliente_domicilio: null,
      lineas: [{ id: 'l1', descripcion: 'Martillo', unidad: 'u', cantidad_entregada: 3 }],
    });
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getByText('RE-0000002'));

    await waitFor(() => expect(obtener).toHaveBeenCalledWith({ id: 'r1' }));
    expect(await screen.findByRole('dialog', { name: /detalle de remito/i })).toBeInTheDocument();
  });

  it('ordena por numero al clickear la cabecera, alternando asc/desc', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    const filasAntes = screen.getAllByRole('row').slice(1); // sin el header
    expect(filasAntes[0]).toHaveTextContent('RE-0000002'); // orden inicial: desc (viene asi del backend)

    fireEvent.click(screen.getByRole('columnheader', { name: /número/i }));
    const filasAsc = screen.getAllByRole('row').slice(1);
    expect(filasAsc[0]).toHaveTextContent('RE-0000001');

    fireEvent.click(screen.getByRole('columnheader', { name: /número/i }));
    const filasDesc = screen.getAllByRole('row').slice(1);
    expect(filasDesc[0]).toHaveTextContent('RE-0000002');
  });

  it('ordena por cliente alfabeticamente', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getByRole('columnheader', { name: /cliente/i }));

    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0]).toHaveTextContent('Ferreteria Sur'); // 'Ferreteria Sur' < 'Obra SRL'
  });

  it('no abre el detalle al clickear los botones de accion de la fila', async () => {
    render(<RemitosView />);
    await screen.findByText('RE-0000002');

    fireEvent.click(screen.getAllByRole('button', { name: /imprimir/i })[0]);

    expect(screen.queryByRole('dialog', { name: /detalle de remito/i })).not.toBeInTheDocument();
    expect(obtener).not.toHaveBeenCalled();
  });
});
