import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtARS, badgeEstado } from './utils';
import { ExportarButton } from '../../components/export/ExportarButton';
import { exportCtaCte } from '@ferreteria/shared';
import { SearchBox, usePersistentListState } from '@core/ui';
import { resaltarCoincidencia } from '../../lib/resaltar';

type CtaCteRow = {
  id: string;
  cliente_id: string;
  saldo_centavos: number;
  limite_credito_centavos: number;
  nombre_completo: string;
  tipo_documento: string;
  numero_documento: string;
};

type SortCol = 'nombre_completo' | 'saldo_centavos' | 'limite_credito_centavos' | 'estado';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>⇅</span>;
  return <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
}

function ThSort({ col, children, className, sortCol, sortDir, onSort }: {
  col: SortCol; children: React.ReactNode; className?: string;
  sortCol: SortCol; sortDir: SortDir; onSort: (c: SortCol) => void;
}) {
  return (
    <th className={className}
      onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {children}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );
}

function estadoOrd(saldo: number, limite: number): number {
  if (limite === 0) return 2;
  if (saldo > limite) return 1;
  return 0;
}

type FiltroSaldo = '' | 'deuda' | 'afavor';

export function CtaCteListado() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CtaCteRow[]>([]);
  const [busqueda, setBusqueda] = usePersistentListState('ctacte-busqueda', '');
  const [busquedaDni, setBusquedaDni] = usePersistentListState('ctacte-busqueda-dni', '');
  const [filtroSaldo, setFiltroSaldo] = usePersistentListState<FiltroSaldo>('ctacte-filtro-saldo', '');
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<SortCol>('nombre_completo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    (globalThis as any).ferreteria.ctacte.list()
      .then((data: CtaCteRow[]) => setRows(data))
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

  const filtrados = useMemo(() => {
    let result = rows;
    if (filtroSaldo === 'deuda')   result = result.filter(r => r.saldo_centavos > 0);
    if (filtroSaldo === 'afavor')  result = result.filter(r => r.saldo_centavos < 0);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      result = result.filter(r => r.nombre_completo.toLowerCase().includes(q));
    }
    if (busquedaDni.trim()) {
      result = result.filter(r => r.numero_documento.includes(busquedaDni.trim()));
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'saldo_centavos') {
        cmp = a.saldo_centavos - b.saldo_centavos;
      } else if (sortCol === 'limite_credito_centavos') {
        cmp = a.limite_credito_centavos - b.limite_credito_centavos;
      } else if (sortCol === 'estado') {
        cmp = estadoOrd(a.saldo_centavos, a.limite_credito_centavos) - estadoOrd(b.saldo_centavos, b.limite_credito_centavos);
      } else {
        cmp = a.nombre_completo.localeCompare(b.nombre_completo, 'es-AR', { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, busqueda, busquedaDni, filtroSaldo, sortCol, sortDir]);

  const totalDeuda   = rows.reduce((acc, r) => acc + (r.saldo_centavos > 0 ? r.saldo_centavos : 0), 0);
  const totalAFavor  = rows.reduce((acc, r) => acc + (r.saldo_centavos < 0 ? Math.abs(r.saldo_centavos) : 0), 0);
  const countDeuda   = rows.filter(r => r.saldo_centavos > 0).length;
  const countAFavor  = rows.filter(r => r.saldo_centavos < 0).length;

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <span style={{ fontSize: '16px', fontWeight: 600, flexShrink: 0 }}>Cuentas Corrientes</span>
        <button
          type="button"
          onClick={() => setFiltroSaldo(f => f === 'deuda' ? '' : 'deuda')}
          style={{
            display: 'flex', flexDirection: 'column', gap: 1,
            padding: '5px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            border: `1px solid ${filtroSaldo === 'deuda' ? 'var(--danger)' : 'var(--line)'}`,
            background: filtroSaldo === 'deuda' ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'var(--surface)',
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>En deuda</span>
          <span>
            <span className="num" style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13 }}>{fmtARS(totalDeuda)}</span>
            <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 12, marginLeft: 5 }}>· {countDeuda}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFiltroSaldo(f => f === 'afavor' ? '' : 'afavor')}
          style={{
            display: 'flex', flexDirection: 'column', gap: 1,
            padding: '5px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            border: `1px solid ${filtroSaldo === 'afavor' ? 'var(--success)' : 'var(--line)'}`,
            background: filtroSaldo === 'afavor' ? 'color-mix(in srgb, var(--success) 8%, transparent)' : 'var(--surface)',
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>A favor</span>
          <span>
            <span className="num" style={{ fontWeight: 700, color: 'var(--success)', fontSize: 13 }}>{fmtARS(totalAFavor)}</span>
            <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 12, marginLeft: 5 }}>· {countAFavor}</span>
          </span>
        </button>
        <div className="ml-auto" />
        <ExportarButton definicion={exportCtaCte} />
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '8px var(--pad, 16px)', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 180, display: 'flex' }}>
          <SearchBox
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por cliente..."
          />
        </div>
        <input
          className="input"
          style={{ flex: 1, minWidth: 140, fontSize: '0.85rem' }}
          placeholder="Filtrar por DNI / CUIT..."
          value={busquedaDni}
          onChange={e => setBusquedaDni(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <ThSort col="nombre_completo" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Cliente</ThSort>
              <th>Tipo</th>
              <th>Número</th>
              <ThSort col="saldo_centavos" className="r" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Saldo</ThSort>
              <ThSort col="limite_credito_centavos" className="r" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Límite</ThSort>
              <ThSort col="estado" className="c" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Estado</ThSort>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>
                Sin cuentas corrientes
              </td></tr>
            )}
            {filtrados.map(r => {
              const badge = badgeEstado(r.saldo_centavos, r.limite_credito_centavos);
              return (
                <tr key={r.id} style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/credito/${r.cliente_id}`)}>
                  <td>{resaltarCoincidencia(r.nombre_completo, busqueda)}</td>
                  <td>{r.tipo_documento}</td>
                  <td className="num">{r.numero_documento}</td>
                  <td className="r num" style={{ color: r.saldo_centavos < 0 ? 'var(--success)' : undefined }}>
                    {fmtARS(r.saldo_centavos)}
                  </td>
                  <td className="r num">
                    {r.limite_credito_centavos === 0 ? '—' : fmtARS(r.limite_credito_centavos)}
                  </td>
                  <td className="c">
                    <span style={{ color: badge.color, fontWeight: 500 }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
