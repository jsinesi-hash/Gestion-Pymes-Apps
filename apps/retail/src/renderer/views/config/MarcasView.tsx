import { useState, useEffect } from 'react';
import { useAuth, bridge } from '@core/ui';
import { useEscapeToClose } from '@core/ui';
import { rutearCampoError } from '@core/ui';
import { useToast } from '@core/ui';
import { ExportarButton } from '@core/ui';
import { exportMarcas } from '@ferreteria/shared';

type MarcaRow = { id: string; nombre: string; descripcion: string | null; activo: boolean };
type ModalState = { mode: 'create' } | { mode: 'edit'; marca: MarcaRow } | null;

export function MarcasView() {
  const { can } = useAuth();
  const toast = useToast();
  const [marcas, setMarcas] = useState<MarcaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'activas' | 'inactivas' | 'todas'>('todas');

  async function cargar() {
    const data = await bridge().catalogo.marca.listAll();
    setMarcas(data);
  }

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  async function handleDesactivar(id: string) {
    try {
      await bridge().catalogo.marca.desactivar({ id });
      setErrores(prev => { const next = { ...prev }; delete next[id]; return next; });
      await cargar();
      toast.success('Marca dada de baja');
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
    await bridge().catalogo.marca.reactivar({ id });
    await cargar();
    toast.success('Marca reactivada');
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  const marcasFiltradas = marcas.filter(m => {
    if (filtroEstado === 'activas' && !m.activo) return false;
    if (filtroEstado === 'inactivas' && m.activo) return false;
    if (busqueda.trim() && !m.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) return false;
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
            placeholder="Buscar por nombre..."
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
        <ExportarButton definicion={exportMarcas} />
        {can('usuario.administrar') && (
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            + Nueva marca
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Descripción</th><th className="c">Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {marcasFiltradas.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin resultados</td></tr>
            )}
            {marcasFiltradas.map(m => (
              <tr key={m.id}>
                <td>{m.nombre}</td>
                <td>{m.descripcion ?? '—'}</td>
                <td className="c">
                  <span className={`badge ${m.activo ? 'ok' : 'off'}`}>
                    <span className="bd" />{m.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <div className="flex-row gap-2">
                    {can('usuario.administrar') && (
                      <>
                        <button className="btn-secondary btn-sm"
                          onClick={() => setModal({ mode: 'edit', marca: m })}>Editar</button>
                        {m.activo
                          ? <button className="btn-secondary btn-sm"
                              onClick={() => handleDesactivar(m.id)}>Desactivar</button>
                          : <button className="btn-secondary btn-sm"
                              onClick={() => handleReactivar(m.id)}>Reactivar</button>
                        }
                      </>
                    )}
                  </div>
                  {errores[m.id] && (
                    <div className="alert-danger" style={{ marginTop: 4, fontSize: 12 }}>
                      {errores[m.id]}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <MarcaModal
          initial={modal.mode === 'edit' ? modal.marca : null}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await cargar(); }}
        />
      )}
    </div>
  );
}

function MarcaModal({ initial, onClose, onSaved }: {
  initial: MarcaRow | null; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setError(null); setCampoError(null);
    try {
      if (initial) {
        await bridge().catalogo.marca.update({
          id: initial.id, nombre: nombre.trim(), descripcion: descripcion.trim() || null,
        });
      } else {
        await bridge().catalogo.marca.create({
          nombre: nombre.trim(), descripcion: descripcion.trim() || null,
        });
      }
      toast.success('Marca guardada');
      await onSaved();
    } catch (e) {
      const r = rutearCampoError(e, { nombre: 'marca-nombre' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else setError(r.mensaje);
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Editar marca' : 'Nueva marca'}</span>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="marca-nombre">Nombre *</label>
            <input id="marca-nombre" className={`input${campoError?.campo === 'nombre' ? ' error' : ''}`} type="text" required
              value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
            {campoError?.campo === 'nombre' && <span className="field-error">{campoError.mensaje}</span>}
          </div>
          <div className="field">
            <label htmlFor="marca-desc">Descripción</label>
            <input id="marca-desc" className="input" type="text"
              value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={!nombre.trim() || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
