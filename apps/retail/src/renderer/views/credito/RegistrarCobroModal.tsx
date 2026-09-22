import { useState } from 'react';
import { fmtARS } from './utils';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useCallIpc } from '@core/ui';

// ADR-085 (SEC-2): campos de este modal que pueden mostrar un error inline; sus inputs
// llevan un `id` igual a la clave, para poder enfocar el control cuando el backend
// rechaza por él. Errores de negocio (p. ej. CAJA_NO_ABIERTA) caen en la región general.
const CAMPOS_ERROR = new Set(['monto_centavos', 'forma_pago', 'observaciones']);

type Props = {
  cuentaId: string;
  saldoActual: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function RegistrarCobroModal({ cuentaId, saldoActual, onClose, onSuccess }: Readonly<Props>) {
  const [monto, setMonto] = useState('');
  const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const callIpc = useCallIpc();

  useEscapeToClose(onClose, !saving);

  const montoCentavos = Math.round(Number.parseFloat(monto.replaceAll(',', '.') || '0') * 100);
  const saldoResultante = saldoActual - montoCentavos;
  const montoValido = montoCentavos > 0;

  async function handleConfirmar() {
    if (!montoValido) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const r = await callIpc(() => (globalThis as any).ferreteria.ctacte.registrarCobro({
      cuentaId, monto_centavos: montoCentavos, forma_pago: formaPago,
      observaciones: observaciones || undefined,
    }), { success: 'Cobro registrado' });
    setSaving(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setFieldErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    onSuccess();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card" style={{ width: '400px', maxWidth: '90vw' }}>
        <div className="card-title">Registrar cobro</div>

        <div className="flex-col gap-3" style={{ padding: 'var(--pad)' }}>
          <label className="flex-col gap-1">
            <span style={{ fontSize: '12px', opacity: 0.6 }}>Monto ($)</span>
            <input
              id="monto_centavos"
              className={`input${fieldErrors.monto_centavos ? ' error' : ''}`}
              placeholder="0.00"
              value={monto}
              onChange={e => { setMonto(e.target.value); setFieldErrors(prev => ({ ...prev, monto_centavos: '' })); }}
              autoFocus
            />
            {fieldErrors.monto_centavos && <span className="field-error">{fieldErrors.monto_centavos}</span>}
          </label>

          <label className="flex-col gap-1">
            <span style={{ fontSize: '12px', opacity: 0.6 }}>Forma de pago</span>
            <select id="forma_pago" className={`input${fieldErrors.forma_pago ? ' error' : ''}`} value={formaPago}
              onChange={e => { setFormaPago(e.target.value as 'efectivo' | 'transferencia'); setFieldErrors(prev => ({ ...prev, forma_pago: '' })); }}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
            {fieldErrors.forma_pago && <span className="field-error">{fieldErrors.forma_pago}</span>}
          </label>

          <label className="flex-col gap-1">
            <span style={{ fontSize: '12px', opacity: 0.6 }}>Observaciones (opcional)</span>
            <input id="observaciones" className={`input${fieldErrors.observaciones ? ' error' : ''}`} value={observaciones}
              onChange={e => { setObservaciones(e.target.value); setFieldErrors(prev => ({ ...prev, observaciones: '' })); }} />
            {fieldErrors.observaciones && <span className="field-error">{fieldErrors.observaciones}</span>}
          </label>

          {montoValido && (
            <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '6px', fontSize: '13px' }}>
              <span style={{ opacity: 0.6 }}>Saldo actual: </span>
              <strong>{fmtARS(saldoActual)}</strong>
              <span style={{ margin: '0 8px', opacity: 0.4 }}>→</span>
              <span style={{ color: saldoResultante <= 0 ? 'var(--success)' : undefined }}>
                <strong>{fmtARS(saldoResultante)}</strong>
              </span>
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', padding: '8px 0' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn-primary" onClick={handleConfirmar}
              disabled={saving || !montoValido}>
              {saving ? 'Registrando...' : 'Confirmar cobro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
