import { useEffect, useState, useRef } from 'react';
import type { Period } from '../hooks/usePeriod';
import type { DashboardProveedoresRango, DashboardProveedoresEstado } from '../../../../main/ipc/dashboard-proveedores';

type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({ label, value, hoy = false }: { label: string; value: string; hoy?: boolean }) {
  return (
    <div style={{ background: 'var(--accent-soft)', borderRadius: 8, padding: '0.75rem' }}>
      <div className="text-muted text-xs" style={{ marginBottom: '0.25rem' }}>{label}</div>
      <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{value}</div>
      {hoy && <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>hoy</div>}
    </div>
  );
}

type Props = { period: Period };

export function ProveedoresTabView({ period }: Props) {
  const [rango,  setRango]  = useState<PS<DashboardProveedoresRango>>(init());
  const [estado, setEstado] = useState<PS<DashboardProveedoresEstado>>(init());
  const estadoLoaded = useRef(false);

  useEffect(() => {
    if (!estadoLoaded.current) {
      estadoLoaded.current = true;
      (window as any).ferreteria.dashboard.proveedoresEstado()
        .then((data: DashboardProveedoresEstado) => setEstado({ loading: false, data, error: false }))
        .catch(() => setEstado({ loading: false, data: null, error: true }));
    }
  }, []);

  useEffect(() => {
    setRango(init());
    (window as any).ferreteria.dashboard
      .proveedoresRango({ desde: period.desde, hasta: period.hasta })
      .then((data: DashboardProveedoresRango) => setRango({ loading: false, data, error: false }))
      .catch(() => setRango({ loading: false, data: null, error: true }));
  }, [period]);

  const maxGasto = rango.data && rango.data.ranking.length > 0
    ? Math.max(...rango.data.ranking.map(r => r.gasto))
    : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* KPIs de estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        <KpiCard
          label="OCs pendientes recepción"
          value={estado.data ? String(estado.data.ocs_pendientes) : '—'}
          hoy
        />
        <KpiCard
          label="OCs sugeridas sin resolver"
          value={estado.data ? String(estado.data.ocs_sugeridas_sin_resolver) : '—'}
          hoy
        />
      </div>

      {/* Ranking proveedores */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>RANKING PROVEEDORES — GASTO DEL PERÍODO</div>
        {rango.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
        {rango.error   && <div className="alert-danger">Error al cargar proveedores</div>}
        {rango.data && rango.data.ranking.length === 0 && (
          <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin compras en el período</div>
        )}
        {rango.data && rango.data.ranking.map(p => (
          <div key={p.proveedor_id} style={{ marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 2 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {p.razon_social}
              </span>
              <span className="num" style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>$ {fmt(p.gasto)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--accent)', width: `${(p.gasto / maxGasto) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
