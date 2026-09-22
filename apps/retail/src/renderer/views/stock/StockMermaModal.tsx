import { useState } from 'react';
import { useExistencias } from '../../hooks/useExistencias';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { rutearCampoError } from '../../lib/rutearCampoError';
import { useToast } from '@core/ui';

export type StockMermaModalProps = {
  productoId: string;
  onSuccess: () => void;
  onClose: () => void;
};

export function StockMermaModal({ productoId, onSuccess, onClose }: Readonly<StockMermaModalProps>) {
  const { existencias, loading } = useExistencias(productoId);
  const toast = useToast();
  const [cantidad, setCantidad] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  useEscapeToClose(onClose, !submitting);

  const cantidadNum = Number.parseFloat(cantidad);
  const stockActual = existencias?.stockFisico ?? 0;
  const stockResultante = !Number.isNaN(cantidadNum) && cantidadNum > 0 ? stockActual - cantidadNum : null;
  const goesNegative = stockResultante !== null && stockResultante < 0;

  function validate(): string | null {
    if (!cantidad || Number.isNaN(cantidadNum) || cantidadNum <= 0) return 'La cantidad debe ser mayor a 0';
    if (!observaciones.trim()) return 'Las observaciones son requeridas';
    if (goesNegative) return `Stock insuficiente. El stock resultante sería ${stockResultante}`;
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
      await (globalThis as any).ferreteria.catalogo.stock.merma({
        producto_id: productoId,
        cantidad: cantidadNum,
        observaciones: observaciones.trim(),
      });
      toast.success('Merma registrada');
      onSuccess();
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      const r = rutearCampoError(err, { cantidad: 'merma-cantidad', observaciones: 'merma-observaciones' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else if (msg === 'STOCK_INSUFICIENTE') setError('Stock insuficiente para registrar esta merma.');
      else setError(r.mensaje);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="button" tabIndex={0} aria-label="Cerrar" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Merma / rotura</span>
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
                  {stockResultante !== null && (
                    <span className={goesNegative ? ' neg' : ''}> → {stockResultante}
                      {goesNegative && ' ⚠ insuficiente'}
                    </span>
                  )}
                </span>
              </div>

              <div className="field">
                <label htmlFor="merma-cantidad">Cantidad perdida / dañada *</label>
                <input id="merma-cantidad" className={`input num${campoError?.campo === 'cantidad' ? ' error' : ''}`} type="number" min="0.001" step="any"
                  value={cantidad} onChange={e => setCantidad(e.target.value)} autoFocus
                  style={goesNegative ? { borderColor: 'var(--danger)' } : {}} />
                {campoError?.campo === 'cantidad' && <span className="field-error">{campoError.mensaje}</span>}
              </div>

              <div className="field">
                <label htmlFor="merma-observaciones">Observaciones *</label>
                <textarea id="merma-observaciones" className={`input${campoError?.campo === 'observaciones' ? ' error' : ''}`} rows={2} value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Causa de la merma o rotura (requerido)" />
                {campoError?.campo === 'observaciones' && <span className="field-error">{campoError.mensaje}</span>}
              </div>

              {error && <div className="alert-danger" role="alert">{error}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
              <button type="submit" className="btn-danger" disabled={submitting || !cantidad || goesNegative}
                style={goesNegative ? { opacity: 0.5 } : {}}>
                {submitting ? 'Guardando...' : 'Registrar merma'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
