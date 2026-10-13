import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, ConfirmarVentaModal, TicketModal } from '@core/ui';
import { usePosSessionContext } from '../../context/PosSessionContext';
import type { VentaPagoPayload } from '../../hooks/usePosSession';
import { PosItemsTable } from './PosItemsTable';
import { PosTopBar } from './PosTopBar';
import { PosBottomBar } from './PosBottomBar';
import { CancelarVentaModal } from './CancelarVentaModal';
import { AnulacionModal } from './AnulacionModal';
import { ticketDesdeVentaRetail } from './ticketRetail';
import { PausarEsperaModal } from './PausarEsperaModal';
import { VentaEsperaDrawer } from './VentaEsperaDrawer';
import { LimiteCreditoAuthModal } from './LimiteCreditoAuthModal';

/** Traduce los códigos de error de venta a mensajes claros para el operador. */
function mensajeErrorVenta(codigo: string): string {
  if (codigo.includes('STOCK_INSUFICIENTE')) return 'No hay stock suficiente de algún producto para completar la venta. Revisá el carrito (un presupuesto puede cotizar productos sin stock, pero la venta requiere stock).';
  if (codigo.includes('PRODUCTO_INACTIVO')) return 'Hay un producto inactivo en la venta. Quitalo del carrito para continuar.';
  if (codigo.includes('SALDO_PENDIENTE')) return 'El pago ingresado no cubre el total de la venta.';
  if (codigo.includes('CAJA_REQUERIDA')) return 'Necesitás una caja abierta para vender.';
  if (codigo.includes('PRESUPUESTO_NO_CONVERTIBLE')) return 'El presupuesto ya no se puede convertir (fue anulado o convertido en otra venta).';
  if (codigo.includes('PAGOS_REQUERIDOS')) return 'Ingresá al menos un medio de pago.';
  return codigo ? `No se pudo confirmar la venta: ${codigo}` : 'No se pudo confirmar la venta.';
}

