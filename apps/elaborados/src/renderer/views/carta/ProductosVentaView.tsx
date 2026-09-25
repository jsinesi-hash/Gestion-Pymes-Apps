import { useState } from 'react';
import { useAuth, useEscapeToClose, useToast, traducirError } from '@core/ui';
import { useProductosVenta } from '../../hooks/useProductosVenta';
import { useCategoriasVenta } from '../../hooks/useCategoriasVenta';
import { useArticulos } from '../../hooks/useArticulos';
import { useGruposModificador } from '../../hooks/useGruposModificador';

export function ProductosVentaView() {
  const { can } = useAuth();
  const { productos, loading, crear } = useProductosVenta();
  const { categorias } = useCategoriasVenta();
  const { articulos } = useArticulos();
  const { grupos } = useGruposModificador();
  const [modal, setModal] = useState(false);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  const puedeGestionar = can('producto_venta.gestionar');
  const categoriaNombre = (id: string) => categorias.find((c) => c.id === id)?.nombre ?? '—';

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="ml-auto" />
        {puedeGestionar && <button className="btn-primary" onClick={() => setModal(true)}>+ Nuevo producto</button>}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Categoría</th><th className="c">Precio</th></tr></thead>
          <tbody>
            {productos.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin productos de venta</td></tr>
            )}
            {productos.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{categoriaNombre(p.categoria_venta_id)}</td>
                <td className="c">${(p.precio_centavos / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <ProductoVentaModal categorias={categorias} articulos={articulos} grupos={grupos} onClose={() => setModal(false)} onCrear={crear} />
      )}
    </div>
  );
}

function ProductoVentaModal({ categorias, articulos, grupos, onClose, onCrear }: {
  categorias: { id: string; nombre: string }[];
  articulos: { id: string; nombre: string; tipo: string }[];
  grupos: { id: string; nombre: string }[];
  onClose: () => void;
  onCrear: (p: any) => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '');
  const [precio, setPrecio] = useState('');
  const [componenteArticuloId, setComponenteArticuloId] = useState(articulos[0]?.id ?? '');
  const [componenteCantidad, setComponenteCantidad] = useState('1');
  const [grupoId, setGrupoId] = useState('');
  const [modoDescuento, setModoDescuento] = useState<'reparto' | 'por_opcion' | 'sin_descuento'>('reparto');
  const [cantidadTotal, setCantidadTotal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const precioCentavos = Math.round(Number(precio) * 100);
    if (!nombre.trim() || !categoriaId || !precioCentavos) return;
    setSaving(true); setError(null);
    try {
      const impuestoId = await (globalThis as any).elaborados.impuesto.list().then((r: any[]) => r.find((i) => i.predeterminado)?.id ?? r[0]?.id);
      await onCrear({
        nombre: nombre.trim(),
        categoria_venta_id: categoriaId,
        precio_centavos: precioCentavos,
        impuesto_id: impuestoId,
        componentes: componenteArticuloId ? [{ articulo_id: componenteArticuloId, cantidad: Number(componenteCantidad) }] : [],
        grupos: grupoId ? [{ grupo_modificador_id: grupoId, min: 1, max: 3, cantidad_total: Number(cantidadTotal) || 0, modo_descuento: modoDescuento, orden: 1 }] : [],
      });
      toast.success('Producto de venta creado');
      onClose();
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header"><span className="modal-title">Nuevo producto de venta</span></div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="pv-nombre">Nombre *</label>
            <input id="pv-nombre" className="input" type="text" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pv-categoria">Categoría *</label>
            <select id="pv-categoria" className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pv-precio">Precio ($) *</label>
            <input id="pv-precio" className="input" type="number" step="0.01" required value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </div>
          <div className="field">
            <label>Componente fijo (envase/insumo directo)</label>
            <div className="flex-row gap-2">
              <select className="input" value={componenteArticuloId} onChange={(e) => setComponenteArticuloId(e.target.value)}>
                <option value="">Sin componente fijo</option>
                {articulos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <input className="input" type="number" step="any" value={componenteCantidad} onChange={(e) => setComponenteCantidad(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Grupo de modificadores</label>
            <select className="input" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              <option value="">Sin modificadores</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          {grupoId && (
            <>
              <div className="field">
                <label htmlFor="pv-modo">Modo de descuento</label>
                <select id="pv-modo" className="input" value={modoDescuento} onChange={(e) => setModoDescuento(e.target.value as any)}>
                  <option value="reparto">Reparto (cantidad total dividida entre las opciones elegidas)</option>
                  <option value="por_opcion">Por opción (cada opción consume su propia cantidad)</option>
                  <option value="sin_descuento">Sin descuento (no toca stock)</option>
                </select>
              </div>
              {modoDescuento === 'reparto' && (
                <div className="field">
                  <label htmlFor="pv-cant-total">Cantidad total a repartir</label>
                  <input id="pv-cant-total" className="input" type="number" step="any" value={cantidadTotal} onChange={(e) => setCantidadTotal(e.target.value)} />
                </div>
              )}
            </>
          )}
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
