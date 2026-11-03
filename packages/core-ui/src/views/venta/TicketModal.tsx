import { useState, type ReactNode } from 'react';
import type { ComprobantePayload } from '@ferreteria/shared';
import { Modal } from '../../components/Modal';
import { buildTicketHtml, etiquetaMedio, formatPesos } from './ticketHtml';

type Props = {
  comprobante: ComprobantePayload;
  onNuevaVenta: () => void;
  /** Si se omite, no se muestra el botón Imprimir. Recibe el HTML del ticket. */
  onImprimir?: (html: string) => Promise<void>;
  /** Slot de anulación: la app dibuja su propio modal. Si se omite, no hay botón Anular. */
  anulacion?: (ctl: { onSuccess: () => void; onCancel: () => void }) => ReactNode;
};

export function TicketModal({ comprobante, onNuevaVenta, onImprimir, anulacion }: Readonly<Props>) {
  const [showAnulacion, setShowAnulacion] = useState(false);
  const [anulada, setAnulada] = useState(!!comprobante.anulado);
  const [printing, setPrinting] = useState(false);

  async function handleImprimir() {
    setPrinting(true);
    try {
      await onImprimir?.(buildTicketHtml({ ...comprobante, anulado: anulada }));
    } catch {
      // print cancelled or failed — no action needed
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      {/* Escape avanza a una nueva venta (el ticket no descarta nada). Con la anulación abierta,
          ese modal queda arriba en la pila y toma el Escape primero. */}
      <Modal ariaLabel="Ticket interno" ancho={420} style={{ maxHeight: '90vh', overflow: 'auto' }} onClose={onNuevaVenta}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)', fontWeight: 700 }}>Ticket interno</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{comprobante.numero}</div>
          </div>
          {anulada && (
            <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(192,57,43,.15)', color: 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
              ANULADA
            </span>
          )}
        </div>

        <div className="modal-body" style={{ flex: 1 }}>
          {comprobante.items.map((it, idx) => (
            <div key={idx} className="srow">
              <span className="sl">{it.descripcion} × {it.cantidad}</span>
              <span className="sv num">$ {formatPesos(it.subtotalCentavos)}</span>
            </div>
          ))}
          {comprobante.descuentoGlobalCentavos > 0 && (
            <div className="srow">
              <span className="sl text-muted">Descuento global</span>
              <span className="sv num text-muted">-$ {formatPesos(comprobante.descuentoGlobalCentavos)}</span>
            </div>
          )}
          {comprobante.ajusteRedondeoCentavos !== 0 && (
            <div className="srow">
              <span className="sl text-muted">Ajuste redondeo</span>
              <span className="sv num text-muted">$ {formatPesos(comprobante.ajusteRedondeoCentavos)}</span>
            </div>
          )}
          <div className="srow total">
            <span className="sl">TOTAL</span>
            <span className="sv num" style={{ color: 'var(--accent)' }}>$ {formatPesos(comprobante.totalCentavos)}</span>
          </div>
          {comprobante.pagos.map((p, idx) => (
            <div key={idx} className="text-muted text-sm">{etiquetaMedio(p.medio)}</div>
          ))}
        </div>

        <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <button type="button" onClick={onNuevaVenta} className="btn-primary" style={{ justifyContent: 'center', fontSize: 15 }}>
            Nueva venta
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {onImprimir && (
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleImprimir} disabled={printing}>
                {printing ? 'Abriendo...' : 'Imprimir'}
              </button>
            )}
            {anulacion && !anulada && (
              <button type="button" onClick={() => setShowAnulacion(true)} className="btn-danger" style={{ flex: 1, justifyContent: 'center' }}>
                Anular venta
              </button>
            )}
          </div>
        </div>
      </Modal>

      {showAnulacion && anulacion?.({
        onSuccess: () => { setAnulada(true); setShowAnulacion(false); },
        onCancel: () => setShowAnulacion(false),
      })}
    </>
  );
}
