import { useState } from 'react';
import { useEscapeToClose } from '@core/ui';
import { rutearCampoError } from '@core/ui';
import { useToast } from '@core/ui';

type Props = {
  cajaId: string;
  onClose: () => void;
};

export function MovimientoModal({ cajaId, onClose }: Readonly<Props>) {
  const toast = useToast();
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso');
  const [motivo, setMotivo] = useState<'retiro' | 'gasto' | 'aporte'>('retiro');
  const [monto, setMonto] = useState('');
  const [formaPago, setFormaPago] = useState('efectivo');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  useEscapeToClose(onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCampoError(null);
    try {
      await (globalThis as any).ferreteria.caja.addMovimiento({
        caja_id: cajaId,
        tipo,
        motivo,
        monto: Number.parseFloat(monto),
        forma_pago: formaPago,
        observaciones: obs || undefined,
      });
      toast.success('Movimiento registrado');
      onClose();
    } catch (err) {
      const r = rutearCampoError(err, { monto: 'monto-mov' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else setError(r.mensaje);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Nuevo movimiento</span>
          <button type="button" className="ia" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="tipo-mov">Tipo</label>
            <select id="tipo-mov" className="input" value={tipo} onChange={e => setTipo(e.target.value as 'ingreso' | 'egreso')}>
              <option value="egreso">Egreso</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="motivo-mov">Motivo</label>
            <select id="motivo-mov" className="input" aria-label="Motivo"
              value={motivo} onChange={e => setMotivo(e.target.value as 'retiro' | 'gasto' | 'aporte')}>
              <option value="retiro">Retiro</option>
              <option value="gasto">Gasto</option>
              <option value="aporte">Aporte</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="monto-mov">Monto</label>
            <input id="monto-mov" className={`input num${campoError?.campo === 'monto' ? ' error' : ''}`} aria-label="Monto"
              type="number" min="1" step="1"
              value={monto} onChange={e => setMonto(e.target.value)} autoFocus />
            {campoError?.campo === 'monto' && <span className="field-error">{campoError.mensaje}</span>}
          </div>

          <div className="field">
            <label htmlFor="forma-pago-mov">Forma de pago</label>
            <select id="forma-pago-mov" className="input"
              value={formaPago} onChange={e => setFormaPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="obs-mov">Observaciones</label>
            <input id="obs-mov" className="input" type="text" value={obs} onChange={e => setObs(e.target.value)} />
          </div>

          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={!monto || Number.parseFloat(monto) <= 0 || loading}>
            {loading ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  );
}
