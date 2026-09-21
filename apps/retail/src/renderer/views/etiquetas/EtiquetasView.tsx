import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EtiquetaItem, PerfilEtiqueta, BarcodeTipo } from '@ferreteria/shared';
import { useFilaNavegable } from '../../hooks/useFilaNavegable';

type Categoria = { id: string; nombre: string };
type Ubicacion = { id: string; codigo: string };

type Filtros = {
  q: string;
  categoriaId: string;
  ubicacionId: string;
  stockStatus: '' | 'con' | 'sin';
};

type SortCol = 'sku' | 'nombre' | 'precio';

const PERFILES_PREDEFINIDOS: PerfilEtiqueta[] = [
  { id: 'rollo-30x15', nombre: 'Rollo 30×15',        tipo: 'rollo', ancho_mm: 30,  alto_mm: 15,  barcode_tipo: 'code128' },
  { id: 'rollo-50x25', nombre: 'Rollo 50×25',        tipo: 'rollo', ancho_mm: 50,  alto_mm: 25,  barcode_tipo: 'qr' },
  { id: 'rollo-70x40', nombre: 'Rollo 70×40',        tipo: 'rollo', ancho_mm: 70,  alto_mm: 40,  barcode_tipo: 'qr' },
  { id: 'a4-2x6',  nombre: 'A4 · 2×6 (12 etiq.)',   tipo: 'hoja',  ancho_mm: 210, alto_mm: 297, cols: 2, filas: 6,  margen_mm: 5, gap_mm: 3,   barcode_tipo: 'qr' },
  { id: 'a4-2x8',  nombre: 'A4 · 2×8 (16 etiq.)',   tipo: 'hoja',  ancho_mm: 210, alto_mm: 297, cols: 2, filas: 8,  margen_mm: 5, gap_mm: 2,   barcode_tipo: 'qr' },
  { id: 'a4-3x8',  nombre: 'A4 · 3×8 (24 etiq.)',   tipo: 'hoja',  ancho_mm: 210, alto_mm: 297, cols: 3, filas: 8,  margen_mm: 5, gap_mm: 2,   barcode_tipo: 'qr' },
  { id: 'a4-3x10', nombre: 'A4 · 3×10 (30 etiq.)',  tipo: 'hoja',  ancho_mm: 210, alto_mm: 297, cols: 3, filas: 10, margen_mm: 5, gap_mm: 1.5, barcode_tipo: 'qr' },
  { id: 'a4-4x10', nombre: 'A4 · 4×10 (40 etiq.)',  tipo: 'hoja',  ancho_mm: 210, alto_mm: 297, cols: 4, filas: 10, margen_mm: 5, gap_mm: 1.5, barcode_tipo: 'qr' },
];

const DEFAULT_PERFIL_ID = 'a4-3x8';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

const ferreteria = () => (globalThis as any).ferreteria;

const STORAGE_KEY = 'etiquetas:estado';

