import { useEffect, useState } from 'react';
import { remitoApi } from '../../hooks/useRemitos';
import { useTransportistas } from '../../hooks/useTransportistas';
import { Modal } from '@core/ui';
import { useCallIpc } from '@core/ui';

// ADR-085 (SEC-2): campos de cabecera con control propio en este form, mapeados al
// `id` de su input (distinto del nombre de campo del backend para no colisionar con
// los ids de GenerarRemitoModal cuando ambos modales conviven — ver RemitoDetalleModal).
// `lineas.*` y cualquier otro campo sin control dedicado caen en la región general de error.
const CAMPO_A_ID: Record<string, string> = {
  domicilio_entrega: 'editar-remito-domicilio',
  transportista_id: 'editar-remito-transportista',
};
const CAMPOS_ERROR = new Set(Object.keys(CAMPO_A_ID));

type LineaEditable = {
  remito_linea_id: string;
  venta_detalle_id: string;
  descripcion: string;
  unidad: string | null;
  cantidadActual: number;
  maximo: number;
};

type Props = {
  remitoId: string;
  onClose: () => void;
  onEditado: () => void;
};

export function EditarRemitoModal({ remitoId, onClose, onEditado }: Readonly<Props>) {
  const { transportistas } = useTransportistas();
  const [lineas, setLineas] = useState<LineaEditable[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [domicilio, setDomicilio] = useState('');
  const [transportistaId, setTransportistaId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const callIpc = useCallIpc();

  useEffect(() => {
    let vigente = true;

    remitoApi().obtener({ id: remitoId })
      .then(async (remito) => {
        if (!vigente) return;
        const pendienteData = await remitoApi().pendiente({
          venta_id: remito.venta_id,
          excluir_remito_id: remitoId,
        });
        if (!vigente) return;

        const pendientePorDetalle = new Map<string, number>(
          pendienteData.lineas.map((p: any) => [p.venta_detalle_id, p.cantidad_pendiente]),
        );

        const editable: LineaEditable[] = remito.lineas.map((l: any) => ({
          remito_linea_id: l.id,
          venta_detalle_id: l.venta_detalle_id,
          descripcion: l.descripcion,
          unidad: l.unidad,
          cantidadActual: l.cantidad_entregada,
          // El pendiente ya vino con excluir_remito_id, o sea que NO cuenta lo que este
          // remito tiene asignado: ese numero es directamente el maximo editable. Sumarle
          // cantidad_entregada lo contaria dos veces. Fallback a lo actual por si el
          // detalle no viniera en la respuesta, para no bloquear la linea en 0.
          maximo: pendientePorDetalle.get(l.venta_detalle_id) ?? l.cantidad_entregada,
        }));

        setLineas(editable);
        setCantidades(Object.fromEntries(editable.map((l) => [l.remito_linea_id, String(l.cantidadActual)])));
        setDomicilio(remito.domicilio_entrega ?? '');
        setTransportistaId(remito.transportista_id ?? '');
      })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
  }, [remitoId]);

  async function guardar() {
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

    const payloadLineas = lineas.map((l) => ({
      remito_linea_id: l.remito_linea_id,
      cantidad_entregada: Number.parseFloat(cantidades[l.remito_linea_id] ?? '0') || 0,
    }));

    const excedida = lineas.find((l) => {
      const valor = Number.parseFloat(cantidades[l.remito_linea_id] ?? '0') || 0;
      return valor > l.maximo;
    });
    if (excedida) {
      setError(`"${excedida.descripcion}": excede lo pendiente (${excedida.maximo}).`);
      return;
    }

    setGuardando(true);
    const r = await callIpc(() => remitoApi().editar({
      id: remitoId,
      domicilio_entrega: domicilio.trim(),
      transportista_id: transportistaId,
      lineas: payloadLineas,
    }), { success: 'Remito guardado' });
    setGuardando(false);
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
    onEditado();
  }

  if (cargando) {
    return (
      <Modal ariaLabel="Cargando remito" ancho={720} onClose={onClose}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>Cargando…</div>
      </Modal>
    );
  }

  return (
    <Modal ariaLabel="Editar remito" ancho={720} onClose={onClose} style={{ maxHeight: '90vh', overflow: 'auto' }}>
      <div className="modal-header">
        <span className="modal-title">Editar remito</span>
      </div>

      <div className="modal-body">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="r">Máximo</th>
                <th className="r">Cantidad a entregar</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.remito_linea_id}>
                  <td>{l.descripcion}</td>
                  <td className="r num">{l.maximo} {l.unidad ?? ''}</td>
                  <td className="r">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="input"
                      style={{ width: 90, textAlign: 'right' }}
                      aria-label={`Cantidad a entregar de ${l.descripcion}`}
                      value={cantidades[l.remito_linea_id] ?? ''}
                      onChange={(e) => setCantidades((c) => ({ ...c, [l.remito_linea_id]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <div className="field">
            <label htmlFor="editar-remito-domicilio">Domicilio de entrega</label>
            <input
              id="editar-remito-domicilio"
              className={`input${fieldErrors.domicilio_entrega ? ' error' : ''}`}
              value={domicilio}
              onChange={(e) => { setDomicilio(e.target.value); setFieldErrors((prev) => ({ ...prev, domicilio_entrega: '' })); }}
            />
            {fieldErrors.domicilio_entrega && <span className="field-error">{fieldErrors.domicilio_entrega}</span>}
          </div>

          <div className="field">
            <label htmlFor="editar-remito-transportista">Transportista</label>
            <select
              id="editar-remito-transportista"
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
        </div>

        {error && <div className="alert-danger" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  );
}
