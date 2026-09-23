import { bridge } from '../../bridge';
import { useState } from 'react';
import type { BackupManifest, RestoreValidationResult } from '@ferreteria/shared';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type Paso = 'seleccionar' | 'validando' | 'comparar' | 'confirmar' | 'ejecutando' | 'resultado';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

function formatFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

export function RestoreWizard({ onClose, onSuccess }: Readonly<Props>) {
  const [paso, setPaso]           = useState<Paso>('seleccionar');
  const [rutaFbk, setRutaFbk]    = useState('');
  const [password, setPassword]   = useState('');
  const [validacion, setValidacion] = useState<RestoreValidationResult | null>(null);
  const [confirmar, setConfirmar] = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ row_counts_antes: Record<string, number>; row_counts_despues: Record<string, number> } | null>(null);

  useEscapeToClose(onClose, paso !== 'ejecutando');

  async function handleValidar() {
    if (!rutaFbk.trim()) { setError('Ingresá la ruta del archivo .fbk'); return; }
    setError(null);
    setPaso('validando');
    try {
      const result: RestoreValidationResult = await bridge().restore.validar({
        ruta: rutaFbk.trim(),
        ...(password ? { password } : {}),
      });
      setValidacion(result);
      if (result.ok) {
        setPaso('comparar');
      } else {
        setError(result.error ?? 'Validación fallida');
        setPaso('seleccionar');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error al validar el backup');
      setPaso('seleccionar');
    }
  }

  async function handleEjecutar() {
    if (confirmar !== 'RESTAURAR') { setError('Escribí RESTAURAR para confirmar'); return; }
    setError(null);
    setPaso('ejecutando');
    try {
      const res = await bridge().restore.ejecutar({
        ruta: rutaFbk.trim(),
        ...(password ? { password } : {}),
      });
      setResultado(res);
      setPaso('resultado');
      onSuccess();
    } catch (e: any) {
      setError(e?.message ?? 'Error al restaurar');
      setPaso('confirmar');
    }
  }

  const manifest = validacion?.manifest as BackupManifest | undefined;

  async function handleExaminarArchivo() {
    const ruta = await bridge().dialog.seleccionarArchivo();
    if (ruta) setRutaFbk(ruta);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Wizard de restauración"> {/* NOSONAR */}
      <div className="modal" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">Restaurar desde backup</span>
          {paso !== 'ejecutando' && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-3)', lineHeight: 1 }}
              aria-label="Cerrar"
            >✕</button>
          )}
        </div>

        {/* PASO: seleccionar / validando */}
        {(paso === 'seleccionar' || paso === 'validando') && (
          <>
            <div className="modal-body">
              <p className="text-sm text-muted">
                Seleccioná el archivo <code>.fbk</code> a restaurar. Esta operación reemplazará <strong>todos</strong> los datos actuales.
              </p>
              <div className="field">
                <label htmlFor="rw-ruta">Ruta del archivo .fbk</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="rw-ruta"
                    className="input"
                    style={{ fontFamily: 'monospace', fontSize: 12, flex: 1 }}
                    value={rutaFbk}
                    onChange={e => setRutaFbk(e.target.value)}
                    placeholder="C:\Backups\ferreteria-backup-2026-06-24.fbk"
                    autoFocus
                    disabled={paso === 'validando'}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleExaminarArchivo}
                    disabled={paso === 'validando'}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Examinar…
                  </button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="rw-pass">Contraseña (solo si el backup está cifrado)</label>
                <input
                  id="rw-pass"
                  type="password"
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Dejar vacío si no está cifrado"
                />
              </div>
              {error && <div className="alert-danger" role="alert">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handleValidar}
                disabled={paso === 'validando'}
              >
                {paso === 'validando' ? 'Validando…' : 'Validar backup'}
              </button>
            </div>
          </>
        )}

        {/* PASO: comparar */}
        {paso === 'comparar' && validacion && manifest && (
          <>
            <div className="modal-body">
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 13,
                background: validacion.compatibilidad === 'direct' ? 'rgba(46,125,82,.1)' : 'rgba(180,105,14,.1)',
                color: validacion.compatibilidad === 'direct' ? 'var(--ok)' : 'var(--warn)',
                border: `1px solid ${validacion.compatibilidad === 'direct' ? 'rgba(46,125,82,.25)' : 'rgba(180,105,14,.25)'}`,
              }}>
                {validacion.compatibilidad === 'direct'
                  ? '✓ Backup compatible — se puede restaurar directamente.'
                  : '⚠ Backup de versión anterior — se aplicarán migraciones automáticamente.'}
              </div>

              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--ink-2)', fontWeight: 600 }}>Campo</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink-2)', fontWeight: 600 }}>Base actual</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink-2)', fontWeight: 600 }}>Backup</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px' }}>Fecha</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink-3)' }}>—</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatFecha(manifest.created_at)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px' }}>Versión app</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink-3)' }}>—</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{manifest.app_version}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px' }}>Certificados</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink-3)' }}>—</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{manifest.incluye_certs ? 'Sí' : 'No'}</td>
                  </tr>
                  {Object.entries(manifest.row_counts).map(([tabla, count]) => (
                    <tr key={tabla} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--ink-2)' }}>{tabla}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {validacion.row_counts_actuales?.[tabla] ?? '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" onClick={() => setPaso('confirmar')}>Continuar →</button>
            </div>
          </>
        )}

        {/* PASO: confirmar */}
        {paso === 'confirmar' && (
          <>
            <div className="modal-body">
              <div className="alert-danger" role="alert">
                <strong>Atención:</strong> La base de datos actual será reemplazada completamente por el backup. Se creará un respaldo de seguridad automático antes de proceder. La aplicación se reiniciará al finalizar.
              </div>
              <div className="field">
                <label htmlFor="rw-confirmar">
                  Para confirmar, escribí <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>RESTAURAR</code>
                </label>
                <input
                  id="rw-confirmar"
                  className="input"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  autoFocus
                  style={{ letterSpacing: '.05em' }}
                />
              </div>
              {error && <div className="alert-danger" role="alert">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPaso('comparar')}>Volver</button>
              <button
                className="btn-danger"
                onClick={handleEjecutar}
                disabled={confirmar !== 'RESTAURAR'}
              >
                Restaurar ahora
              </button>
            </div>
          </>
        )}

        {/* PASO: ejecutando */}
        {paso === 'ejecutando' && (
          <div className="modal-body" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Restaurando base de datos…</p>
            <p className="text-sm text-muted">La aplicación se reiniciará automáticamente al finalizar.</p>
            <p className="text-xs text-muted" style={{ marginTop: 4 }}>No cerrés la aplicación.</p>
          </div>
        )}

        {/* PASO: resultado */}
        {paso === 'resultado' && resultado && (
          <div className="modal-body">
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(46,125,82,.1)', color: 'var(--ok)',
              border: '1px solid rgba(46,125,82,.25)',
            }}>
              ✓ Restauración completada exitosamente. La aplicación se reiniciará en instantes.
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Tabla</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Antes</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Después</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resultado.row_counts_despues).map(([tabla, despues]) => (
                  <tr key={tabla} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px' }}>{tabla}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                      {resultado.row_counts_antes[tabla] ?? '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{despues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
