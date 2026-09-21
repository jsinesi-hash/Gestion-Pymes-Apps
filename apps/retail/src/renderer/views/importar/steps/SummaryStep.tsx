import { useState } from 'react';
import type { ImportSummaryResult, SummaryRowResult } from '../../../../main/ipc/importar';
import { descargarReporteImportacion, type ColumnaReporte } from '../../../lib/reporteImportacion';

type Props = { summary: ImportSummaryResult; onNueva: () => void };

function downloadCsv(rows: SummaryRowResult[], filtro: string) {
  const dinamicas = rows.length > 0 && rows[0].raw ? Object.keys(rows[0].raw) : [];
  const columnas: ColumnaReporte<SummaryRowResult>[] = [
    { header: 'fila', valor: r => r.fila },
    ...dinamicas.map(c => ({ header: c, valor: (r: SummaryRowResult) => r.raw?.[c] ?? '' })),
    { header: 'estado', valor: r => r.status },
    { header: 'mensaje', valor: r => r.mensaje },
  ];
  descargarReporteImportacion(rows, columnas, `resumen-importacion_${filtro}`);
}

export function SummaryStep({ summary, onNueva }: Props) {
  const [filtro, setFiltro] = useState<'all' | SummaryRowResult['status']>('all');
  const total = summary.stats.created + summary.stats.updated + summary.stats.error;
  const columnas = summary.rows.length > 0 && summary.rows[0].raw ? Object.keys(summary.rows[0].raw) : [];
  const filasFiltradas = summary.rows.filter(r => filtro === 'all' || r.status === filtro);

  const chip = (key: 'all' | SummaryRowResult['status'], label: string, val: number, color: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setFiltro(key)}
      className="card"
      style={{
        padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        border: filtro === key ? '2px solid var(--accent)' : '1px solid var(--line)',
      }}
    >
      <div className="card-title" style={{ padding: 0, marginBottom: 4 }}>{label} ({val})</div>
      <div className="num" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', color }}>{val}</div>
    </button>
  );

  return (
    <div className="flex-col" style={{ flex: 1, overflow: 'auto', padding: 'var(--pad)', gap: 'var(--pad)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {chip('all', 'Todas', total, 'var(--ink)')}
        {chip('created', 'Creadas', summary.stats.created, '#2e7d52')}
        {chip('updated', 'Actualizadas', summary.stats.updated, '#b4690e')}
        {chip('error', 'Errores', summary.stats.error, '#c0392b')}
      </div>

      <div className="card">
        <div className="card-title">Detalle por fila</div>
        <div className="table-wrap">
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Línea</th>
                {columnas.map(c => <th key={c}>{c}</th>)}
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map(row => (
                <tr key={row.fila}>
                  <td><span className="num text-muted" style={{ fontSize: 11.5 }}>{row.fila}</span></td>
                  {columnas.map(c => <td key={c} className="text-xs">{row.raw?.[c] ?? ''}</td>)}
                  <td style={{ color: row.status === 'error' ? '#c0392b' : row.status === 'updated' ? '#b4690e' : 'var(--ink)', fontSize: 12.5 }}>
                    {row.mensaje}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onNueva} className="btn-secondary">Nueva importación</button>
        {summary.stats.error > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(summary.rows.filter(r => r.status === 'error'), 'errores')}
            className="btn-secondary"
          >
            ↓ Descargar errores (.csv)
          </button>
        )}
        <button type="button" onClick={() => downloadCsv(filasFiltradas, filtro)} className="btn-primary" style={{ background: '#2e7d52', boxShadow: 'none' }}>
          ↓ Descargar filtro actual (.csv)
        </button>
      </div>
    </div>
  );
}
