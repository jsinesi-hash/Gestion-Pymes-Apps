import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StockEntradaModal } from './StockEntradaModal';
import { StockAjusteModal } from './StockAjusteModal';
import { StockMermaModal } from './StockMermaModal';
import { ExportarButton, bridge } from '@core/ui';
import { useFilaNavegable } from '../../hooks/useFilaNavegable';
import { exportStock } from '@ferreteria/shared';

type ModalState = { type: 'entrada' | 'ajuste' | 'merma'; productoId: string } | null;
type SortCol = 'sku' | 'nombre_corto' | 'stock_fisico' | 'stock_minimo';
// ADR-057: 'bajo_sin' es el filtro combinado "Bajo mínimo + Sin stock" (default).
type StockStatus = 'ok' | 'bajo' | 'sin' | 'bajo_sin' | undefined;

const PAGE_SIZE = 20;

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function StockListado() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ ok: 0, bajo: 0, sin: 0 });
  const [modal, setModal] = useState<ModalState>(null);

  const [filterSku, setFilterSku] = useState('');
  const [filterNombre, setFilterNombre] = useState('');
  // ADR-057: el listado abre mostrando "Bajo mínimo + Sin stock" por default.
  const [stockStatus, setStockStatus] = useState<StockStatus>('bajo_sin');
  const [sortBy, setSortBy] = useState<SortCol>('sku');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bridge().catalogo.producto.list({
        filterSku: filterSku || undefined,
        filterNombre: filterNombre || undefined,
        stock_status: stockStatus,
        sortBy,
        sortDir,
        activo: true,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [filterSku, filterNombre, stockStatus, sortBy, sortDir, page]);

  async function fetchCounts() {
    try {
      const c = await bridge().catalogo.producto.stockCounts();
      setCounts(c);
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchCounts(); }, []);

  function handleSort(col: SortCol) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  function handleFilterSku(v: string) { setFilterSku(v); setPage(1); }
  function handleFilterNombre(v: string) { setFilterNombre(v); setPage(1); }
  function handleStockStatus(v: string) {
    setStockStatus(v === '' ? undefined : v as StockStatus);
    setPage(1);
  }

  function handleCardStatus(status: 'ok' | 'bajo' | 'sin') {
    setStockStatus(s => s === status ? undefined : status);
    setPage(1);
  }

  function handleSuccess() { setModal(null); fetchItems(); fetchCounts(); }

  const thStyle = (col: SortCol): React.CSSProperties => ({
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });

  return (
    <div className="flex-col gap-4">
      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div
          className="card"
          style={{ padding: 'var(--pad)', cursor: 'pointer', outline: stockStatus === 'ok' ? '2px solid var(--accent)' : 'none' }}
          role="button"
          tabIndex={0}
          onClick={() => handleCardStatus('ok')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardStatus('ok'); }}
        >
          <div className="shift-label">Con stock OK</div>
          <div className="num pos" style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px' }}>{counts.ok}</div>
        </div>
        <div
          className="card"
          style={{ padding: 'var(--pad)', cursor: 'pointer', outline: (stockStatus === 'bajo' || stockStatus === 'bajo_sin') ? '2px solid var(--warn)' : 'none' }}
          role="button"
          tabIndex={0}
          onClick={() => handleCardStatus('bajo')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardStatus('bajo'); }}
        >
          <div className="shift-label">Bajo mínimo</div>
          <div className="num" style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: 'var(--warn)' }}>{counts.bajo}</div>
        </div>
        <div
          className="card"
          style={{ padding: 'var(--pad)', cursor: 'pointer', outline: (stockStatus === 'sin' || stockStatus === 'bajo_sin') ? '2px solid var(--danger)' : 'none' }}
          role="button"
          tabIndex={0}
          onClick={() => handleCardStatus('sin')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardStatus('sin'); }}
        >
          <div className="shift-label">Sin stock</div>
          <div className="num neg" style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px' }}>{counts.sin}</div>
        </div>
      </div>

      <div className="panel">
        {/* Barra de filtros — siempre visible, nunca se desmonta */}
        <div style={{ display: 'flex', gap: '8px', padding: '8px var(--pad)', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 140, fontSize: '0.85rem' }}
            placeholder="Filtrar SKU..."
            value={filterSku}
            onChange={e => handleFilterSku(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: 2, minWidth: 180, fontSize: '0.85rem' }}
            placeholder="Filtrar nombre..."
            value={filterNombre}
            onChange={e => handleFilterNombre(e.target.value)}
          />
          <select
            className="input"
            style={{ minWidth: 140, fontSize: '0.85rem' }}
            value={stockStatus ?? ''}
            onChange={e => handleStockStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="bajo_sin">Bajo mínimo + Sin stock</option>
            <option value="ok">OK</option>
            <option value="bajo">Bajo mínimo</option>
            <option value="sin">Sin stock</option>
          </select>
          <ExportarButton
            definicion={exportStock}
            filtrosActivos={{ filterSku: filterSku || undefined, filterNombre: filterNombre || undefined, stock_status: stockStatus }}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ ...thStyle('sku'), whiteSpace: 'nowrap' }} onClick={() => handleSort('sku')}>
                  SKU <SortIcon active={sortBy === 'sku'} dir={sortDir} />
                </th>
                <th style={thStyle('nombre_corto')} onClick={() => handleSort('nombre_corto')}>
                  Nombre <SortIcon active={sortBy === 'nombre_corto'} dir={sortDir} />
                </th>
                <th className="c" style={thStyle('stock_fisico')} onClick={() => handleSort('stock_fisico')}>
                  Stock <SortIcon active={sortBy === 'stock_fisico'} dir={sortDir} />
                </th>
                <th className="c" style={thStyle('stock_minimo')} onClick={() => handleSort('stock_minimo')}>
                  Mínimo <SortIcon active={sortBy === 'stock_minimo'} dir={sortDir} />
                </th>
                <th className="c">Estado</th>
                <th className="c">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin resultados</td></tr>
              ) : (
                items.map(p => {
                  const f = p.stock_fisico ?? 0;
                  const m = p.stock_minimo ?? 0;
                  const statusBajo = m > 0 && f <= m ? 'bajo' : 'ok';
                  const status = f === 0 ? 'sin' : statusBajo;
                  const stockNumClass = status === 'sin' ? ' neg' : status === 'bajo' ? ' stock-low' : '';
                  const filaProps = useFilaNavegable(() => navigate(`/productos/${p.id}`), `Ver detalle de ${p.nombre_corto}`);
                  return (
                    <tr key={p.id} {...filaProps}>
                      <td style={{ whiteSpace: 'nowrap' }}><span className="num p-code">{p.sku}</span></td>
                      <td className="p-name">{p.nombre_corto}</td>
                      <td className="c"><span className={`num${stockNumClass}`}>{f}</span></td>
                      <td className="c"><span className="num">{m}</span></td>
                      <td className="c">
                        {status === 'ok' && <span className="badge ok"><span className="bd" />OK</span>}
                        {status === 'bajo' && <span className="badge-warn">Bajo mínimo</span>}
                        {status === 'sin' && <span className="badge off"><span className="bd" />Sin stock</span>}
                      </td>
                      <td className="c">
                        <div className="row-act" style={{ justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                          <button className="ia" title="Entrada" onClick={() => setModal({ type: 'entrada', productoId: p.id })}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                          </button>
                          <button className="ia" title="Ajuste" onClick={() => setModal({ type: 'ajuste', productoId: p.id })}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="ia del" title="Merma" onClick={() => setModal({ type: 'merma', productoId: p.id })}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                          </button>
                          <button className="ia" title="Kardex" onClick={() => navigate(`/stock/${p.id}/kardex`)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>{total} resultado{total === 1 ? '' : 's'}</span>
          {totalPages > 1 && (
            <div className="pg-btns">
              <button className="pg" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
              <span className="pg">{page}/{totalPages}</span>
              <button className="pg" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>›</button>
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'entrada' && <StockEntradaModal productoId={modal.productoId} onSuccess={handleSuccess} onClose={() => setModal(null)} />}
      {modal?.type === 'ajuste' && <StockAjusteModal productoId={modal.productoId} onSuccess={handleSuccess} onClose={() => setModal(null)} />}
      {modal?.type === 'merma' && <StockMermaModal productoId={modal.productoId} onSuccess={handleSuccess} onClose={() => setModal(null)} />}
    </div>
  );
}
