import { useEffect, useState, useRef } from 'react';
import type { Period } from '../hooks/usePeriod';
import type {
  VentasKpisRangoResult,
  EvolucionPoint,
  HeatmapEntry,
  VentasDiaMesEntry,
  VendedorEntry,
} from '../../../../main/ipc/dashboard-rango';
import { EvolucionChart } from './EvolucionChart';
import { HeatmapVentas } from './HeatmapVentas';
import { DiaMesChart } from './DiaMesChart';
import { RankingVendedor } from './RankingVendedor';

import { bridge } from '@core/ui';
type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Categoria = { id: string; nombre: string };

type Props = { period: Period };

export function VentasTabView({ period }: Props) {
  const [kpis,     setKpis]     = useState<PS<VentasKpisRangoResult>>(init());
  const [evol,     setEvol]     = useState<PS<EvolucionPoint[]>>(init());
  const [heatmap,  setHeatmap]  = useState<PS<HeatmapEntry[]>>(init());
  const [diaMes,   setDiaMes]   = useState<PS<VentasDiaMesEntry[]>>(init());
  const [vendedor, setVendedor] = useState<PS<VendedorEntry[]>>(init());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catFiltro, setCatFiltro]   = useState<string | null>(null);

  const catLoaded = useRef(false);
  useEffect(() => {
    if (catLoaded.current) return;
    catLoaded.current = true;
    bridge().catalogo.categoria.list()
      .then((rows: Categoria[]) => setCategorias(rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const f = bridge().dashboard;
    const { desde, hasta, desde_anterior, hasta_anterior } = period;
    setKpis(init()); setEvol(init()); setHeatmap(init()); setDiaMes(init()); setVendedor(init());

    Promise.allSettled([
      f.ventasKpisRango({ desde, hasta, categoria_id: catFiltro, producto_id: null }),
      f.ventasEvolucion({ desde, hasta, desde_anterior, hasta_anterior, categoria_id: catFiltro }),
      f.ventasHeatmap({ desde, hasta, categoria_id: catFiltro }),
      f.ventasDiaMes({ desde, hasta, categoria_id: catFiltro }),
      f.ventasVendedor({ desde, hasta, categoria_id: catFiltro }),
    ]).then(([k, e, h, d, v]) => {
      setKpis    ({ loading: false, data: k.status === 'fulfilled' ? k.value : null, error: k.status === 'rejected' });
      setEvol    ({ loading: false, data: e.status === 'fulfilled' ? e.value : null, error: e.status === 'rejected' });
      setHeatmap ({ loading: false, data: h.status === 'fulfilled' ? h.value : null, error: h.status === 'rejected' });
      setDiaMes  ({ loading: false, data: d.status === 'fulfilled' ? d.value : null, error: d.status === 'rejected' });
      setVendedor({ loading: false, data: v.status === 'fulfilled' ? v.value : null, error: v.status === 'rejected' });
    });
  }, [period, catFiltro]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Filtro de categoría */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="text-muted text-xs" style={{ fontWeight: 600 }}>Rubro:</span>
        <select
          className="input"
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
          value={catFiltro ?? ''}
          onChange={e => setCatFiltro(e.target.value || null)}
        >
          <option value="">Todos</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* KPIs */}
      {kpis.loading && <div className="text-muted text-xs" style={{ textAlign: 'center', opacity: 0.5 }}>Cargando…</div>}
      {kpis.error   && <div className="alert-danger">Error al cargar datos</div>}
      {kpis.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Total',  value: `$ ${fmt(kpis.data.total)}` },
            { label: 'Ventas', value: String(kpis.data.count) },
            { label: 'Ticket', value: `$ ${fmt(kpis.data.ticket_promedio)}` },
            { label: 'IVA',    value: `$ ${fmt(kpis.data.importe_iva)}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--accent-soft)', borderRadius: 8, padding: '0.75rem' }}>
              <div className="text-muted text-xs" style={{ marginBottom: '0.25rem' }}>{label}</div>
              <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Evolución temporal */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>EVOLUCIÓN</div>
        {evol.loading && <div className="text-muted text-xs" style={{ textAlign: 'center', opacity: 0.5 }}>Cargando…</div>}
        {evol.data && (
          <EvolucionChart
            data={evol.data}
            labelActual={period.label}
            labelAnterior={period.label_anterior}
          />
        )}
      </div>

      {/* Heatmap + Día del mes en grid 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>VENTAS POR HORA Y DÍA</div>
          {heatmap.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
          {heatmap.data    && <HeatmapVentas data={heatmap.data} />}
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>DISTRIBUCIÓN POR DÍA DEL MES</div>
          {diaMes.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
          {diaMes.data    && <DiaMesChart data={diaMes.data} />}
        </div>
      </div>

      {/* Ranking vendedor + Top productos en grid 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>RANKING VENDEDORES</div>
          {vendedor.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
          {vendedor.data    && <RankingVendedor data={vendedor.data} />}
        </div>
        {kpis.data && kpis.data.top_cantidad.length > 0 && (
          <div className="card" style={{ padding: '1rem' }}>
            <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>TOP PRODUCTOS</div>
            {(() => {
              const maxQ = Math.max(...kpis.data!.top_cantidad.map(t => t.cantidad), 1);
              return kpis.data!.top_cantidad.map(item => (
                <div key={item.producto_id} style={{ marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 2 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.nombre}</span>
                    <span className="num" style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>{item.cantidad}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--accent)', width: `${(item.cantidad / maxQ) * 100}%` }} />
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
