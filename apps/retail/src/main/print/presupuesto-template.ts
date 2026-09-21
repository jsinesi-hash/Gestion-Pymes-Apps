export type PresupuestoImprimible = {
  numero: string | null;
  fecha_emision: Date | number | string | null;
  fecha_validez: Date | number | string | null;
  estado: 'borrador' | 'emitido' | 'vencido' | 'convertido' | 'anulado';
  descuento_global_pct: number;
  total_centavos: number;
  observaciones?: string | null;
  cliente_nombre_completo?: string | null;
  cliente_documento?: string | null;
  cliente_condicion_fiscal?: string | null;
  lineas: {
    descripcion: string;
    cantidad: number;
    precio_unitario_centavos: number | null;
    descuento_linea_pct: number;
    subtotal_centavos: number;
  }[];
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function opt(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.trim() === '' ? '—' : esc(s);
}

/** Formatea centavos como $ 1.234,56 (es-AR). */
function pesos(centavos: number | null | undefined): string {
  const c = centavos ?? 0;
  return (c / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

/**
 * Presupuesto (cotizacion) — documento simple CON importes (ADR-046 §5).
 * SIN plantilla fiscal: no es un comprobante AFIP.
 */
export function renderPresupuestoHtml(p: PresupuestoImprimible): string {
  const fechaEmision = p.fecha_emision ? new Date(p.fecha_emision).toLocaleDateString('es-AR') : '—';
  const fechaValidez = p.fecha_validez ? new Date(p.fecha_validez).toLocaleDateString('es-AR') : '—';

  const filas = p.lineas.map((l) => {
    const desc = l.descuento_linea_pct ? `${esc(l.descuento_linea_pct)}%` : '—';
    return `
      <tr>
        <td class="num">${esc(l.cantidad)}</td>
        <td>${esc(l.descripcion)}</td>
        <td class="num">${pesos(l.precio_unitario_centavos)}</td>
        <td class="num">${desc}</td>
        <td class="num">${pesos(l.subtotal_centavos)}</td>
      </tr>`;
  }).join('');

  const descGlobal = p.descuento_global_pct
    ? `<div><strong>Descuento global:</strong> ${esc(p.descuento_global_pct)}%</div>`
    : '';

  const sello = p.estado === 'anulado' ? '<div class="sello">ANULADO</div>'
    : p.estado === 'vencido' ? '<div class="sello">VENCIDO</div>'
    : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Presupuesto ${esc(p.numero)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .doc { border: 1px solid #000; padding: 12px; margin-bottom: 12px; }
  .aviso { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #999; padding: 6px; text-align: left; }
  th { background: #f0f0f0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total { margin-top: 12px; text-align: right; font-size: 15px; font-weight: bold; }
  .sello { color: #b00; border: 3px solid #b00; padding: 6px 14px; display: inline-block;
           font-weight: bold; letter-spacing: 3px; margin-bottom: 12px; }
</style></head>
<body>
  ${sello}
  <div class="doc">
    <h1>PRESUPUESTO ${opt(p.numero)}</h1>
    <div>Fecha de emisión: ${esc(fechaEmision)}</div>
    <div>Válido hasta: ${esc(fechaValidez)}</div>
    <div class="aviso">Presupuesto no válido como factura</div>
  </div>

  <div class="doc">
    <div><strong>Cliente:</strong> ${opt(p.cliente_nombre_completo) === '—' ? 'Consumidor Final' : opt(p.cliente_nombre_completo)}</div>
    <div><strong>Documento:</strong> ${opt(p.cliente_documento)}</div>
    <div><strong>Condición fiscal:</strong> ${opt(p.cliente_condicion_fiscal)}</div>
  </div>

  <table>
    <thead>
      <tr><th class="num">Cant.</th><th>Descripción</th><th class="num">P. unitario</th><th class="num">Desc.</th><th class="num">Subtotal</th></tr>
    </thead>
    <tbody>${filas}
    </tbody>
  </table>

  ${descGlobal}
  <div class="total">TOTAL: ${pesos(p.total_centavos)}</div>

  <p><strong>Observaciones:</strong> ${opt(p.observaciones)}</p>
</body></html>`;
}
