import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEscapeToClose } from '@core/ui';
import { rutearCampoError } from '@core/ui';
import { useToast } from '@core/ui';
import { ExportarButton } from '../../components/export/ExportarButton';
import { exportUnidades } from '@ferreteria/shared';

type UnidadRow = { id: string; nombre: string; abreviatura: string; activo: boolean };
type ModalState = { mode: 'create' } | { mode: 'edit'; unidad: UnidadRow } | null;

export function UnidadesView() {
  const { can } = useAuth();
  const toast = useToast();
  const [unidades, setUnidades] = useState<UnidadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'activas' | 'inactivas' | 'todas'>('todas');

  async function cargar() {
    const data = await (globalThis as any).ferreteria.unidad.listAll();
    setUnidades(data);
  }

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  async function handleDesactivar(id: string) {
    try {
      await (globalThis as any).ferreteria.unidad.desactivar({ id });
      setErrores(prev => { const next = { ...prev }; delete next[id]; return next; });
      await cargar();
      toast.success('Unidad dada de baja');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg.startsWith('TIENE_PRODUCTOS:')) {
        const n = msg.split(':')[1];
        setErrores(prev => ({ ...prev, [id]: `No se puede desactivar: tiene ${n} producto(s) activo(s)` }));
      } else {
        setErrores(prev => ({ ...prev, [id]: msg }));
      }
    }
  }

  async function handleReactivar(id: string) {
    await (globalThis as any).ferreteria.unidad.reactivar({ id });
    await cargar();
    toast.success('Unidad reactivada');
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  const filtradas = unidades.filter(u => {
    if (filtroEstado === 'activas' && !u.activo) return false;
    if (filtroEstado === 'inactivas' && u.activo) return false;
    const q = busqueda.trim().toLowerCase();
    if (q && !u.nombre.toLowerCase().includes(q) && !u.abreviatura.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            placeholder="Buscar por nombre o abreviatura..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <select
          className="input"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as 'activas' | 'inactivas' | 'todas')}
          style={{ width: 'auto', fontSize: '0.85rem' }}
        >
          <option value="todas">Todas</option>
          <option value="activas">Solo activas</option>
          <option value="inactivas">Solo inactivas</option>
        </select>
        <div className="ml-auto" />
        <ExportarButton definicion={exportUnidades} />
        {can('usuario.administrar') && (
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            + Nueva unidad
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Abreviatura</th>
              <th className="c">Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>
                  Sin resultados
                </td>
              </tr>
            )}
            {filtradas.map(u => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td><code style={{ fontSize: '0.9em' }}>{u.abreviatura}</code></td>
                <td className="c">
                  <span className={`badge ${u.activo ? 'ok' : 'off'}`}>
                    <span className="bd" />{u.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <div className="flex-row gap-2">
                    {can('usuario.administrar') && (
                      <>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => setModal({ mode: 'edit', unidad: u })}
                        >
                          Editar
                        </button>
                        {u.activo
                          ? (
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => handleDesactivar(u.id)}
                            >
                              Desactivar
                            </button>
                          )
                          : (
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => handleReactivar(u.id)}
                            >
                              Reactivar
                            </button>
                          )
                        }
                      </>
                    )}
                  </div>
                  {errores[u.id] && (
                    <div className="alert-danger" style={{ marginTop: 4, fontSize: 12 }}>
                      {errores[u.id]}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UnidadModal
          initial={modal.mode === 'edit' ? modal.unidad : null}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await cargar(); }}
        />
      )}
    </div>
  );
}

function UnidadModal({ initial, onClose, onSaved }: {
  initial: UnidadRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [abreviatura, setAbreviatura] = useState(initial?.abreviatura ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !abreviatura.trim()) return;
    setSaving(true);
    setError(null);
    setCampoError(null);
    try {
      if (initial) {
        await (globalThis as any).ferreteria.unidad.update({
          id: initial.id,
          nombre: nombre.trim(),
          abreviatura: abreviatura.trim(),
        });
      } else {
        await (globalThis as any).ferreteria.unidad.create({
          nombre: nombre.trim(),
          abreviatura: abreviatura.trim(),
        });
      }
      toast.success('Unidad guardada');
      await onSaved();
    } catch (e) {
      const r = rutearCampoError(e, { nombre: 'unidad-nombre', abreviatura: 'unidad-abr' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else setError(r.mensaje);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <span className="modal-title">
            {initial ? 'Editar unidad' : 'Nueva unidad'}
          </span>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="unidad-nombre">Nombre *</label>
            <input
              id="unidad-nombre"
              className={`input${campoError?.campo === 'nombre' ? ' error' : ''}`}
              type="text"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              autoFocus
              placeholder="Ej: Unidad, Kilogramo, Metro"
            />
            {campoError?.campo === 'nombre' && <span className="field-error">{campoError.mensaje}</span>}
          </div>
          <div className="field">
            <label htmlFor="unidad-abr">Abreviatura *</label>
            <input
              id="unidad-abr"
              className={`input${campoError?.campo === 'abreviatura' ? ' error' : ''}`}
              type="text"
              required
              value={abreviatura}
              onChange={e => setAbreviatura(e.target.value)}
              placeholder="Ej: u, kg, m"
              style={{ textTransform: 'lowercase' }}
            />
            {campoError?.campo === 'abreviatura' && <span className="field-error">{campoError.mensaje}</span>}
            <span style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              Única. Se usa en stock y presentaciones.
            </span>
          </div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!nombre.trim() || !abreviatura.trim() || saving}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
