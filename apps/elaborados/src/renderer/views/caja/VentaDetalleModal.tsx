import { useEffect, useState } from 'react';
import { AnulacionModal, bridge, formatPesos, traducirError, useAuth, Modal } from '@core/ui';

type Modificador = { id: string; descripcion: string };
type Linea = {
  id: string; descripcion: string; cantidad: number; subtotal_centavos: number; modificadores: Modificador[];
};
type Detalle = {
  venta: { numero_interno: string; fecha: number; total: number; estado: string };
  lineas: Linea[];
  cliente: { nombre_completo: string } | null;
};

type Props = { ventaId: string; onClose: () => void };

/** Detalle de solo lectura de una venta; es el slot `renderVentaDetalle` de CajaView. */
export function VentaDetalleModal({ ventaId, onClose }: Readonly<Props>) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const { can } = useAuth();

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = (await bridge().venta.get({ id: ventaId })) as Detalle | null;
        if (vivo) setDetalle(r);
      } catch (e) {
        if (vivo) setError(traducirError(e).mensaje);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [ventaId, recarga]);

  return (
    <>
      <Modal ariaLabel="Detalle de venta" ancho={560} onClose={onClose}>
        <div className="modal-header"><span className="modal-title">Detalle de venta</span></div>
        <div className="modal-body">
          {cargando && <p>Cargando…</p>}
          {error && <p role="alert">{error}</p>}
          {!cargando && !error && !detalle && <p>No se encontró la venta</p>}
          {detalle && (
            <>
              <p>
                <strong className="num">{detalle.venta.numero_interno}</strong>
                {detalle.venta.estado === 'anulada' && <span className="badge" style={{ marginLeft: 8 }}>ANULADA</span>}
              </p>
              <p>{new Date(detalle.venta.fecha).toLocaleString('es-AR')} · {detalle.cliente?.nombre_completo ?? 'Consumidor Final'}</p>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {detalle.lineas.map((l) => {
                  const mods = l.modificadores.map((m) => m.descripcion).join(', ');
                  return (
                    <li key={l.id} className="srow" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{l.cantidad} × {l.descripcion}{mods ? ` — ${mods}` : ''}</span>
                      <span className="num">{formatPesos(l.subtotal_centavos)}</span>
                    </li>
                  );
                })}
              </ul>
              <p style={{ textAlign: 'right' }}>
                Total: <strong className="num">{formatPesos(Math.round(detalle.venta.total * 100))}</strong>
              </p>
            </>
          )}
        </div>
        <div className="modal-footer">
          {can('venta.anular') && detalle?.venta.estado === 'confirmada' && (
            <button type="button" className="btn-danger" onClick={() => setAnulando(true)}>Anular venta</button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </Modal>
      {anulando && (
        <AnulacionModal
          ventaId={ventaId}
          onSuccess={() => { setAnulando(false); setRecarga((n) => n + 1); }}
          onCancel={() => setAnulando(false)}
        />
      )}
    </>
  );
}
