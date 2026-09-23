import { useState, useEffect } from 'react';
import { useImportacionCosto } from '../../hooks/useImportacionCosto';
import { formatCurrency } from '@core/ui';

type HistorialItem = {
  id: string;
  proveedor: string;
  nombre_archivo: string;
  fecha_importacion: number;
  filas_totales: number;
  identificados: number;
  rechazados: number;
  pendientes: number;
  descartados: number;
  estado: 'pendiente' | 'confirmado' | 'cancelado';
};

// Estados posibles de una fila del detalle (incluye los que aparecen DESPUÉS de la carga,
// resueltos/descartados en Cola de Revisión).
type DetalleEstado = 'matched' | 'resuelto_manual' | 'error_formato' | 'sin_matchear' | 'descartado';

type HistorialDetalleFila = {
  detalle_id: string;
  fila_num: number;
  datos: Record<string, string>;
  nombre_producto: string | null;
  costo_anterior_centavos: number | null;
  costo_nuevo_centavos: number | null;
  estado: DetalleEstado;
  motivo: string | null;
};

// Badge por estado del detalle. 'matched' y 'resuelto_manual' son ambos "identificados"
// (costo aplicado), pero se distinguen para que se vea cuál se resolvió después a mano.
const BADGE: Record<DetalleEstado, { label: string; color: string; bg: string; border: string }> = {
  matched:         { label: 'Actualizado', color: 'var(--ok)',     bg: 'rgba(46,125,82,.1)',  border: 'rgba(46,125,82,.2)' },
  resuelto_manual: { label: 'Resuelto',     color: 'var(--ok)',     bg: 'rgba(46,125,82,.1)',  border: 'rgba(46,125,82,.2)' },
  error_formato:   { label: 'Rechazado',    color: 'var(--danger)', bg: 'rgba(192,57,43,.08)', border: 'rgba(192,57,43,.15)' },
  sin_matchear:    { label: 'Pendiente',    color: 'var(--warn)',   bg: 'rgba(180,105,14,.1)', border: 'rgba(180,105,14,.2)' },
  descartado:      { label: 'Descartado',   color: 'var(--ink-3)',  bg: 'var(--surface-2)',    border: 'var(--line)' },
};

type FiltroDetalle = 'all' | 'identificados' | 'rechazados' | 'pendientes' | 'descartados';

// ADR-054: columnas ordenables del listado.
type SortKey = 'proveedor' | 'nombre_archivo' | 'fecha_importacion' | 'filas_totales' | 'identificados' | 'rechazados' | 'pendientes' | 'estado';

// Qué estados del detalle entran en cada chip de filtro.
const FILTRO_ESTADOS: Record<Exclude<FiltroDetalle, 'all'>, DetalleEstado[]> = {
  identificados: ['matched', 'resuelto_manual'],
  rechazados:    ['error_formato'],
  pendientes:    ['sin_matchear'],
  descartados:   ['descartado'],
};