export function EtiquetasView() {
  const navigate = useNavigate();
  const [items,       setItems]       = useState<EtiquetaItem[]>([]);
  const [categorias,  setCategorias]  = useState<Categoria[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return new Set<string>(JSON.parse(raw).selectedIds ?? []);
    } catch { /* ignore */ }
    return new Set();
  });
  const [perfilId,    setPerfilId]    = useState<string>(DEFAULT_PERFIL_ID);
  const [barcodeTipo, setBarcodeTipo] = useState<BarcodeTipo>(
    PERFILES_PREDEFINIDOS.find(p => p.id === DEFAULT_PERFIL_ID)!.barcode_tipo,
  );
  const [celdaInicio, setCeldaInicio] = useState(0);
  const [filtros,     setFiltros]     = useState<Filtros>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (p?.filtros) return p.filtros;
    } catch { /* ignore */ }
    return { q: '', categoriaId: '', ubicacionId: '', stockStatus: '' };
  });
  const [loading,     setLoading]     = useState(true);
  const [accion,      setAccion]      = useState<string | null>(null);
  const [sortCol,     setSortCol]     = useState<SortCol>('sku');
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('asc');

  const perfilActual = PERFILES_PREDEFINIDOS.find(p => p.id === perfilId) ?? PERFILES_PREDEFINIDOS[0];

  const cargarProductos = useCallback(async (f: Filtros) => {
    setLoading(true);
    try {
      const data = await ferreteria().etiquetas.listarProductos({
        q:           f.q           || undefined,
        categoriaId: f.categoriaId || undefined,
        ubicacionId: f.ubicacionId || undefined,
        stockStatus: f.stockStatus || undefined,
      });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // ADR-069: persistir selección + filtros para restaurar al volver del detalle.
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedIds: [...selectedIds], filtros }));
  }, [selectedIds, filtros]);

  useEffect(() => {
    Promise.all([
      ferreteria().catalogo.categoria.list(),
      ferreteria().catalogo.ubicacion.list(),
    ]).then(([c, u]) => {
      setCategorias(c);
      setUbicaciones(u);
    });
    cargarProductos(filtros);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'sku')    cmp = a.sku.localeCompare(b.sku);
      if (sortCol === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
      if (sortCol === 'precio') cmp = a.precio_venta_lista_centavos - b.precio_venta_lista_centavos;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [items, sortCol, sortDir]);

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function toggleItem(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function seleccionarTodos() {
    if (selectedIds.size === items.length && items.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.producto_id)));
  }

  function handleFiltroChange(cambio: Partial<Filtros>) {
    const nuevos = { ...filtros, ...cambio };
    setFiltros(nuevos);
    setSelectedIds(new Set());
    cargarProductos(nuevos);
  }

  function handlePerfilChange(id: string) {
    setPerfilId(id);
    const p = PERFILES_PREDEFINIDOS.find(x => x.id === id) ?? PERFILES_PREDEFINIDOS[0];
    setBarcodeTipo(p.barcode_tipo);
  }

  const itemsSeleccionados = items.filter(i => selectedIds.has(i.producto_id));
  const todosSeleccionados = items.length > 0 && selectedIds.size === items.length;
  const n = itemsSeleccionados.length;
  const contadorLabel = `${n} producto${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;

  async function handleImprimir() {
    if (itemsSeleccionados.length === 0) return;
    setAccion('imprimiendo');
    try {
      await ferreteria().etiquetas.imprimir({
        items:       itemsSeleccionados,
        perfil:      { ...perfilActual, barcode_tipo: barcodeTipo },
        celdaInicio: perfilActual.tipo === 'hoja' ? celdaInicio : 0,
      });
    } finally { setAccion(null); }
  }

  async function handleExportarPdf() {
    if (itemsSeleccionados.length === 0) return;
    setAccion('exportando');
    try {
      const result = await ferreteria().etiquetas.exportarPdf({
        items:       itemsSeleccionados,
        perfil:      { ...perfilActual, barcode_tipo: barcodeTipo },
        celdaInicio: perfilActual.tipo === 'hoja' ? celdaInicio : 0,
      });
      if (result?.guardado) {
        setAccion('exportado');
        setTimeout(() => setAccion(null), 2500);
      } else {
        setAccion(null);
      }
    } catch { setAccion(null); }
  }

  async function handleVistaPrevia() {
    if (itemsSeleccionados.length === 0) return;
    setAccion('generando');
    try {
      await ferreteria().etiquetas.vistaPrevia({
        items:       itemsSeleccionados,
        perfil:      { ...perfilActual, barcode_tipo: barcodeTipo },
        celdaInicio: perfilActual.tipo === 'hoja' ? celdaInicio : 0,
      });
    } finally { setAccion(null); }
  }

  const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <div className="flex-col gap-4">
      {/* Top bar: título + config inline + botones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ margin: 0 }}>Etiquetas</h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>{contadorLabel}</span>
        </div>
        {/* ADR-057: config en una sola línea; "Omitir primeras" queda a la derecha
            del selector QR/CODE128 (agrupados en un contenedor nowrap para que nunca
            se rompan a un segundo renglón). */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
          <select
            value={perfilId}
            onChange={e => handlePerfilChange(e.target.value)}
            className="input"
            style={{ minWidth: 160, fontSize: '0.85rem' }}
            aria-label="Perfil de etiqueta"
          >
            {PERFILES_PREDEFINIDOS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
            <select
              value={barcodeTipo}
              onChange={e => setBarcodeTipo(e.target.value as BarcodeTipo)}
              className="input"
              style={{ minWidth: 130, fontSize: '0.85rem' }}
              aria-label="Tipo de código"
            >
              <option value="qr">QR</option>
              <option value="code128">CODE128 (barras)</option>
            </select>
            {perfilActual.tipo === 'hoja' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                Omitir primeras:
                <input
                  aria-label="Omitir primeras celdas"
                  className="input"
                  type="number"
                  min={0}
                  value={celdaInicio}
                  onChange={e => setCeldaInicio(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ width: 64, fontSize: '0.85rem' }}
                />
              </label>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            className="btn-secondary"
            onClick={handleVistaPrevia}
            disabled={itemsSeleccionados.length === 0 || !!accion}
          >
            {accion === 'generando' ? 'Generando...' : 'Vista previa'}
          </button>
          <button
            className="btn-secondary"
            onClick={handleExportarPdf}
            disabled={itemsSeleccionados.length === 0 || !!accion}
          >
            {accion === 'exportando' ? 'Exportando...' : accion === 'exportado' ? 'PDF guardado' : 'Exportar PDF'}
          </button>
          <button
            className="btn-primary"
            onClick={handleImprimir}
            disabled={itemsSeleccionados.length === 0 || !!accion}
          >
            {accion === 'imprimiendo' ? 'Imprimiendo...' : 'Imprimir'}
          </button>
        </div>
      </div>

      {/* Tabla full-width */}
      <div className="panel">
        <div style={{ display: 'flex', gap: '8px', padding: '8px var(--pad)', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <input
            className="input"
            style={{ flex: 2, minWidth: 180, fontSize: '0.85rem' }}
            placeholder="Buscar por nombre o SKU..."
            value={filtros.q}
            onChange={e => handleFiltroChange({ q: e.target.value })}
          />
          <select
            className="input"
            style={{ minWidth: 140, fontSize: '0.85rem' }}
            value={filtros.categoriaId}
            onChange={e => handleFiltroChange({ categoriaId: e.target.value })}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select
            className="input"
            style={{ minWidth: 140, fontSize: '0.85rem' }}
            value={filtros.ubicacionId}
            onChange={e => handleFiltroChange({ ubicacionId: e.target.value })}
          >
            <option value="">Todas las ubicaciones</option>
            {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.codigo}</option>)}
          </select>
          <select
            className="input"
            style={{ minWidth: 120, fontSize: '0.85rem' }}
            value={filtros.stockStatus}
            onChange={e => handleFiltroChange({ stockStatus: e.target.value as Filtros['stockStatus'] })}
          >
            <option value="">Todos (stock)</option>
            <option value="con">Con stock</option>
            <option value="sin">Sin stock</option>
          </select>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: '2rem' }}>
                    <input type="checkbox" checked={todosSeleccionados} onChange={seleccionarTodos} aria-label="Seleccionar todos" />
                  </th>
                  <th style={thStyle} onClick={() => handleSort('sku')}>
                    SKU <SortIcon active={sortCol === 'sku'} dir={sortDir} />
                  </th>
                  <th>EAN</th>
                  <th style={thStyle} onClick={() => handleSort('nombre')}>
                    Nombre <SortIcon active={sortCol === 'nombre'} dir={sortDir} />
                  </th>
                  <th className="r" style={thStyle} onClick={() => handleSort('precio')}>
                    Precio <SortIcon active={sortCol === 'precio'} dir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin resultados</td></tr>
                )}
                {sortedItems.map(item => {
                  const filaProps = useFilaNavegable(
                    () => navigate(`/productos/${item.producto_id}`),
                    `Ver detalle del producto ${item.sku}`,
                  );
                  return (
                  <tr key={item.producto_id} {...filaProps}>
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar producto ${item.sku}`}
                        checked={selectedIds.has(item.producto_id)}
                        onChange={() => toggleItem(item.producto_id)}
                      />
                    </td>
                    <td><span className="num">{item.sku}</span></td>
                    <td><span className="num">{item.gtin_barcode ?? '—'}</span></td>
                    <td>{item.nombre}</td>
                    <td className="r"><span className="num">$ {(item.precio_venta_lista_centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
