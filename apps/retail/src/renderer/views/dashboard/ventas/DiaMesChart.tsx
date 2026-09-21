import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { VentasDiaMesEntry } from '../../../../main/ipc/dashboard-rango';

type Props = { data: VentasDiaMesEntry[] };

export function DiaMesChart({ data }: Props) {
  const [accent, setAccent] = useState('#E8730A');
  useEffect(() => {
    setAccent(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E8730A');
  }, []);

  if (data.length === 0) {
    return <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin datos</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval={4} />
        <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={36} />
        <Tooltip formatter={(v: number) => `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} labelFormatter={v => `Día ${v}`} />
        <Bar dataKey="total" name="Ventas" fill={accent} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
