import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface Props {
  version: string;
  onInstalar: () => void;
  onPosponer: () => void;
}

export function ActualizacionPropuestaModal({ version, onInstalar, onPosponer }: Readonly<Props>) {
  useEscapeToClose(onPosponer, true);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Actualización disponible">
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-header">
          <span className="modal-title">Actualización disponible</span>
        </div>
        <div className="modal-body">
          <p className="text-sm text-muted">
            Hay una nueva versión lista para instalar: <strong>{version}</strong>.
          </p>
          <p className="text-sm text-muted" style={{ marginTop: 8 }}>
            Al actualizar, la aplicación se cerrará, instalará la nueva versión y volverá a abrir.
            Podés hacerlo más tarde.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onPosponer}>Ahora no</button>
          <button className="btn-primary" onClick={onInstalar}>Actualizar ahora</button>
        </div>
      </div>
    </div>
  );
}
