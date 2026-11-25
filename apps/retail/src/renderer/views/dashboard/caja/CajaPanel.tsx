import type { DashboardCaja, ArqueoResumen } from '../../../../main/ipc/dashboard';

type PS<T> = { loading: boolean; data: T | null; error: boolean };
// ADR-157: el dashboard manda centavos; se muestran en pesos, sin decimales como antes.
function fmt(centavos: number) { return (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function ArqueoRow({ arqueo, umbral }: { arqueo: ArqueoResumen; umbral: number }) {
  const abs = Math.abs(arqueo.diferencia_centavos);
  const color = arqueo.diferencia_centavos === 0 ? 'var(--ok)' : abs > umbral ? 'var(--danger)' : 'var(--warn)';
  return (
    <div className="srow">
      <span className="sl">
        <span style={{ fontWeight: 500 }}>{arqueo.usuario_nombre}</span>
        <span className="text-muted text-xs" style={{ marginLeft: '0.4rem' }}>
          {new Date(arqueo.fecha_cierre).toLocaleDateString('es-AR')}
        </span>
        {/* F3 PR5 (ADR-155 §5): llegaron movimientos después del cierre; la diferencia no se recalculó. */}
        {arqueo.posterior_al_cierre && (
          <span data-testid={`arqueo-tardio-${arqueo.caja_id}`} className="badge-warn" style={{ marginLeft: '0.4rem', padding: '1px 8px' }}
            title="Llegaron movimientos de otra caja después del cierre. La diferencia del arqueo no se recalculó.">
            con movimientos posteriores
          </span>
        )}
      </span>
      <span data-testid={`arqueo-diferencia-${arqueo.caja_id}`}
        className="sv num" style={{ color }}>
        {arqueo.diferencia_centavos === 0 ? '$ 0' : `${arqueo.diferencia_centavos > 0 ? '+' : ''}$ ${fmt(Math.abs(arqueo.diferencia_centavos))}`}
      </span>
    </div>
  );
}

export function CajaPanel({ state }: { state: PS<DashboardCaja> }) {
  return (
    <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
      <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700 }}>Caja</h2>
      {state.loading && <div className="text-muted" style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Cargando…</div>}
      {state.error  && <div className="alert-danger">Error al cargar caja</div>}
      {!state.loading && state.data && (() => {
        const d = state.data;
        return (
          <>
            <div style={{ marginBottom: '0.75rem' }}>
              {d.caja_activa ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="badge ok"><span className="bd" />Caja abierta</span>
                  <span className="num text-muted" style={{ fontSize: '0.85rem' }}>
                    Inicial: $ {fmt(d.caja_activa.monto_inicial_centavos)}
                  </span>
                </div>
              ) : (
                <span className="badge off"><span className="bd" />Sin caja abierta</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[
                { label: 'Ingresos', value: `$ ${fmt(d.ingresos_dia_centavos)}`,      color: 'var(--ok)' },
                { label: 'Egresos',  value: `$ ${fmt(d.egresos_dia_centavos)}`,       color: 'var(--danger)' },
                { label: 'Efectivo', value: `$ ${fmt(d.efectivo_esperado_centavos)}`, color: 'inherit' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div className="text-muted text-xs" style={{ marginBottom: '0.15rem' }}>{label}</div>
                  <div className="num" style={{ fontWeight: 700, color, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                </div>
              ))}
            </div>
            {d.arqueos_recientes.length > 0 && (
              <div>
                <div className="card-title" style={{ padding: '0 0 6px' }}>Arqueos recientes</div>
                {d.arqueos_recientes.map(a => <ArqueoRow key={a.caja_id} arqueo={a} umbral={d.umbral_diferencia_caja_centavos} />)}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
