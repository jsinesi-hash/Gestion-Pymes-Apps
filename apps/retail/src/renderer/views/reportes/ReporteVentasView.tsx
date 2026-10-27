import { useState, useEffect, useRef } from 'react';
import { useAuth, bridge } from '@core/ui';
import { VentaDetalleModal } from '../caja/VentaDetalleModal';
import { ExportarButton } from '@core/ui';
import { exportReporteVentas, hoyYmd, inicioDelDia, finDelDia, nombreCompletoCliente } from '@ferreteria/shared';
import type { ReporteVentasFiltros, ReporteVentasRow, ReporteVentasResult, ReporteVentasSortCol } from '../../../main/ipc/reportes';

const PAGE_SIZE = 100;

type SelectOpt = { id: string; label: string };

const hoy = hoyYmd;

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtFecha(v: number | Date) {
  try {
    const d = v instanceof Date ? v : new Date((v as number) * 1000);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '—'; }
}

const ICO_SEARCH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
);

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 2px)', left: 0, minWidth: '100%',
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
  zIndex: 20, listStyle: 'none', padding: '4px 0', margin: 0,
  maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow)',
};

const DROPDOWN_ITEM_STYLE: React.CSSProperties = {
  width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 13,
  cursor: 'pointer', background: 'none', border: 'none', display: 'block',
  color: 'var(--ink)', fontFamily: 'inherit',
};

