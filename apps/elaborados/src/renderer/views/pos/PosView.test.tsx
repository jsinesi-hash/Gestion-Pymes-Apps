import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PosView } from './PosView';

let mockCaja: any = { id: 'caja-1' };
let mockCan = false;
vi.mock('@core/ui', async (orig) => ({
  ...(await orig<any>()),
  useAuth: () => ({ ...(({} as any)), can: () => mockCan }),
  useCajaActiva: () => ({ caja: mockCaja, isLoading: false, refetch: vi.fn() }),
}));

const CATALOGO = {
  categorias: [{ id: 'c1', nombre: 'Helados', orden: 1 }],
  productos: [
    { id: 'p-palito', nombre: 'Palito', categoria_venta_id: 'c1', precio_centavos: 50000, grupos: [] },
    {
      id: 'p-pote', nombre: 'Pote 1/4', categoria_venta_id: 'c1', precio_centavos: 150000,
      grupos: [{
        grupo_modificador_id: 'g1', nombre: 'Sabores', min: 1, max: 3, cantidad_total: 0.25, modo_descuento: 'reparto',
        opciones: [
          { id: 'o-choco', nombre: 'Chocolate', recargo_centavos: 0 },
          { id: 'o-ddl', nombre: 'DDL', recargo_centavos: 0 },
        ],
      }],
    },
  ],
};
const cotizacion = (extra: any = {}) => ({
  lineas: [{ descripcion: 'Palito', cantidad: 1, precio_unitario_centavos: 50000, descuento_linea_pct: 0, subtotal_centavos: 50000, opciones: [] }],
  subtotal_centavos: 50000, descuento_global_centavos: 0, total_centavos: 50000,
  ajuste_redondeo_centavos: 0, importe_iva_centavos: 0, bloqueos: [], advertencias: [], ...extra,
});
const RESULTADO = {
  venta: { numero_interno: 'V-C1-000001', fecha: 1700000000000, total: 500, descuento_global: 0, ajuste_redondeo: 0, estado: 'confirmada' },
  lineas: [{ descripcion: 'Palito', cantidad: 1, precio_unitario_centavos: 50000, alicuota_iva: 21, subtotal_centavos: 50000, modificadores: [] }],
  advertencias: [],
};

const catalogo = vi.fn();
const cotizar = vi.fn();
const confirmar = vi.fn();
const html = vi.fn();
const list = vi.fn();
const seedHeladeria = vi.fn();
vi.stubGlobal('elaborados', {
  venta: { catalogo, cotizar, confirmar }, print: { html }, cliente: { list },
  demoCatalog: { seedHeladeria },
});

const montar = () => render(<MemoryRouter><PosView /></MemoryRouter>);
const agregarPalito = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Palito' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'COBRAR' })).toBeEnabled(), { timeout: 3000 });
};
const cobrarEfectivo = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'COBRAR' }));
  fireEvent.change(await screen.findByLabelText('Monto'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCaja = { id: 'caja-1' };
  mockCan = false;
  catalogo.mockResolvedValue(CATALOGO);
  cotizar.mockResolvedValue(cotizacion());
  confirmar.mockResolvedValue(RESULTADO);
  html.mockResolvedValue(undefined);
  list.mockResolvedValue([
    { id: 'c1', nombre: 'Juan', apellido: 'García', numero_documento: '20111222', habilita_cuenta_corriente: true },
  ]);
});

const elegirJuan = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
  fireEvent.click(await screen.findByText('Juan García'));
};
const pedirSupervisor = async () => {
  confirmar.mockRejectedValueOnce(new Error('LIMITE_CREDITO_EXCEDIDO'));
  await cobrarEfectivo();
  await screen.findByLabelText('Usuario Supervisor');
};
const autorizar = () => {
  fireEvent.change(screen.getByLabelText('Usuario Supervisor'), { target: { value: 'sup' } });
  fireEvent.change(screen.getByLabelText('Contraseña Supervisor'), { target: { value: 'pw' } });
  fireEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
};

