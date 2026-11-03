import { bridge, type AppBridge } from '../../bridge';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CajaActiva } from '../../hooks/useCajaActiva';
import { MovimientoModal } from './MovimientoModal';
import { useAuth } from '../../auth/AuthContext';
import { ExportarButton } from '../../components/export/ExportarButton';
import { exportCaja } from '@ferreteria/shared';

type Props = {
  caja: CajaActiva;
  onRefetch: () => void;
  renderVentaDetalle?: (ventaId: string, onClose: () => void) => ReactNode;
};

function fmt(n: number) { return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtHora(v: any) {
  try { return (v instanceof Date ? v : new Date(v)).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

type VentaResumen = {
  id: string; numero_interno: string; fecha: any; total: number; estado: string;
  forma_pago: string; cliente_nombre: string | null;
};
type MovCaja = { id: string; tipo: string; motivo: string; monto: number; forma_pago: string | null; fecha: any; observaciones: string | null };

const MOTIVO_LABEL: Record<string, string> = { retiro: 'Retiro', gasto: 'Gasto', aporte: 'Aporte', cobro_cta_cte: 'Cobro Cta.Cte', pago_proveedor: 'Pago proveedor', ajuste: 'Ajuste' };
const FORMA_PAGO_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', cuenta_corriente: 'Cuenta corriente' };
function fmtFormaPago(fp: string) { return FORMA_PAGO_LABEL[fp] ?? fp; }

type SortVentas = 'numero' | 'total';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function CajaDashboard({ caja, onRefetch, renderVentaDetalle }: Readonly<Props>) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [movModal, setMovModal] = useState(false);
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [movimientos, setMovimientos] = useState<MovCaja[]>([]);
  const [detalleVentaId, setDetalleVentaId] = useState<string | null>(null);
  const [detalleMov, setDetalleMov] = useState<MovCaja | null>(null);

  const [filterNumero, setFilterNumero] = useState('');
  const [filterEstado, setFilterEstado] = useState<'' | 'confirmada' | 'anulada'>('');
  const [sortVentas, setSortVentas] = useState<SortVentas>('numero');
  const [sortVentasDir, setSortVentasDir] = useState<'asc' | 'desc'>('asc');

  const apertura = caja.fecha_apertura instanceof Date ? caja.fecha_apertura : new Date(caja.fecha_apertura);
  const duracionMin = Math.floor((Date.now() - apertura.getTime()) / 60000);
  const duracionH = Math.floor(duracionMin / 60);
  const duracionM = duracionMin % 60;

  async function cargarDatos() {
    // `venta` lo aporta cada app (no está en el catálogo universal): se declara lo que se usa.
    const f: AppBridge & { venta: { listByCaja(p: unknown): Promise<any[]> } } = bridge() as never;
    const [v, m] = await Promise.all([
      f.venta.listByCaja({ caja_id: caja.id }).catch(() => []),
      f.caja.listMovimientos({ caja_id: caja.id }).catch(() => []),
    ]);
    setVentas(v ?? []);
    setMovimientos(m ?? []);
  }

  useEffect(() => { cargarDatos(); }, [caja.id]);

  const confirmadas = ventas.filter(v => v.estado === 'confirmada');
  const anuladas = ventas.filter(v => v.estado === 'anulada');
  const totalVentas = confirmadas.reduce((s, v) => s + v.total, 0);
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const totalNeto = totalVentas - totalEgresos;
  const movManuales = movimientos.filter(m => m.motivo !== 'venta');

  const ventasFiltradas = useMemo(() => ventas
    .filter(v => filterNumero === '' || v.numero_interno.toLowerCase().includes(filterNumero.toLowerCase()))
    .filter(v => filterEstado === '' || v.estado === filterEstado)
    .sort((a, b) => {
      let cmp = 0;
      if (sortVentas === 'numero') cmp = a.numero_interno.localeCompare(b.numero_interno);
      if (sortVentas === 'total')  cmp = a.total - b.total;
      return sortVentasDir === 'asc' ? cmp : -cmp;
    }), [ventas, filterNumero, filterEstado, sortVentas, sortVentasDir]);

  function handleSortVentas(col: SortVentas) {
    if (sortVentas === col) setSortVentasDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortVentas(col); setSortVentasDir('asc'); }
  }

  if (detalleMov) {
    return (
      <div className="flex-col gap-4">
        <div className="detail-head">
          <button className="back" onClick={() => setDetalleMov(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h2 style={{ margin: 0 }}>Detalle de movimiento</h2>
        </div>
        <div className="card">
          <div className="srow"><span className="sl">Hora</span><span className="sv num">{fmtHora(detalleMov.fecha)}</span></div>
          <div className="srow"><span className="sl">Tipo</span><span className="sv">
            <span className={`badge ${detalleMov.tipo === 'ingreso' ? 'pos' : 'neg'}`}>
              <span className="bd" />{detalleMov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </span>
          </span></div>
          <div className="srow"><span className="sl">Motivo</span><span className="sv">{MOTIVO_LABEL[detalleMov.motivo] ?? detalleMov.motivo}</span></div>
          <div className="srow"><span className="sl">Forma de pago</span><span className="sv">{detalleMov.forma_pago ?? '—'}</span></div>
          <div className="srow total">
            <span className="sl">Monto</span>
            <span className={`sv num ${detalleMov.tipo === 'ingreso' ? 'pos' : 'neg'}`}>
              {detalleMov.tipo === 'egreso' ? '-' : ''}$ {fmt(detalleMov.monto)}
            </span>
          </div>
          {detalleMov.observaciones && (
            <div className="srow"><span className="sl">Observaciones</span><span className="sv">{detalleMov.observaciones}</span></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col gap-4">
      <div className="shift-bar">
        {/* Info items — pueden wrappear */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div className="shift-item">
            <span className="shift-label">Fondo apertura</span>
            <span className="shift-val num">$ {fmt(caja.monto_inicial)}</span>
          </div>
          <div className="shift-sep" />
          <div className="shift-item">
            <span className="shift-label">Apertura</span>
            <span className="shift-val num">{apertura.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="shift-sep" />
          <div className="shift-item">
            <span className="shift-label">Duración</span>
            <span className="shift-val num">{duracionH}h {duracionM}min</span>
          </div>
          <div className="shift-sep" />
          <div className="shift-item">
            <span className="shift-label">Total Neto</span>
            <span className={`shift-val num ${totalNeto >= 0 ? 'pos' : 'neg'}`}>$ {fmt(totalNeto)}</span>
          </div>
        </div>
        {/* Botones — siempre en la misma línea, sin wrapping */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <ExportarButton definicion={exportCaja} />
          <button className="btn-secondary" onClick={() => setMovModal(true)}>+ Movimiento</button>
          <button className="btn-primary" onClick={() => navigate('/caja/cerrar')}>Cerrar caja</button>
        </div>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: '1.5fr 0.75fr 1.5fr 1.5fr' }}>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div className="shift-label">Total ventas</div>
          <div className="num pos" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>$ {fmt(totalVentas)}</div>
          <div className="text-muted text-xs">{confirmadas.length} confirmada{confirmadas.length === 1 ? '' : 's'}</div>
        </div>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div className="shift-label">Ventas anuladas</div>
          <div className="num neg" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>{anuladas.length}</div>
          <div className="text-muted text-xs">en este turno</div>
        </div>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div className="shift-label">Total ingresos</div>
          <div className="num pos" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>$ {fmt(totalIngresos)}</div>
        </div>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div className="shift-label">Total egresos</div>
          <div className="num neg" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>$ {fmt(totalEgresos)}</div>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px var(--pad)', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Ventas del turno ({confirmadas.length})</span>
          <input
            className="input"
            style={{ width: 160, fontSize: '0.85rem' }}
            placeholder="N° venta..."
            value={filterNumero}
            onChange={e => setFilterNumero(e.target.value)}
            aria-label="Filtrar por número"
          />
          <select
            className="input"
            style={{ width: 150, fontSize: '0.85rem' }}
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value as '' | 'confirmada' | 'anulada')}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            <option value="confirmada">Confirmadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>
        {ventas.length === 0 ? (
          <div className="text-muted" style={{ padding: 'var(--pad)', textAlign: 'center', fontSize: '13px' }}>Sin ventas en este turno</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => handleSortVentas('numero')}>
                    Número <SortIcon active={sortVentas === 'numero'} dir={sortVentasDir} />
                  </th>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Forma de pago</th>
                  <th className="r" style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => handleSortVentas('total')}>
                    Total <SortIcon active={sortVentas === 'total'} dir={sortVentasDir} />
                  </th>
                  <th className="c">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem', opacity: 0.5 }}>Sin resultados</td></tr>
                )}
                {ventasFiltradas.map(v => (
                  <tr
                    key={v.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalle de la venta ${v.numero_interno}`}
                    style={{ opacity: v.estado === 'anulada' ? 0.5 : 1, cursor: 'pointer' }}
                    onClick={() => setDetalleVentaId(v.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetalleVentaId(v.id); } }}
                  >
                    <td>
                      <button
                        type="button"
                        className="num link-btn"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', color: 'inherit', font: 'inherit' }}
                        onClick={e => { e.stopPropagation(); setDetalleVentaId(v.id); }}
                      >
                        {v.numero_interno}
                      </button>
                    </td>
                    <td className="text-muted text-sm">{fmtHora(v.fecha)}</td>
                    <td className="text-sm">{v.cliente_nombre ?? '—'}</td>
                    <td className="text-sm text-muted">{fmtFormaPago(v.forma_pago)}</td>
                    <td className="r"><span className="num">$ {fmt(v.total)}</span></td>
                    <td className="c">
                      <span className={`badge ${v.estado === 'confirmada' ? 'ok' : 'off'}`}>
                        <span className="bd" />{v.estado === 'confirmada' ? 'Confirmada' : 'Anulada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {movManuales.length > 0 && (
        <div className="panel">
          <div className="card-title">Movimientos manuales ({movManuales.length})</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Hora</th><th>Tipo</th><th>Motivo</th><th>Forma pago</th><th className="r">Monto</th></tr>
              </thead>
              <tbody>
                {movManuales.map(m => (
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setDetalleMov(m)}>
                    <td className="text-muted text-sm">{fmtHora(m.fecha)}</td>
                    <td>
                      <span className={`badge ${m.tipo === 'ingreso' ? 'pos' : 'neg'}`}>
                        <span className="bd" />{m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </span>
                    </td>
                    <td className="text-sm">{MOTIVO_LABEL[m.motivo] ?? m.motivo}</td>
                    <td className="text-sm text-muted">{m.forma_pago ?? '—'}</td>
                    <td className="r">
                      <span className={`num ${m.tipo === 'ingreso' ? 'pos' : 'neg'}`}>
                        {m.tipo === 'egreso' ? '-' : ''}$ {fmt(m.monto)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {movModal && <MovimientoModal cajaId={caja.id} onClose={() => { setMovModal(false); cargarDatos(); onRefetch(); }} />}
      {detalleVentaId && renderVentaDetalle?.(detalleVentaId, () => { setDetalleVentaId(null); cargarDatos(); })}
    </div>
  );
}
