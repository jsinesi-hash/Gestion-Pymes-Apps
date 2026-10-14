import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComprasView } from './ComprasView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const COMPRAS = [
  { id: '1', numero: 'CP-C1-000001', proveedor_id: 'p1', proveedor_nombre: 'Lácteos SA', comprobante: 'A-1', total_centavos: 150000, estado: 'confirmada', fecha: 1700000000, observaciones: null },
  { id: '2', numero: 'CP-C1-000002', proveedor_id: null, proveedor_nombre: null, comprobante: null, total_centavos: 5000, estado: 'anulada', fecha: 1700000100, observaciones: null },
];
const ARTICULOS = [
  { id: 'a1', nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false, stock_minimo: null, costo_promedio_centavos: 100, activo: true, stock: 5 },
  { id: 'a2', nombre: 'Azúcar', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false, stock_minimo: null, costo_promedio_centavos: 100, activo: true, stock: 5 },
];

const mockListCompras = vi.fn();
const mockCrear = vi.fn();
const mockAnular = vi.fn();
const mockListProv = vi.fn();
const mockCrearProv = vi.fn();

vi.stubGlobal('elaborados', {
  compra: {
    list: mockListCompras, get: vi.fn(), crear: mockCrear, anular: mockAnular,
    proveedores: mockListProv, proveedorCrearRapido: mockCrearProv,
  },
  articulo: { list: vi.fn().mockResolvedValue(ARTICULOS), get: vi.fn(), create: vi.fn(), update: vi.fn() },
});

function renderView() {
  return render(<MemoryRouter><ComprasView /></MemoryRouter>);
}

async function abrirNueva() {
  renderView();
  await waitFor(() => expect(screen.getByText('CP-C1-000001')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /nueva compra/i }));
  await screen.findByRole('dialog');
}

describe('ComprasView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockListCompras.mockResolvedValue(COMPRAS.map((c) => ({ ...c })));
    mockListProv.mockResolvedValue([{ id: 'p1', razon_social: 'Lácteos SA' }]);
    mockCrear.mockResolvedValue({});
    mockAnular.mockResolvedValue({});
    mockCrearProv.mockResolvedValue({ id: 'p2', razon_social: 'Dulces SRL' });
  });

  it('lista las compras con proveedor, comprobante y total', async () => {
    renderView();
    const fila = (await screen.findByText('CP-C1-000001')).closest('tr')!;
    expect(within(fila).getByText('Lácteos SA')).toBeInTheDocument();
    expect(within(fila).getByText('A-1')).toBeInTheDocument();
    expect(within(fila).getByText('$1500.00')).toBeInTheDocument();
  });

  it('oculta "+ Nueva compra" y "Anular" sin permiso; no ofrece Anular en anuladas', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await screen.findByText('CP-C1-000001');
    expect(screen.queryByRole('button', { name: /nueva compra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();

    mockCan.mockReturnValue(true);
    renderView();
    const anulada = (await screen.findAllByText('CP-C1-000002'))[0]!.closest('tr')!;
    expect(within(anulada).queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();
  });

  it('registra una compra: convierte pesos a centavos y envía proveedor y comprobante', async () => {
    await abrirNueva();
    fireEvent.change(screen.getByLabelText(/^proveedor$/i), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText(/comprobante/i), { target: { value: 'B-9' } });
    fireEvent.change(screen.getByLabelText(/cantidad \*/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/costo unitario/i), { target: { value: '12.5' } });
    expect(screen.getByText('Total: $50.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /registrar compra/i }));
    await waitFor(() => expect(mockCrear).toHaveBeenCalledWith({
      proveedor_id: 'p1', comprobante: 'B-9',
      items: [{ articulo_id: 'a1', cantidad: 4, costo_unitario_centavos: 1250 }],
    }));
  });

  it('el botón de registrar queda deshabilitado hasta completar cantidad y costo', async () => {
    await abrirNueva();
    expect(screen.getByRole('button', { name: /registrar compra/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/cantidad \*/i), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /registrar compra/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/costo unitario/i), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /registrar compra/i })).toBeEnabled();
  });

  it('permite agregar y quitar ítems', async () => {
    await abrirNueva();
    fireEvent.click(screen.getByRole('button', { name: /agregar ítem/i }));
    expect(screen.getAllByLabelText(/cantidad \*/i)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /quitar ítem 2/i }));
    expect(screen.getAllByLabelText(/cantidad \*/i)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /quitar ítem 1/i })).toBeDisabled();
  });

  it('alta rápida de proveedor: lo crea y queda seleccionado', async () => {
    await abrirNueva();
    fireEvent.click(screen.getByRole('button', { name: /nuevo proveedor/i }));
    fireEvent.change(screen.getByLabelText(/razón social del proveedor/i), { target: { value: 'Dulces SRL' } });
    mockListProv.mockResolvedValue([{ id: 'p1', razon_social: 'Lácteos SA' }, { id: 'p2', razon_social: 'Dulces SRL' }]);
    fireEvent.click(screen.getByRole('button', { name: /guardar proveedor/i }));
    await waitFor(() => expect(mockCrearProv).toHaveBeenCalledWith({ razon_social: 'Dulces SRL' }));
    const sel = (await screen.findByLabelText(/^proveedor$/i)) as HTMLSelectElement;
    await waitFor(() => expect(sel.value).toBe('p2'));
  });

  it('muestra el error traducido y no cierra el modal si registrar falla', async () => {
    mockCrear.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await abrirNueva();
    fireEvent.change(screen.getByLabelText(/cantidad \*/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/costo unitario/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar compra/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se encontró el registro/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('anular pide motivo y luego credenciales de supervisor', async () => {
    renderView();
    const fila = (await screen.findByText('CP-C1-000001')).closest('tr')!;
    fireEvent.click(within(fila).getByRole('button', { name: /anular/i }));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Error de carga' } });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.change(await screen.findByLabelText(/usuario/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar|autorizar/i }));
    await waitFor(() => expect(mockAnular).toHaveBeenCalledWith({
      id: '1', motivo: 'Error de carga',
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
    }));
  });
});
