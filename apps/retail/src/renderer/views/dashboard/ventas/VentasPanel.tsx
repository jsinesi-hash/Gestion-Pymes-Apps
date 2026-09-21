import type { DashboardVentas } from '../../../../main/ipc/dashboard';

type PS<T> = { loading: boolean; data: T | null; error: boolean };

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function VentasPanel({ state }: { state: PS<DashboardVentas> }) {
  return (
    <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Ventas del día</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['Hoy', 'Semana', 'Mes'] as const).map(tab => (
            <button key={tab} type="button" disabled={tab !== 'Hoy'} title={tab !== 'Hoy' ? 'Próximamente' : undefined}
              style={{
                padding: '0.25rem 0.75rem', borderRadius: 999, border: '1px solid var(--line)',
                background: tab === 'Hoy' ? 'var(--accent)' : 'transparent',
                color: tab === 'Hoy' ? '#fff' : 'inherit',
                cursor: tab !== 'Hoy' ? 'not-allowed' : 'pointer', opacity: tab !== 'Hoy' ? 0.4 : 1,
                fontFamily: 'inherit',
              }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {state.loading && <div className="text-muted" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando…</div>}
      {state.error && <div className="alert-danger">Error al cargar ventas</div>}

      {!state.loading && !state.error && state.data && (() => {
        const d = state.data;
        const maxTop    = Math.max(...d.top_cantidad.map(t => t.cantidad), 1);
        const maxMargen = Math.max(...d.top_margen.map(t => t.margen_estimado), 1);
        const maxHora   = Math.max(...d.por_hora.map(h => h.total), 1);
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Total',  value: `$ ${fmt(d.total_dia)}` },
                { label: 'Ventas', value: String(d.count_dia) },
                { label: 'Ticket', value: `$ ${fmt(d.ticket_promedio)}` },
                { label: 'IVA',    value: `$ ${fmt(d.importe_iva_dia)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '0.75rem' }}>
                  <div className="text-muted text-xs" style={{ marginBottom: '0.25rem' }}>{label}</div>
                  <div className="num" style={{ color: 'var(--ink)', fontWeight: 700, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48, marginBottom: '1.25rem' }}>
              {Array.from({ length: 24 }, (_, hora) => {
                const entry = d.por_hora.find(h => h.hora === hora);
                const pct = entry ? Math.max((entry.total / maxHora) * 100, 8) : 8;
                return (
                  <div key={hora} title={entry ? `${hora}h: $${fmt(entry.total)}` : `${hora}h`}
                    style={{ flex: 1, borderRadius: '3px 3px 0 0', background: entry ? 'var(--accent)' : 'var(--line)', height: `${pct}%` }} />
                );
              })}
            </div>

            {d.por_forma_pago.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {d.por_forma_pago.map(fp => (
                  <span key={fp.forma_pago} style={{ padding: '0.2rem 0.6rem', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: '0.8rem' }}>
                    {fp.forma_pago}: <strong>$ {fmt(fp.total)}</strong>
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>TOP CANTIDAD</div>
                {d.top_cantidad.map(item => (
                  <div key={item.producto_id} style={{ marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 2 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.nombre}</span>
                      <span className="num" style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>{item.cantidad}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--accent)', width: `${(item.cantidad / maxTop) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div>
                <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>TOP MARGEN *</div>
                {d.top_margen.map(item => (
                  <div key={item.producto_id} style={{ marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 2 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.nombre}</span>
                      <span className="num" style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>$ {fmt(item.margen_estimado)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--ok)', width: `${(item.margen_estimado / maxMargen) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <p className="text-muted text-xs" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              * Margen estimado: precio neto (sin IVA) − costo promedio actual del producto.
            </p>
          </>
        );
      })()}
    </div>
  );
}
