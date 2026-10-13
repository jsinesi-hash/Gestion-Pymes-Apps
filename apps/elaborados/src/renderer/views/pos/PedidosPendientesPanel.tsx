import { useState } from 'react';
import { formatPesos, useEscapeToClose } from '@core/ui';
import type { PedidoPendiente } from '../../hooks/usePedidosPendientes';

type Props = {
  pedidos: PedidoPendiente[];
  pedidoActualId: string | null;
  carritoVacio: boolean;
  onRetomar: (id: string) => void;
  onDescartar: (id: string) => void;
  onCerrar: () => void;
  error: string | null;
};

/** Antigüedad legible: "hace instantes" / "hace N min" / "hace N h" / "hace N d". */
export function hace(fecha: Date | string | number, ahora: Date = new Date()): string {
  const seg = Math.max(0, Math.floor((ahora.getTime() - new Date(fecha).getTime()) / 1000));
  if (seg < 60) return 'hace instantes';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function PedidosPendientesPanel({ pedidos, pedidoActualId, carritoVacio, onRetomar, onDescartar, onCerrar, error }: Props) {
  useEscapeToClose(onCerrar);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const ahora = new Date();

  return (
    <div role="dialog" aria-label="Pedidos pendientes" className="modal-overlay" style={{ justifyContent: 'flex-end' }}>
      <div className="modal" style={{ width: 460, maxHeight: '100vh', height: '100%', borderRadius: 0 }}>
        <div className="modal-header">
          <span className="modal-title">Pedidos pendientes</span>
          <button type="button" className="btn-secondary" onClick={onCerrar}>Cerrar</button>
        </div>
        <div className="modal-body">
          {error && <div role="alert" style={{ color: 'var(--danger, #c0392b)', fontSize: 13 }}>{error}</div>}
          {pedidos.length === 0 && <div style={{ opacity: 0.7 }}>No hay pedidos pendientes</div>}
          {pedidos.map((p) => {
            const actual = p.id === pedidoActualId;
            return (
              <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{p.alias || 'Sin alias'}</strong>
                  <span className="num">{formatPesos(Math.round(p.total * 100))}</span>
                </div>
                {p.observaciones && <div style={{ fontSize: 13 }}>{p.observaciones}</div>}
                <div style={{ fontSize: 12, opacity: 0.75, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>{p.count_items} {p.count_items === 1 ? 'ítem' : 'ítems'}</span>
                  {p.en_espera_desde != null && <span>{hace(p.en_espera_desde, ahora)}</span>}
                  {p.vencida && <span className="badge-warn">Vencido</span>}
                </div>
                {actual ? (
                  <div style={{ fontSize: 13, fontWeight: 700 }}>En el carrito</div>
                ) : confirmando === p.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>¿Descartar?</span>
                    <button type="button" className="btn-primary" onClick={() => { setConfirmando(null); onDescartar(p.id); }}>Sí, descartar</button>
                    <button type="button" className="btn-secondary" onClick={() => setConfirmando(null)}>No</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-primary" disabled={!carritoVacio} onClick={() => onRetomar(p.id)}>Retomar</button>
                    <button type="button" className="btn-secondary" onClick={() => setConfirmando(p.id)}>Descartar</button>
                  </div>
                )}
              </div>
            );
          })}
          {!carritoVacio && pedidos.some((p) => p.id !== pedidoActualId) && (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Guardá o vaciá el carrito actual para retomar un pedido</div>
          )}
        </div>
      </div>
    </div>
  );
}
