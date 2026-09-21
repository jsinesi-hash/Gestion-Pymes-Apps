import { useState } from 'react';
import type { ImportPreviewResult, ImportRowResult } from '../../../../main/ipc/importar';

type Props = {
  preview: ImportPreviewResult;
  onConfirm: () => void;
  onBack: () => void;
  onEditarFila: (fila: number, raw: Record<string, string>) => void;
  loading: boolean;
};

const STATUS_CONFIG = {
  ok:     { label: '✓ Nuevo',     color: '#2e7d52', bg: 'rgba(46,125,82,.1)',   border: 'rgba(46,125,82,.2)' },
  update: { label: '↻ Actualiza', color: '#b4690e', bg: 'rgba(180,105,14,.1)', border: 'rgba(180,105,14,.2)' },
  error:  { label: '✕ Error',     color: '#c0392b', bg: 'rgba(192,57,43,.08)',  border: 'rgba(192,57,43,.15)' },
} as const;

function StatusBadge({ status }: { status: ImportRowResult['status'] }) {
  const config = STATUS_CONFIG[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: config.color, background: config.bg, border: `1px solid ${config.border}` }}>
      {config.label}
    </span>
  );
}

export function PreviewStep({ preview, onConfirm, onBack, onEditarFila, loading }: Props) {
  const [filtro, setFiltro] = useState<'all' | ImportRowResult['status']>('all');
  const [modalAbierto, setModalAbierto] = useState(false);

  const { stats, rows } = preview;
  const hasValid = stats.ok + stats.update > 0;
  const columnas = rows.length > 0 && rows[0].raw ? Object.keys(rows[0].raw) : [];
  const filasFiltradas = rows.filter(r => filtro === 'all' || r.status === filtro);

  // Centramos las columnas "chicas o numéricas": todas sus celdas no vacías son números
  // (con $, coma, punto o %) o texto muy corto. Se calcula por columna para que quede
  // parejo en toda la columna, no celda por celda.
  const esValorCortoONumerico = (v: string) => {
    const t = v.trim();
    if (t === '') return false;
    return /^-?\$?\s?[\d.,]+\s?%?$/.test(t) || t.length <= 6;
  };
  const columnasCentradas = new Set(
    columnas.filter(c => {
      const vals = rows.map(r => (r.raw?.[c] ?? '').trim()).filter(v => v !== '');
      return vals.length > 0 && vals.every(esValorCortoONumerico);
    }),
  );

  const chip = (key: 'all' | ImportRowResult['status'], label: string) => (
    <button
      type="button"
      onClick={() => setFiltro(key)}
      style={{
        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${filtro === key ? 'var(--accent)' : 'transparent'}`,
        color: key === 'all' ? 'var(--ink-2)' : STATUS_CONFIG[key as ImportRowResult['status']].color,
        background: key === 'all' ? 'var(--surface-2)' : STATUS_CONFIG[key as ImportRowResult['status']].bg,
      }}
    >
      {label} ({key === 'all' ? rows.length : stats[key as keyof typeof stats]})
    </button>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div className="toolbar" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chip('all', 'Todos')}
          {chip('ok', '✓ Nuevo')}
          {chip('update', '↻ Actualiza')}
          {chip('error', '✕ Error')}
        </div>
        <div className="ml-auto" style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onBack} disabled={loading} className="btn-secondary">← Volver</button>
          <button type="button" onClick={() => setModalAbierto(true)} disabled={!hasValid || loading} className="btn-primary" style={{ opacity: !hasValid || loading ? 0.5 : 1 }}>
            {loading ? 'Importando…' : 'Confirmar importación →'}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th className="c">Línea</th>
              {columnas.map(c => <th key={c} className={columnasCentradas.has(c) ? 'c' : undefined}>{c}</th>)}
              <th>Match</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map(row => (
              <tr key={row.fila} style={{ background: row.status === 'ok' ? 'rgba(46,125,82,.04)' : row.status === 'update' ? 'rgba(180,105,14,.04)' : 'rgba(192,57,43,.04)' }}>
                <td className="c"><span className="num text-muted" style={{ fontSize: 11.5 }}>{row.fila}</span></td>
                {columnas.map(c => (
                  <td
                    key={c}
                    contentEditable
                    suppressContentEditableWarning
                    className={columnasCentradas.has(c) ? 'c' : undefined}
                    style={{ fontFamily: 'var(--mono-font)', fontSize: 13, cursor: 'text' }}
                    onBlur={e => onEditarFila(row.fila, { ...(row.raw ?? {}), [c]: e.currentTarget.textContent ?? '' })}
                  >
                    {row.raw?.[c] ?? ''}
                  </td>
                ))}
                <td className="text-muted text-xs">{row.matchKey ?? '—'}</td>
                <td>
                  <StatusBadge status={row.status} />
                  {row.error && <div style={{ color: '#c0392b', fontSize: 11, marginTop: 3, minWidth: 240, maxWidth: 420, whiteSpace: 'normal' }}>{row.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <div className="modal-overlay" role="dialog">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Confirmar importación</span>
            </div>
            <div className="modal-body">
              <p>Se van a crear/procesar <strong>{stats.ok + stats.update} registros</strong>. Las {stats.error} filas con error quedan afuera.</p>
              <p>Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={() => { setModalAbierto(false); onConfirm(); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