function fmtFecha(ms: number): string {
  return new Date(ms).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

// ADR-054: cuando se muestra dentro de la pantalla unificada de 3 tabs, "Ver pendientes"
// cambia al tab Revisión en vez de navegar a una ruta separada (que ya no existe).
export function HistorialImportacionCostosView({ onVerPendientes }: { onVerPendientes?: () => void } = {}) {
  const ipc = useImportacionCosto();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionada, setSeleccionada] = useState<HistorialItem | null>(null);
  const [detalle, setDetalle] = useState<HistorialDetalleFila[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroDetalle>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  // ADR-054: filtros y orden del LISTADO (client-side; el dataset es chico).
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('fecha_importacion');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  }

  const cargarHistorial = () => ipc.getHistorial().then((rows: any) => { setHistorial(rows); setLoading(false); });

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrirDetalle(item: HistorialItem) {
    setSeleccionada(item);
    setFiltro('all');
    const rows = await ipc.getHistorialDetalle(item.id) as HistorialDetalleFila[];
    setDetalle(rows);
  }

  // Una importación 'pendiente' huérfana o 'cancelado' no aporta nada quedándose para
  // siempre en el listado (a diferencia de 'confirmado', que sí es auditoría real de un
  // cambio de costo) — se puede borrar directo desde acá. Borrado físico, no baja lógica.
  async function eliminarDelHistorial(importacionId: string) {
    setEliminando(importacionId);
    try {
      await ipc.eliminar({ importacionId });
      setConfirmDeleteId(null);
      await cargarHistorial();
    } finally {
      setEliminando(null);
    }
  }

  if (loading) {
    return <div className="panel" style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>Cargando…</div>;
  }

  // ── DETALLE de una importación ────────────────────────────────────────────────
  if (seleccionada && detalle) {
    const counts = {
      all: detalle.length,
      identificados: detalle.filter(d => FILTRO_ESTADOS.identificados.includes(d.estado)).length,
      rechazados:    detalle.filter(d => FILTRO_ESTADOS.rechazados.includes(d.estado)).length,
      pendientes:    detalle.filter(d => FILTRO_ESTADOS.pendientes.includes(d.estado)).length,
      descartados:   detalle.filter(d => FILTRO_ESTADOS.descartados.includes(d.estado)).length,
    };
    const filtradas = filtro === 'all' ? detalle : detalle.filter(d => FILTRO_ESTADOS[filtro].includes(d.estado));
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
            {chip('identificados', 'Identificados', 'var(--ok)')}
            {chip('rechazados', 'Rechazados', 'var(--danger)')}
            {chip('pendientes', 'Pendientes', 'var(--warn)')}
            {counts.descartados > 0 && chip('descartados', 'Descartados', 'var(--ink-3)')}
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
                  <td className="text-muted" style={{ fontSize: 12.5 }}>{d.nombre_producto ?? '—'}</td>
                  <td className="r text-muted" style={{ fontSize: 12.5 }}>{d.costo_anterior_centavos != null ? formatCurrency(d.costo_anterior_centavos) : '—'}</td>
                  <td className="r" style={{ fontSize: 12.5 }}>{d.costo_nuevo_centavos != null ? formatCurrency(d.costo_nuevo_centavos) : '—'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: BADGE[d.estado].color, background: BADGE[d.estado].bg, border: `1px solid ${BADGE[d.estado].border}` }}>
                      {BADGE[d.estado].label}
                    </span>
                    {d.motivo && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3, maxWidth: 240 }}>{d.motivo}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {seleccionada.pendientes > 0 && onVerPendientes && (
          <div style={{ padding: '12px var(--pad)', borderTop: '1px solid var(--line)' }}>
            <button type="button" onClick={onVerPendientes}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Ver {seleccionada.pendientes} fila{seleccionada.pendientes > 1 ? 's' : ''} pendientes en Revisión →
            </button>
          </div>
        )}
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
        <span className="text-sm text-muted" style={{ marginLeft: 'auto' }}>Total = Identificados + Rechazados + Pendientes (+ Descartados).</span>
      </div>
      <div className="table-wrap">
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th {...sortable('proveedor')}>Proveedor{sortArrow('proveedor')}</th>
              <th {...sortable('nombre_archivo')}>Archivo{sortArrow('nombre_archivo')}</th>
              <th {...sortable('fecha_importacion')}>Fecha{sortArrow('fecha_importacion')}</th>
              <th className="c" {...sortable('filas_totales')}>Total{sortArrow('filas_totales')}</th>
              <th className="c" {...sortable('identificados')} title="Filas cuyo costo se actualizó (matcheadas + resueltas después en Cola de Revisión)">Identificados{sortArrow('identificados')}</th>
              <th className="c" {...sortable('rechazados')} title="Filas con costo inválido, no se aplicó">Rechazados{sortArrow('rechazados')}</th>
              <th className="c" {...sortable('pendientes')} title="Filas sin identificar que siguen pendientes de resolución hoy">Pendientes{sortArrow('pendientes')}</th>
              <th {...sortable('estado')}>Estado{sortArrow('estado')}</th>
              <th className="c">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {historialVisible.map(h => (
              <tr key={h.id} style={{ cursor: 'pointer' }}>
                <td className="p-name" onClick={() => abrirDetalle(h)}>{h.proveedor}</td>
                <td className="text-xs text-muted" onClick={() => abrirDetalle(h)}>{h.nombre_archivo}</td>
                <td className="text-sm" onClick={() => abrirDetalle(h)}>{fmtFecha(h.fecha_importacion)}</td>
                <td className="c num" onClick={() => abrirDetalle(h)}>{h.filas_totales}</td>
                <td className="c num" onClick={() => abrirDetalle(h)} style={{ fontWeight: 700, color: 'var(--ok)' }}>{h.identificados}</td>
                <td className="c num" onClick={() => abrirDetalle(h)} style={{ color: h.rechazados === 0 ? 'var(--ink-3)' : 'var(--danger)' }}>{h.rechazados}</td>
                <td className="c num" onClick={() => abrirDetalle(h)} style={{ fontWeight: 700, color: h.pendientes === 0 ? 'var(--ink-3)' : 'var(--warn)' }}>{h.pendientes}</td>
                <td onClick={() => abrirDetalle(h)}>
                  {h.estado === 'confirmado' && <span className="badge-ok" style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--ok)', background: 'rgba(46,125,82,.1)', border: '1px solid rgba(46,125,82,.2)' }}>confirmado</span>}
                  {h.estado === 'cancelado' && <span className="tag">cancelado</span>}
                  {h.estado === 'pendiente' && <span className="tag">pendiente</span>}
                </td>
                <td className="c" onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
                  {(h.estado === 'pendiente' || h.estado === 'cancelado') && (
                    confirmDeleteId === h.id ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--danger)' }}>¿Eliminar?</span>
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          disabled={eliminando === h.id}
                          onClick={() => eliminarDelHistorial(h.id)}
                        >
                          {eliminando === h.id ? 'Eliminando…' : 'Sí'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)' }}
                        onClick={() => setConfirmDeleteId(h.id)}
                      >
                        Eliminar
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
