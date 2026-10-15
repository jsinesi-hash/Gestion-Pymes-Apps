import { useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bridge, traducirError, useAuth, useCajaActiva,
  ConfirmarVentaModal, TicketModal, SupervisorAuthModal, AnulacionModal,
} from '@core/ui';
import type { PagoComprobante } from '@ferreteria/shared';
import { usePosCatalogo } from '../../hooks/usePosCatalogo';
import { usePosCotizacion } from '../../hooks/usePosCotizacion';
import { usePedidosPendientes } from '../../hooks/usePedidosPendientes';
import { aPayload, carritoInicial, carritoReducer, type CarritoAction } from './carritoReducer';
import { CarritoPanel } from './CarritoPanel';
import { ClienteSelector } from './ClienteSelector';
import { CONSUMIDOR_FINAL, type ClientePos } from './consumidorFinal';
import { GuardarPedidoModal } from './GuardarPedidoModal';
import { PedidosPendientesPanel } from './PedidosPendientesPanel';
import { ProductosGrilla } from './ProductosGrilla';
import { SelectorSaboresModal } from './SelectorSaboresModal';
import { ticketDesdeVentaElaborados } from './ticketElaborados';
import type { ModificadorElegido, ProductoPos } from './tipos';

type Pagos = Parameters<NonNullable<React.ComponentProps<typeof ConfirmarVentaModal>['onConfirmar']>>[0];
type Creds = { nombre_usuario: string; password: string };
type VentaTerminada = { resultado: any; pagos: Pagos; cliente: ClientePos };
type PedidoActual = { id: string; alias: string | null; observaciones: string | null };
type LineaCargar = Extract<CarritoAction, { tipo: 'cargar' }>['lineas'][number];
/** Respuesta de `ventaEspera.retomar` (líneas sin precios; el carrito vuelve a cotizar). */
type PedidoRetomado = {
  venta_id: string;
  alias: string | null;
  observaciones: string | null;
  descuento_global_pct: number;
  cliente: ClientePos | null;
  lineas: { producto_venta_id: string; nombre: string; cantidad: number; descuento_linea_pct: number; modificadores: ModificadorElegido[] }[];
};

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e ?? ''));

