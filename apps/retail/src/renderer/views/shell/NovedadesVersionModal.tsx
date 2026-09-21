interface Props {
  titulo: string;
  notas: string[];
  onContinuar: () => void;
}

export function NovedadesVersionModal({ titulo, notas, onContinuar }: Readonly<Props>) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Novedades de la versión"> {/* NOSONAR */}
      <div className="modal" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
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
      </div>
    </div>
  );
}
