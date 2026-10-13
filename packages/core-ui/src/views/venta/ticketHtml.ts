import type { ComprobantePayload } from '@ferreteria/shared';

export function formatPesos(centavos: number): string {
  return (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const esc = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
  cuenta_corriente: 'Cuenta corriente', cheque: 'Cheque',
};
export const etiquetaMedio = (m: string) => MEDIOS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

export function buildTicketHtml(c: ComprobantePayload): string {
  const fecha = new Date(c.fechaIso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const items = c.items.map((i) =>
    `<tr><td>${esc(i.descripcion)} × ${i.cantidad}</td><td align="right">$ ${formatPesos(i.subtotalCentavos)}</td></tr>`).join('');
  const desc = c.descuentoGlobalCentavos > 0
    ? `<tr><td>Descuento global</td><td align="right">-$ ${formatPesos(c.descuentoGlobalCentavos)}</td></tr>` : '';
  const ajuste = c.ajusteRedondeoCentavos === 0
    ? '' : `<tr><td>Ajuste redondeo</td><td align="right">$ ${formatPesos(c.ajusteRedondeoCentavos)}</td></tr>`;
  const pagos = c.pagos.map((p) =>
    `<tr><td>${esc(etiquetaMedio(p.medio))}</td><td align="right">$ ${formatPesos(p.montoCentavos)}</td></tr>`).join('');
  const anulada = c.anulado ? '<div style="text-align:center;font-weight:bold;color:#c0392b">ANULADA</div>' : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}
    table{width:100%;border-collapse:collapse}td{padding:2px 4px}
    .hdr{text-align:center;margin-bottom:8px}
    .tot{border-top:1px solid #000;font-weight:bold;font-size:14px}
    hr{border:none;border-top:1px dashed #999}
  </style></head><body>
  <div class="hdr"><div style="font-size:18px;font-weight:bold">TICKET INTERNO</div>
  <div>${esc(c.numero)}</div><div>${fecha}</div></div>${anulada}
  <hr/><table>${items}${desc}${ajuste}
  <tr class="tot"><td>TOTAL</td><td align="right">$ ${formatPesos(c.totalCentavos)}</td></tr>
  </table><hr/><table>${pagos}</table>
  </body></html>`;
}
