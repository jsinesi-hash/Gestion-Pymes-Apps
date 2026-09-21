import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEscapeAction } from '../../hooks/useEscapeAction';
import { useCallIpc } from '../../hooks/useCallIpc';
import { RegistrarCobroModal } from './RegistrarCobroModal';
import { fmtARS, badgeEstado } from './utils';

// ADR-085 (SEC-2): campos con control propio en esta vista, mapeados a su `id` (el resto
// de un error de validación —p. ej. `cuentaId`, que no es editable acá— cae en la región
// general). Ids con prefijo propio para no colisionar con los del modal de cobro
// (RegistrarCobroModal usa `monto_centavos`), que puede convivir montado a la vez.
const CAMPO_A_ID_LIMITE: Record<string, string> = { limite_centavos: 'limite-centavos' };
const CAMPO_A_ID_SALDO_INICIAL: Record<string, string> = {
  monto_centavos: 'saldo-inicial-monto',
  tipo: 'saldo-inicial-tipo',
};

type Cuenta = {
  id: string;
  cliente_id: string;
  saldo_centavos: number;
  limite_credito_centavos: number;
};

type Movimiento = {
  id: string;
  tipo: 'cargo' | 'pago';
  motivo: string;
  monto_centavos: number;
  saldo_resultante_centavos: number;
  fecha: number;
  observaciones: string | null;
  nombre_usuario: string | null;
};

