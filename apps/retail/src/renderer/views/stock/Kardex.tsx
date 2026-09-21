import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { inicioDelDia, finDelDia } from '@ferreteria/shared';
import { useExistencias } from '../../hooks/useExistencias';
import { useMovimientos, MovimientoStock } from '../../hooks/useMovimientos';
import { StockEntradaModal } from './StockEntradaModal';
import { StockAjusteModal } from './StockAjusteModal';
import { StockMermaModal } from './StockMermaModal';

type ModalType = 'entrada' | 'ajuste' | 'merma' | null;

const PAGE_SIZE = 20;

const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  transferencia: 'Transf.',
};

const TIPO_CSS: Record<string, string> = {
  entrada: 'pos',
  salida: 'neg',
  ajuste: 'stock-low',
  transferencia: '',
};

const MOTIVO_LABEL: Record<string, string> = {
  inicial: 'Inicial',
  venta: 'Venta',
  entrada_manual: 'Entrada manual',
  recepcion_compra: 'Recepción compra',
  devolucion: 'Devolución',
  ajuste_conteo: 'Ajuste conteo',
  merma_rotura: 'Merma / Rotura',
};

function fmt(date: string): string {
  try {
    return new Date(date).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return date; }
}
function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}
function fmtCosto(n: number | null): string {
  if (n === null) return '—';
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Kardex() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productoId = id ?? '';

  const [nombreProducto, setNombreProducto] = useState<string | null>(null);
  const { existencias, loading: loadingEx, refetch: refetchEx } = useExistencias(productoId);
  const { movimientos, loading: loadingMov, refetch: refetchMov } = useMovimientos(productoId);
  const [modal, setModal] = useState<ModalType>(null);

  useEffect(() => {
    if (!productoId) return;
    (globalThis as any).ferreteria.catalogo.producto.get({ id: productoId })
      .then((p: any) => { if (p) setNombreProducto(p.nombre_largo ?? p.nombre_corto); })
      .catch(() => {});
  }, [productoId]);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterMotivo, setFilterMotivo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [pagina, setPagina] = useState(1);

  const filtered = useMemo<MovimientoStock[]>(() => {
    let list = [...movimientos];
    if (filterTipo) list = list.filter(m => m.tipo === filterTipo);
    if (filterMotivo) list = list.filter(m => m.motivo === filterMotivo);
    if (filterDesde) { const d = inicioDelDia(filterDesde).getTime(); list = list.filter(m => new Date(m.fecha).getTime() >= d); }
    if (filterHasta) { const h = finDelDia(filterHasta).getTime(); list = list.filter(m => new Date(m.fecha).getTime() <= h); }
    return list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [movimientos, filterTipo, filterMotivo, filterDesde, filterHasta]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (pagina - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(pageStart, pageEnd);

  const loading = loadingEx || loadingMov;

  function handleSuccess() { setModal(null); refetchEx(); refetchMov(); }
  function resetPagina() { setPagina(1); }

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate('/stock')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Stock
        </button>
        <h1>
          {productoId ? (
            <Link
              className="crumb-link"
              to={`/productos/${productoId}`}
              aria-label={`Ver detalle del producto ${nombreProducto ?? ''}`.trim()}
            >
              {nombreProducto ?? 'Kardex'}
            </Link>
          ) : (
            nombreProducto ?? 'Kardex'
          )}
        </h1>
      </div>

      <div className="shift-bar">
        <div className="shift-item">
          <span className="shift-label">Stock actual</span>
          <span className="shift-val num">{loading ? '—' : fmtNum(existencias?.stockFisico ?? 0)}</span>
        </div>
        <div className="shift-sep" />
        <div className="shift-item">
          <span className="shift-label">Mínimo</span>
          <span className="shift-val num">{loading ? '—' : fmtNum(existencias?.stockMinimo ?? 0)}</span>
        </div>
        <div className="ml-auto" />
        <button className="btn-secondary" onClick={() => setModal('entrada')}>Entrada</button>
        <button className="btn-secondary" onClick={() => setModal('ajuste')}>Ajuste</button>
        <button className="btn-danger" onClick={() => setModal('merma')}>Merma</button>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="kardex-tipo" style={{ margin: 0 }}>Tipo</label>
            <select id="kardex-tipo" className="filter" value={filterTipo} onChange={e => { setFilterTipo(e.target.value); resetPagina(); }}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="kardex-motivo" style={{ margin: 0 }}>Motivo</label>
            <select id="kardex-motivo" className="filter" value={filterMotivo} onChange={e => { setFilterMotivo(e.target.value); resetPagina(); }}>
              <option value="">Todos</option>
              <option value="inicial">Inicial</option>
              <option value="entrada_manual">Entrada manual</option>
              <option value="ajuste_conteo">Ajuste conteo</option>
              <option value="merma_rotura">Merma / Rotura</option>
              <option value="venta">Venta</option>
            </select>
          </div>
          <input className="input" type="date" value={filterDesde} onChange={e => { setFilterDesde(e.target.value); resetPagina(); }} style={{ width: '140px' }} />
          <input className="input" type="date" value={filterHasta} onChange={e => { setFilterHasta(e.target.value); resetPagina(); }} style={{ width: '140px' }} />
          {(filterTipo || filterMotivo || filterDesde || filterHasta) && (
            <button className="btn-secondary" onClick={() => { setFilterTipo(''); setFilterMotivo(''); setFilterDesde(''); setFilterHasta(''); resetPagina(); }}>
              Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha/Hora</th>
                    <th className="c">Tipo</th>
                    <th>Motivo</th>
                    <th className="r">Cantidad</th>
                    <th className="r">Saldo result.</th>
                    <th className="r">Costo u.</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin movimientos</td></tr>
                  )}
                  {paginated.map(m => {
                    const displayQty = m.tipo === 'salida' ? -Math.abs(m.cantidad) : m.cantidad;
                    const cantidadNeg = displayQty < 0 ? 'neg' : '';
                    const cantidadColor = displayQty > 0 ? 'pos' : cantidadNeg;
                    return (
                      <tr key={m.id}>
                        <td><span className="num" style={{ fontSize: '12px' }}>{fmt(m.fecha)}</span></td>
                        <td className="c">
                          <span className={`badge ${TIPO_CSS[m.tipo] ?? ''}`}>
                            <span className="bd" />{TIPO_LABEL[m.tipo] ?? m.tipo}
                          </span>
                        </td>
                        <td className="text-sm">{MOTIVO_LABEL[m.motivo] ?? m.motivo}</td>
                        <td className="r"><span className={`num ${cantidadColor}`}>{displayQty > 0 ? '+' : ''}{fmtNum(displayQty)}</span></td>
                        <td className="r"><span className="num">{fmtNum(m.stockResultante)}</span></td>
                        <td className="r"><span className="num">{fmtCosto(m.costoUnitario)}</span></td>
                        <td className="text-sm text-muted" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.observaciones ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <span>{pageStart + 1}–{pageEnd} de {filtered.length}</span>
              <div className="pg-btns">
                <button className="pg" onClick={() => setPagina(p => p - 1)} disabled={pagina === 1}>‹</button>
                <span className="pg">{pagina}/{totalPages}</span>
                <button className="pg" onClick={() => setPagina(p => p + 1)} disabled={pagina >= totalPages}>›</button>
              </div>
            </div>
          </>
        )}
      </div>

      {modal === 'entrada' && <StockEntradaModal productoId={productoId} onSuccess={handleSuccess} onClose={() => setModal(null)} />}
      {modal === 'ajuste' && <StockAjusteModal productoId={productoId} onSuccess={handleSuccess} onClose={() => setModal(null)} />}
      {modal === 'merma' && <StockMermaModal productoId={productoId} onSuccess={handleSuccess} onClose={() => setModal(null)} />}
    </div>
  );
}
