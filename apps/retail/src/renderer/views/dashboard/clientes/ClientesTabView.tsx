import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Period } from '../hooks/usePeriod';
import type { DashboardClientesRango, DashboardClientesEstado } from '../../../../main/ipc/dashboard-clientes';

import { bridge } from '@core/ui';
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

export function ClientesTabView({ period }: Props) {
  const navigate = useNavigate();
  const [rango,  setRango]  = useState<PS<DashboardClientesRango>>(init());
  const [estado, setEstado] = useState<PS<DashboardClientesEstado>>(init());
  const estadoLoaded = useRef(false);

  useEffect(() => {
    if (!estadoLoaded.current) {
      estadoLoaded.current = true;
      bridge().dashboard.clientesEstado()
        .then((data: DashboardClientesEstado) => setEstado({ loading: false, data, error: false }))
        .catch(() => setEstado({ loading: false, data: null, error: true }));
    }
  }, []);

  useEffect(() => {
    setRango(init());
    bridge().dashboard
      .clientesRango({ desde: period.desde, hasta: period.hasta })
      .then((data: DashboardClientesRango) => setRango({ loading: false, data, error: false }))
      .catch(() => setRango({ loading: false, data: null, error: true }));
  }, [period]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        <KpiCard
          label="Deuda total"
          value={estado.data ? `$ ${fmt(estado.data.deuda_total)}` : '—'}
          hoy
        />
        <KpiCard
          label="Deuda vencida"
          value={estado.data ? `$ ${fmt(estado.data.deuda_vencida)}` : '—'}
          hoy
        />
        <KpiCard
          label="Nuevos"
          value={rango.data ? String(rango.data.clientes_nuevos) : '—'}
        />
        <KpiCard
          label="Inactivos"
          value={estado.data ? String(estado.data.clientes_inactivos) : '—'}
          hoy
        />
      </div>

      {/* Ranking */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>RANKING CLIENTES</div>
        {rango.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
        {rango.error   && <div className="alert-danger">Error al cargar clientes</div>}
        {rango.data && rango.data.ranking.length === 0 && (
          <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin ventas en el período</div>
        )}
        {rango.data && rango.data.ranking.map(c => (
          <div
            key={c.cliente_id}
            className="srow"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/clientes/${c.cliente_id}`)}
          >
            <span className="sl" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.nombre_completo}
              <span className="text-muted text-xs" style={{ marginLeft: '0.4rem' }}>{c.count_ventas} ventas</span>
            </span>
            <span className="sv num" style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>$ {fmt(c.total_facturado)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
