import { useState } from 'react';
import { useExistencias } from '../../hooks/useExistencias';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { rutearCampoError } from '../../lib/rutearCampoError';
import { useToast } from '../../components/toast/useToast';

export type StockAjusteModalProps = {
  productoId: string;
  onSuccess: () => void;
  onClose: () => void;
};

function fmtDelta(n: number): string {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 4 });
}

export function StockAjusteModal({ productoId, onSuccess, onClose }: Readonly<StockAjusteModalProps>) {
  const { existencias, loading } = useExistencias(productoId);
  const toast = useToast();
  const [cantidadContada, setCantidadContada] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  useEscapeToClose(onClose, !submitting);

  const cantidadNum = Number.parseFloat(cantidadContada);
  const stockActual = existencias?.stockFisico ?? 0;
  const delta = !Number.isNaN(cantidadNum) && cantidadContada !== '' ? cantidadNum - stockActual : null;

  function validate(): string | null {
    if (cantidadContada === '' || Number.isNaN(cantidadNum) || cantidadNum < 0) return 'La cantidad contada es requerida y debe ser ≥ 0';
    if (!observaciones.trim()) return 'Las observaciones son requeridas';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setCampoError(null);
    setSubmitting(true);
    try {
      await (globalThis as any).ferreteria.catalogo.stock.ajuste({
        producto_id: productoId,
        cantidad_contada: cantidadNum,
        observaciones: observaciones.trim(),
      });
      toast.success('Ajuste registrado');
      onSuccess();
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      const r = rutearCampoError(err, { cantidad_contada: 'ajuste-cantidad', observaciones: 'ajuste-observaciones' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else if (msg === 'NO_CHANGE') setError('El stock contado es igual al stock actual. No hay cambio.');
      else setError(r.mensaje);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="button" tabIndex={0} aria-label="Cerrar" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Ajuste de stock (conteo)</span>
          <button className="ia" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {loading ? (
          <div className="modal-body" style={{ textAlign: 'center', opacity: 0.5 }}>Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="kv" style={{ borderRadius: '10px', background: 'var(--surface-2)', padding: '10px var(--pad)', borderBottom: 'none' }}>
                <span className="k">Stock actual</span>
                <span className="v num">{stockActual}
                  {delta !== null && delta !== 0 && (
                    <span className={delta > 0 ? ' pos' : ' neg'}> {delta > 0 ? '+' : ''}{fmtDelta(delta)} → {cantidadNum}</span>
                  )}
                  {delta === 0 && cantidadContada !== '' && <span className="text-muted"> (sin cambio)</span>}
                </span>
              </div>

              <div className="field">
                <label htmlFor="ajuste-cantidad">Cantidad contada (real) *</label>
                <input id="ajuste-cantidad" className={`input num${campoError?.campo === 'cantidad_contada' ? ' error' : ''}`} type="number" min="0" step="any"
                  value={cantidadContada} onChange={e => setCantidadContada(e.target.value)} autoFocus />
                {campoError?.campo === 'cantidad_contada' && <span className="field-error">{campoError.mensaje}</span>}
              </div>

              <div className="field">
                <label htmlFor="ajuste-observaciones">Observaciones *</label>
                <textarea id="ajuste-observaciones" className={`input${campoError?.campo === 'observaciones' ? ' error' : ''}`} rows={2} value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Motivo del ajuste (requerido)" />
                {campoError?.campo === 'observaciones' && <span className="field-error">{campoError.mensaje}</span>}
              </div>

              {error && <div className="alert-danger" role="alert">{error}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={submitting || cantidadContada === ''}>
                {submitting ? 'Guardando...' : 'Confirmar ajuste'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
