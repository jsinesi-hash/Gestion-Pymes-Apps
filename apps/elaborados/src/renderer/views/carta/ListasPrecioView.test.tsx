import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListasPrecioView } from './ListasPrecioView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const LISTAS = [
  { id: 'l1', nombre: 'Mayorista', descripcion: null, ajuste_porcentual: -10, activo: true },
  { id: 'l2', nombre: 'Vieja', descripcion: null, ajuste_porcentual: 0, activo: false },
];
const PRODUCTOS = [
  { id: 'p1', nombre: 'Pote 1/4', categoria_venta_id: 'c', precio_centavos: 150000, impuesto_id: 'i', activo: true },
  { id: 'p2', nombre: 'Palito', categoria_venta_id: 'c', precio_centavos: 100000, impuesto_id: 'i', activo: true },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockPrecios = vi.fn();
const mockPrecioSet = vi.fn();

vi.stubGlobal('elaborados', {
  listaPrecio: { list: mockList, create: mockCreate, update: mockUpdate, precios: mockPrecios, precioSet: mockPrecioSet },
  productoVenta: { list: vi.fn().mockResolvedValue(PRODUCTOS), create: vi.fn() },
});

const renderView = () => render(<MemoryRouter><ListasPrecioView /></MemoryRouter>);

describe('ListasPrecioView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockList.mockResolvedValue(LISTAS.map((l) => ({ ...l })));
    mockPrecios.mockResolvedValue([{ producto_venta_id: 'p2', precio_centavos: 85000 }]);
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockPrecioSet.mockResolvedValue({ ok: true });
  });

  it('lista las listas con su ajuste y estado', async () => {
    renderView();
    const fila = (await screen.findByText('Mayorista')).closest('tr')!;
    expect(within(fila).getByText('-10%')).toBeInTheDocument();
    expect(within(fila).getByText('Activa')).toBeInTheDocument();
    expect(within(screen.getByText('Vieja').closest('tr')!).getByText('Inactiva')).toBeInTheDocument();
  });

  it('sin permiso no hay acciones de gestión', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await screen.findByText('Mayorista');
    expect(screen.queryByRole('button', { name: /nueva lista/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /precios/i })).not.toBeInTheDocument();
  });

  it('crea una lista con nombre y ajuste', async () => {
    renderView();
    await screen.findByText('Mayorista');
    fireEvent.click(screen.getByRole('button', { name: /nueva lista/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Delivery' } });
    fireEvent.change(screen.getByLabelText(/ajuste/i), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ nombre: 'Delivery', ajuste_porcentual: 15 }));
  });

  it('edita una lista existente (incluye activo)', async () => {
    renderView();
    const fila = (await screen.findByText('Mayorista')).closest('tr')!;
    fireEvent.click(within(fila).getByRole('button', { name: /editar/i }));
    fireEvent.click(screen.getByLabelText(/lista activa/i));
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'l1', nombre: 'Mayorista', ajuste_porcentual: -10, activo: false }));
  });

  it('muestra el error traducido y no cierra si guardar falla', async () => {
    mockCreate.mockRejectedValueOnce(new Error('UNIQUE constraint failed: lista_precio.nombre'));
    renderView();
    await screen.findByText('Mayorista');
    fireEvent.click(screen.getByRole('button', { name: /nueva lista/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Mayorista' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya existe un registro/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('precios: muestra el propio, sugiere el efectivo, guarda en centavos y permite quitar', async () => {
    renderView();
    const fila = (await screen.findByText('Mayorista')).closest('tr')!;
    fireEvent.click(within(fila).getByRole('button', { name: /^precios$/i }));
    const palito = (await screen.findByLabelText('Precio de Palito')) as HTMLInputElement;
    expect(palito.value).toBe('850.00');
    const pote = screen.getByLabelText('Precio de Pote 1/4') as HTMLInputElement;
    expect(pote.value).toBe('');
    expect(pote.placeholder).toBe('1350.00'); // 1500 -10%

    fireEvent.change(pote, { target: { value: '1300.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio de Pote 1/4' }));
    await waitFor(() => expect(mockPrecioSet).toHaveBeenCalledWith({ lista_precio_id: 'l1', producto_venta_id: 'p1', precio_centavos: 130050 }));

    fireEvent.click(screen.getByRole('button', { name: 'Quitar precio de Palito' }));
    await waitFor(() => expect(mockPrecioSet).toHaveBeenCalledWith({ lista_precio_id: 'l1', producto_venta_id: 'p2', precio_centavos: null }));
    await waitFor(() => expect((screen.getByLabelText('Precio de Palito') as HTMLInputElement).value).toBe(''));
  });

  it('precios: el botón Guardar está deshabilitado sin cambios', async () => {
    renderView();
    const fila = (await screen.findByText('Mayorista')).closest('tr')!;
    fireEvent.click(within(fila).getByRole('button', { name: /^precios$/i }));
    await screen.findByLabelText('Precio de Palito');
    expect(screen.getByRole('button', { name: 'Guardar precio de Palito' })).toBeDisabled();
  });
});
