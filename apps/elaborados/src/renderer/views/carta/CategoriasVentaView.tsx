import { useState } from 'react';
import { useAuth, useEscapeToClose, useToast, traducirError } from '@core/ui';
import { useCategoriasVenta } from '../../hooks/useCategoriasVenta';

export function CategoriasVentaView() {
  const { can } = useAuth();
  const { categorias, loading, crear } = useCategoriasVenta();
  const [modal, setModal] = useState(false);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  const puedeGestionar = can('producto_venta.gestionar');

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="ml-auto" />
        {puedeGestionar && <button className="btn-primary" onClick={() => setModal(true)}>+ Nueva categoría</button>}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th className="c">Orden</th></tr></thead>
          <tbody>
            {categorias.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin categorías</td></tr>
            )}
            {categorias.map((c) => <tr key={c.id}><td>{c.nombre}</td><td className="c">{c.orden}</td></tr>)}
          </tbody>
        </table>
      </div>
      {modal && <CategoriaModal onClose={() => setModal(false)} onCrear={crear} siguienteOrden={categorias.length + 1} />}
    </div>
  );
}

function CategoriaModal({ onClose, onCrear, siguienteOrden }: {
  onClose: () => void; onCrear: (p: { nombre: string; orden: number }) => Promise<void>; siguienteOrden: number;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setError(null);
    try {
      await onCrear({ nombre: nombre.trim(), orden: siguienteOrden });
      toast.success('Categoría creada');
      onClose();
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header"><span className="modal-title">Nueva categoría</span></div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="cat-nombre">Nombre *</label>
            <input id="cat-nombre" className="input" type="text" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={!nombre.trim() || saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}
