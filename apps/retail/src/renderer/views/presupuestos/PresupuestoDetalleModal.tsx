import { useEffect, useState } from 'react';
import { presupuestoApi, type PresupuestoEstado } from '../../hooks/usePresupuestos';
import { Modal } from '@core/ui';

type LineaDet = {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario_centavos: number | null;
  descuento_linea_pct: number;
  subtotal_centavos: number;
};

type Detalle = {
  numero: string | null;
  estado: PresupuestoEstado;
  fecha_emision: number | string | Date | null;
  fecha_validez: number | string | Date | null;
  validez_dias: number;
  descuento_global_pct: number;
  total_centavos: number;
  observaciones: string | null;
  cliente_nombre_completo: string | null;
  cliente_documento: string | null;
  cliente_condicion_fiscal: string | null;
  venta_numero_interno: string | null;
  venta_total: number | null; // pesos (columna venta.total)
  lineas: LineaDet[];
};

function pesos(centavos: number | null | undefined): string {
  return ((centavos ?? 0) / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}
function pesosDesde(pesosValor: number | null | undefined): string {
  return (pesosValor ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}
function fmtFecha(v: Detalle['fecha_emision']): string {
  if (!v) return '—';
  try { return (v instanceof Date ? v : new Date(v)).toLocaleDateString('es-AR'); } catch { return '—'; }
}

const ESTADO_LABEL: Record<PresupuestoEstado, string> = {
  borrador: 'Borrador', emitido: 'Emitido', vencido: 'Vencido',
  convertido: 'Convertido', anulado: 'Anulado',
};

export function PresupuestoDetalleModal({ presupuestoId, onClose }: Readonly<{ presupuestoId: string; onClose: () => void }>) {
  const [det, setDet] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    presupuestoApi().obtener({ id: presupuestoId })
      .then((d) => { if (vigente) setDet(d as Detalle); })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : String(e)); });
    return () => { vigente = false; };
  }, [presupuestoId]);

  return (
    <Modal ariaLabel="Detalle de presupuesto" ancho={720} onClose={onClose} style={{ maxWidth: '95vw' }}>
      <div className="modal-header">
        <span className="modal-title">Presupuesto {det?.numero ?? '(borrador)'}</span>
      </div>
      <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
        {error && <div className="alert-danger" role="alert">{error}</div>}
        {!det && !error && <div className="text-muted">Cargando…</div>}
        {det && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div><strong>Estado:</strong> {ESTADO_LABEL[det.estado]}</div>
              <div><strong>Cliente:</strong> {det.cliente_nombre_completo ?? 'Consumidor Final'}</div>
              <div><strong>Documento:</strong> {det.cliente_documento ?? '—'}</div>
              <div><strong>Condición fiscal:</strong> {det.cliente_condicion_fiscal ?? '—'}</div>
              <div><strong>Emisión:</strong> {fmtFecha(det.fecha_emision)}</div>
              <div><strong>Válido hasta:</strong> {fmtFecha(det.fecha_validez)}</div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th><th className="r">Cantidad</th><th className="r">P. unitario</th>
                    <th className="r">Desc.</th><th className="r">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {det.lineas.map((l) => (
                    <tr key={l.id}>
                      <td>{l.descripcion}</td>
                      <td className="num r">{l.cantidad}</td>
                      <td className="num r">{pesos(l.precio_unitario_centavos)}</td>
                      <td className="num r">{l.descuento_linea_pct ? `${l.descuento_linea_pct}%` : '—'}</td>
                      <td className="num r">{pesos(l.subtotal_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {det.descuento_global_pct > 0 && (
              <div style={{ textAlign: 'right', fontSize: 13 }}><strong>Descuento global:</strong> {det.descuento_global_pct}%</div>
            )}
            <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 700 }}>Total cotizado: {pesos(det.total_centavos)}</div>

            {det.estado === 'convertido' && (
              <div className="alert-warn" style={{ fontSize: 13 }}>
                Convertido a la venta <strong>{det.venta_numero_interno ?? '—'}</strong> por <strong>{pesosDesde(det.venta_total)}</strong>.
                {det.venta_total != null && Math.round(det.venta_total * 100) !== det.total_centavos && (
                  <> El total de la venta difiere del cotizado (se editó el carrito al vender).</>
                )}
              </div>
            )}

            {det.observaciones && <div style={{ fontSize: 13 }}><strong>Observaciones:</strong> {det.observaciones}</div>}
          </>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
