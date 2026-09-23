import { useState } from 'react';
import type { ResumenDepuracion } from '@ferreteria/shared';
import { useEscapeToClose } from '@core/ui';

// Postergación persistente del aviso de depuración, por terminal (es un recordatorio sobre
// archivos de backup locales de esta máquina). Guarda el epoch-ms hasta el que no se vuelve
// a mostrar al arranque. Lo lee AppShell antes de decidir si abre el modal.
export const DEPURACION_POSPUESTA_KEY = 'backup_depuracion_pospuesta_hasta';

/** true si el aviso de depuración fue pospuesto y todavía no venció. */
export function depuracionPospuestaVigente(now: number = Date.now()): boolean {
  try {
    const hasta = Number(localStorage.getItem(DEPURACION_POSPUESTA_KEY) ?? '0');
    return Number.isFinite(hasta) && now < hasta;
  } catch {
    return false;
  }
}

interface Props {
  resumen: ResumenDepuracion;
  onClose: () => void;
  onDone: (r: { eliminados: number; bytesLiberados: number }) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

export function DepuracionBackupsModal({ resumen, onClose, onDone }: Readonly<Props>) {
  const [depurando, setDepurando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, !depurando);

  function handlePosponer(dias: number) {
    try {
      localStorage.setItem(DEPURACION_POSPUESTA_KEY, String(Date.now() + dias * 86400000));
    } catch {
      // localStorage no disponible: al menos cerramos (postergación de sesión).
    }
    onClose();
  }

  async function handleDepurar() {
    setDepurando(true);
    setError(null);
    try {
      const rutas = resumen.candidatos.map(c => c.ruta);
      const r = await (globalThis as any).ferreteria.backup.depurar({ rutas });
      onDone(r);
    } catch (e: any) {
      setError(e?.message ?? 'Error al depurar');
      setDepurando(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Depurar backups"> {/* NOSONAR */}
      <div className="modal" style={{ width: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <span className="modal-title">Depurar backups antiguos</span>
          {!depurando && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-3)', lineHeight: 1 }}
              aria-label="Cerrar"
            >✕</button>
          )}
        </div>

        <div className="modal-body">
          <p className="text-sm text-muted">
            Se pueden eliminar <strong>{resumen.candidatos.length}</strong> backup{resumen.candidatos.length !== 1 ? 's' : ''} automático{resumen.candidatos.length !== 1 ? 's' : ''}
            {' '}antiguos y liberar <strong>{formatBytes(resumen.bytesALiberar)}</strong>. Los backups manuales no se tocan.
          </p>

          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', color: 'var(--ink-2)', fontWeight: 600 }}>Archivo</th>
                <th style={{ padding: '6px 8px', color: 'var(--ink-2)', fontWeight: 600 }}>Fecha</th>
                <th style={{ padding: '6px 8px', color: 'var(--ink-2)', fontWeight: 600 }}>Tamaño</th>
              </tr>
            </thead>
            <tbody>
              {resumen.candidatos.map(c => (
                <tr key={c.ruta} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{c.nombre}</td>
                  <td style={{ padding: '8px' }}>{formatFecha(c.fecha)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(c.tamano_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {error && <div className="alert-danger" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
          <span className="text-xs text-muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>Postergar:</span>
          <button className="btn-secondary" onClick={() => handlePosponer(5)} disabled={depurando}>5 días</button>
          <button className="btn-secondary" onClick={() => handlePosponer(15)} disabled={depurando}>15 días</button>
          <button className="btn-secondary" onClick={() => handlePosponer(30)} disabled={depurando}>30 días</button>
          <button className="btn-danger" onClick={handleDepurar} disabled={depurando}>
            {depurando ? 'Depurando…' : 'Depurar ahora'}
          </button>
        </div>
      </div>
    </div>
  );
}
