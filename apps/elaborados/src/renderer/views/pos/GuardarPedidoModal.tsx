import { useState } from 'react';
import { Modal } from '@core/ui';

type Props = {
  inicial?: { alias: string; observaciones: string };
  guardando: boolean;
  error: string | null;
  onGuardar: (datos: { alias: string; observaciones: string }) => void;
  onCancelar: () => void;
};

export function GuardarPedidoModal({ inicial, guardando, error, onGuardar, onCancelar }: Props) {
  const [alias, setAlias] = useState(inicial?.alias ?? '');
  const [observaciones, setObservaciones] = useState(inicial?.observaciones ?? '');
  const puede = alias.trim() !== '' && !guardando;

  return (
    <Modal ariaLabel="Guardar pedido" ancho={460} onClose={onCancelar}>
      <div className="modal-header"><span className="modal-title">Guardar pedido</span></div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="pedido-alias">Alias</label>
          <input
            id="pedido-alias" className="input" aria-label="Alias del pedido" maxLength={60} autoFocus
            placeholder="Nombre o teléfono" value={alias} onChange={(e) => setAlias(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pedido-obs">Observaciones</label>
          <textarea
            id="pedido-obs" className="input" aria-label="Observaciones" maxLength={500} rows={3}
            placeholder="Dirección, hora de entrega, aclaraciones" value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>
        {error && <div role="alert" style={{ color: 'var(--danger, #c0392b)', fontSize: 13 }}>{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onCancelar}>Cancelar</button>
        <button
          type="button" className="btn-primary" disabled={!puede}
          onClick={() => onGuardar({ alias: alias.trim(), observaciones: observaciones.trim() })}
        >
          Guardar pedido
        </button>
      </div>
    </Modal>
  );
}
