import type { VendedorEntry } from '../../../../main/ipc/dashboard-rango';

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Props = { data: VendedorEntry[] };

export function RankingVendedor({ data }: Props) {
  if (data.length === 0) {
    return <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin datos</div>;
  }
  const maxTotal = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="flex-col" style={{ gap: '0.5rem' }}>
      {data.map((v, i) => (
        <div key={v.usuario_id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
            <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
              <span className="num text-muted" style={{ fontSize: '0.7rem', flexShrink: 0 }}>#{i + 1}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre}</span>
            </span>
            <span style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>
              <span className="num" style={{ fontWeight: 700 }}>$ {fmt(v.total)}</span>
              <span className="text-muted num" style={{ fontSize: '0.7rem', marginLeft: '0.3rem' }}>({v.count})</span>
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent)', width: `${(v.total / maxTotal) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
