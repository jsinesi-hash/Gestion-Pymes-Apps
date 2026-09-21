import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import type { DefinicionExport, ExportFormato } from '@ferreteria/shared';

type Props = {
  definicion: DefinicionExport<any>;
  filtrosActivos?: Record<string, unknown>;
  onClose: () => void;
};

export function ExportarModal({ definicion, filtrosActivos, onClose }: Readonly<Props>) {
  const { can } = useContext(AuthContext);

  const perfilesVisibles = definicion.perfiles.filter(p => can(p.permiso));
  const firstPerfil = perfilesVisibles[0];
  const [perfilId, setPerfilId] = useState(firstPerfil?.id ?? '');
  const [formato, setFormato] = useState<ExportFormato>(firstPerfil?.defaultFormato ?? 'csv');
  const [alcance, setAlcance] = useState<'todo' | 'filtrado'>('todo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, !loading);

  const perfilActual = perfilesVisibles.find(p => p.id === perfilId);
  const soloFormatos = perfilActual?.soloFormatos;
  const xlsxDisabled = !!soloFormatos && !soloFormatos.includes('xlsx');

  async function handleExportar() {
    setError(null);
    setLoading(true);
    try {
      await (globalThis as any).ferreteria.exportar.ejecutar({
        entidad: definicion.entidad,
        perfilId,
        formato,
        alcance,
        filtros: alcance === 'filtrado' ? filtrosActivos : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        className="modal"
        role="button"
        tabIndex={0}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">Exportar — {definicion.label}</span>
          <button className="ia" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="export-perfil">Perfil</label>
            <select id="export-perfil" className="input" value={perfilId}
              onChange={e => {
                const perfil = perfilesVisibles.find(p => p.id === e.target.value);
                setPerfilId(e.target.value);
                setFormato(perfil?.defaultFormato ?? 'csv');
              }}>
              {perfilesVisibles.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span>Formato</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="formato" value="csv"
                  checked={formato === 'csv'} onChange={() => setFormato('csv')} />
                {' '}CSV (;)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6,
                cursor: xlsxDisabled ? 'not-allowed' : 'pointer', opacity: xlsxDisabled ? 0.4 : 1 }}>
                <input type="radio" name="formato" value="xlsx"
                  checked={formato === 'xlsx'} disabled={xlsxDisabled}
                  onChange={() => setFormato('xlsx')} />
                {' '}Excel (.xlsx)
              </label>
            </div>
          </div>

          <div className="field">
            <span>Alcance</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="alcance" value="todo"
                  checked={alcance === 'todo'} onChange={() => setAlcance('todo')} />
                {' '}Todo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6,
                cursor: filtrosActivos ? 'pointer' : 'not-allowed',
                opacity: filtrosActivos ? 1 : 0.4 }}>
                <input type="radio" name="alcance" value="filtrado"
                  checked={alcance === 'filtrado'} disabled={!filtrosActivos}
                  onChange={() => setAlcance('filtrado')} />
                {' '}Filtrado actual
              </label>
            </div>
          </div>

          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleExportar}
            disabled={loading || !perfilId}>
            {loading ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}
