import { bridge } from '../../bridge';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCajaActiva } from '../../hooks/useCajaActiva';
import { useCajaCierre } from '../../hooks/useCajaCierre';
import { SupervisorAuthModal } from './SupervisorAuthModal';
import { useToast } from '../../components/toast/useToast';
import { useCallIpc } from '../../hooks/useCallIpc';
import { rutearCampoError } from '../../lib/rutearCampoError';

// ADR-085 (SEC-2, Task 14): mapa de código de error de dominio → id del campo del form,
// usado por rutearCampoError para decidir si el mensaje va inline (monto/obs) o al
// alert general de la vista.
const CAMPOS_ERROR: Record<string, string> = { monto_contado: 'monto-declarado', observaciones: 'cierre-obs' };

function fmt(n: number) { return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function CajaCierreView() {
  const navigate = useNavigate();
  const toast = useToast();
  const callIpc = useCallIpc();
  const { caja, isLoading: loadingCaja } = useCajaActiva();
  const {
    resumen,
    montoDeclarado,
    setMontoDeclarado,
    diferencia,
    requiereAutorizacion,
    isLoading: loadingResumen,
  } = useCajaCierre(caja?.id ?? '');

  const [obs, setObs] = useState('');
  const [authModal, setAuthModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [inputStr, setInputStr] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [errorMonto, setErrorMonto] = useState<string | null>(null);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);

  if (!loadingCaja && !caja) { navigate('/caja', { replace: true }); return null; }
  if (loadingCaja || loadingResumen || !caja || !resumen) return null;

  const displayDeclarado = inputFocused
    ? inputStr
    : montoDeclarado > 0 ? `$ ${fmt(montoDeclarado)}` : '';

  function handleDeclaradoFocus() {
    setInputStr(montoDeclarado > 0 ? montoDeclarado.toFixed(2) : '');
    setInputFocused(true);
  }

  function handleDeclaradoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const str = e.target.value;
    setInputStr(str);
    const parsed = parseFloat(str.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    setMontoDeclarado(parsed);
    setErrorMonto(null);
  }

  function handleDeclaradoBlur() {
    const parsed = parseFloat(inputStr.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    setMontoDeclarado(parsed);
    setInputFocused(false);
  }

  function cerrarCaja(supervisor_credenciales?: { nombre_usuario: string; password: string }) {
    return bridge().caja.cerrar({
      caja_id: caja!.id,
      monto_contado: montoDeclarado,
      observaciones: obs || undefined,
      supervisor_credenciales,
    });
  }

  // Camino sin autorización (ADR-085 Task 14): pasa por useCallIpc (toast + traducción) y
  // rutea el error de dominio/validación al campo correspondiente o al alert general.
  async function executeCierreSinAuth() {
    setClosing(true);
    const r = await callIpc(() => cerrarCaja(), { success: 'Caja cerrada' });
    setClosing(false);
    if (!r.ok) {
      const routed = rutearCampoError(r.error, CAMPOS_ERROR);
      if (routed.campo === 'monto_contado') setErrorMonto(routed.mensaje);
      else setErrorCierre(routed.mensaje);
      return;
    }
    navigate('/caja', { replace: true });
  }

  // Camino con autorización de Supervisor. El discriminador credencial-vs-dominio vive acá:
  // si el error es SUPERVISOR_INVALIDO se re-lanza para que SupervisorAuthModal lo muestre y
  // permanezca abierto; cualquier otro error (validación/dominio del cierre en sí) se maneja
  // acá: cierra el modal y lo rutea a la superficie de error de esta vista, nunca dentro del
  // modal (que solo entiende de credenciales).
  async function handleAuthConfirm(creds: { nombre_usuario: string; password: string }) {
    setClosing(true);
    try {
      await cerrarCaja(creds);
    } catch (err) {
      setClosing(false);
      const texto = err instanceof Error ? err.message : String(err);
      if (texto === 'SUPERVISOR_INVALIDO') {
        throw err;
      }
      setAuthModal(false);
      const routed = rutearCampoError(err, CAMPOS_ERROR);
      toast.error(routed.mensaje);
      if (routed.campo === 'monto_contado') setErrorMonto(routed.mensaje);
      else setErrorCierre(routed.mensaje);
      return;
    }
    setClosing(false);
    toast.success('Caja cerrada');
    setAuthModal(false);
    navigate('/caja', { replace: true });
  }

  function handleConfirm() {
    setErrorMonto(null);
    setErrorCierre(null);
    if (!Number.isFinite(montoDeclarado) || montoDeclarado < 0) {
      setErrorMonto('Ingresá un monto de efectivo declarado válido.');
      document.getElementById('monto-declarado')?.focus();
      return;
    }
    if (requiereAutorizacion) { setAuthModal(true); return; }
    void executeCierreSinAuth();
  }

  const difColorInner = diferencia > 0 ? 'pos' : '';
  const difColor = diferencia < 0 ? 'neg' : difColorInner;

  return (
    <div className="flex-col gap-4">
      <h2 style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-.02em' }}>Cierre de caja</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '14px', alignItems: 'start' }}>
        {/* Columna izquierda */}
        <div className="flex-col gap-4">
          <div className="card">
            <div className="card-title">Resumen de ventas del turno</div>
            <div className="srow">
              <span className="sl">Ventas confirmadas</span>
              <span className="sv num">{resumen.ventas_count}</span>
            </div>
            <div className="srow total">
              <span className="sl">Total ventas</span>
              <span className="sv num">$ {fmt(resumen.total_ventas)}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Desglose por medio de pago</div>
            {resumen.por_forma_pago.length === 0 && (
              <div className="text-muted" style={{ padding: 'var(--pad)', fontSize: '13px', opacity: 0.5 }}>Sin movimientos</div>
            )}
            {resumen.por_forma_pago.map(fp => (
              <div key={fp.forma_pago} className="srow">
                <span className="sl" style={{ textTransform: 'capitalize' }}>{fp.forma_pago}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted text-xs">{fp.cantidad_operaciones} ops.</span>
                  <span className="sv num">$ {fmt(fp.ingresado)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha — arqueo */}
        <div className="card flex-col">
          <div className="card-title">Arqueo de caja — Efectivo</div>

          <div className="srow">
            <span className="sl">Fondo de apertura</span>
            <span className="sv num">$ {fmt(resumen.monto_inicial)}</span>
          </div>
          <div className="srow total">
            <span className="sl">Efectivo esperado</span>
            <span className="sv num">$ {fmt(resumen.esperado_efectivo)}</span>
          </div>

          <div style={{ padding: '12px var(--pad)' }}>
            <div className="field">
              <label htmlFor="monto-declarado">Efectivo declarado</label>
              <input
                id="monto-declarado"
                aria-label="Efectivo declarado"
                className={`input num${errorMonto ? ' error' : ''}`}
                type="text"
                value={displayDeclarado}
                onChange={handleDeclaradoChange}
                onFocus={handleDeclaradoFocus}
                onBlur={handleDeclaradoBlur}
                style={{ fontSize: '22px', fontWeight: 700, textAlign: 'right' }}
              />
              {errorMonto && <span className="field-error" role="alert">{errorMonto}</span>}
            </div>
          </div>

          <div style={{ margin: '0 var(--pad) 12px' }}>
            <div className="kv" style={{
              borderRadius: '10px',
              padding: '12px var(--pad)',
              background: diferencia < 0 ? 'rgba(192,57,43,.08)' : 'rgba(46,125,82,.08)',
              border: `1px solid ${diferencia < 0 ? 'rgba(192,57,43,.2)' : 'rgba(46,125,82,.15)'}`,
            }}>
              <span className={`k font-bold ${difColor}`}>
                {(() => { const inner = diferencia > 0 ? 'Sobrante' : 'Exacto'; return diferencia < 0 ? 'Faltante' : inner; })()}
              </span>
              <span className={`v big num ${difColor}`}>$ {fmt(Math.abs(diferencia))}</span>
            </div>
          </div>

          {requiereAutorizacion && (
            <div className="alert-danger" style={{ margin: '0 var(--pad) 12px', background: 'rgba(180,105,14,.1)', border: '1px solid rgba(180,105,14,.2)', color: 'var(--warn)' }}>
              La diferencia supera el umbral. Se requiere autorización del Supervisor.
            </div>
          )}

          <div style={{ padding: '0 var(--pad) 12px' }}>
            <div className="field">
              <label htmlFor="cierre-obs">Observaciones</label>
              <textarea id="cierre-obs" className="input" rows={3} value={obs} onChange={e => { setObs(e.target.value); setErrorCierre(null); }} placeholder="Notas sobre el cierre…" />
            </div>
          </div>

          {errorCierre && (
            <div className="alert-danger" role="alert" style={{ margin: '0 var(--pad) 12px' }}>
              {errorCierre}
            </div>
          )}

          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => navigate('/caja')}>Cancelar</button>
            <button className="btn-primary" onClick={handleConfirm} disabled={closing}>
              {closing ? 'Cerrando…' : 'Confirmar cierre'}
            </button>
          </div>
        </div>
      </div>

      {authModal && (
        <SupervisorAuthModal
          onCancel={() => setAuthModal(false)}
          onConfirm={handleAuthConfirm}
        />
      )}
    </div>
  );
}
