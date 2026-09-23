import { useState, useEffect } from 'react';
import { useImportacionCatalogo } from '../../hooks/useImportacionCatalogo';
import { formatCurrency } from '@core/ui';

type HistorialItem = {
  id: string;
  proveedor: string;
  nombre_archivo: string;
  fecha_importacion: number;
  filas_totales: number;
  creados: number;
  actualizados: number;
  sin_match: number;
  errores: number;
  preferidos_asignados: number;
  estado: 'confirmado';
};

type DetalleEstado = 'crear' | 'actualizar' | 'sin_matchear' | 'error';

type DetalleFila = {
  detalle_id: string;
  fila_num: number;
  datos: Record<string, string>;
  nombre_producto: string | null;
  sku_producto: string | null;
  codigo_producto_prov: string | null;
  costo_centavos: number | null;
  costo_anterior_centavos: number | null;
  estado: DetalleEstado;
  preferido_asignado: boolean;
};

const BADGE: Record<DetalleEstado, { label: string; color: string; bg: string; border: string }> = {
  crear:        { label: 'Vínculo creado', color: 'var(--ok)',            bg: 'rgba(46,125,82,.1)',  border: 'rgba(46,125,82,.2)' },
  actualizar:   { label: 'Actualizado',    color: 'var(--accent-strong)', bg: 'var(--accent-soft)',  border: 'rgba(232,115,10,.25)' },
  sin_matchear: { label: 'Sin identificar', color: 'var(--warn)',         bg: 'rgba(180,105,14,.1)', border: 'rgba(180,105,14,.2)' },
  error:        { label: 'Error',          color: 'var(--danger)',        bg: 'rgba(192,57,43,.08)', border: 'rgba(192,57,43,.15)' },
};

type FiltroDetalle = 'all' | DetalleEstado;

// ADR-054: columnas ordenables del listado.
type SortKey = 'proveedor' | 'nombre_archivo' | 'fecha_importacion' | 'filas_totales' | 'creados' | 'actualizados' | 'sin_match' | 'preferidos_asignados';

