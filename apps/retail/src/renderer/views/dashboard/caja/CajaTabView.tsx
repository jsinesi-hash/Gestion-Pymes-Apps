import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { Period } from '../hooks/usePeriod';
import type { DashboardCajaRango } from '../../../../main/ipc/dashboard-caja-rango';

import { bridge } from '@core/ui';
type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Props = { period: Period };

export function CajaTabView({ period }: Props) {
  const [state, setState] = useState<PS<DashboardCajaRango>>(init());

  useEffect(() => {
    setState(init());
    bridge().dashboard
      .cajaRango({ desde: period.desde, hasta: period.hasta })
      .then((data: DashboardCajaRango) => setState({ loading: false, data, error: false }))
      .catch(() => setState({ loading: false, data: null, error: true }));
  }, [period]);

  if (state.loading) {
    return <div className="text-muted text-xs" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando…</div>;
  }
  if (state.error || !state.data) {
    return <div className="alert-danger">Error al cargar datos de caja</div>;
  }

  const d = state.data;
  const totalIngresos = d.turnos.reduce((s, t) => s + t.ingresos, 0);
  const totalEgresos  = d.turnos.reduce((s, t) => s + t.egresos,  0);

  const barData = d.turnos.map(t => ({
    name:     new Date(t.fecha_apertura).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    Ingresos: t.ingresos,
    Egresos:  t.egresos,
  }));

  const totalMedios = d.por_medio_pago.reduce((s, m) => s + m.monto_total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Ingresos',        value: `$ ${fmt(totalIngresos)}`, color: 'var(--ok)' },
          { label: 'Egresos',         value: `$ ${fmt(totalEgresos)}`,  color: 'var(--danger)' },
          { label: 'Recargo', value: `$ ${fmt(d.recargo_tarjeta_total)}`, color: 'inherit' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--accent-soft)', borderRadius: 8, padding: '0.75rem' }}>
            <div className="text-muted text-xs" style={{ marginBottom: '0.25rem' }}>{label}</div>
            <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico por turno */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>MOVIMIENTOS POR TURNO</div>
        {d.turnos.length === 0
          ? <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin turnos en el período</div>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$ ${fmt(v)}`} />
                <Legend />
                <Bar dataKey="Ingresos" fill="var(--ok)"     radius={[3, 3, 0, 0]} />
                <Bar dataKey="Egresos"  fill="var(--danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* Medios de pago */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>MEDIOS DE PAGO</div>
        {d.por_medio_pago.length === 0
          ? <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin datos</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Medio', 'Monto', '%'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Medio' ? 'left' : 'right', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--line)', fontWeight: 600, color: 'var(--ink-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.por_medio_pago.map(m => (
                  <tr key={m.medio_pago}>
                    <td style={{ padding: '0.3rem 0.5rem', textTransform: 'capitalize' }}>{m.medio_pago.replace('_', ' ')}</td>
                    <td className="num" style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>$ {fmt(m.monto_total)}</td>
                    <td className="num" style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--ink-3)' }}>
                      {totalMedios > 0 ? `${Math.round((m.monto_total / totalMedios) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}