describe('PosView', () => {
  it('sin caja abierta muestra el mensaje y el link, sin grilla', async () => {
    mockCaja = null;
    montar();
    expect(await screen.findByText(/Necesitás una caja abierta para vender/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir caja' })).toHaveAttribute('href', '/caja');
    expect(screen.queryByRole('button', { name: 'Palito' })).toBeNull();
  });

  it('producto sin grupos se agrega y cotiza sin precios', async () => {
    montar();
    await agregarPalito();
    expect(cotizar).toHaveBeenLastCalledWith({
      lineas: [{ producto_venta_id: 'p-palito', cantidad: 1, descuento_linea_pct: 0, modificadores: [] }],
      descuento_global_pct: 0,
    });
  });

  it('producto con grupos abre el selector y agrega la línea con detalle', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Pote 1/4' }));
    fireEvent.click(screen.getByRole('button', { name: /Chocolate/ }));
    fireEvent.click(screen.getByRole('button', { name: /DDL/ }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar/ }));
    expect(await screen.findByText('Chocolate, DDL')).toBeInTheDocument();
    expect(screen.getAllByText('Pote 1/4').length).toBeGreaterThan(0);
  });

  it('COBRAR confirma el pago y muestra el ticket', async () => {
    montar();
    await agregarPalito();
    await cobrarEfectivo();
    expect(await screen.findByText(/V-C1-000001/)).toBeInTheDocument();
    const arg = confirmar.mock.calls[0][0];
    expect(arg.caja_id).toBe('caja-1');
    expect(arg.cliente_id).toBe('cf000000-0000-0000-0000-000000000001');
    expect(arg.lineas).toEqual([{ producto_venta_id: 'p-palito', cantidad: 1, descuento_linea_pct: 0, modificadores: [] }]);
    expect(arg.pagos[0]).toMatchObject({ medio_pago: 'efectivo', monto_centavos: 50000 });
  });

  it('Nueva venta vacía el carrito', async () => {
    montar();
    await agregarPalito();
    await cobrarEfectivo();
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }));
    expect(await screen.findByText('El carrito está vacío')).toBeInTheDocument();
  });

  it('STOCK_INSUFICIENTE muestra alerta y el cobro sigue abierto', async () => {
    confirmar.mockRejectedValue(new Error('STOCK_INSUFICIENTE:Palito'));
    montar();
    await agregarPalito();
    await cobrarEfectivo();
    const alerta = await screen.findByText(/No hay stock suficiente/);
    expect(alerta.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('LIMITE_CREDITO_EXCEDIDO pide Supervisor y reintenta con credenciales', async () => {
    confirmar.mockRejectedValueOnce(new Error('LIMITE_CREDITO_EXCEDIDO'));
    montar();
    await agregarPalito();
    await cobrarEfectivo();
    fireEvent.change(await screen.findByLabelText('Usuario Supervisor'), { target: { value: 'sup' } });
    fireEvent.change(screen.getByLabelText('Contraseña Supervisor'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
    expect(await screen.findByText(/V-C1-000001/)).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(confirmar.mock.calls[1][0].supervisor_credenciales).toEqual({ nombre_usuario: 'sup', password: 'pw' });
    expect(confirmar.mock.calls[1][0].pagos[0]).toMatchObject({ monto_centavos: 50000 });
  });

  it('con bloqueos COBRAR está deshabilitado', async () => {
    cotizar.mockResolvedValue(cotizacion({ bloqueos: [{ articulo_id: 'a1', nombre: 'Palito', stockResultante: -1 }] }));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Palito' }));
    await screen.findByText(/Sin stock suficiente de Palito/, undefined, { timeout: 3000 });
    expect(screen.getByRole('button', { name: 'COBRAR' })).toBeDisabled();
  });

  it('Imprimir llama a print.html con TICKET INTERNO', async () => {
    montar();
    await agregarPalito();
    await cobrarEfectivo();
    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir' }));
    await waitFor(() => expect(html).toHaveBeenCalled());
    expect(html.mock.calls[0][0]).toContain('TICKET INTERNO');
  });

  it('SUPERVISOR_INVALIDO en el reintento deja el modal abierto con el error y no reintenta solo', async () => {
    montar();
    await agregarPalito();
    await pedirSupervisor();
    confirmar.mockRejectedValueOnce(new Error('SUPERVISOR_INVALIDO'));
    autorizar();
    expect(await screen.findByText(/Usuario o contraseña incorrectos/)).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario Supervisor')).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(2);
  });

  it('cancelar el Supervisor vuelve al cobro', async () => {
    montar();
    await agregarPalito();
    await pedirSupervisor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Usuario Supervisor')).toBeNull();
  });

  it('reintento con credenciales que falla por otro error cierra el Supervisor y vuelve al cobro con alerta', async () => {
    montar();
    await agregarPalito();
    await pedirSupervisor();
    confirmar.mockRejectedValueOnce(new Error('STOCK_INSUFICIENTE:Palito'));
    autorizar();
    const alerta = await screen.findByText(/No hay stock suficiente/);
    expect(alerta.closest('[role="alert"]')).not.toBeNull();
    expect(screen.queryByLabelText('Usuario Supervisor')).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('Nueva venta devuelve el cliente a Consumidor Final', async () => {
    montar();
    await agregarPalito();
    await elegirJuan();
    expect(screen.getByText('Juan García')).toBeInTheDocument();
    await cobrarEfectivo();
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }));
    expect(await screen.findByText('El carrito está vacío')).toBeInTheDocument();
    expect(screen.getByText('Consumidor Final')).toBeInTheDocument();
    expect(screen.queryByText('Juan García')).toBeNull();
  });

  it('un cliente con cuenta corriente habilita Cta. Corriente en el cobro; Consumidor Final no', async () => {
    montar();
    await agregarPalito();
    fireEvent.click(screen.getByRole('button', { name: 'COBRAR' }));
    await screen.findByLabelText('Monto');
    expect(screen.queryByRole('option', { name: 'Cta. Corriente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await elegirJuan();
    fireEvent.click(screen.getByRole('button', { name: 'COBRAR' }));
    await screen.findByLabelText('Monto');
    expect(screen.getByRole('option', { name: 'Cta. Corriente' })).toBeInTheDocument();
  });

  describe('catálogo vacío', () => {
    const BOTON = 'Cargar catálogo demo de heladería';

    it('con permiso muestra el botón; al click siembra y recarga el catálogo sin recargar la página', async () => {
      mockCan = true;
      catalogo.mockResolvedValueOnce({ categorias: CATALOGO.categorias, productos: [] }).mockResolvedValue(CATALOGO);
      seedHeladeria.mockResolvedValue(undefined);
      montar();
      fireEvent.click(await screen.findByRole('button', { name: BOTON }));
      expect(await screen.findByRole('button', { name: 'Palito' })).toBeInTheDocument();
      expect(seedHeladeria).toHaveBeenCalledTimes(1);
      expect(catalogo).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('button', { name: BOTON })).toBeNull();
    });

    it('sin permiso no hay botón y se pide a un Supervisor', async () => {
      mockCan = false;
      catalogo.mockResolvedValue({ categorias: [], productos: [] });
      montar();
      expect(await screen.findByText(/Pedile a un Supervisor/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: BOTON })).toBeNull();
    });

    it('si seedHeladeria rechaza muestra una alerta y el botón sigue disponible', async () => {
      mockCan = true;
      catalogo.mockResolvedValue({ categorias: [], productos: [] });
      seedHeladeria.mockRejectedValue(new Error('boom'));
      montar();
      fireEvent.click(await screen.findByRole('button', { name: BOTON }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: BOTON })).toBeEnabled();
    });
  });
});
