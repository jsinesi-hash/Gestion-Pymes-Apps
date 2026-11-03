import { Modal } from '@core/ui';

interface Props {
  version: string;
  onInstalar: () => void;
  onPosponer: () => void;
}

export function ActualizacionPropuestaModal({ version, onInstalar, onPosponer }: Readonly<Props>) {

  return (
    <Modal ariaLabel="Actualización disponible" ancho={480} onClose={onPosponer}>
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
    </Modal>
  );
}
