import { useState } from 'react';
import { rutearCampoError } from '../../lib/rutearCampoError';
import { useToast } from '../../components/toast/useToast';

type Props = { onSuccess: () => void };

function fmtARS(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AperturaForm({ onSuccess }: Readonly<Props>) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [focused, setFocused] = useState(false);
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  const parsedMonto = Number.parseFloat(monto) || 0;
  const displayValue = focused || parsedMonto <= 0
    ? monto
    : `$ ${fmtARS(parsedMonto)}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCampoError(null);
    try {
      await (globalThis as any).ferreteria.caja.abrir({
        monto_inicial: parsedMonto,
        observaciones: obs || undefined,
      });
      toast.success('Caja abierta');
      onSuccess();
    } catch (err) {
      const r = rutearCampoError(err, { monto_inicial: 'monto' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else setError(r.mensaje);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form onSubmit={handleSubmit} className="login-card" style={{ width: '380px' }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: '18px', margin: 0 }}>Abrir caja</h2>
          <p className="text-muted text-sm" style={{ marginTop: '4px' }}>Ingresá el fondo inicial para comenzar el turno</p>
        </div>

        <div className="field">
          <label htmlFor="monto">Monto inicial</label>
          <input
            id="monto"
            aria-label="Monto inicial"
            className="input num"
            type="text"
            value={displayValue}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
              setMonto(raw);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            style={{ fontSize: '20px', fontWeight: 700 }}
          />
          {campoError?.campo === 'monto_inicial' && <span className="field-error">{campoError.mensaje}</span>}
        </div>

        <div className="field">
          <label htmlFor="obs-apertura">Observaciones (opcional)</label>
          <input
            id="obs-apertura"
            className="input"
            type="text"
            value={obs}
            onChange={e => setObs(e.target.value)}
          />
        </div>

        {error && <div className="alert-danger" role="alert">{error}</div>}

        <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}
          disabled={!monto || parsedMonto <= 0 || loading}>
          {loading ? 'Abriendo…' : 'Abrir caja'}
        </button>
      </form>
    </div>
  );
}
