import { useState } from 'react';
import { useEscapeToClose } from '@core/ui';

type Props = {
  loading: boolean;
  onConfirmar: (alias?: string) => void;
  onCancelar: () => void;
};

export function PausarEsperaModal({ loading, onConfirmar, onCancelar }: Readonly<Props>) {
  const [alias, setAlias] = useState('');

  useEscapeToClose(onCancelar, !loading);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirmar(alias.trim() || undefined);
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 50,
        width: 340,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: '16px 20px',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Poner venta en espera</h3>
      <p className="text-muted" style={{ fontSize: 12, margin: '0 0 14px' }}>
        Se guarda sin cobrar ni descontar stock. Podés retomarla cuando quieras.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
          Alias (opcional)
          <input
            className="input"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
            placeholder="ej. Juan, mesa 3..."
            value={alias}
            onChange={e => setAlias(e.target.value)}
            autoFocus
            maxLength={60}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onCancelar} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Poner en espera'}
          </button>
        </div>
      </form>
    </div>
  );
}