export function PosView() {
  const { caja, isLoading } = useCajaActiva();
  const { can } = useAuth();
  const [sembrando, setSembrando] = useState(false);
  const [errorSiembra, setErrorSiembra] = useState<string | null>(null);
  const [estado, dispatch] = useReducer(carritoReducer, carritoInicial);
  const [cliente, setCliente] = useState<ClientePos>(CONSUMIDOR_FINAL);
  const { catalogo, error: errorCatalogo, recargar } = usePosCatalogo(cliente.id);
  const payload = useMemo(() => aPayload(estado), [estado]);
  // ADR-104: el cliente viaja en la cotización para que el main aplique su lista de precios.
  const payloadCotizar = useMemo(() => ({ ...payload, cliente_id: cliente.id }), [payload, cliente.id]);
  const { cotizacion, cotizando, error: errorCotizacion } = usePosCotizacion(payloadCotizar);

  const [productoElegido, setProductoElegido] = useState<ProductoPos | null>(null);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [errorCobro, setErrorCobro] = useState<string | null>(null);
  const [limitePendiente, setLimitePendiente] = useState<Pagos | null>(null);
  const [terminada, setTerminada] = useState<VentaTerminada | null>(null);

  const { pedidos, error: errorListaPedidos, recargar: recargarPedidos } = usePedidosPendientes();
  const [pedidoActual, setPedidoActual] = useState<PedidoActual | null>(null);
  const [guardarAbierto, setGuardarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [pedidosAbierto, setPedidosAbierto] = useState(false);
  const [errorPedidos, setErrorPedidos] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // M-1: si el operador vacía el carrito de un pedido retomado, se desvincula; si no, el próximo
  // carrito (contenido ajeno) se cobraría consumiendo ese pedido. Antes del early return (hooks).
  const carritoVacio = estado.lineas.length === 0;
  useEffect(() => {
    if (carritoVacio) setPedidoActual(null);
  }, [carritoVacio]);

  if (isLoading || caja === undefined) return null;

  if (caja === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <p>Necesitás una caja abierta para vender</p>
        <Link to="/caja">Abrir caja</Link>
      </div>
    );
  }
  const cajaId = caja.id;

  async function cargarDemo() {
    setErrorSiembra(null);
    setSembrando(true);
    try {
      await (bridge() as any).demoCatalog.seedHeladeria();
      recargar();
    } catch (e) {
      setErrorSiembra(traducirError(e).mensaje);
    } finally {
      setSembrando(false);
    }
  }

  const elegirProducto = (p: ProductoPos) => {
    if (p.grupos.length > 0) setProductoElegido(p);
    else dispatch({ tipo: 'agregar', producto: p, modificadores: [] });
  };

  const confirmarSabores = (modificadores: ModificadorElegido[]) => {
    if (productoElegido) dispatch({ tipo: 'agregar', producto: productoElegido, modificadores });
    setProductoElegido(null);
  };

  async function confirmar(pagos: Pagos, supervisor?: Creds) {
    const resultado = await (bridge() as any).venta.confirmar({
      caja_id: cajaId,
      cliente_id: cliente.id,
      ...payload,
      pagos,
      ...(supervisor ? { supervisor_credenciales: supervisor } : {}),
      ...(pedidoActual ? { venta_en_espera_id: pedidoActual.id } : {}),
    });
    setTerminada({ resultado, pagos, cliente });
    setCobroAbierto(false);
    setLimitePendiente(null);
    dispatch({ tipo: 'limpiar' });
    if (pedidoActual) {
      setPedidoActual(null);
      recargarPedidos();
    }
  }

  const abrirGuardar = () => {
    setAviso(null);
    setErrorGuardar(null);
    setGuardarAbierto(true);
  };

  async function guardarPedido(datos: { alias: string; observaciones: string }) {
    setErrorGuardar(null);
    setGuardando(true);
    try {
      await (bridge() as any).ventaEspera.pausar({
        caja_id: cajaId,
        cliente_id: cliente.id,
        ...payload,
        alias: datos.alias,
        observaciones: datos.observaciones,
        ...(pedidoActual ? { venta_id: pedidoActual.id } : {}),
      });
      setGuardarAbierto(false);
      dispatch({ tipo: 'limpiar' });
      setPedidoActual(null);
      setCliente(CONSUMIDOR_FINAL);
      recargarPedidos();
      setAviso('Pedido guardado');
    } catch (e) {
      setErrorGuardar(traducirError(e).mensaje);
    } finally {
      setGuardando(false);
    }
  }

  const abrirPedidos = () => {
    setAviso(null);
    setErrorPedidos(null);
    setPedidosAbierto(true);
  };

  async function retomarPedido(id: string) {
    setErrorPedidos(null);
    // M-4: sin catálogo cargado todas las líneas parecerían "no disponibles" (aviso falso).
    if (!catalogo) {
      setErrorPedidos('El catálogo todavía no cargó. Probá de nuevo en un momento.');
      return;
    }
    try {
      const r = (await (bridge() as any).ventaEspera.retomar({ venta_id: id })) as PedidoRetomado;
      const productos = new Map(catalogo.productos.map((p) => [p.id, p] as const));
      const lineas: LineaCargar[] = [];
      let omitidas = 0;
      for (const l of r.lineas) {
        const producto = productos.get(l.producto_venta_id);
        if (!producto) { omitidas += 1; continue; }
        lineas.push({ producto, cantidad: l.cantidad, descuento_linea_pct: l.descuento_linea_pct, modificadores: l.modificadores });
      }
      setPedidosAbierto(false);
      setAviso(omitidas > 0 ? `${omitidas} producto(s) del pedido ya no están disponibles` : null);
      if (lineas.length === 0) return; // nada que cargar: el pedido queda pendiente, sin vincular
      dispatch({ tipo: 'cargar', lineas, descuentoGlobalPct: r.descuento_global_pct });
      setCliente(r.cliente ?? CONSUMIDOR_FINAL);
      setPedidoActual({ id: r.venta_id, alias: r.alias, observaciones: r.observaciones });
    } catch (e) {
      setErrorPedidos(traducirError(e).mensaje);
    }
  }

  async function descartarPedido(id: string) {
    setErrorPedidos(null);
    try {
      await (bridge() as any).ventaEspera.descartar({ venta_id: id });
      recargarPedidos();
    } catch (e) {
      setErrorPedidos(traducirError(e).mensaje);
    }
  }

  async function handleConfirmarCobro(pagos: Pagos) {
    setErrorCobro(null);
    setConfirmando(true);
    try {
      await confirmar(pagos);
    } catch (e) {
      if (mensaje(e).includes('LIMITE_CREDITO_EXCEDIDO')) {
        setCobroAbierto(false);
        setLimitePendiente(pagos);
      } else {
        setErrorCobro(traducirError(e).mensaje);
      }
    } finally {
      setConfirmando(false);
    }
  }

  async function handleLimiteAuth(creds: Creds) {
    if (!limitePendiente) return;
    try {
      await confirmar(limitePendiente, creds);
    } catch (e) {
      if (mensaje(e).includes('SUPERVISOR_INVALIDO')) {
        // El SupervisorAuthModal lo muestra dentro del modal y deja reintentar.
        throw new Error('SUPERVISOR_INVALIDO');
      }
      setLimitePendiente(null);
      setCobroAbierto(true);
      setErrorCobro(traducirError(e).mensaje);
    }
  }

  const nuevaVenta = () => {
    setTerminada(null);
    setCliente(CONSUMIDOR_FINAL);
    setErrorCobro(null);
    setPedidoActual(null);
  };

  const acciones = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pedidoActual && (
        <div className="badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>Pedido: {pedidoActual.alias ?? 'sin alias'}</span>
          <button type="button" className="btn-secondary" aria-label="Soltar pedido" onClick={() => setPedidoActual(null)}>
            Soltar
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-secondary" disabled={estado.lineas.length === 0} onClick={abrirGuardar}>
          Guardar pedido
        </button>
        <button type="button" className="btn-secondary" onClick={abrirPedidos}>
          {pedidos.length > 0 ? `Pedidos (${pedidos.length})` : 'Pedidos'}
        </button>
      </div>
    </div>
  );

  const comprobante = terminada
    ? ticketDesdeVentaElaborados(
        terminada.resultado,
        { nombre: terminada.cliente.nombre_completo },
        terminada.pagos.map((p): PagoComprobante => ({
          medio: p.medio_pago,
          montoCentavos: p.monto_centavos,
          ...(p.recargo_centavos !== undefined ? { recargoCentavos: p.recargo_centavos } : {}),
        })),
      )
    : null;
  const ventaTerminadaId: string = terminada?.resultado?.venta?.id;
  const advertencias: { nombre: string }[] = terminada?.resultado?.advertencias ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 16, padding: 16, alignItems: 'start' }}>
      <div>
        {errorCatalogo && <div role="alert" style={{ color: 'var(--danger, #b3261e)' }}>{errorCatalogo}</div>}
        {catalogo && (
          <ProductosGrilla categorias={catalogo.categorias} productos={catalogo.productos} onElegir={elegirProducto} />
        )}
        {catalogo && !errorCatalogo && catalogo.productos.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 12 }}>
            {can('producto_venta.gestionar') ? (
              <button type="button" className="btn-primary" disabled={sembrando} onClick={cargarDemo}>
                Cargar catálogo demo de heladería
              </button>
            ) : (
              <p>Pedile a un Supervisor que cargue los productos en Carta → Productos de venta.</p>
            )}
            {errorSiembra && <div role="alert" style={{ color: 'var(--danger, #b3261e)' }}>{errorSiembra}</div>}
            <Link to="/carta/productos">Ir a Carta → Productos de venta</Link>
          </div>
        )}
      </div>
      <CarritoPanel
        lineas={estado.lineas}
        cotizacion={cotizacion}
        cotizando={cotizando}
        errorCotizacion={errorCotizacion}
        descuentoGlobalPct={estado.descuentoGlobalPct}
        onCantidad={(key, cantidad) => dispatch({ tipo: 'cantidad', key, cantidad })}
        onQuitar={(key) => dispatch({ tipo: 'quitar', key })}
        onDescuentoLinea={(key, pct) => dispatch({ tipo: 'descuentoLinea', key, pct })}
        onDescuentoGlobal={(pct) => dispatch({ tipo: 'descuentoGlobal', pct })}
        onCobrar={() => { setErrorCobro(null); setCobroAbierto(true); }}
        puedeCobrar
        acciones={acciones}
      >
        <ClienteSelector clienteId={cliente.id} nombre={cliente.nombre_completo} onCambiar={setCliente} />
      </CarritoPanel>

      {aviso && (
        <div role="status" style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: 'var(--bg, #fff)', padding: '8px 16px' }}>
          {aviso}
        </div>
      )}

      {guardarAbierto && (
        <GuardarPedidoModal
          {...(pedidoActual ? { inicial: { alias: pedidoActual.alias ?? '', observaciones: pedidoActual.observaciones ?? '' } } : {})}
          guardando={guardando}
          error={errorGuardar}
          onGuardar={guardarPedido}
          onCancelar={() => { setGuardarAbierto(false); setErrorGuardar(null); }}
        />
      )}

      {pedidosAbierto && (
        <PedidosPendientesPanel
          pedidos={pedidos}
          pedidoActualId={pedidoActual?.id ?? null}
          carritoVacio={carritoVacio}
          onRetomar={retomarPedido}
          onDescartar={descartarPedido}
          onCerrar={() => { setPedidosAbierto(false); setErrorPedidos(null); }}
          error={errorPedidos ?? errorListaPedidos}
        />
      )}

      {productoElegido && (
        <SelectorSaboresModal
          producto={productoElegido}
          onConfirmar={confirmarSabores}
          onCancelar={() => setProductoElegido(null)}
        />
      )}

      {cobroAbierto && cotizacion && (
        <>
          <ConfirmarVentaModal
            totales={{ totalCentavos: cotizacion.total_centavos }}
            formaPagoDefault="efectivo"
            habilitaCcc={cliente.habilita_cuenta_corriente}
            loading={confirmando}
            onConfirmar={handleConfirmarCobro}
            onVolver={() => { setCobroAbierto(false); setErrorCobro(null); }}
          />
          {errorCobro && (
            <div role="alert" style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--bg, #fff)', padding: '8px 16px', color: 'var(--danger, #b3261e)' }}>
              {errorCobro}
            </div>
          )}
        </>
      )}

      {limitePendiente && (
        <SupervisorAuthModal
          onConfirm={handleLimiteAuth}
          onCancel={() => { setLimitePendiente(null); setCobroAbierto(true); }}
        />
      )}

      {comprobante && (
        <>
          {advertencias.length > 0 && (
            <div role="status" style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: 'var(--bg, #fff)', padding: '8px 16px' }}>
              {advertencias.map((a) => `${a.nombre} quedó en negativo`).join('. ')}
            </div>
          )}
          <TicketModal
            comprobante={comprobante}
            onNuevaVenta={nuevaVenta}
            onImprimir={(html) => (bridge() as any).print.html(html)}
            {...(can('venta.anular')
              ? {
                  anulacion: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
                    <AnulacionModal ventaId={ventaTerminadaId} onSuccess={onSuccess} onCancel={onCancel} />
                  ),
                }
              : {})}
          />
        </>
      )}
    </div>
  );
}
