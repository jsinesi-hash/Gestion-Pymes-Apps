import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { EvolucionPoint } from '../../../../main/ipc/dashboard-rango';

function fmt(n: number) {
  return n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${Math.round(n)}`;
}

type Props = {
  data: EvolucionPoint[];
  labelActual: string;
  labelAnterior: string;
};

export function EvolucionChart({ data, labelActual, labelAnterior }: Props) {
  const [accent, setAccent] = useState('#E8730A');
  const [muted,  setMuted]  = useState('#8A8479');

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setAccent(s.getPropertyValue('--accent').trim() || '#E8730A');
    setMuted(s.getPropertyValue('--ink-3').trim()   || '#8A8479');
  }, []);

  if (data.length === 0) {
    return <div className="text-muted text-xs" style={{ textAlign: 'center', padding: '2rem' }}>Sin datos para el período</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} width={48} />
        <Tooltip formatter={(v: number) => `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="actual"   name={labelActual}   stroke={accent} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="anterior" name={labelAnterior} stroke={muted}  strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
      </LineChart>
    </ResponsiveContainer>
  );
}
