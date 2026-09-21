import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardStock, StockAlerta } from '../../../../main/ipc/dashboard';

type PS<T> = { loading: boolean; data: T | null; error: boolean };
type AlertKey = 'sin_stock' | 'bajo_minimo' | 'sin_movimiento';

function fmt(n: number) { return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function AlertRow({ alertKey, label, items, color, linkTo, open, onToggle }: {
  alertKey: AlertKey; label: string; items: StockAlerta[];
  color: string; linkTo: string; open: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <div data-testid={`alert-${alertKey.replace(/_/g, '-')}`} onClick={onToggle}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer', background: open ? 'var(--surface-2)' : 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="num" style={{ fontWeight: 700, color: items.length > 0 ? color : 'inherit' }}>{items.length}</span>
          <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
        </div>
      </div>
      {open && items.length > 0 && (
        <div style={{ margin: '0.25rem 0 0.5rem 1.5rem', borderLeft: `2px solid ${color}`, paddingLeft: '0.75rem' }}>
          {items.map(item => (
            <div key={item.producto_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', fontSize: '0.8rem', minWidth: 0 }}>
              <div style={{ overflow: 'hidden', minWidth: 0 }}>
                <span className="num text-muted" style={{ fontSize: '0.75rem' }}>{item.sku}</span>{' '}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre_corto}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, paddingLeft: '0.5rem' }}>
                <span className="num">{item.stock_fisico}</span>
                {item.dias_hasta_agotar !== null && (
                  <span style={{ padding: '0 0.3rem', borderRadius: 4, background: item.dias_hasta_agotar <= 7 ? '#c62828' : '#e65100', color: '#fff', fontSize: '0.7rem' }}>
                    {item.dias_hasta_agotar}d
                  </span>
                )}
              </div>
            </div>
          ))}
          <Link to={linkTo} className="text-muted text-xs" style={{ textDecoration: 'none', display: 'block', marginTop: '0.25rem' }}>
            Ver en stock →
          </Link>
        </div>
      )}
    </div>
  );
}

export function StockPanel({ state }: { state: PS<DashboardStock> }) {
  const [open, setOpen] = useState<AlertKey | null>(null);
  const toggle = (key: AlertKey) => setOpen(prev => prev === key ? null : key);

  return (
    <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Stock</h2>
        {state.data && <span className="num text-muted" style={{ fontSize: '0.8rem' }}>Inventario: $ {fmt(state.data.valor_inventario)}</span>}
      </div>
      {state.loading && <div className="text-muted" style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Cargando…</div>}
      {state.error  && <div className="alert-danger">Error al cargar stock</div>}
      {!state.loading && state.data && (
        <div className="flex-col" style={{ gap: '0.25rem' }}>
          <AlertRow alertKey="sin_stock"      label="Sin stock"      items={state.data.sin_stock}      color="var(--danger)"  linkTo="/stock"                 open={open === 'sin_stock'}      onToggle={() => toggle('sin_stock')} />
          <AlertRow alertKey="bajo_minimo"    label="Bajo mínimo"    items={state.data.bajo_minimo}    color="var(--warn)"    linkTo="/stock"                  open={open === 'bajo_minimo'}    onToggle={() => toggle('bajo_minimo')} />
          <AlertRow alertKey="sin_movimiento" label="Sin movimiento"  items={state.data.sin_movimiento} color="var(--ink-3)"   linkTo="/stock"                  open={open === 'sin_movimiento'} onToggle={() => toggle('sin_movimiento')} />
        </div>
      )}
    </div>
  );
}