function fmtFecha(ms: number): string {
  return new Date(ms).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export function HistorialCatalogosView() {
  const ipc = useImportacionCatalogo();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionada, setSeleccionada] = useState<HistorialItem | null>(null);
  const [detalle, setDetalle] = useState<DetalleFila[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroDetalle>('all');
  // ADR-054: filtros y orden del LISTADO (client-side).
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('fecha_importacion');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  }

  useEffect(() => {
    ipc.getHistorial().then((rows: any) => { setHistorial(rows); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrirDetalle(item: HistorialItem) {
    setSeleccionada(item);
    setFiltro('all');
    const rows = await ipc.getHistorialDetalle(item.id) as DetalleFila[];
    setDetalle(rows);
  }

  if (loading) {
    return <div className="panel" style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>Cargando…</div>;
  }

  // ── DETALLE ──────────────────────────────────────────────────────────────────
  if (seleccionada && detalle) {
    const counts = {
      all: detalle.length,
      crear:        detalle.filter(d => d.estado === 'crear').length,
      actualizar:   detalle.filter(d => d.estado === 'actualizar').length,
      sin_matchear: detalle.filter(d => d.estado === 'sin_matchear').length,
      error:        detalle.filter(d => d.estado === 'error').length,
    };
    const filtradas = filtro === 'all' ? detalle : detalle.filter(d => d.estado === filtro);
    const columnas = detalle.length > 0 ? Object.keys(detalle[0].datos) : [];

    const chip = (key: FiltroDetalle, label: string, color: string) => (
      <button
        key={key} type="button" onClick={() => setFiltro(key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
          padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
          border: `1px solid ${filtro === key ? 'var(--accent)' : 'var(--line)'}`,
          background: filtro === key ? 'var(--accent-soft)' : 'var(--surface)',
          color: filtro === key ? 'var(--accent-strong)' : 'var(--ink-2)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
        {label} ({key === 'all' ? counts.all : counts[key]})
      </button>
    );

    return (
      <div className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--pad) var(--pad) 0' }}>
          <button type="button" onClick={() => { setSeleccionada(null); setDetalle(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
            ← Volver al historial
          </button>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{seleccionada.proveedor}</h1>
            <span className="tag">{seleccionada.nombre_archivo}</span>
            <span className="text-sm text-muted">{fmtFecha(seleccionada.fecha_importacion)}</span>
          </div>
        </div>

        <div className="toolbar" style={{ borderTop: '1px solid var(--line)', marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chip('all', 'Todos', 'var(--ink-3)')}
            {chip('crear', 'Creados', 'var(--ok)')}
            {chip('actualizar', 'Actualizados', 'var(--accent)')}
            {chip('sin_matchear', 'Sin identificar', 'var(--warn)')}
            {counts.error > 0 && chip('error', 'Con error', 'var(--danger)')}
          </div>
        </div>

        <div className="table-wrap">
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Línea</th>
                {columnas.map(c => <th key={c}>{c}</th>)}
                <th>Producto</th>
                <th className="r">Costo anterior</th>
                <th className="r">Costo nuevo</th>
                <th className="c">Preferido</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(d => (
                <tr key={d.detalle_id}>
                  <td><span className="num text-muted" style={{ fontSize: 11.5 }}>{d.fila_num}</span></td>
                  {columnas.map(c => (
                    <td key={c} style={{ fontFamily: 'var(--mono-font)', fontSize: 13 }}>{d.datos[c]}</td>
                  ))}
                  <td className="text-muted" style={{ fontSize: 12.5 }}>
                    {d.nombre_producto ?? '—'}{d.sku_producto ? <span className="num text-muted"> ({d.sku_producto})</span> : null}
                  </td>
                  <td className="r text-muted" style={{ fontSize: 12.5 }}>{d.costo_anterior_centavos != null ? formatCurrency(d.costo_anterior_centavos) : '—'}</td>
                  <td className="r" style={{ fontSize: 12.5 }}>{d.costo_centavos != null ? formatCurrency(d.costo_centavos) : '—'}</td>
                  <td className="c">{d.preferido_asignado ? '★' : ''}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: BADGE[d.estado].color, background: BADGE[d.estado].bg, border: `1px solid ${BADGE[d.estado].border}` }}>
                      {BADGE[d.estado].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── LISTADO ───────────────────────────────────────────────────────────────────
  const proveedores = [...new Set(historial.map(h => h.proveedor))].sort((a, b) => a.localeCompare(b, 'es'));
  const estados = [...new Set(historial.map(h => h.estado))];
  const dir = sortDir === 'asc' ? 1 : -1;
  const historialVisible = historial
    .filter(h => (!filtroProveedor || h.proveedor === filtroProveedor) && (!filtroEstado || h.estado === filtroEstado))
    .sort((a, b) => {
      const va = a[sortBy]; const vb = b[sortBy];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'es') * dir;
    });

  const sortArrow = (key: SortKey) => (sortBy === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');
  const sortable = (key: SortKey) => ({ onClick: () => toggleSort(key), style: { cursor: 'pointer', userSelect: 'none' as const } });

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0 }}>
          <select aria-label="Filtrar por proveedor" className="input" style={{ fontSize: 13, padding: '5px 8px' }}
            value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <select aria-label="Filtrar por estado" className="input" style={{ fontSize: 13, padding: '5px 8px' }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {estados.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <span className="text-sm text-muted" style={{ marginLeft: 'auto' }}>Cada importación de catálogo queda registrada acá.</span>
      </div>
      {historial.length === 0 ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', padding: 40, fontSize: 14 }}>
          Todavía no se importó ningún catálogo.
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th {...sortable('proveedor')}>Proveedor{sortArrow('proveedor')}</th>
                <th {...sortable('nombre_archivo')}>Archivo{sortArrow('nombre_archivo')}</th>
                <th {...sortable('fecha_importacion')}>Fecha{sortArrow('fecha_importacion')}</th>
                <th className="c" {...sortable('filas_totales')}>Total{sortArrow('filas_totales')}</th>
                <th className="c" {...sortable('creados')} title="Vínculos nuevos creados">Creados{sortArrow('creados')}</th>
                <th className="c" {...sortable('actualizados')} title="Vínculos existentes actualizados">Actualizados{sortArrow('actualizados')}</th>
                <th className="c" {...sortable('sin_match')} title="Filas cuyo producto no está en el catálogo">Sin identificar{sortArrow('sin_match')}</th>
                <th className="c" {...sortable('preferidos_asignados')} title="Productos que quedaron con este proveedor como preferido">Preferido asignado{sortArrow('preferidos_asignados')}</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historialVisible.map(h => (
                <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => abrirDetalle(h)}>
                  <td className="p-name">{h.proveedor}</td>
                  <td className="text-xs text-muted">{h.nombre_archivo}</td>
                  <td className="text-sm">{fmtFecha(h.fecha_importacion)}</td>
                  <td className="c num">{h.filas_totales}</td>
                  <td className="c num" style={{ fontWeight: 700, color: 'var(--ok)' }}>{h.creados}</td>
                  <td className="c num">{h.actualizados}</td>
                  <td className="c num" style={{ color: h.sin_match === 0 ? 'var(--ink-3)' : 'var(--warn)', fontWeight: h.sin_match === 0 ? 400 : 700 }}>{h.sin_match}</td>
                  <td className="c num">{h.preferidos_asignados}</td>
                  <td>
                    <span className="badge-ok" style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--ok)', background: 'rgba(46,125,82,.1)', border: '1px solid rgba(46,125,82,.2)' }}>{h.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
