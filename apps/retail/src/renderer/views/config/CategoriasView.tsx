import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { rutearCampoError } from '../../lib/rutearCampoError';
import { useToast } from '../../components/toast/useToast';
import { ExportarButton } from '../../components/export/ExportarButton';
import { exportCategorias } from '@ferreteria/shared';

type CatRow = {
  id: string; nombre: string; descripcion: string | null;
  activo: boolean; categoria_padre_id: string | null;
};

type ModalState = { mode: 'create' } | { mode: 'edit'; cat: CatRow } | null;

export function CategoriasView() {
  const { can } = useAuth();
  const toast = useToast();
  const [categorias, setCategorias] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'activas' | 'inactivas' | 'todas'>('todas');

  async function cargar() {
    const data = await (globalThis as any).ferreteria.catalogo.categoria.listAll();
    setCategorias(data);
  }

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  async function handleDesactivar(id: string) {
    try {
      await (globalThis as any).ferreteria.catalogo.categoria.desactivar({ id });
      setErrores(prev => { const next = { ...prev }; delete next[id]; return next; });
      await cargar();
      toast.success('Categoría dada de baja');
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
    await (globalThis as any).ferreteria.catalogo.categoria.reactivar({ id });
    await cargar();
    toast.success('Categoría reactivada');
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  const padreNombre = (id: string | null) =>
    id ? (categorias.find(c => c.id === id)?.nombre ?? '—') : '—';

  const categoriasFiltradas = categorias.filter(cat => {
    if (filtroEstado === 'activas' && !cat.activo) return false;
    if (filtroEstado === 'inactivas' && cat.activo) return false;
    if (busqueda.trim() && !cat.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) return false;
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
        <ExportarButton definicion={exportCategorias} />
        {can('usuario.administrar') && (
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            + Nueva categoría
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th><th>Categoría padre</th><th>Descripción</th>
              <th className="c">Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categoriasFiltradas.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin resultados</td></tr>
            )}
            {categoriasFiltradas.map(cat => (
              <tr key={cat.id}>
                <td>{cat.nombre}</td>
                <td>{padreNombre(cat.categoria_padre_id)}</td>
                <td>{cat.descripcion ?? '—'}</td>
                <td className="c">
                  <span className={`badge ${cat.activo ? 'ok' : 'off'}`}>
                    <span className="bd" />{cat.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <div className="flex-row gap-2">
                    {can('usuario.administrar') && (
                      <>
                        <button className="btn-secondary btn-sm"
                          onClick={() => setModal({ mode: 'edit', cat })}>Editar</button>
                        {cat.activo
                          ? <button className="btn-secondary btn-sm"
                              onClick={() => handleDesactivar(cat.id)}>Desactivar</button>
                          : <button className="btn-secondary btn-sm"
                              onClick={() => handleReactivar(cat.id)}>Reactivar</button>
                        }
                      </>
                    )}
                  </div>
                  {errores[cat.id] && (
                    <div className="alert-danger" style={{ marginTop: 4, fontSize: 12 }}>
                      {errores[cat.id]}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <CategoriaModal
          categorias={categorias}
          initial={modal.mode === 'edit' ? modal.cat : null}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await cargar(); }}
        />
      )}
    </div>
  );
}

function CategoriaModal({ categorias, initial, onClose, onSaved }: {
  categorias: CatRow[];
  initial: CatRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');
  const [padreId, setPadreId] = useState(initial?.categoria_padre_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  const padresDisponibles = categorias.filter(c => c.id !== initial?.id && c.activo);

  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    setError(null);
    setCampoError(null);
    try {
      if (initial) {
        await (globalThis as any).ferreteria.catalogo.categoria.update({
          id: initial.id, nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          categoria_padre_id: padreId || null,
        });
      } else {
        await (globalThis as any).ferreteria.catalogo.categoria.create({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          categoria_padre_id: padreId || null,
        });
      }
      toast.success('Categoría guardada');
      await onSaved();
    } catch (e) {
      const r = rutearCampoError(e, { nombre: 'cat-nombre' });
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
          <span className="modal-title">{initial ? 'Editar categoría' : 'Nueva categoría'}</span>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="cat-nombre">Nombre *</label>
            <input id="cat-nombre" className={`input${campoError?.campo === 'nombre' ? ' error' : ''}`} type="text" required
              value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
            {campoError?.campo === 'nombre' && <span className="field-error">{campoError.mensaje}</span>}
          </div>
          <div className="field">
            <label htmlFor="cat-desc">Descripción</label>
            <input id="cat-desc" className="input" type="text"
              value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cat-padre">Categoría padre</label>
            <select id="cat-padre" className="input"
              value={padreId} onChange={e => setPadreId(e.target.value)}>
              <option value="">— Sin padre —</option>
              {padresDisponibles.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
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
