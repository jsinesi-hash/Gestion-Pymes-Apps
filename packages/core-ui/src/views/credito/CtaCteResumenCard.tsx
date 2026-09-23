import { bridge } from '../../bridge';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtARS, badgeEstado } from '../../lib/credito';
import { RegistrarCobroModal } from './RegistrarCobroModal';

type Cuenta = {
  id: string;
  saldo_centavos: number;
  limite_credito_centavos: number;
};

type Movimiento = { id: string };

export function CtaCteResumenCard({ clienteId }: Readonly<{ clienteId: string }>) {
  const navigate = useNavigate();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [movimientosCount, setMovimientosCount] = useState(0);
  const [showCobro, setShowCobro] = useState(false);

  function load() {
    bridge().ctacte.getByCliente(clienteId)
      .then((data: { cuenta: Cuenta; movimientos: Movimiento[] }) => {
        setCuenta(data.cuenta);
        setMovimientosCount(data.movimientos.length);
      })
      .catch(() => setCuenta(null));
  }

  useEffect(() => { load(); }, [clienteId]);

  if (!cuenta) return null;

  const badge = badgeEstado(cuenta.saldo_centavos, cuenta.limite_credito_centavos);

  return (
    <>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Cuenta corriente</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {movimientosCount === 0 && (
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '3px 10px' }}
                onClick={() => navigate(`/credito/${clienteId}`)}
              >
                Saldo inicial
              </button>
            )}
            <button
              className="btn-primary"
              style={{ fontSize: '12px', padding: '3px 10px' }}
              onClick={() => setShowCobro(true)}
            >
              Cobrar
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '3px 10px' }}
              onClick={() => navigate(`/credito/${clienteId}`)}
            >
              Ver cuenta →
            </button>
          </div>
        </div>
        <div className="kv">
          <span className="k">Saldo</span>
          <span className="v num" style={{ color: cuenta.saldo_centavos < 0 ? 'var(--ok)' : undefined }}>
            {fmtARS(cuenta.saldo_centavos)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Límite</span>
          <span className="v num">
            {cuenta.limite_credito_centavos === 0 ? 'Sin límite' : fmtARS(cuenta.limite_credito_centavos)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Estado</span>
          <span className="v" style={{ color: badge.color, fontWeight: 500 }}>{badge.label}</span>
        </div>
      </div>

      {showCobro && (
        <RegistrarCobroModal
          cuentaId={cuenta.id}
          saldoActual={cuenta.saldo_centavos}
          onClose={() => setShowCobro(false)}
          onSuccess={() => { setShowCobro(false); load(); }}
        />
      )}
    </>
  );
}
