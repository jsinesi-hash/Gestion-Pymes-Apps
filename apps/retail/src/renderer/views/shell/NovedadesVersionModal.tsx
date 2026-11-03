import { Modal } from '@core/ui';

interface Props {
  titulo: string;
  notas: string[];
  onContinuar: () => void;
}

export function NovedadesVersionModal({ titulo, notas, onContinuar }: Readonly<Props>) {
  return (
    <Modal ariaLabel="Novedades de la versión" ancho={520} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="modal-header">
        <span className="modal-title">{titulo}</span>
      </div>
      <div className="modal-body">
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notas.map((n, i) => (
            <li key={i} className="text-sm">{n}</li>
          ))}
        </ul>
      </div>
      <div className="modal-footer">
        <button className="btn-primary" onClick={onContinuar}>Continuar</button>
      </div>
    </Modal>
  );
}
