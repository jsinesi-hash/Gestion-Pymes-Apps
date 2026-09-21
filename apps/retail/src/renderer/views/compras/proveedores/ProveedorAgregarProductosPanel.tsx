import { useEffect, useMemo, useState } from 'react';

type Prod = { id: string; sku: string; nombre_corto: string; categoria_id: string; marca_id?: string | null };
type Cat = { id: string; nombre: string };
type Marca = { id: string; nombre: string };
type Sel = { costo: string; codigo: string };

const f = () => (globalThis as any).ferreteria;

/**
 * ADR-084 — alta masiva de productos en un proveedor, como PANTALLA (no modal). Reemplaza in
 * situ la lista del tab Productos: usa todo el ancho y no se cierra por Escape ni por click
 * afuera (antes un descuido perdía toda la carga). Se sale sólo con «Volver» (onClose(false))
 * o al confirmar (onClose(true)).
 */
export function ProveedorAgregarProductosPanel({
  proveedorId, asociadosIds, onClose,
}: Readonly<{ proveedorId: string; asociadosIds: Set<string>; onClose: (added: boolean) => void }>) {
  const [productos, setProductos] = useState<Prod[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Cat[]>([]);
  const [search, setSearch] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [mostrarAsociados, setMostrarAsociados] = useState(true);
  const [sel, setSel] = useState<Map<string, Sel>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    f().catalogo.producto.list({ page: 1, pageSize: 9999, activo: true })
      .then((d: { items: Prod[] }) => setProductos(d.items)).catch(() => setError('No se pudieron cargar los productos.'));
    f().catalogo.marca.list().then(setMarcas).catch(() => {});
    f().catalogo.categoria.list().then(setCategorias).catch(() => {});
  }, []);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productos.filter(p => {
      if (!mostrarAsociados && asociadosIds.has(p.id)) return false;
      if (filtroMarca && p.marca_id !== filtroMarca) return false;
      if (filtroCategoria && p.categoria_id !== filtroCategoria) return false;
      if (q && !(p.nombre_corto.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [productos, search, filtroMarca, filtroCategoria, mostrarAsociados, asociadosIds]);

  function toggle(id: string) {
    setSel(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id); else next.set(id, { costo: '', codigo: '' });
      return next;
    });
  }
  function setCampo(id: string, campo: keyof Sel, valor: string) {
    setSel(prev => {
      const next = new Map(prev);
      const cur = next.get(id) ?? { costo: '', codigo: '' };
      next.set(id, { ...cur, [campo]: valor });
      return next;
    });
  }

  async function confirmar() {
    if (sel.size === 0) { onClose(false); return; }
    setSaving(true);
    setError(null);
    try {
      const items = [...sel.entries()].map(([producto_id, v]) => {
        const n = v.costo.trim() === '' ? 0 : Number(v.costo.replace(',', '.'));
        return {
          producto_id,
          costo_centavos: Number.isFinite(n) ? Math.round(n * 100) : 0,
          codigo_proveedor: v.codigo.trim() || undefined,
        };
      });
      await f().compras.proveedor.productos.asociarLote({ proveedor_id: proveedorId, items });
      onClose(true);
    } catch {
      setError('No se pudieron agregar los productos. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const hayAsociadosEnVista = visibles.some(p => asociadosIds.has(p.id));

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" disabled={saving} onClick={() => onClose(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver
        </button>
        <h1 style={{ fontSize: 18 }}>Agregar productos al proveedor</h1>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {/* Mismo patrón que la lista del tab: todo dentro de un `.panel` (fondo blanco, borde,
          radio y sombra), con la barra de filtros como `.toolbar` y la acción en `.table-footer`. */}
      <div className="panel">
        <div className="toolbar">
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por nombre o SKU…" aria-label="Buscar productos" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" aria-label="Filtrar por marca" value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)}>
            <option value="">Todas las marcas</option>
            {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select className="input" aria-label="Filtrar por categoría" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={mostrarAsociados} onChange={e => setMostrarAsociados(e.target.checked)} />
            Mostrar ya asociados
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th></th><th>Producto</th><th className="num">Costo ($)</th><th>Código proveedor</th></tr></thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin resultados.</td></tr>
              )}
              {visibles.map(p => {
                const yaAsociado = asociadosIds.has(p.id);
                const s = sel.get(p.id);
                // Fila ya asociada: tinte ámbar suave + texto atenuado, para distinguirla a
                // simple vista de las que sí se pueden agregar (checkbox deshabilitado + chip).
                const filaStyle = yaAsociado ? { background: 'rgba(180,105,14,.07)', color: 'var(--ink-3)' } : undefined;
                return (
                  <tr key={p.id} style={filaStyle}>
                    <td className="c">
                      <input type="checkbox" aria-label={`Seleccionar ${p.nombre_corto}`}
                        disabled={yaAsociado} checked={!!s} onChange={() => toggle(p.id)} />
                    </td>
                    <td>
                      <div className="p-name">{p.nombre_corto}</div>
                      <div className="num p-code">{p.sku}{yaAsociado && <span className="badge-warn" style={{ marginLeft: 8 }}>ya cargado</span>}</div>
                    </td>
                    <td className="num">
                      <input className="input num" style={{ width: 90 }} aria-label={`Costo de ${p.nombre_corto}`}
                        disabled={!s} value={s?.costo ?? ''} placeholder="0.00"
                        onChange={e => setCampo(p.id, 'costo', e.target.value)} />
                    </td>
                    <td>
                      <input className="input" style={{ width: 130 }} aria-label={`Código de ${p.nombre_corto}`}
                        disabled={!s} value={s?.codigo ?? ''} placeholder="Opcional"
                        onChange={e => setCampo(p.id, 'codigo', e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="table-footer" style={{ justifyContent: 'space-between' }}>
          <span>
            {sel.size} seleccionado{sel.size === 1 ? '' : 's'}
            {hayAsociadosEnVista && <span className="text-muted" style={{ marginLeft: 10 }}>· las filas resaltadas ya están asociadas</span>}
          </span>
          <button className="btn-primary" disabled={saving || sel.size === 0} onClick={confirmar}>
            Agregar seleccionados ({sel.size})
          </button>
        </div>
      </div>
    </div>
  );
}
