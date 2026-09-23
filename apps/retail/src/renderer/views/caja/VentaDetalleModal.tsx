import { useState, useEffect } from 'react';
import { AnulacionModal } from '../pos/AnulacionModal';
import { useAuth } from '@core/ui';
import { GenerarRemitoModal } from '../remitos/GenerarRemitoModal';
import { useRemitosHabilitado } from '../../hooks/useRemitos';
import { useEscapeToClose } from '@core/ui';

type VentaData = {
  venta: any;
  detalles: any[];
  comprobante: any;
  cliente: { nombre_completo: string } | null;
};

type Props = {
  ventaId: string;
  onClose: () => void;
  onAnulada: () => void;
};

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(v: any) {
  try {
    return (v instanceof Date ? v : new Date(v)).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function buildTicketHtml(venta: any, detalles: any[]): string {
  const fecha = new Date(venta.fecha).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const formaPago = venta.forma_pago.charAt(0).toUpperCase() + venta.forma_pago.slice(1);
  const rows = detalles.map((d: any) =>
    `<tr><td>${d.descripcion} × ${d.cantidad}</td><td align="right">$ ${fmt(d.subtotal)}</td></tr>`
  ).join('');
  const descRow = venta.descuento_global > 0
    ? `<tr><td>Descuento global</td><td align="right">-${venta.descuento_global}%</td></tr>` : '';
  const ajusteRow = venta.ajuste_redondeo === 0
    ? '' : `<tr><td>Ajuste redondeo</td><td align="right">$ ${fmt(venta.ajuste_redondeo)}</td></tr>`;
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
  <tr class="tot"><td>TOTAL</td><td align="right">$ ${fmt(venta.total)}</td></tr>
  <tr><td>Forma de pago</td><td align="right">${formaPago}</td></tr>
  </table><hr/>
  </body></html>`;
}

export function VentaDetalleModal({ ventaId, onClose, onAnulada }: Readonly<Props>) {
  const { can } = useAuth();
  const remitosHabilitado = useRemitosHabilitado();
  const [showRemito, setShowRemito] = useState(false);
  const [avisoRemito, setAvisoRemito] = useState<string | null>(null);
  const [data, setData] = useState<VentaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnulacion, setShowAnulacion] = useState(false);
  const [anulada, setAnulada] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Escape no debe cerrar este modal mientras un hijo (remito/anulación) está abierto encima:
  // ambos usan el mismo hook con listeners de window, así que sin este guard un solo Escape
  // cerraría los dos modales a la vez.
  useEscapeToClose(onClose, !showRemito && !showAnulacion);

  useEffect(() => {
    (globalThis as any).ferreteria.venta.get({ id: ventaId })
      .then((result: VentaData | null) => {
        if (!result) { setError('Venta no encontrada'); return; }
        setData(result);
        if (result.venta.estado === 'anulada') setAnulada(true);
      })
      .catch(() => setError('Error al cargar la venta'))
      .finally(() => setLoading(false));
  }, [ventaId]);

  async function handleImprimir() {
    if (!data) return;
    setPrinting(true);
    try {
      const html = buildTicketHtml(data.venta, data.detalles);
      await (globalThis as any).ferreteria.catalogo.print.html(html);
    } catch {
      // print cancelled or failed — no action needed
    } finally {
      setPrinting(false);
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ width: 640 }}>
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>Cargando…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ width: 640 }}>
          <div className="modal-header"><span className="modal-title">Detalle de venta</span></div>
          <div className="modal-body"><div className="alert-danger">{error ?? 'Error desconocido'}</div></div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  const { venta, detalles, comprobante, cliente } = data;
  const puedeAnular = can('venta.anular') && venta.estado === 'confirmada' && !anulada;
  // ADR-045: el remito es opt-in sobre una venta confirmada, nunca automatico.
  const puedeRemitir = remitosHabilitado && can('remito.crear') && venta.estado === 'confirmada' && !anulada;
  const formaPagoLabel = venta.forma_pago.charAt(0).toUpperCase() + venta.forma_pago.slice(1);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 640, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)', fontWeight: 700 }}>
              Detalle de venta
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{venta.numero_interno}</div>
            <div className="text-muted text-sm">{fmtFecha(venta.fecha)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {anulada && (
              <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(192,57,43,.15)', color: 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
                ANULADA
              </span>
            )}
            <button type="button" className="ia" onClick={onClose} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Comprobante</div>
              <div className="num" style={{ fontWeight: 700 }}>{venta.numero_interno}</div>
              <div className="text-muted text-xs">
                {comprobante?.tipo === 'ticket_interno' ? 'Ticket interno' : (comprobante?.tipo ?? '—')}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Cliente</div>
              <div style={{ fontWeight: 600 }}>{cliente?.nombre_completo ?? '—'}</div>
            </div>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Forma de pago</div>
              <div style={{ fontWeight: 600 }}>{formaPagoLabel}</div>
              <div className="text-muted text-xs">{anulada ? 'Anulada' : 'Confirmada'}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className="r">Cant.</th>
                  <th className="r">Precio u.</th>
                  <th className="r">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map((d: any) => (
                  <tr key={d.id}>
                    <td>{d.descripcion}</td>
                    <td className="r num">{d.cantidad}</td>
                    <td className="r num">$ {fmt(d.precio_unitario)}</td>
                    <td className="r num">$ {fmt(d.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 8 }}>
            {venta.descuento_global > 0 && (
              <div className="srow">
                <span className="sl text-muted">Descuento global</span>
                <span className="sv num text-muted">-{venta.descuento_global}%</span>
              </div>
            )}
            {venta.ajuste_redondeo !== 0 && (
              <div className="srow">
                <span className="sl text-muted">Ajuste redondeo</span>
                <span className="sv num text-muted">$ {fmt(venta.ajuste_redondeo)}</span>
              </div>
            )}
            <div className="srow total">
              <span className="sl">TOTAL</span>
              <span className="sv num" style={{ color: 'var(--accent)' }}>$ {fmt(venta.total)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {avisoRemito && (
            <span className="text-muted text-sm" style={{ marginRight: 'auto' }}>{avisoRemito}</span>
          )}
          <button type="button" className="btn-secondary" onClick={handleImprimir} disabled={printing}>
            {printing ? 'Abriendo...' : 'Reimprimir'}
          </button>
          {puedeRemitir && (
            <button type="button" className="btn-secondary" onClick={() => setShowRemito(true)}>
              Generar remito
            </button>
          )}
          {puedeAnular && (
            <button type="button" className="btn-danger" onClick={() => setShowAnulacion(true)}>
              Cancelar venta
            </button>
          )}
        </div>
      </div>

      {showRemito && (
        <GenerarRemitoModal
          ventaId={venta.id}
          onClose={() => setShowRemito(false)}
          onCreado={(r) => { setShowRemito(false); setAvisoRemito(`Remito ${r.numero} emitido.`); }}
        />
      )}

      {showAnulacion && (
        <AnulacionModal
          ventaId={venta.id}
          onSuccess={() => { setAnulada(true); setShowAnulacion(false); onAnulada(); }}
          onCancel={() => setShowAnulacion(false)}
        />
      )}
    </div>
  );
}
