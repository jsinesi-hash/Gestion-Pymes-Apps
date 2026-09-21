import { useState } from 'react';
import type { VentaEsperaItem } from '../../hooks/usePosSession';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type Props = {
  ventas: VentaEsperaItem[];
  loading: boolean;
  onRetomar: (id: string) => void;
  onDescartar: (id: string) => void;
  onCerrar: () => void;
};

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tiempoRelativo(fecha: Date | null): string {
  if (!fecha) return '—';
  const diff = Date.now() - fecha.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h}h`;
}

function toDate(v: Date | null): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v as any);
}

export function VentaEsperaDrawer({ ventas, loading, onRetomar, onDescartar, onCerrar }: Readonly<Props>) {
  const [confirmDescartarId, setConfirmDescartarId] = useState<string | null>(null);

  useEscapeToClose(onCerrar);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--line)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
      }}
    >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Ventas en espera ({ventas.length})</h3>
          <button type="button" className="ia" onClick={onCerrar} style={{ fontSize: 18, padding: '4px 8px' }}>✕</button>
        </div>

        {ventas.length === 0 && (
          <div className="text-muted" style={{ textAlign: 'center', padding: '2rem 0', fontSize: 13 }}>
            No hay ventas en espera
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {ventas.map(v => (
            <div key={v.id} className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
              {v.vencida && (
                <div style={{ background: 'var(--warn-bg, #fff3cd)', color: 'var(--warn-text, #856404)', fontSize: 11, padding: '2px 6px', borderRadius: 4, marginBottom: 6, display: 'inline-block' }}>
                  Vencida
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {v.alias ?? 'Venta pausada'}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {tiempoRelativo(toDate(v.en_espera_desde))}
                    {' · '}{v.count_items} ítem{v.count_items !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
                  $ {fmt(v.total)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {confirmDescartarId === v.id ? (
                  <>
                    <span className="text-muted" style={{ fontSize: 12, alignSelf: 'center', flex: 1 }}>¿Descartar?</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={() => setConfirmDescartarId(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      style={{ fontSize: 12 }}
                      disabled={loading}
                      onClick={() => { onDescartar(v.id); setConfirmDescartarId(null); }}
                    >
                      Sí, descartar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: 12 }}
                      disabled={loading}
                      onClick={() => setConfirmDescartarId(v.id)}
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: 12, flex: 1 }}
                      disabled={loading}
                      onClick={() => onRetomar(v.id)}
                    >
                      Retomar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
