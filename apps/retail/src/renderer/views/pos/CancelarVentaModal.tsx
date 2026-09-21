import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type Props = {
  onDescartar: () => void;
  onVolver: () => void;
};

// ADR-056 Lote 2 — confirmación del botón "Cancelar" del POS. Vuelve el cart a cero. Es
// SOLO estado de UI: no registra nada en la BD (no confundir con la venta en espera de
// ADR-033). El diálogo evita vaciar el carrito por accidente.
export function CancelarVentaModal({ onDescartar, onVolver }: Readonly<Props>) {
  useEscapeToClose(onVolver, true);

  return (
    <div className="modal-overlay" onClick={onVolver}>
      <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Cancelar venta en curso</span>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0 }}>
            Se vaciará el carrito y se perderán las líneas, el cliente y los descuentos de
            esta venta. Esta acción no registra nada.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onVolver}>
            Volver
          </button>
          <button type="button" className="btn-danger" onClick={onDescartar}>
            Descartar venta
          </button>
        </div>
      </div>
    </div>
  );
}