export function ReporteVentasView() {
  const { can } = useAuth();

  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);

  // Producto combobox
  const [productoTexto, setProductoTexto] = useState('');
  const [productoId, setProductoId]       = useState('');
  const [prodSugs, setProdSugs]           = useState<SelectOpt[]>([]);
  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cliente combobox
  const [clienteTexto, setClienteTexto] = useState('');
  const [clienteId, setClienteId]       = useState('');
  const [clienteSugs, setClienteSugs]   = useState<SelectOpt[]>([]);

  // Resto de filtros
  const [categoriaId, setCategoriaId] = useState('');
  const [usuarioId, setUsuarioId]     = useState('');
  const [medioPago, setMedioPago]     = useState('');

  // Orden
  const [sortCol, setSortCol] = useState<ReporteVentasSortCol>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Opciones de dropdowns
  const [clientes,   setClientes]   = useState<SelectOpt[]>([]);
  const [categorias, setCategorias] = useState<SelectOpt[]>([]);
  const [usuarios,   setUsuarios]   = useState<SelectOpt[]>([]);

  // Resultados
  const [loading, setLoading]               = useState(false);
  const [resultado, setResultado]           = useState<ReporteVentasResult | null>(null);
  const [page, setPage]                     = useState(1);
  const [error, setError]                   = useState(false);
  const [filtrosActivos, setFiltrosActivos] = useState<Record<string, unknown> | undefined>(undefined);
  const [ventaId, setVentaId]               = useState<string | null>(null);

  useEffect(() => {
    if (!can('dashboard.ver')) return;
    const f = bridge();
    Promise.all([
      f.cliente.list().catch(() => []),
      f.catalogo.categoria.list().catch(() => []),
      f.usuario.list().catch(() => []),
    ]).then(([c, cat, u]: any[]) => {
      setClientes(c.map((x: any) => ({ id: x.id, label: x.nombre ? nombreCompletoCliente(x) : x.id })));
      setCategorias(cat.map((x: any) => ({ id: x.id, label: x.nombre })));
      setUsuarios(u.map((x: any) => ({ id: x.id, label: x.nombre_completo ?? x.nombre_usuario })));
    });
    const today = hoy();
    buscar({ fechaDesde: inicioDelDia(today), fechaHasta: finDelDia(today), sortCol: 'fecha', sortDir: 'desc' }, 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function buildFiltros(): ReporteVentasFiltros {
    const f: ReporteVentasFiltros = { sortCol, sortDir };
    if (fechaDesde)  f.fechaDesde  = inicioDelDia(fechaDesde);
    if (fechaHasta)  f.fechaHasta  = finDelDia(fechaHasta);
    if (clienteId)   f.clienteId   = clienteId;
    if (categoriaId) f.categoriaId = categoriaId;
    if (productoId)  f.productoId  = productoId;
    if (usuarioId)   f.usuarioId   = usuarioId;
    if (medioPago)   f.medioPago   = medioPago;
    return f;
  }

  async function buscar(filtros: ReporteVentasFiltros, p: number) {
    setLoading(true);
    setError(false);
    try {
      const r = await bridge().reportes.detalleVentas(filtros, p, PAGE_SIZE);
      setResultado(r);
      setPage(p);
      setFiltrosActivos(filtros as Record<string, unknown>);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleBuscar() { buscar(buildFiltros(), 1); }

  function handleSort(col: ReporteVentasSortCol) {
    const newDir = sortCol === col ? (sortDir === 'desc' ? 'asc' : 'desc') : 'desc';
    setSortCol(col);
    setSortDir(newDir);
    buscar({ ...buildFiltros(), sortCol: col, sortDir: newDir }, 1);
  }

  function limpiar() {
    const today = hoy();
    setFechaDesde(today); setFechaHasta(today);
    setProductoTexto(''); setProductoId(''); setProdSugs([]);
    setClienteTexto('');  setClienteId('');  setClienteSugs([]);
    setCategoriaId(''); setUsuarioId(''); setMedioPago('');
    setSortCol('fecha'); setSortDir('desc');
    buscar({ fechaDesde: inicioDelDia(today), fechaHasta: finDelDia(today), sortCol: 'fecha', sortDir: 'desc' }, 1);
  }

  function handleClienteTexto(text: string) {
    setClienteTexto(text);
    if (clienteId) setClienteId('');
    if (!text.trim()) { setClienteSugs([]); return; }
    const q = text.toLowerCase();
    setClienteSugs(clientes.filter(c => c.label.toLowerCase().includes(q)).slice(0, 8));
  }

  function handleProductoTexto(text: string) {
    setProductoTexto(text);
    if (productoId) setProductoId('');
    if (prodTimer.current) clearTimeout(prodTimer.current);
    if (!text.trim()) { setProdSugs([]); return; }
    prodTimer.current = setTimeout(async () => {
      try {
        const r = await bridge().catalogo.producto.list({
          busqueda: text, page: 1, pageSize: 8, activo: true,
        });
        setProdSugs((r.items ?? []).map((p: any) => ({
          id: p.id,
          label: `${p.sku} — ${p.nombre_corto}`,
        })));
      } catch { setProdSugs([]); }
    }, 300);
  }

  const thSort = (col: ReporteVentasSortCol, label: string, cls?: string) => (
    <th
      className={cls}
      onClick={() => handleSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  if (!can('dashboard.ver')) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="font-bold">Sin acceso</p>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>Esta vista requiere rol Supervisor.</p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ flex: 1 }}>

      {/* ── Toolbar de filtros ── */}
      <div className="toolbar">

        {/* Fechas */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
          Desde
          <input
            type="date" className="filter" style={{ fontWeight: 400 }}
            value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
          Hasta
          <input
            type="date" className="filter" style={{ fontWeight: 400 }}
            value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
          />
        </label>

        {/* Cliente combobox */}
        <div style={{ position: 'relative' }}>
          <div className="search" style={{ minWidth: 0, width: 200 }}>
            {ICO_SEARCH}
            <input
              placeholder="Cliente..."
              value={clienteTexto}
              onChange={e => handleClienteTexto(e.target.value)}
              onBlur={() => setTimeout(() => setClienteSugs([]), 150)}
            />
            {clienteId && (
              <button
                type="button" className="ia"
                style={{ color: 'var(--ink-3)', lineHeight: 1, padding: '0 2px', cursor: 'pointer' }}
                onClick={() => { setClienteId(''); setClienteTexto(''); }}
              >✕</button>
            )}
          </div>
          {clienteSugs.length > 0 && (
            <ul style={DROPDOWN_STYLE}>
              {clienteSugs.map(c => (
                <li key={c.id}>
                  <button
                    type="button" className="ia"
                    style={DROPDOWN_ITEM_STYLE}
                    onMouseDown={() => { setClienteId(c.id); setClienteTexto(c.label); setClienteSugs([]); }}
                  >{c.label}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Producto combobox */}
        <div style={{ position: 'relative' }}>
          <div className="search" style={{ minWidth: 0, width: 220 }}>
            {ICO_SEARCH}
            <input
              placeholder="Producto (SKU o nombre)..."
              value={productoTexto}
              onChange={e => handleProductoTexto(e.target.value)}
              onBlur={() => setTimeout(() => setProdSugs([]), 150)}
            />
            {productoId && (
              <button
                type="button" className="ia"
                style={{ color: 'var(--ink-3)', lineHeight: 1, padding: '0 2px', cursor: 'pointer' }}
                onClick={() => { setProductoId(''); setProductoTexto(''); }}
              >✕</button>
            )}
          </div>
          {prodSugs.length > 0 && (
            <ul style={DROPDOWN_STYLE}>
              {prodSugs.map(p => (
                <li key={p.id}>
                  <button
                    type="button" className="ia"
                    style={DROPDOWN_ITEM_STYLE}
                    onMouseDown={() => { setProductoId(p.id); setProductoTexto(p.label); setProdSugs([]); }}
                  >{p.label}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Categoría */}
        <select className="filter" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        {/* Vendedor */}
        <select className="filter" value={usuarioId} onChange={e => setUsuarioId(e.target.value)}>
          <option value="">Todos los vendedores</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>

        {/* Medio de pago */}
        <select className="filter" value={medioPago} onChange={e => setMedioPago(e.target.value)}>
          <option value="">Todos los medios</option>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option>
          <option value="cuenta_corriente">Cta. Corriente</option>
          <option value="cheque">Cheque</option>
        </select>

        <div className="ml-auto" />

        {resultado && (
          <ExportarButton definicion={exportReporteVentas} filtrosActivos={filtrosActivos} />
        )}
        <button type="button" className="btn-secondary" onClick={limpiar}>Limpiar</button>
        <button type="button" className="btn-primary" onClick={handleBuscar} disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {/* ── Tabla ── */}
      {error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
          Error al obtener los datos. Intentá de nuevo.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {thSort('numero_interno', 'Nro. Venta')}
                {thSort('fecha', 'Fecha')}
                {thSort('cliente', 'Cliente')}
                {thSort('vendedor', 'Vendedor')}
                <th>Medios de pago</th>
                {thSort('importe_iva', 'IVA', 'r')}
                {thSort('total', 'Total', 'r')}
              </tr>
            </thead>
            <tbody>
              {loading && resultado === null && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</td></tr>
              )}
              {!loading && resultado !== null && resultado.rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin ventas para los filtros seleccionados.</td></tr>
              )}
              {resultado?.rows.map((row: ReporteVentasRow) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle de la venta ${row.numero_interno}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setVentaId(row.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVentaId(row.id); } }}
                >
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button" className="ia"
                      style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                      onClick={e => { e.stopPropagation(); setVentaId(row.id); }}
                    >{row.numero_interno}</button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(row.fecha)}</td>
                  <td>{row.cliente_nombre_completo}</td>
                  <td>{row.vendedor_nombre}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.medios_pago}</td>
                  <td className="r"><span className="num">${fmt(row.importe_iva)}</span></td>
                  <td className="r"><span className="num" style={{ fontWeight: 600 }}>${fmt(row.total)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ── */}
      {resultado && (
        <div className="table-footer">
          <span>
            {resultado.total} venta{resultado.total !== 1 ? 's' : ''} · Total: <strong>${fmt(resultado.totalImporte)}</strong>
          </span>
          {resultado.totalPages > 1 && (
            <div className="pg-btns">
              <button
                className="pg" aria-label="Anterior"
                disabled={page <= 1 || loading}
                onClick={() => buscar(buildFiltros(), page - 1)}
              >‹</button>
              {Array.from({ length: Math.min(resultado.totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`pg${p === page ? ' active' : ''}`}
                  onClick={() => buscar(buildFiltros(), p)}
                >{p}</button>
              ))}
              <button
                className="pg" aria-label="Siguiente"
                disabled={page >= resultado.totalPages || loading}
                onClick={() => buscar(buildFiltros(), page + 1)}
              >›</button>
            </div>
          )}
        </div>
      )}

      {ventaId && (
        <VentaDetalleModal
          ventaId={ventaId}
          onClose={() => setVentaId(null)}
          onAnulada={() => { setVentaId(null); buscar(buildFiltros(), page); }}
        />
      )}
    </div>
  );
}
