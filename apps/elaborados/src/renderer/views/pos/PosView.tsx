import { useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bridge, traducirError, useAuth, useCajaActiva,
  ConfirmarVentaModal, TicketModal, SupervisorAuthModal,
} from '@core/ui';
import type { PagoComprobante } from '@ferreteria/shared';
import { usePosCatalogo } from '../../hooks/usePosCatalogo';
import { usePosCotizacion } from '../../hooks/usePosCotizacion';
import { aPayload, carritoInicial, carritoReducer } from './carritoReducer';
import { CarritoPanel } from './CarritoPanel';
import { ClienteSelector } from './ClienteSelector';
import { CONSUMIDOR_FINAL, type ClientePos } from './consumidorFinal';
import { ProductosGrilla } from './ProductosGrilla';
import { SelectorSaboresModal } from './SelectorSaboresModal';
import { ticketDesdeVentaElaborados } from './ticketElaborados';
import type { ModificadorElegido, ProductoPos } from './tipos';

type Pagos = Parameters<NonNullable<React.ComponentProps<typeof ConfirmarVentaModal>['onConfirmar']>>[0];
type Creds = { nombre_usuario: string; password: string };
type VentaTerminada = { resultado: any; pagos: Pagos; cliente: ClientePos };

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e ?? ''));

export function PosView() {
  const { caja, isLoading } = useCajaActiva();
  const { catalogo, error: errorCatalogo, recargar } = usePosCatalogo();
  const { can } = useAuth();
  const [sembrando, setSembrando] = useState(false);
  const [errorSiembra, setErrorSiembra] = useState<string | null>(null);
  const [estado, dispatch] = useReducer(carritoReducer, carritoInicial);
  const [cliente, setCliente] = useState<ClientePos>(CONSUMIDOR_FINAL);
  const payload = useMemo(() => aPayload(estado), [estado]);
  const { cotizacion, cotizando, error: errorCotizacion } = usePosCotizacion(payload);

  const [productoElegido, setProductoElegido] = useState<ProductoPos | null>(null);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [errorCobro, setErrorCobro] = useState<string | null>(null);
  const [limitePendiente, setLimitePendiente] = useState<Pagos | null>(null);
  const [terminada, setTerminada] = useState<VentaTerminada | null>(null);

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
    });
    setTerminada({ resultado, pagos, cliente });
    setCobroAbierto(false);
    setLimitePendiente(null);
    dispatch({ tipo: 'limpiar' });
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
  };

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
      >
        <ClienteSelector clienteId={cliente.id} onCambiar={setCliente} />
      </CarritoPanel>

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
          />
        </>
      )}
    </div>
  );
}
