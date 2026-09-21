// packages/client/src/renderer/views/compras/ordenes/OrdenesCompraListado.tsx
import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useFilaNavegable } from '../../../hooks/useFilaNavegable';

type OcRow = {
  id: string;
  numero_interno: string;
  razon_social: string;
  tipo: string;
  estado: string;
  fecha: string | number;
  total_centavos: number;
};

type SortCol = 'numero_interno' | 'razon_social' | 'tipo' | 'estado' | 'fecha' | 'total_centavos';
type SortDir = 'asc' | 'desc';

const ESTADO_BADGE: Record<string, string> = {
  borrador:         'warn',
  emitida:          'info',
  recibida_parcial: 'info',
  recibida_total:   'ok',
  cerrada:          'ok',
  anulada:          'off',
};

const ESTADOS_ACTIVOS = new Set(['borrador', 'emitida', 'recibida_parcial']);

function fmtARS(centavos: number) {
  return (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function fmtFecha(ts: string | number) {
  return new Date(ts).toLocaleDateString('es-AR');
}

function SortIcon({ col, sortCol, sortDir }: Readonly<{ col: SortCol; sortCol: SortCol; sortDir: SortDir }>) {
  if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>⇅</span>;
  return <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
}

function ThSort({ col, children, className, onSort, sortCol, sortDir }: Readonly<{
  col: SortCol;
  children: ReactNode;
  className?: string;
  onSort: (col: SortCol) => void;
  sortCol: SortCol;
  sortDir: SortDir;
}>) {
  return (
    <th className={className}
      onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {children}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );
}

export function OrdenesCompraListado() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [ocs, setOcs] = useState<OcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);

  const [sortCol, setSortCol] = useState<SortCol>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filtroEstado, setFiltroEstado] = useState('activas');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroNumero, setFiltroNumero] = useState('');

  useEffect(() => {
    (globalThis as any).ferreteria.compras.oc.list()
      .then((data: OcRow[]) => setOcs(data))
      .finally(() => setLoading(false));
  }, []);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let result = ocs;

    if (filtroEstado === 'activas') {
      result = result.filter(oc => ESTADOS_ACTIVOS.has(oc.estado));
    } else if (filtroEstado !== 'todas') {
      result = result.filter(oc => oc.estado === filtroEstado);
    }

    if (filtroProveedor.trim()) {
      const q = filtroProveedor.trim().toLowerCase();
      result = result.filter(oc => oc.razon_social.toLowerCase().includes(q));
    }

    if (filtroNumero.trim()) {
      const q = filtroNumero.trim().toLowerCase();
      result = result.filter(oc => oc.numero_interno.toLowerCase().includes(q));
    }

    return [...result].sort((a, b) => {
      let av: any = a[sortCol];
      let bv: any = b[sortCol];
      if (sortCol === 'fecha') {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }
      if (sortCol === 'total_centavos') {
        av = Number(av);
        bv = Number(bv);
      }
      let cmp: number;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv, 'es-AR', { sensitivity: 'base' });
      } else {
        const cmpGt = av > bv ? 1 : 0;
        cmp = av < bv ? -1 : cmpGt;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ocs, filtroEstado, filtroProveedor, filtroNumero, sortCol, sortDir]);

  const countEmitidas = useMemo(() => ocs.filter(oc => oc.estado === 'emitida').length, [ocs]);
  const countBorrador = useMemo(() => ocs.filter(oc => oc.estado === 'borrador').length, [ocs]);

  async function handleSugerida() {
    setCreando(true);
    try { navigate('/compras/ordenes/sugerida'); }
    finally { setCreando(false); }
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Órdenes de compra</h2>
        <div className="ml-auto" />
        <button className="btn-secondary" onClick={handleSugerida} disabled={creando}>
          OC Sugerida
        </button>
        {can('proveedor.gestionar') && (
          <Link to="/compras/ordenes/nueva">
            <button className="btn-primary">+ Nueva OC manual</button>
          </Link>
        )}
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr', padding: '8px var(--pad, 16px)', gap: '8px' }}>
        <div
          className="card"
          style={{ padding: 'var(--pad)', cursor: 'pointer', outline: filtroEstado === 'emitida' ? '2px solid var(--accent)' : 'none' }}
          role="button"
          tabIndex={0}
          onClick={() => setFiltroEstado(f => f === 'emitida' ? 'activas' : 'emitida')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFiltroEstado(f => f === 'emitida' ? 'activas' : 'emitida'); }}
        >
          <div className="shift-label">OC Emitidas</div>
          <div className="num" style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px', color: 'var(--accent)' }}>{countEmitidas}</div>
        </div>
        <div
          className="card"
          style={{ padding: 'var(--pad)', cursor: 'pointer', outline: filtroEstado === 'borrador' ? '2px solid var(--warn)' : 'none' }}
          role="button"
          tabIndex={0}
          onClick={() => setFiltroEstado(f => f === 'borrador' ? 'activas' : 'borrador')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFiltroEstado(f => f === 'borrador' ? 'activas' : 'borrador'); }}
        >
          <div className="shift-label">OC Borrador</div>
          <div className="num" style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px', color: 'var(--warn)' }}>{countBorrador}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '8px var(--pad, 16px)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Estado</span>
          <select className="input" style={{ width: '170px' }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="activas">Activas</option>
            <option value="todas">Todas</option>
            <option value="borrador">Borrador</option>
            <option value="emitida">Emitida</option>
            <option value="recibida_parcial">Recibida parcial</option>
            <option value="recibida_total">Recibida total</option>
            <option value="anulada">Anulada</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Proveedor</span>
          <input className="input" style={{ width: '180px' }} placeholder="Buscar proveedor…"
            value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Número</span>
          <input className="input" style={{ width: '150px' }} placeholder="OC-C1-000001"
            value={filtroNumero} onChange={e => setFiltroNumero(e.target.value)} />
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <ThSort col="numero_interno" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Número</ThSort>
                <ThSort col="razon_social" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Proveedor</ThSort>
                <ThSort col="tipo" className="c" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Tipo</ThSort>
                <ThSort col="estado" className="c" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Estado</ThSort>
                <ThSort col="fecha" className="c" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Fecha</ThSort>
                <ThSort col="total_centavos" className="r" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Total</ThSort>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    Sin resultados
                  </td>
                </tr>
              )}
              {filtered.map(oc => {
                const filaProps = useFilaNavegable(() => navigate(`/compras/ordenes/${oc.id}`), `Ver detalle de ${oc.numero_interno}`);
                return (
                <tr key={oc.id} {...filaProps}>
                  <td><span className="num">{oc.numero_interno}</span></td>
                  <td>{oc.razon_social}</td>
                  <td className="c"><span className="tag">{oc.tipo}</span></td>
                  <td className="c">
                    <span className={`badge ${ESTADO_BADGE[oc.estado] ?? 'off'}`}>
                      <span className="bd" />{oc.estado.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="c"><span className="num">{fmtFecha(oc.fecha)}</span></td>
                  <td className="r"><span className="num">$ {fmtARS(oc.total_centavos)}</span></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
