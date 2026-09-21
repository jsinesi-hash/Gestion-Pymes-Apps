import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useImportar, type Entidad } from '../../hooks/useImportar';
import { UploadStep } from './steps/UploadStep';
import { PreviewStep } from './steps/PreviewStep';
import { SummaryStep } from './steps/SummaryStep';

const ENTIDADES: { key: Entidad; label: string }[] = [
  { key: 'productos',    label: 'Productos' },
  { key: 'clientes',     label: 'Clientes' },
  { key: 'proveedores',  label: 'Proveedores' },
  { key: 'ubicaciones',  label: 'Ubicaciones' },
  { key: 'stockInicial', label: 'Stock inicial' },
];

const STEPS = ['Subir archivo', 'Previsualizar', 'Resultado'];

function estadoToStep(estado: string): number {
  if (estado === 'idle' || estado === 'validating') return 0;
  if (estado === 'preview' || estado === 'confirming') return 1;
  return 2;
}

export function ImportarView() {
  const { can } = useAuth();
  const { entidad, setEntidad, estado, preview, summary, error, subirArchivo, confirmar, reset, editarFilaPreview } = useImportar();

  if (!can('import.masiva')) return <Navigate to="/" replace />;

  const currentStep = estadoToStep(estado);

  return (
    <div className="flex-col gap-4" style={{ height: '100%' }}>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        {ENTIDADES.map(e => (
          <button key={e.key} type="button" className={entidad === e.key ? 'on' : ''} onClick={() => setEntidad(e.key)}>
            {e.label}
          </button>
        ))}
      </div>

      <div className="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: 0, flexShrink: 0, padding: 'var(--pad)' }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, background: i < currentStep ? 'var(--ok)' : i === currentStep ? 'var(--accent)' : 'var(--surface-2)', color: i <= currentStep ? '#fff' : 'var(--ink-3)', border: i > currentStep ? '1.5px solid var(--line)' : 'none' }}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: i === currentStep ? 'var(--ink)' : i < currentStep ? 'var(--ok)' : 'var(--ink-3)' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1.5, background: i < currentStep ? 'var(--ok)' : 'var(--line)', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}

      <div className="panel" style={{ flex: 1, minHeight: 0 }}>
        {currentStep === 0 && (
          <UploadStep entidad={entidad} onFile={subirArchivo} loading={estado === 'validating'} />
        )}
        {currentStep === 1 && preview && (
          <PreviewStep preview={preview} onConfirm={confirmar} onBack={reset} onEditarFila={editarFilaPreview} loading={estado === 'confirming'} />
        )}
        {currentStep === 2 && summary && (
          <SummaryStep summary={summary} onNueva={reset} />
        )}
      </div>
    </div>
  );
}
