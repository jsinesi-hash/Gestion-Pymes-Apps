import { useState, useEffect } from 'react';
import { useAuth, useEscapeToClose, useToast, traducirError } from '@core/ui';
import { useGruposModificador, type OpcionModificador } from '../../hooks/useGruposModificador';
import { useArticulos } from '../../hooks/useArticulos';

export function ModificadoresView() {
  const { can } = useAuth();
  const { grupos, loading, crear, obtener, setOpciones } = useGruposModificador();
  const { articulos } = useArticulos();
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  const puedeGestionar = can('producto_venta.gestionar');

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    setErrorCrear(null);
    try {
      await crear(nuevoNombre.trim());
      setNuevoNombre('');
    } catch (e) {
      setErrorCrear(traducirError(e).mensaje);
    }
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      {puedeGestionar && (
        <>
          <form className="toolbar" onSubmit={handleCrear}>
            <input className="input" placeholder="Nombre del grupo (ej. Sabores)" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
            <button type="submit" className="btn-primary" disabled={!nuevoNombre.trim()}>+ Nuevo grupo</button>
          </form>
          {errorCrear && <div className="alert-danger" role="alert">{errorCrear}</div>}
        </>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Grupo</th><th>Acciones</th></tr></thead>
          <tbody>
            {grupos.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin grupos</td></tr>
            )}
            {grupos.map((g) => (
              <tr key={g.id}>
                <td>{g.nombre}</td>
                <td>{puedeGestionar && <button className="btn-secondary btn-sm" onClick={() => setEditando(g.id)}>Opciones</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <OpcionesModal grupoId={editando} articulos={articulos} onClose={() => setEditando(null)} obtener={obtener} setOpciones={setOpciones} />
      )}
    </div>
  );
}

function OpcionesModal({ grupoId, articulos, onClose, obtener, setOpciones }: {
  grupoId: string;
  articulos: { id: string; nombre: string; tipo: string }[];
  onClose: () => void;
  obtener: (id: string) => Promise<{ nombre: string; opciones: OpcionModificador[] } | null>;
  setOpciones: (grupoId: string, opciones: OpcionModificador[]) => Promise<void>;
}) {
  const toast = useToast();
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [opciones, setLocalOpciones] = useState<OpcionModificador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elegibles = articulos.filter((a) => a.tipo === 'elaborado');

  useEscapeToClose(onClose, !saving);

  useEffect(() => {
    obtener(grupoId).then((g) => {
      if (g) { setNombreGrupo(g.nombre); setLocalOpciones(g.opciones); }
      setLoading(false);
    });
  }, [grupoId]);

  function agregarOpcion() {
    const primero = elegibles[0];
    if (!primero) return;
    setLocalOpciones([...opciones, { articulo_id: primero.id, nombre: primero.nombre, recargo_centavos: 0, cantidad: 0, orden: opciones.length + 1 }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await setOpciones(grupoId, opciones);
      toast.success('Opciones guardadas');
      onClose();
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally { setSaving(false); }
  }

  if (loading) return null;

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header"><span className="modal-title">Opciones — {nombreGrupo}</span></div>
        <div className="modal-body">
          {opciones.map((op, i) => (
            <div key={i} className="flex-row gap-2">
              <select className="input" value={op.articulo_id}
                onChange={(e) => {
                  const art = elegibles.find((a) => a.id === e.target.value)!;
                  setLocalOpciones(opciones.map((o, idx) => idx === i ? { ...o, articulo_id: art.id, nombre: art.nombre } : o));
                }}>
                {elegibles.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <input className="input" type="number" placeholder="Recargo (centavos)" value={op.recargo_centavos}
                onChange={(e) => setLocalOpciones(opciones.map((o, idx) => idx === i ? { ...o, recargo_centavos: Number(e.target.value) } : o))} />
            </div>
          ))}
          <button type="button" className="btn-secondary btn-sm" onClick={agregarOpcion}>+ Agregar opción</button>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}
