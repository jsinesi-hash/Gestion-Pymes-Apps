import { useState, useEffect, useRef } from 'react';
import { remitoApi } from '../../hooks/useRemitos';
import { VentaDetalleModal } from '../caja/VentaDetalleModal';
import { EditarRemitoModal } from './EditarRemitoModal';
import { Modal } from '@core/ui';

type Props = {
  remitoId: string;
  onClose: () => void;
};

type LineaRemito = {
  id: string;
  descripcion: string;
  unidad: string | null;
  cantidad_entregada: number;
};

type RemitoDetalle = {
  id: string;
  numero: string;
  estado: 'emitido' | 'conformado' | 'anulado';
  fecha_emision: number | string | Date;
  fecha_entrega: number | string | Date | null;
  recibido_por: string | null;
  transportista: string | null;
  domicilio_entrega: string | null;
  observaciones: string | null;
  motivo_anulacion: string | null;
  venta_id: string;
  venta_numero_interno: string | null;
  cliente_nombre_completo: string | null;
  cliente_domicilio: string | null;
  lineas: LineaRemito[];
};

function fmtFecha(v: RemitoDetalle['fecha_emision'] | null) {
  if (!v) return '—';
  try {
    return (v instanceof Date ? v : new Date(v)).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function EstadoBadge({ estado }: Readonly<{ estado: RemitoDetalle['estado'] }>) {
  if (estado === 'conformado') {
    return <span className="badge ok"><span className="bd" />Conformado</span>;
  }
  if (estado === 'anulado') {
    return <span className="badge off"><span className="bd" />Anulado</span>;
  }
  return <span className="badge-warn">Emitido</span>;
}

export function RemitoDetalleModal({ remitoId, onClose }: Readonly<Props>) {
  const [data, setData] = useState<RemitoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verVenta, setVerVenta] = useState(false);
  const [editar, setEditar] = useState(false);

  // `cargar` se reinvoca tras editar, asi que el guard de montaje no puede vivir
  // en el efecto (se recrearia por carga): va en un ref con vida util del componente.
  const vigente = useRef(true);
  useEffect(() => {
    vigente.current = true;
    return () => { vigente.current = false; };
  }, []);

  function cargar() {
    setCargando(true);
    remitoApi().obtener({ id: remitoId })
      .then((r) => { if (vigente.current) setData(r); })
      .catch((e) => { if (vigente.current) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente.current) setCargando(false); });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [remitoId]);

  if (cargando) {
    return (
      <Modal ariaLabel="Cargando remito" ancho={640} onClose={onClose} bloqueado={editar || verVenta}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>Cargando…</div>
      </Modal>
    );
  }

  if (error || !data) {
    return (
      <Modal ariaLabel="Detalle de remito" ancho={640} onClose={onClose} bloqueado={editar || verVenta}>
        <div className="modal-header"><span className="modal-title">Detalle de remito</span></div>
        <div className="modal-body"><div className="alert-danger" role="alert">{error ?? 'Remito no encontrado'}</div></div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      {/* Igual que en VentaDetalleModal: `bloqueado` mientras un modal hijo (editar remito o ver venta)
          está abierto encima, para que un solo Escape cierre solo el que está arriba. */}
      <Modal ariaLabel="Detalle de remito" ancho={640} onClose={onClose} bloqueado={editar || verVenta} style={{ maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)', fontWeight: 700 }}>
              Detalle de remito
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{data.numero}</div>
            <div className="text-muted text-sm">{fmtFecha(data.fecha_emision)}</div>
          </div>
          <EstadoBadge estado={data.estado} />
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Venta</div>
              {data.venta_numero_interno ? (
                <button
                  type="button"
                  className="num link-btn"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', color: 'inherit', font: 'inherit' }}
                  onClick={() => setVerVenta(true)}
                >
                  {data.venta_numero_interno}
                </button>
              ) : <div>—</div>}
            </div>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Cliente</div>
              <div style={{ fontWeight: 600 }}>{data.cliente_nombre_completo ?? '—'}</div>
            </div>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Transportista</div>
              <div>{data.transportista ?? '—'}</div>
            </div>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Domicilio de entrega</div>
              <div>{data.domicilio_entrega ?? data.cliente_domicilio ?? '—'}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Producto</th><th className="r">Cantidad entregada</th></tr>
              </thead>
              <tbody>
                {data.lineas.map((l) => (
                  <tr key={l.id}>
                    <td>{l.descripcion}</td>
                    <td className="r num">{l.cantidad_entregada} {l.unidad ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.estado === 'conformado' && (
            <div className="text-sm" style={{ marginTop: 12 }}>
              Recibido por <strong>{data.recibido_por}</strong> el {fmtFecha(data.fecha_entrega)}.
            </div>
          )}
          {data.estado === 'anulado' && data.motivo_anulacion && (
            <div className="alert-danger" style={{ marginTop: 12 }}>Anulado: {data.motivo_anulacion}</div>
          )}
          {data.observaciones && (
            <div className="text-muted text-sm" style={{ marginTop: 12 }}>{data.observaciones}</div>
          )}
        </div>

        <div className="modal-footer">
          {data.estado === 'emitido' && (
            <button type="button" className="btn-secondary" onClick={() => setEditar(true)}>Editar</button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </Modal>

      {editar && (
        <EditarRemitoModal
          remitoId={data.id}
          onClose={() => setEditar(false)}
          onEditado={() => { setEditar(false); cargar(); }}
        />
      )}

      {verVenta && (
        <VentaDetalleModal
          ventaId={data.venta_id}
          onClose={() => setVerVenta(false)}
          onAnulada={() => {}}
        />
      )}
    </>
  );
}
