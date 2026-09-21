import type { HeatmapEntry } from '../../../../main/ipc/dashboard-rango';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
// SQL strftime('%w'): 0=Dom,1=Lun,2=Mar,3=Mié,4=Jue,5=Vie,6=Sáb
// Remapeamos a display: Lun=col0 … Dom=col6
function sqlDowToCol(sqlDow: number): number {
  return sqlDow === 0 ? 6 : sqlDow - 1;
}

type Props = { data: HeatmapEntry[] };

export function HeatmapVentas({ data }: Props) {
  if (data.length === 0) {
    return <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin datos</div>;
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  const grid = new Map<string, number>();
  data.forEach(d => {
    const col = sqlDowToCol(d.dia_semana);
    grid.set(`${d.hora}-${col}`, d.total);
  });

  const HORAS_SHOW = [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 23];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        <div />
        {DIAS.map(d => (
          <div key={d} className="text-muted" style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      {Array.from({ length: 24 }, (_, hora) => (
        <div key={hora} style={{ display: 'grid', gridTemplateColumns: '28px repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
          <div className="text-muted" style={{ fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 3 }}>
            {HORAS_SHOW.includes(hora) ? `${hora}h` : ''}
          </div>
          {Array.from({ length: 7 }, (_, col) => {
            const v = grid.get(`${hora}-${col}`) ?? 0;
            const opacity = v > 0 ? 0.15 + (v / maxTotal) * 0.85 : 0.07;
            return (
              <div
                key={col}
                title={v > 0 ? `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : undefined}
                style={{
                  height: 8,
                  borderRadius: 2,
                  background: `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, var(--surface-2))`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