export function CtaCteDetalle() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  // Escape hace lo mismo que el botón «Volver» de más abajo.
  useEscapeAction(() => navigate('/credito'), { layer: 'page' });
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCobro, setShowCobro] = useState(false);
  const [showSaldoInicial, setShowSaldoInicial] = useState(false);
  const [editandoLimite, setEditandoLimite] = useState(false);
  const [limiteInput, setLimiteInput] = useState('');
  const [savingLimite, setSavingLimite] = useState(false);
  const [saldoInicialMonto, setSaldoInicialMonto] = useState('');
  const [saldoInicialTipo, setSaldoInicialTipo] = useState<'cargo' | 'pago'>('cargo');
  const [savingSaldoInicial, setSavingSaldoInicial] = useState(false);
  const [saldoInicialError, setSaldoInicialError] = useState<string | null>(null);
  const [limiteError, setLimiteError] = useState<string | null>(null);
  const callIpc = useCallIpc();

  const refresh = useCallback(() => {
    if (!clienteId) return;
    (globalThis as any).ferreteria.ctacte.getByCliente(clienteId)
      .then((data: { cuenta: Cuenta; movimientos: Movimiento[] }) => {
        setCuenta(data.cuenta);
        setMovimientos(data.movimientos);
      })
      .finally(() => setLoading(false));
  }, [clienteId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleGuardarLimite() {
    if (!cuenta) return;
    setSavingLimite(true);
    setLimiteError(null);
    const centavos = Math.round(Number.parseFloat(limiteInput.replace(',', '.') || '0') * 100);
    const r = await callIpc(
      () => (globalThis as any).ferreteria.ctacte.setLimite({ cuentaId: cuenta.id, limite_centavos: centavos }),
      { success: 'Límite actualizado' },
    );
    setSavingLimite(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      setLimiteError(r.traducido.mensaje);
      const campo = r.traducido.campo;
      if (campo && CAMPO_A_ID_LIMITE[campo]) document.getElementById(CAMPO_A_ID_LIMITE[campo])?.focus();
      return;
    }
    setEditandoLimite(false);
    refresh();
  }

  async function handleSaldoInicial() {
    if (!cuenta) return;
    const centavos = Math.round(Number.parseFloat(saldoInicialMonto.replace(',', '.') || '0') * 100);
    if (centavos <= 0) {
      setSaldoInicialError('Ingresá un monto mayor a cero.');
      return;
    }
    setSavingSaldoInicial(true);
    setSaldoInicialError(null);
    const r = await callIpc(
      () => (globalThis as any).ferreteria.ctacte.registrarSaldoInicial({
        cuentaId: cuenta.id, monto_centavos: centavos, tipo: saldoInicialTipo,
      }),
      { success: 'Saldo inicial registrado' },
    );
    setSavingSaldoInicial(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      setSaldoInicialError(r.traducido.mensaje);
      const campo = r.traducido.campo;
      if (campo && CAMPO_A_ID_SALDO_INICIAL[campo]) document.getElementById(CAMPO_A_ID_SALDO_INICIAL[campo])?.focus();
      return;
    }
    setShowSaldoInicial(false);
    setSaldoInicialMonto('');
    refresh();
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  if (!cuenta) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Cuenta corriente no encontrada.</div>;

  const badge = badgeEstado(cuenta.saldo_centavos, cuenta.limite_credito_centavos);

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate('/credito')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>Cuenta corriente</h1>
        <div className="detail-actions">
          <button className="btn-primary" onClick={() => setShowCobro(true)}>Registrar cobro</button>
          {movimientos.length === 0 && !showSaldoInicial && (
            <button className="btn-secondary" onClick={() => setShowSaldoInicial(true)}>Saldo inicial</button>
          )}
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-title">Saldo actual</div>
          <div className="kv">
            <span className="k">Saldo</span>
            <span className="v big num">{fmtARS(cuenta.saldo_centavos)}</span>
          </div>
          <div className="kv">
            <span className="k">Estado</span>
            <span className="v" style={{ color: badge.color, fontWeight: 500 }}>{badge.label}</span>
          </div>
          <div className="kv">
            <span className="k">Límite</span>
            {editandoLimite ? (
              <span className="v" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input id="limite-centavos" className="input" style={{ width: '120px' }}
                  value={limiteInput}
                  onChange={e => setLimiteInput(e.target.value)}
                  placeholder="0.00" />
                <button className="btn-primary" style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={handleGuardarLimite} disabled={savingLimite}>OK</button>
                <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => { setEditandoLimite(false); setLimiteError(null); }}>✕</button>
                {limiteError && <span style={{ color: 'var(--danger)', fontSize: '11px' }}>{limiteError}</span>}
              </span>
            ) : (
              <span className="v num" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {cuenta.limite_credito_centavos === 0 ? 'Sin límite' : fmtARS(cuenta.limite_credito_centavos)}
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 0 }}
                  onClick={() => { setLimiteInput((cuenta.limite_credito_centavos / 100).toFixed(2)); setEditandoLimite(true); }}
                  title="Editar límite">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {showSaldoInicial && (
        <div className="card">
          <div className="card-title">Registrar saldo inicial</div>
          <div style={{ padding: 'var(--pad)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="flex-col gap-1">
              <span style={{ fontSize: '12px', opacity: 0.6 }}>Tipo</span>
              <select id="saldo-inicial-tipo" className="input" style={{ width: '200px' }} value={saldoInicialTipo}
                onChange={e => setSaldoInicialTipo(e.target.value as 'cargo' | 'pago')}>
                <option value="cargo">Cargo (cliente debe)</option>
                <option value="pago">A favor del cliente</option>
              </select>
            </label>
            <label className="flex-col gap-1">
              <span style={{ fontSize: '12px', opacity: 0.6 }}>Monto ($)</span>
              <input id="saldo-inicial-monto" className="input" style={{ width: '120px' }} value={saldoInicialMonto}
                placeholder="0.00" onChange={e => setSaldoInicialMonto(e.target.value)} />
            </label>
            <button className="btn-primary" onClick={handleSaldoInicial} disabled={savingSaldoInicial}>Confirmar</button>
            <button className="btn-secondary" onClick={() => { setShowSaldoInicial(false); setSaldoInicialError(null); }}>Cancelar</button>
          </div>
          {saldoInicialError && (
            <div style={{ padding: '0 var(--pad) var(--pad)', color: 'var(--danger)', fontSize: '13px' }}>
              {saldoInicialError}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">Movimientos</div>
        <div className="table-wrap" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Motivo</th>
                <th className="r">Monto</th>
                <th className="r">Saldo resultante</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin movimientos</td></tr>
              )}
              {movimientos.map(m => (
                <tr key={m.id}>
                  <td className="num">{new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                  <td>{m.motivo.replaceAll('_', ' ')}</td>
                  <td className="r num" style={{ color: m.tipo === 'cargo' ? 'var(--danger)' : 'var(--success)' }}>
                    {m.tipo === 'cargo' ? '+' : '−'} {fmtARS(m.monto_centavos)}
                  </td>
                  <td className="r num">{fmtARS(m.saldo_resultante_centavos)}</td>
                  <td>{m.nombre_usuario ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCobro && (
        <RegistrarCobroModal
          cuentaId={cuenta.id}
          saldoActual={cuenta.saldo_centavos}
          onClose={() => setShowCobro(false)}
          onSuccess={() => { setShowCobro(false); refresh(); }}
        />
      )}
    </div>
  );
}
