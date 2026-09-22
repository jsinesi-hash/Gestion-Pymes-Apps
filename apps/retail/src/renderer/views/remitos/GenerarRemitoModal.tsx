import { useEffect, useState } from 'react';
import { remitoApi, type LineaPendiente } from '../../hooks/useRemitos';
import { useTransportistas } from '../../hooks/useTransportistas';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useCallIpc } from '@core/ui';

// ADR-085 (SEC-2): campos de cabecera con control propio en este form, mapeados al
// `id` de su input (distinto del nombre de campo del backend para no colisionar con
// los ids de EditarRemitoModal cuando ambos modales conviven — ver RemitoDetalleModal,
// que puede tener a la vez "Editar" y "Ver venta → Generar remito" montados).
// `lineas.*` y cualquier otro campo sin control dedicado caen en la región general de error.
const CAMPO_A_ID: Record<string, string> = {
  domicilio_entrega: 'remito-domicilio',
  transportista_id: 'remito-transportista',
  observaciones: 'remito-observaciones',
};
const CAMPOS_ERROR = new Set(Object.keys(CAMPO_A_ID));

type Props = {
  ventaId: string;
  onClose: () => void;
  onCreado: (remito: { id: string; numero: string }) => void;
};

export function GenerarRemitoModal({ ventaId, onClose, onCreado }: Readonly<Props>) {
  const [lineas, setLineas] = useState<LineaPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [domicilio, setDomicilio] = useState('');
  const [transportistaId, setTransportistaId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emitiendo, setEmitiendo] = useState(false);
  const { transportistas } = useTransportistas();
  const callIpc = useCallIpc();

  useEscapeToClose(onClose);

  useEffect(() => {
    let vigente = true;
    remitoApi().pendiente({ venta_id: ventaId })
      .then(({ lineas: filas, domicilio_cliente }) => {
        if (!vigente) return;
        // Solo tiene sentido remitir lo que todavia esta pendiente de entrega.
        setLineas(filas.filter((f) => f.cantidad_pendiente > 0));
        setDomicilio((actual) => actual || domicilio_cliente || '');
      })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [ventaId]);

  async function emitir() {
    setError(null);
    setFieldErrors({});

    if (domicilio.trim() === '') {
      setError('El domicilio de entrega es obligatorio.');
      return;
    }
    if (!transportistaId) {
      setError('Seleccioná un transportista.');
      return;
    }

    const seleccionadas = lineas
      .map((linea) => ({ linea, valor: Number.parseFloat(cantidades[linea.venta_detalle_id] ?? '') }))
      .filter((x) => Number.isFinite(x.valor) && x.valor > 0);

    if (seleccionadas.length === 0) {
      setError('Seleccioná al menos una linea con cantidad a entregar.');
      return;
    }
    const excedida = seleccionadas.find((x) => x.valor > x.linea.cantidad_pendiente);
    if (excedida) {
      setError(`"${excedida.linea.descripcion}": excede lo pendiente (${excedida.linea.cantidad_pendiente}).`);
      return;
    }

    setEmitiendo(true);
    const r = await callIpc(() => remitoApi().crear({
      venta_id: ventaId,
      domicilio_entrega: domicilio.trim(),
      transportista_id: transportistaId,
      observaciones: observaciones || null,
      lineas: seleccionadas.map((x) => ({
        venta_detalle_id: x.linea.venta_detalle_id,
        cantidad_entregada: x.valor,
      })),
    }), { success: 'Remito emitido' });
    setEmitiendo(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setFieldErrors((prev) => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(CAMPO_A_ID[campo])?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    onCreado(r.data);
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 720, maxHeight: '90vh', overflow: 'auto' }} role="dialog" aria-label="Generar remito">
        <div className="modal-header">
          <span className="modal-title">Generar remito</span>
        </div>

        <div className="modal-body">
          {cargando && <div className="text-muted">Cargando líneas…</div>}

          {!cargando && lineas.length === 0 && (
            <div className="text-muted">No hay líneas pendientes de entrega para esta venta.</div>
          )}

          {lineas.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="r">Vendido</th>
                    <th className="r">Entregado</th>
                    <th className="r">Pendiente</th>
                    <th className="r">A entregar</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.venta_detalle_id}>
                      <td>{l.descripcion}</td>
                      <td className="r num">{l.cantidad_vendida}</td>
                      <td className="r num">{l.cantidad_entregada}</td>
                      <td className="r num">{l.cantidad_pendiente} {l.unidad ?? ''}</td>
                      <td className="r">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="input"
                          style={{ width: 90, textAlign: 'right' }}
                          aria-label={`Cantidad a entregar de ${l.descripcion}`}
                          value={cantidades[l.venta_detalle_id] ?? ''}
                          onChange={(e) => setCantidades((c) => ({ ...c, [l.venta_detalle_id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <div className="field">
              <label htmlFor="remito-domicilio">Domicilio de entrega</label>
              <input
                id="remito-domicilio"
                className={`input${fieldErrors.domicilio_entrega ? ' error' : ''}`}
                value={domicilio}
                onChange={(e) => { setDomicilio(e.target.value); setFieldErrors((prev) => ({ ...prev, domicilio_entrega: '' })); }}
                placeholder="Si difiere del domicilio del cliente"
              />
              {fieldErrors.domicilio_entrega && <span className="field-error">{fieldErrors.domicilio_entrega}</span>}
            </div>

            <div className="field">
              <label htmlFor="remito-transportista">Transportista</label>
              <select
                id="remito-transportista"
                className={`input${fieldErrors.transportista_id ? ' error' : ''}`}
                value={transportistaId}
                onChange={(e) => { setTransportistaId(e.target.value); setFieldErrors((prev) => ({ ...prev, transportista_id: '' })); }}
              >
                <option value="">Seleccionar…</option>
                {transportistas.map((t) => (
                  <option key={t.id} value={t.id}>{t.razon_social}</option>
                ))}
              </select>
              {fieldErrors.transportista_id && <span className="field-error">{fieldErrors.transportista_id}</span>}
            </div>

            <div className="field">
              <label htmlFor="remito-observaciones">Observaciones</label>
              <textarea
                id="remito-observaciones"
                className={`input${fieldErrors.observaciones ? ' error' : ''}`}
                rows={2}
                value={observaciones}
                onChange={(e) => { setObservaciones(e.target.value); setFieldErrors((prev) => ({ ...prev, observaciones: '' })); }}
              />
              {fieldErrors.observaciones && <span className="field-error">{fieldErrors.observaciones}</span>}
            </div>
          </div>

          {error && <div className="alert-danger" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn-primary"
            onClick={emitir}
            disabled={emitiendo || cargando || lineas.length === 0}
          >
            {emitiendo ? 'Emitiendo…' : 'Emitir remito'}
          </button>
        </div>
      </div>
    </div>
  );
}
