export type RemitoImprimible = {
  numero: string;
  fecha_emision: Date | number | string;
  estado: 'emitido' | 'conformado' | 'anulado';
  domicilio_entrega?: string | null;
  transportista?: string | null;
  observaciones?: string | null;
  venta_numero_interno?: string | null;
  cliente_nombre_completo?: string | null;
  cliente_documento?: string | null;
  lineas: { cantidad_entregada: number; descripcion: string; unidad?: string | null }[];
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Campo opcional: renderiza guion largo cuando viene null/vacio (nunca "null"). */
function opt(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.trim() === '' ? '—' : esc(s);
}

/**
 * Remito SIN importes (ADR-045 §4): cantidad + descripcion, datos de entrega
 * y pie con firma de recepcion. El precio vive en la factura.
 */
export function renderRemitoHtml(r: RemitoImprimible): string {
  const fecha = new Date(r.fecha_emision).toLocaleDateString('es-AR');

  const filas = r.lineas.map((l) => `
      <tr>
        <td class="num">${esc(l.cantidad_entregada)}</td>
        <td class="num">${opt(l.unidad)}</td>
        <td>${esc(l.descripcion)}</td>
      </tr>`).join('');

  const sello = r.estado === 'anulado'
    ? '<div class="sello">ANULADO</div>'
    : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Remito ${esc(r.numero)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .doc { border: 1px solid #000; padding: 12px; margin-bottom: 12px; }
  .aviso { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #999; padding: 6px; text-align: left; }
  th { background: #f0f0f0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .firma { margin-top: 72px; border-top: 1px solid #000; width: 280px; padding-top: 4px; font-size: 11px; }
  .sello { color: #b00; border: 3px solid #b00; padding: 6px 14px; display: inline-block;
           font-weight: bold; letter-spacing: 3px; margin-bottom: 12px; }
</style></head>
<body>
  ${sello}
  <div class="doc">
    <h1>REMITO ${esc(r.numero)}</h1>
    <div>Fecha de emisión: ${esc(fecha)}</div>
    <div class="aviso">Documento no válido como factura</div>
  </div>

  <div class="doc">
    <div><strong>Cliente:</strong> ${opt(r.cliente_nombre_completo)}</div>
    <div><strong>Documento:</strong> ${opt(r.cliente_documento)}</div>
    <div><strong>Domicilio de entrega:</strong> ${opt(r.domicilio_entrega)}</div>
    <div><strong>Venta asociada:</strong> ${opt(r.venta_numero_interno)}</div>
    <div><strong>Transportista:</strong> ${opt(r.transportista)}</div>
  </div>

  <table>
    <thead>
      <tr><th class="num">Cantidad</th><th class="num">Unidad</th><th>Descripción</th></tr>
    </thead>
    <tbody>${filas}
    </tbody>
  </table>

  <p><strong>Observaciones:</strong> ${opt(r.observaciones)}</p>

  <div class="firma">Firma y aclaración de recepción</div>
</body></html>`;
}
