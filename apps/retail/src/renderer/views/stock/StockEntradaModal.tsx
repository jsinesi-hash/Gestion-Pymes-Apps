import { useState } from 'react';
import { useExistencias } from '../../hooks/useExistencias';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { rutearCampoError } from '../../lib/rutearCampoError';
import { useToast } from '../../components/toast/useToast';

export type StockEntradaModalProps = {
  productoId: string;
  onSuccess: () => void;
  onClose: () => void;
};

export function StockEntradaModal({ productoId, onSuccess, onClose }: Readonly<StockEntradaModalProps>) {
  const { existencias, loading } = useExistencias(productoId);
  const toast = useToast();
  const [cantidad, setCantidad] = useState('');
  const [costo, setCosto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  useEscapeToClose(onClose, !submitting);

  const cantidadNum = Number.parseFloat(cantidad);
  const costoNum = Number.parseFloat(costo);
  const stockActual = existencias?.stockFisico ?? 0;
  const stockNuevo = !Number.isNaN(cantidadNum) && cantidadNum > 0 ? stockActual + cantidadNum : null;
  const willUpdateCpp = !Number.isNaN(costoNum) && costoNum > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Number.isNaN(cantidadNum) || cantidadNum <= 0) { setError('La cantidad debe ser mayor a 0'); return; }
    setError(null);
    setCampoError(null);
    setSubmitting(true);
    try {
      await (globalThis as any).ferreteria.catalogo.stock.entrada({
        producto_id: productoId,
        cantidad: cantidadNum,
        costo_unitario: !Number.isNaN(costoNum) && costoNum > 0 ? costoNum : undefined,
        observaciones: observaciones.trim() || undefined,
      });
      toast.success('Entrada registrada');
      onSuccess();
    } catch (err: any) {
      const r = rutearCampoError(err, { cantidad: 'entrada-cantidad', costo_unitario: 'entrada-costo', observaciones: 'entrada-observaciones' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else setError(r.mensaje);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="button" tabIndex={0} aria-label="Cerrar" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Entrada de stock</span>
          <button className="ia" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {loading ? (
          <div className="modal-body" style={{ textAlign: 'center', opacity: 0.5 }}>Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="kv" style={{ borderRadius: '10px', background: 'var(--surface-2)', padding: '10px var(--pad)', borderBottom: 'none' }}>
                <span className="k">Stock actual:</span>
                <span className="v num">{stockActual}
                  {stockNuevo !== null && <span className="pos"> → {stockNuevo}</span>}
                </span>
              </div>

              <div className="field">
                <label htmlFor="entrada-cantidad">Cantidad a ingresar *</label>
                <input id="entrada-cantidad" className={`input num${campoError?.campo === 'cantidad' ? ' error' : ''}`} type="number" min="1" step="1"
                  value={cantidad} onChange={e => setCantidad(e.target.value)} autoFocus />
                {campoError?.campo === 'cantidad' && <span className="field-error">{campoError.mensaje}</span>}
              </div>

              <div className="field">
                <label htmlFor="entrada-costo">Costo unitario (opcional)</label>
                <input id="entrada-costo" className={`input num${campoError?.campo === 'costo_unitario' ? ' error' : ''}`} type="number" min="0" step="any"
                  value={costo} onChange={e => setCosto(e.target.value)}
                  placeholder="Deja en blanco para no actualizar CPP" />
                {campoError?.campo === 'costo_unitario' && <span className="field-error">{campoError.mensaje}</span>}
                {willUpdateCpp && (
                  <span className="text-xs text-muted">Se actualizará el CPP con ${costoNum.toFixed(2)}/u</span>
                )}
              </div>

              <div className="field">
                <label htmlFor="entrada-observaciones">Observaciones (opcional)</label>
                <textarea id="entrada-observaciones" className={`input${campoError?.campo === 'observaciones' ? ' error' : ''}`} rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                {campoError?.campo === 'observaciones' && <span className="field-error">{campoError.mensaje}</span>}
              </div>

              {error && <div className="alert-danger" role="alert">{error}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={submitting || !cantidad}>
                {submitting ? 'Guardando...' : 'Confirmar entrada'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
