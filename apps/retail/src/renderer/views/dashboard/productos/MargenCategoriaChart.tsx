import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { MargenCategoriaEntry } from '../../../../main/ipc/dashboard-rango';

type Props = { data: MargenCategoriaEntry[] };

export function MargenCategoriaChart({ data }: Props) {
  const [accent, setAccent] = useState('#E8730A');
  const [danger, setDanger] = useState('#C0392B');
  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setAccent(s.getPropertyValue('--accent').trim() || '#E8730A');
    setDanger(s.getPropertyValue('--danger').trim() || '#C0392B');
  }, []);

  if (data.length === 0) {
    return <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin datos</div>;
  }

  const top10 = data.slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={Math.max(top10.length * 28, 120)}>
      <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={90} />
        <Tooltip
          formatter={(v: number) => `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
          labelFormatter={(l: string) => l}
        />
        <Bar dataKey="margen_total" name="Margen" radius={[0, 3, 3, 0]}>
          {top10.map(entry => (
            <Cell key={entry.categoria_id} fill={entry.margen_total >= 0 ? accent : danger} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
