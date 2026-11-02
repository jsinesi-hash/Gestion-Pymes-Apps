import { useState } from 'react';
import { useAuth, useToast, rutearCampoError, traducirError, Modal } from '@core/ui';
import { useArticulos, type ArticuloRow } from '../../hooks/useArticulos';

export function ConteoView() {
  const { can } = useAuth();
  const { articulos, loading, ajustarStock } = useArticulos();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [ajustando, setAjustando] = useState<ArticuloRow | null>(null);
  const [procesandoTacho, setProcesandoTacho] = useState<Set<string>>(new Set());

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  const puedeAjustar = can('stock.ajustar');
  const visibles = articulos.filter((a) =>
    !busqueda.trim() || a.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  async function tachoVacio(a: ArticuloRow) {
    if ((a.stock ?? 0) === 0 || procesandoTacho.has(a.id)) return;
    setProcesandoTacho((prev) => new Set(prev).add(a.id));
    try {
      await ajustarStock({ articulo_id: a.id, motivo: 'conteo', cantidad: -(a.stock ?? 0), observaciones: 'Tacho vacío' });
      toast.success('Stock puesto en 0');
    } catch (e) {
      toast.error(traducirError(e).mensaje);
    } finally {
      setProcesandoTacho((prev) => {
        const next = new Set(prev);
        next.delete(a.id);
        return next;
      });
    }
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="search">
          <input placeholder="Buscar artículo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Unidad</th><th className="c">Stock actual</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin resultados</td></tr>
            )}
            {visibles.map((a) => (
              <tr key={a.id}>
                <td>{a.nombre}</td>
                <td>{a.unidad}</td>
                <td className="c">{a.stock ?? 0}</td>
                <td>
                  {puedeAjustar && (
                    <div className="flex-row gap-2">
                      <button className="btn-secondary btn-sm" onClick={() => setAjustando(a)}>Ajustar</button>
                      <button className="btn-secondary btn-sm" onClick={() => tachoVacio(a)}
                        disabled={(a.stock ?? 0) === 0 || procesandoTacho.has(a.id)}>
                        Tacho vacío
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ajustando && (
        <AjusteModal
          articulo={ajustando}
          onClose={() => setAjustando(null)}
          onAjustar={ajustarStock}
        />
      )}
    </div>
  );
}

function AjusteModal({ articulo, onClose, onAjustar }: {
  articulo: ArticuloRow;
  onClose: () => void;
  onAjustar: (p: { articulo_id: string; motivo: 'conteo' | 'merma'; cantidad: number; observaciones?: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [motivo, setMotivo] = useState<'conteo' | 'merma'>('conteo');
  const [nuevoStock, setNuevoStock] = useState((articulo.stock ?? 0).toString());
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const destino = Number(nuevoStock);
    if (Number.isNaN(destino)) return;
    const cantidad = destino - (articulo.stock ?? 0);
    setSaving(true); setError(null);
    try {
      const obs = observaciones.trim();
      await onAjustar({ articulo_id: articulo.id, motivo, cantidad, ...(obs ? { observaciones: obs } : {}) });
      toast.success('Stock ajustado');
      onClose();
    } catch (e) {
      setError(rutearCampoError(e, { cantidad: 'conteo-stock' }).mensaje);
    } finally { setSaving(false); }
  }

  return (
    <Modal ariaLabel={`Ajustar stock de ${articulo.nombre}`} onClose={onClose} bloqueado={saving} as="form" onSubmit={handleSubmit}>
      <div className="modal-header"><span className="modal-title">Ajustar stock — {articulo.nombre}</span></div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="conteo-motivo">Motivo *</label>
          <select id="conteo-motivo" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value as 'conteo' | 'merma')}>
            <option value="conteo">Conteo (ajuste de inventario)</option>
            <option value="merma">Merma / rotura</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="conteo-stock">Stock actual: {articulo.stock ?? 0} {articulo.unidad}. Nuevo stock *</label>
          <input id="conteo-stock" className="input" type="number" step="any" required autoFocus
            value={nuevoStock} onChange={(e) => setNuevoStock(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="conteo-obs">Observaciones</label>
          <input id="conteo-obs" className="input" type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Modal>
  );
}
