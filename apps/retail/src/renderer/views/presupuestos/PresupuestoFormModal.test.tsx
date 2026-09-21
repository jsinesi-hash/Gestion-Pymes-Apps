import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PresupuestoFormModal } from './PresupuestoFormModal';

const clienteList = vi.fn();
const listaList = vi.fn();
const getPrecio = vi.fn();
const productoList = vi.fn();
const crear = vi.fn();

beforeEach(() => {
  [clienteList, listaList, getPrecio, productoList, crear].forEach((f) => f.mockReset());
  clienteList.mockResolvedValue([
    { id: 'c1', nombre: 'Ferreteria', apellido: 'Norte', numero_documento: '20111', tipo_documento: 'CUIT' },
    { id: 'c2', nombre: 'Kiosco', apellido: 'Sur', numero_documento: '30222', tipo_documento: 'CUIT' },
  ]);
  listaList.mockResolvedValue([{ id: 'lp1', predeterminada: true }]);
  getPrecio.mockResolvedValue({ precio_centavos: 10000, origen: 'vigente' });
  productoList.mockResolvedValue({ items: [{ id: 'pr1', nombre_corto: 'Martillo', sku: 'P-0000001-3', stock_fisico: 5 }], total: 1 });
  crear.mockResolvedValue({ id: 'new' });
  (globalThis as any).ferreteria = {
    cliente: { list: clienteList },
    precios: { lista: { list: listaList }, valor: { getPrecioEnLista: getPrecio } },
    catalogo: { producto: { list: productoList } },
    presupuesto: { crear, obtener: vi.fn() },
  };
});

function renderForm(onClose = vi.fn()) {
  return { onClose, ...render(<PresupuestoFormModal validezDefault={15} onClose={onClose} onGuardado={vi.fn()} />) };
}

describe('PresupuestoFormModal', () => {
  it('busca cliente por documento y lo selecciona', async () => {
    renderForm();
    const buscador = await screen.findByPlaceholderText(/Buscar cliente por nombre o documento/);
    fireEvent.change(buscador, { target: { value: '30222' } }); // documento de Kiosco Sur
    fireEvent.click(await screen.findByText('Kiosco Sur'));
    // queda seleccionado (muestra nombre + documento)
    expect(screen.getByText('Kiosco Sur')).toBeInTheDocument();
    expect(screen.getByText(/30222/)).toBeInTheDocument();
  });

  it('busca producto por nombre/SKU y lo agrega como línea', async () => {
    renderForm();
    const buscador = await screen.findByPlaceholderText(/Buscar producto/);
    fireEvent.change(buscador, { target: { value: 'mar' } });
    // el dropdown muestra el stock disponible
    expect(await screen.findByText(/stock 5/)).toBeInTheDocument();
    fireEvent.click(await screen.findByText(/Martillo/));
    await waitFor(() => expect(getPrecio).toHaveBeenCalledWith({ productoId: 'pr1', listaId: 'lp1' }));
    // la línea aparece en la tabla con su precio resuelto
    expect(screen.getByLabelText('cantidad Martillo')).toBeInTheDocument();
  });

  it('guardar envía cliente_id y líneas al backend', async () => {
    renderForm();
    // cliente
    fireEvent.change(await screen.findByPlaceholderText(/Buscar cliente/), { target: { value: 'norte' } });
    fireEvent.click(await screen.findByText('Ferreteria Norte'));
    // producto
    fireEvent.change(await screen.findByPlaceholderText(/Buscar producto/), { target: { value: 'mar' } });
    fireEvent.click(await screen.findByText(/Martillo/));
    await screen.findByLabelText('cantidad Martillo');
    // guardar
    fireEvent.click(screen.getByText('Guardar borrador'));
    await waitFor(() => expect(crear).toHaveBeenCalled());
    const payload = crear.mock.calls[0][0];
    expect(payload.cliente_id).toBe('c1');
    expect(payload.lineas).toHaveLength(1);
    expect(payload.lineas[0].producto_id).toBe('pr1');
  });

  it('cierra con Escape', async () => {
    const { onClose } = renderForm();
    await screen.findByPlaceholderText(/Buscar cliente/);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ADR-085 (SEC-2): un rechazo VALIDATION de un campo de cabecera muestra error inline y enfoca el control', async () => {
    crear.mockRejectedValue(new Error('VALIDATION:descuento_global_pct:MAX:100'));
    renderForm();
    fireEvent.change(await screen.findByPlaceholderText(/Buscar producto/), { target: { value: 'mar' } });
    fireEvent.click(await screen.findByText(/Martillo/));
    await screen.findByLabelText('cantidad Martillo');

    fireEvent.click(screen.getByText('Guardar borrador'));

    expect(await screen.findByText('El valor no puede superar 100.')).toBeInTheDocument();
    expect(document.getElementById('descuento_global_pct')).toHaveFocus();
  });

  it('ADR-085 (SEC-2): un rechazo VALIDATION de una línea cae en la región general de error', async () => {
    crear.mockRejectedValue(new Error('VALIDATION:lineas.0.producto_id:TIPO'));
    renderForm();
    fireEvent.change(await screen.findByPlaceholderText(/Buscar producto/), { target: { value: 'mar' } });
    fireEvent.click(await screen.findByText(/Martillo/));
    await screen.findByLabelText('cantidad Martillo');

    fireEvent.click(screen.getByText('Guardar borrador'));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('El valor tiene un formato inválido.');
  });

  it('NO cierra con Escape mientras se está guardando', async () => {
    let resolveCrear: (v: unknown) => void = () => {};
    crear.mockReturnValue(new Promise((resolve) => { resolveCrear = resolve; }));
    const { onClose } = renderForm();

    fireEvent.change(await screen.findByPlaceholderText(/Buscar producto/), { target: { value: 'mar' } });
    fireEvent.click(await screen.findByText(/Martillo/));
    await screen.findByLabelText('cantidad Martillo');
    fireEvent.click(screen.getByText('Guardar borrador'));
    await waitFor(() => expect(screen.getByText(/guardando/i)).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    resolveCrear({ id: 'new' });
  });
});
