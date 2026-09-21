import type { AbcEntry } from '../../../../main/ipc/dashboard-rango';

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const CLASE_COLOR: Record<'A' | 'B' | 'C', string> = {
  A: 'var(--ok)',
  B: 'var(--warn)',
  C: 'var(--ink-3)',
};

type Props = { data: AbcEntry[] };

export function AbcResumen({ data }: Props) {
  if (data.length === 0) {
    return <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin ventas en el período seleccionado</div>;
  }

  const grupos = { A: data.filter(d => d.clase === 'A'), B: data.filter(d => d.clase === 'B'), C: data.filter(d => d.clase === 'C') };
  const totalMonto = data.reduce((s, d) => s + d.monto_total, 0);

  return (
    <div>
      {/* Tarjetas resumen A/B/C */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['A', 'B', 'C'] as const).map(clase => {
          const g = grupos[clase];
          const rev = g.reduce((s, d) => s + d.monto_total, 0);
          const pct = totalMonto > 0 ? ((rev / totalMonto) * 100).toFixed(1) : '0';
          return (
            <div key={clase} style={{ borderRadius: 8, padding: '0.65rem', border: `2px solid ${CLASE_COLOR[clase]}`, textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: CLASE_COLOR[clase] }}>{clase}</div>
              <div className="num" style={{ fontWeight: 700, fontSize: '0.85rem' }}>{g.length} prod.</div>
              <div className="text-muted num" style={{ fontSize: '0.75rem' }}>{pct}% revenue</div>
            </div>
          );
        })}
      </div>

      {/* Tabla top 15 */}
      <div style={{ fontSize: '0.8rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 3rem 4rem', gap: '0.25rem 0.5rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
          <span className="text-muted" style={{ fontWeight: 600 }}>#</span>
          <span className="text-muted" style={{ fontWeight: 600 }}>Producto</span>
          <span className="text-muted num" style={{ fontWeight: 600, textAlign: 'right' }}>Clase</span>
          <span className="text-muted num" style={{ fontWeight: 600, textAlign: 'right' }}>Monto</span>
        </div>
        {data.slice(0, 15).map((d, i) => (
          <div key={d.producto_id} style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 3rem 4rem', gap: '0.25rem 0.5rem', padding: '0.15rem 0', borderBottom: '1px solid var(--line)' }}>
            <span className="text-muted num" style={{ fontSize: '0.7rem' }}>{i + 1}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</span>
            <span className="num" style={{ textAlign: 'right', fontWeight: 700, color: CLASE_COLOR[d.clase] }}>{d.clase}</span>
            <span className="num" style={{ textAlign: 'right' }}>$ {fmt(d.monto_total)}</span>
          </div>
        ))}
        {data.length > 15 && (
          <div className="text-muted text-xs" style={{ marginTop: '0.25rem' }}>…y {data.length - 15} más</div>
        )}
      </div>
    </div>
  );
}
