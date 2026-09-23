import { useState } from 'react';
import { AnulacionModal } from './AnulacionModal';
import { useEscapeToClose } from '@core/ui';

type Props = {
  result: { venta: any; detalles: any[]; comprobante: any };
  onNuevaVenta: () => void;
  canAnular: boolean;
};

function formatPeso(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildTicketHtml(venta: any, detalles: any[]): string {
  const fecha = new Date(venta.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const formaPago = venta.forma_pago.charAt(0).toUpperCase() + venta.forma_pago.slice(1);
  const rows = detalles.map((d: any) =>
    `<tr><td>${d.descripcion} × ${d.cantidad}</td><td align="right">$ ${formatPeso(d.subtotal)}</td></tr>`
  ).join('');
  const descRow = venta.descuento_global > 0
    ? `<tr><td>Descuento global</td><td align="right">-${venta.descuento_global}%</td></tr>` : '';
  const ajusteRow = venta.ajuste_redondeo === 0
    ? '' : `<tr><td>Ajuste redondeo</td><td align="right">$ ${formatPeso(venta.ajuste_redondeo)}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}
    table{width:100%;border-collapse:collapse}td{padding:2px 4px}
    .hdr{text-align:center;margin-bottom:8px}
    .tot{border-top:1px solid #000;font-weight:bold;font-size:14px}
    hr{border:none;border-top:1px dashed #999}
  </style></head><body>
  <div class="hdr"><div style="font-size:18px;font-weight:bold">TICKET INTERNO</div>
  <div>${venta.numero_interno}</div><div>${fecha}</div></div>
  <hr/><table>${rows}${descRow}${ajusteRow}
  <tr class="tot"><td>TOTAL</td><td align="right">$ ${formatPeso(venta.total)}</td></tr>
  <tr><td>Forma de pago</td><td align="right">${formaPago}</td></tr>
  </table><hr/>
  </body></html>`;
}

export function TicketModal({ result, onNuevaVenta, canAnular }: Readonly<Props>) {
  const { venta, detalles } = result;
  const [showAnulacion, setShowAnulacion] = useState(false);
  const [anulada, setAnulada] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Escape avanza a una nueva venta (el ticket no descarta nada). Con la anulación
  // abierta, ese modal queda arriba en la pila y toma el Escape primero.
  useEscapeToClose(onNuevaVenta);

  async function handleImprimir() {
    setPrinting(true);
    try {
      const html = buildTicketHtml(venta, detalles);
      await (globalThis as any).ferreteria.catalogo.print.html(html);
    } catch {
      // print cancelled or failed — no action needed
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 420, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)', fontWeight: 700 }}>Ticket interno</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{venta.numero_interno}</div>
          </div>
          {anulada && (
            <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(192,57,43,.15)', color: 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
              ANULADA
            </span>
          )}
        </div>

        <div className="modal-body" style={{ flex: 1 }}>
          {detalles.map((d: any) => (
            <div key={d.id} className="srow">
              <span className="sl">{d.descripcion} × {d.cantidad}</span>
              <span className="sv num">$ {formatPeso(d.subtotal)}</span>
            </div>
          ))}
          {venta.descuento_global > 0 && (
            <div className="srow">
              <span className="sl text-muted">Descuento global</span>
              <span className="sv num text-muted">-{venta.descuento_global}%</span>
            </div>
          )}
          <div className="srow total">
            <span className="sl">TOTAL</span>
            <span className="sv num" style={{ color: 'var(--accent)' }}>$ {formatPeso(venta.total)}</span>
          </div>
          <div className="text-muted text-sm">
            {venta.forma_pago.charAt(0).toUpperCase() + venta.forma_pago.slice(1)}
          </div>
        </div>

        <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <button type="button" onClick={onNuevaVenta} className="btn-primary" style={{ justifyContent: 'center', fontSize: 15 }}>
            Nueva venta
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleImprimir} disabled={printing}>
              {printing ? 'Abriendo...' : 'Imprimir'}
            </button>
            {canAnular && !anulada && (
              <button type="button" onClick={() => setShowAnulacion(true)} className="btn-danger" style={{ flex: 1, justifyContent: 'center' }}>
                Anular venta
              </button>
            )}
          </div>
        </div>
      </div>

      {showAnulacion && (
        <AnulacionModal
          ventaId={venta.id}
          onSuccess={() => { setAnulada(true); setShowAnulacion(false); }}
          onCancel={() => setShowAnulacion(false)}
        />
      )}
    </div>
  );
}
