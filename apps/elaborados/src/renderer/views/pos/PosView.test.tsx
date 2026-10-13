import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PosView } from './PosView';

let mockCaja: any = { id: 'caja-1' };
let mockCan = false;
let mockAnular = false;
vi.mock('@core/ui', async (orig) => ({
  ...(await orig<any>()),
  useAuth: () => ({ ...(({} as any)), can: (c: string) => (c === 'venta.anular' ? mockAnular : mockCan) }),
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
const anular = vi.fn();
const html = vi.fn();
const list = vi.fn();
const seedHeladeria = vi.fn();
const listar = vi.fn();
const pausar = vi.fn();
const retomar = vi.fn();
const descartar = vi.fn();
vi.stubGlobal('elaborados', {
  venta: { catalogo, cotizar, confirmar, anular }, print: { html }, cliente: { list },
  demoCatalog: { seedHeladeria },
  ventaEspera: { listar, pausar, retomar, descartar },
});

const PEDIDOS = [
  { id: 've-1', alias: 'Ana', observaciones: 'Calle 1', en_espera_desde: Date.now(), turno_creacion_id: null, cliente_id: 'c1', total: 2700, count_items: 1, vencida: false },
  { id: 've-2', alias: 'Beto', observaciones: null, en_espera_desde: Date.now(), turno_creacion_id: null, cliente_id: 'cf000000-0000-0000-0000-000000000001', total: 500, count_items: 1, vencida: false },
];
const LINEA_POTE = {
  producto_venta_id: 'p-pote', nombre: 'Pote 1/4', cantidad: 2, descuento_linea_pct: 5,
  modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-choco', 'o-ddl'] }],
};
const RETOMADO = {
  venta_id: 've-1', alias: 'Ana', observaciones: 'Calle 1', descuento_global_pct: 10,
  cliente: { id: 'c1', nombre_completo: 'Juan García', habilita_cuenta_corriente: true },
  lineas: [LINEA_POTE],
};

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
  mockAnular = false;
  catalogo.mockResolvedValue(CATALOGO);
  cotizar.mockResolvedValue(cotizacion());
  confirmar.mockResolvedValue(RESULTADO);
  html.mockResolvedValue(undefined);
  list.mockResolvedValue([
    { id: 'c1', nombre: 'Juan', apellido: 'García', numero_documento: '20111222', habilita_cuenta_corriente: true },
  ]);
  listar.mockResolvedValue([]);
  pausar.mockResolvedValue({ id: 've-nuevo' });
  retomar.mockResolvedValue(RETOMADO);
  descartar.mockResolvedValue({ ok: true });
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

  describe('pedidos en espera', () => {
    const CF = 'cf000000-0000-0000-0000-000000000001';
    const accionGuardar = () => screen.getByRole('button', { name: 'Guardar pedido' });
    const modalGuardar = () => screen.getByRole('dialog', { name: 'Guardar pedido' });
    const panel = () => screen.getByRole('dialog', { name: 'Pedidos pendientes' });
    const abrirPedidos = async (n = 2) => {
      fireEvent.click(await screen.findByRole('button', { name: `Pedidos (${n})` }));
      return panel();
    };
    const retomarPrimero = async () => {
      const p = await abrirPedidos();
      await screen.findByRole('button', { name: 'Palito' }); // catálogo cargado
      fireEvent.click(within(p).getAllByRole('button', { name: 'Retomar' })[0]!);
    };
    beforeEach(() => { listar.mockResolvedValue(PEDIDOS); });
    const guardarCon = (alias?: string, obs?: string) => {
      fireEvent.click(accionGuardar());
      const m = modalGuardar();
      if (alias !== undefined) fireEvent.change(within(m).getByLabelText('Alias del pedido'), { target: { value: alias } });
      if (obs !== undefined) fireEvent.change(within(m).getByLabelText('Observaciones'), { target: { value: obs } });
      fireEvent.click(within(m).getByRole('button', { name: 'Guardar pedido' }));
    };

    it('Guardar pedido: deshabilitado vacío; con una línea guarda sin precios, limpia el carrito y avisa', async () => {
      montar();
      await screen.findByRole('button', { name: 'Palito' });
      expect(accionGuardar()).toBeDisabled();
      await agregarPalito();
      guardarCon('  Ana  ', ' Calle 1 ');
      await waitFor(() => expect(pausar).toHaveBeenCalledTimes(1));
      expect(pausar.mock.calls[0][0]).toEqual({
        caja_id: 'caja-1', cliente_id: CF,
        lineas: [{ producto_venta_id: 'p-palito', cantidad: 1, descuento_linea_pct: 0, modificadores: [] }],
        descuento_global_pct: 0, alias: 'Ana', observaciones: 'Calle 1',
      });
      expect(await screen.findByRole('status')).toHaveTextContent('Pedido guardado');
      expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Guardar pedido' })).toBeNull();
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    });

    it('pausar rechaza MAX_EN_ESPERA: alerta traducida y el modal sigue abierto', async () => {
      pausar.mockRejectedValue(new Error('MAX_EN_ESPERA'));
      montar();
      await agregarPalito();
      guardarCon('Ana');
      const alerta = await within(modalGuardar()).findByRole('alert');
      expect(alerta).toHaveTextContent('Llegaste al máximo de ventas en espera.');
      expect(modalGuardar()).toBeInTheDocument();
      expect(screen.queryByText('El carrito está vacío')).toBeNull();
    });

    it('Pedidos (2) abre el panel; Retomar carga líneas, sabores, descuento global y cliente, y muestra el chip', async () => {
      montar();
      await retomarPrimero();
      await waitFor(() => expect(retomar).toHaveBeenCalledWith({ venta_id: 've-1' }));
      expect(await screen.findByText('Chocolate, DDL')).toBeInTheDocument();
      expect(screen.getAllByText('Pote 1/4').length).toBeGreaterThan(0);
      expect(screen.getByLabelText('Descuento global')).toHaveValue(10);
      expect(screen.getByLabelText('Descuento de línea')).toHaveValue(5);
      expect(screen.getByText('Pedido: Ana')).toBeInTheDocument();
      // el selector muestra el cliente del pedido (no el genérico "Cliente")
      expect(screen.getByText('Juan García')).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Pedidos pendientes' })).toBeNull();
      await waitFor(() => expect(cotizar).toHaveBeenLastCalledWith({
        lineas: [{ producto_venta_id: 'p-pote', cantidad: 2, descuento_linea_pct: 5, modificadores: LINEA_POTE.modificadores }],
        descuento_global_pct: 10,
      }));
      // el cliente del pedido habilita cuenta corriente en el cobro
      await waitFor(() => expect(screen.getByRole('button', { name: 'COBRAR' })).toBeEnabled(), { timeout: 3000 });
      fireEvent.click(screen.getByRole('button', { name: 'COBRAR' }));
      await screen.findByLabelText('Monto');
      expect(screen.getByRole('option', { name: 'Cta. Corriente' })).toBeInTheDocument();
    });

    it('retomar con un producto que ya no está en el catálogo lo omite y avisa', async () => {
      retomar.mockResolvedValue({
        ...RETOMADO,
        lineas: [LINEA_POTE, { producto_venta_id: 'p-borrado', nombre: 'Viejo', cantidad: 1, descuento_linea_pct: 0, modificadores: [] }],
      });
      montar();
      await retomarPrimero();
      expect(await screen.findByRole('status')).toHaveTextContent('1 producto(s) del pedido ya no están disponibles');
      expect(screen.getByText('Chocolate, DDL')).toBeInTheDocument();
      expect(screen.queryByText('Viejo')).toBeNull();
      expect(screen.getByText('Pedido: Ana')).toBeInTheDocument();
    });

    it('retomar un pedido sin ningún producto disponible no lo vincula y deja el carrito vacío', async () => {
      retomar.mockResolvedValue({
        ...RETOMADO,
        lineas: [{ producto_venta_id: 'p-borrado', nombre: 'Viejo', cantidad: 1, descuento_linea_pct: 0, modificadores: [] }],
      });
      montar();
      await retomarPrimero();
      expect(await screen.findByRole('status')).toHaveTextContent('1 producto(s) del pedido ya no están disponibles');
      expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
      expect(screen.queryByText(/Pedido: /)).toBeNull();
    });

    it('con un pedido retomado: COBRAR confirma con venta_en_espera_id y suelta el chip; Guardar manda venta_id', async () => {
      montar();
      await retomarPrimero();
      await screen.findByText('Pedido: Ana');
      await waitFor(() => expect(screen.getByRole('button', { name: 'COBRAR' })).toBeEnabled(), { timeout: 3000 });
      await cobrarEfectivo();
      expect(await screen.findByText(/V-C1-000001/)).toBeInTheDocument();
      expect(confirmar.mock.calls[0][0]).toMatchObject({ venta_en_espera_id: 've-1', cliente_id: 'c1', descuento_global_pct: 10 });
      expect(screen.queryByText('Pedido: Ana')).toBeNull();
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole('button', { name: 'Nueva venta' }));
      await retomarPrimero();
      await screen.findByText('Pedido: Ana');
      fireEvent.click(accionGuardar());
      expect(within(modalGuardar()).getByLabelText('Alias del pedido')).toHaveValue('Ana');
      expect(within(modalGuardar()).getByLabelText('Observaciones')).toHaveValue('Calle 1');
      fireEvent.click(within(modalGuardar()).getByRole('button', { name: 'Guardar pedido' }));
      await waitFor(() => expect(pausar).toHaveBeenCalledTimes(1));
      expect(pausar.mock.calls[0][0]).toMatchObject({ venta_id: 've-1', cliente_id: 'c1', alias: 'Ana', descuento_global_pct: 10 });
      expect(await screen.findByText('El carrito está vacío')).toBeInTheDocument();
      expect(screen.queryByText('Pedido: Ana')).toBeNull();
    });

    it('Soltar desvincula el pedido: el siguiente guardado ya no manda venta_id', async () => {
      montar();
      await retomarPrimero();
      await screen.findByText('Pedido: Ana');
      fireEvent.click(screen.getByRole('button', { name: 'Soltar pedido' }));
      expect(screen.queryByText('Pedido: Ana')).toBeNull();
      expect(screen.getByText('Chocolate, DDL')).toBeInTheDocument();
      guardarCon('Otro');
      await waitFor(() => expect(pausar).toHaveBeenCalledTimes(1));
      expect(pausar.mock.calls[0][0]).not.toHaveProperty('venta_id');
      expect(pausar.mock.calls[0][0].alias).toBe('Otro');
    });

    it('Descartar pide confirmación, llama a descartar y refresca la lista', async () => {
      montar();
      const p = await abrirPedidos();
      fireEvent.click(within(p).getAllByRole('button', { name: 'Descartar' })[0]!);
      expect(descartar).not.toHaveBeenCalled();
      fireEvent.click(within(p).getByRole('button', { name: 'Sí, descartar' }));
      await waitFor(() => expect(descartar).toHaveBeenCalledWith({ venta_id: 've-1' }));
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    });

    it('M-1: quitar todas las líneas de un pedido retomado lo desvincula; el cobro siguiente no lo consume', async () => {
      montar();
      await retomarPrimero();
      await screen.findByText('Pedido: Ana');
      fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
      expect(await screen.findByText('El carrito está vacío')).toBeInTheDocument();
      expect(screen.queryByText('Pedido: Ana')).toBeNull();
      await agregarPalito();
      await cobrarEfectivo();
      expect(await screen.findByText(/V-C1-000001/)).toBeInTheDocument();
      expect(confirmar).toHaveBeenCalledTimes(1);
      expect(confirmar.mock.calls[0][0]).not.toHaveProperty('venta_en_espera_id');
    });

    it('M-4: retomar con el catálogo sin cargar avisa y no llama a retomar ni vincula', async () => {
      catalogo.mockReturnValue(new Promise(() => {})); // nunca resuelve
      montar();
      const p = await abrirPedidos();
      fireEvent.click(within(p).getAllByRole('button', { name: 'Retomar' })[0]!);
      expect(await within(p).findByRole('alert')).toHaveTextContent('El catálogo todavía no cargó. Probá de nuevo en un momento.');
      expect(retomar).not.toHaveBeenCalled();
      expect(screen.queryByText(/Pedido: /)).toBeNull();
      expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
    });

    it('si confirmar falla con un pedido vinculado, el vínculo (chip) se conserva', async () => {
      confirmar.mockRejectedValue(new Error('STOCK_INSUFICIENTE:Pote'));
      montar();
      await retomarPrimero();
      await screen.findByText('Pedido: Ana');
      await waitFor(() => expect(screen.getByRole('button', { name: 'COBRAR' })).toBeEnabled(), { timeout: 3000 });
      await cobrarEfectivo();
      await screen.findByText(/No hay stock suficiente/);
      expect(confirmar.mock.calls[0][0]).toMatchObject({ venta_en_espera_id: 've-1' });
      expect(screen.getByText('Pedido: Ana')).toBeInTheDocument();
    });

    it('el reintento por LIMITE_CREDITO_EXCEDIDO con pedido vinculado manda venta_en_espera_id también con credenciales', async () => {
      montar();
      await retomarPrimero();
      await screen.findByText('Pedido: Ana');
      await waitFor(() => expect(screen.getByRole('button', { name: 'COBRAR' })).toBeEnabled(), { timeout: 3000 });
      await pedirSupervisor();
      autorizar();
      expect(await screen.findByText(/V-C1-000001/)).toBeInTheDocument();
      expect(confirmar).toHaveBeenCalledTimes(2);
      expect(confirmar.mock.calls[0][0]).toMatchObject({ venta_en_espera_id: 've-1' });
      expect(confirmar.mock.calls[1][0]).toMatchObject({
        venta_en_espera_id: 've-1',
        supervisor_credenciales: { nombre_usuario: 'sup', password: 'pw' },
      });
    });

    it('error de retomar → alerta traducida en el panel, sin vincular', async () => {
      retomar.mockRejectedValue(new Error("Error invoking remote method 'venta.espera:retomar': Error: VENTA_NO_EN_ESPERA"));
      montar();
      await retomarPrimero();
      expect(await within(panel()).findByRole('alert')).toHaveTextContent('La venta ya no está en espera.');
      expect(screen.queryByText(/Pedido: /)).toBeNull();
    });

    it('error de descartar → alerta traducida en el panel', async () => {
      descartar.mockRejectedValue(new Error("Error invoking remote method 'venta.espera:descartar': Error: VENTA_ESPERA_NOT_FOUND"));
      montar();
      const p = await abrirPedidos();
      fireEvent.click(within(p).getAllByRole('button', { name: 'Descartar' })[0]!);
      fireEvent.click(within(p).getByRole('button', { name: 'Sí, descartar' }));
      expect(await within(p).findByRole('alert')).toHaveTextContent('No se encontró la venta en espera.');
    });

    it('con el carrito no vacío Retomar está deshabilitado en el panel', async () => {
      montar();
      await agregarPalito();
      const p = await abrirPedidos();
      for (const b of within(p).getAllByRole('button', { name: 'Retomar' })) expect(b).toBeDisabled();
      expect(within(p).getByText(/Guardá o vaciá el carrito actual/)).toBeInTheDocument();
    });
  });

  describe('anulación desde el ticket', () => {
    const cobrarHastaTicket = async () => {
      confirmar.mockResolvedValue({ ...RESULTADO, venta: { ...RESULTADO.venta, id: 'v-9' } });
      montar();
      await agregarPalito();
      await cobrarEfectivo();
      await screen.findByText('Ticket interno');
    };

    it('con venta.anular el flujo motivo → Supervisor llama a venta.anular y el ticket queda ANULADA', async () => {
      mockAnular = true;
      anular.mockResolvedValue({ ok: true });
      await cobrarHastaTicket();
      fireEvent.click(screen.getByRole('button', { name: 'Anular venta' }));
      fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Error de carga' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      fireEvent.change(screen.getByLabelText('Usuario Supervisor'), { target: { value: 'sup' } });
      fireEvent.change(screen.getByLabelText('Contraseña Supervisor'), { target: { value: 'clave' } });
      fireEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
      expect(await screen.findByText('ANULADA')).toBeInTheDocument();
      expect(anular).toHaveBeenCalledWith({
        venta_id: 'v-9', motivo: 'Error de carga',
        supervisor_credenciales: { nombre_usuario: 'sup', password: 'clave' },
      });
    });

    it('SUPERVISOR_INVALIDO envuelto por Electron muestra el mensaje amigable y deja reintentar', async () => {
      mockAnular = true;
      anular.mockRejectedValueOnce(new Error("Error invoking remote method 'venta:anular': Error: SUPERVISOR_INVALIDO"));
      anular.mockResolvedValue({ ok: true });
      await cobrarHastaTicket();
      fireEvent.click(screen.getByRole('button', { name: 'Anular venta' }));
      fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Error de carga' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      fireEvent.change(screen.getByLabelText('Usuario Supervisor'), { target: { value: 'sup' } });
      fireEvent.change(screen.getByLabelText('Contraseña Supervisor'), { target: { value: 'mala' } });
      fireEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
      expect(await screen.findByText('Usuario o contraseña incorrectos, o no es Supervisor.')).toBeInTheDocument();
      expect(screen.queryByText(/invoking remote method/)).toBeNull();
      expect(screen.queryByText('ANULADA')).toBeNull();
      // el modal sigue abierto: se puede reintentar con otra clave
      fireEvent.change(screen.getByLabelText('Contraseña Supervisor'), { target: { value: 'buena' } });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Autorizar' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
      expect(await screen.findByText('ANULADA')).toBeInTheDocument();
      expect(anular).toHaveBeenCalledTimes(2);
    });

    it('sin venta.anular el ticket no ofrece Anular venta', async () => {
      mockAnular = false;
      await cobrarHastaTicket();
      expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull();
    });
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