export function PosView() {
  const { can } = useAuth();
  const {
    cajaActiva, lines, descuentoGlobalPct, totales,
    loading, error, addLinea, updateCantidad, updateDescuentoLinea, updatePresentacion,
    removeLine, setDescuentoGlobal, confirmar, reset, clearError,
    clienteId, clienteInfo, setCliente,
    ventasEnEspera, cantidadEnEspera, pausarVenta, retomarVenta, descartarVenta,
    recargarVentasEnEspera, avisosRetomar, clearAvisosRetomar,
    precargarDesdePresupuesto, refrescarCaja,
  } = usePosSessionContext();

  const location = useLocation();

  // ADR-056 Lote 1: el provider del cart vive desde el login, así que el estado del cart
  // persiste entre navegaciones. Pero la caja puede haberse abierto/cerrado en /caja
  // mientras tanto: al (re)entrar a /pos re-consultamos la caja activa (solo lectura).
  useEffect(() => {
    void refrescarCaja();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ventaResult, setVentaResult] = useState<any>(null);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [pausarOpen, setPausarOpen] = useState(false);
  const [esperaDrawerOpen, setEsperaDrawerOpen] = useState(false);
  const [limiteAuth, setLimiteAuth] = useState<{ pagos: VentaPagoPayload[]; vuelto: number | null } | null>(null);
  const [avisoConversion, setAvisoConversion] = useState<string | null>(null);
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null);

  // ADR-046 §4: si se navegó desde "Convertir" un presupuesto, precargar el carrito.
  const presupuestoConvertido = useRef<string | null>(null);
  useEffect(() => {
    const presupId = (location.state as { presupuestoId?: string } | null)?.presupuestoId;
    if (presupId && presupuestoConvertido.current !== presupId) {
      presupuestoConvertido.current = presupId;
      void precargarDesdePresupuesto(presupId)
        .then((r) => { if (r.aviso) setAvisoConversion(r.aviso); })
        .catch(() => { /* error queda en session.error */ });
    }
  }, [location.state, precargarDesdePresupuesto]);

  if (cajaActiva === undefined) return null;

  if (cajaActiva === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div className="text-muted">Necesitás una caja abierta para vender.</div>
        <Link to="/caja" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Ir a Caja →</Link>
      </div>
    );
  }

  async function handleConfirmar(pagos: VentaPagoPayload[], vuelto: number | null) {
    setErrorConfirmar(null);
    try {
      const result = await confirmar(pagos, vuelto);
      setConfirmarOpen(false);
      setVentaResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setConfirmarOpen(false);
      if (msg.includes('LIMITE_CREDITO_EXCEDIDO')) {
        setLimiteAuth({ pagos, vuelto });
      } else {
        setErrorConfirmar(mensajeErrorVenta(msg));
      }
    }
  }

  async function handleLimiteAuth(creds: { nombre_usuario: string; password: string }) {
    if (!limiteAuth) return;
    try {
      const result = await confirmar(limiteAuth.pagos, limiteAuth.vuelto, creds);
      setLimiteAuth(null);
      setVentaResult(result);
    } catch (e) {
      setLimiteAuth(null);
      setErrorConfirmar(mensajeErrorVenta(e instanceof Error ? e.message : ''));
    }
  }

  async function handlePausar(alias?: string) {
    try {
      await pausarVenta(alias);
      setPausarOpen(false);
      setEsperaDrawerOpen(true);
    } catch {
      setPausarOpen(false);
    }
  }

  async function handleRetomar(venta_id: string) {
    setEsperaDrawerOpen(false);
    try {
      await retomarVenta(venta_id);
    } catch {
      // error ya en hook (session.error, mostrado por PosBottomBar)
    }
  }

  async function handleDescartar(venta_id: string) {
    try {
      await descartarVenta(venta_id);
    } catch {
      // error ya en hook (session.error, mostrado por PosBottomBar)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PosTopBar
        onAdd={addLinea}
        disabled={loading}
        clienteInfo={clienteInfo}
        onSeleccionarCliente={setCliente}
        clienteId={clienteId}
      />
      {avisoConversion && (
        <div className="alert-warn" style={{ margin: '4px var(--pad) 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 13 }}>⚠ {avisoConversion}</div>
          <button type="button" onClick={() => setAvisoConversion(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}
      {errorConfirmar && (
        <div className="alert-danger" role="alert" style={{ margin: '4px var(--pad) 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 13 }}>{errorConfirmar}</div>
          <button type="button" onClick={() => setErrorConfirmar(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}
      {avisosRetomar && (avisosRetomar.stock_caido.length > 0 || avisosRetomar.precio_cambiado.length > 0) && (
        <div className="alert-warn" style={{ margin: '4px var(--pad) 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 13 }}>
            {avisosRetomar.stock_caido.map(a => (
              <div key={a.producto_id}>⚠ {a.nombre}: stock disponible {a.stock_disponible}</div>
            ))}
            {avisosRetomar.precio_cambiado.map(a => (
              <div key={a.producto_id}>⚠ {a.nombre}: precio actualizado a $ {a.precio_nuevo.toLocaleString('es-AR')}</div>
            ))}
          </div>
          <button type="button" onClick={clearAvisosRetomar} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}
      <div className="panel" style={{ flex: 1, margin: 'var(--pad)', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <PosItemsTable
            lines={lines}
            onCantidad={updateCantidad}
            onDescuentoLinea={updateDescuentoLinea}
            onRemove={removeLine}
            onPresentacion={updatePresentacion}
            canOverride={can('precio.override')}
          />
        </div>
      </div>
      <PosBottomBar
        totales={totales}
        descuentoGlobalPct={descuentoGlobalPct}
        onDescuentoGlobal={setDescuentoGlobal}
        canOverride={can('precio.override')}
        loading={loading}
        linesCount={lines.length}
        error={error}
        onClearError={clearError}
        onConfirmar={() => setConfirmarOpen(true)}
        onCancelar={() => setCancelarOpen(true)}
        cantidadEnEspera={cantidadEnEspera}
        onEspera={() => setPausarOpen(true)}
        onAbrirEspera={() => { recargarVentasEnEspera(); setEsperaDrawerOpen(true); }}
      />
      {confirmarOpen && (
        <ConfirmarVentaModal
          totales={totales ?? { totalCentavos: 0 }}
          formaPagoDefault="efectivo"
          habilitaCcc={clienteInfo?.habilita_ccc ?? false}
          loading={loading}
          onConfirmar={handleConfirmar}
          onVolver={() => setConfirmarOpen(false)}
        />
      )}
      {cancelarOpen && (
        <CancelarVentaModal
          onDescartar={() => { reset(); setCancelarOpen(false); }}
          onVolver={() => setCancelarOpen(false)}
        />
      )}
      {ventaResult && (
        <TicketModal
          comprobante={ticketDesdeVentaRetail(ventaResult, clienteInfo?.nombre_completo ?? 'Consumidor Final')}
          onNuevaVenta={() => { reset(); setVentaResult(null); }}
          onImprimir={(html) => (globalThis as any).ferreteria.catalogo.print.html(html)}
          {...(can('venta.anular')
            ? { anulacion: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => <AnulacionModal ventaId={ventaResult.venta.id} onSuccess={onSuccess} onCancel={onCancel} /> }
            : {})}
        />
      )}
      {pausarOpen && (
        <PausarEsperaModal
          loading={loading}
          onConfirmar={handlePausar}
          onCancelar={() => setPausarOpen(false)}
        />
      )}
      {esperaDrawerOpen && (
        <VentaEsperaDrawer
          ventas={ventasEnEspera}
          loading={loading}
          onRetomar={handleRetomar}
          onDescartar={handleDescartar}
          onCerrar={() => setEsperaDrawerOpen(false)}
        />
      )}
      {limiteAuth && (
        <LimiteCreditoAuthModal
          onAutorizar={handleLimiteAuth}
          onCancelar={() => setLimiteAuth(null)}
        />
      )}
    </div>
  );
}
