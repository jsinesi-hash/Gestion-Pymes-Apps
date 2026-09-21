import { useState, useEffect, useCallback } from 'react';
import type { BackupListItem, ResumenDepuracion } from '@ferreteria/shared';
import { RestoreWizard } from './RestoreWizard';
import { DepuracionBackupsModal } from './DepuracionBackupsModal';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

export function ConfigBackupRestore() {
  const [backups, setBackups]           = useState<BackupListItem[]>([]);
  const [directorio, setDirectorio]     = useState('');
  const [autoHabilitado, setAutoHab]    = useState('true');
  const [retencionDias, setRetencion]   = useState('30');
  const [incluirCerts, setIncluirCerts] = useState('false');
  const [creando, setCreando]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [ok, setOk]                     = useState<string | null>(null);
  const [showWizard, setShowWizard]     = useState(false);
  const [resumenDep, setResumenDep]     = useState<ResumenDepuracion | null>(null);
  const [showDepuracion, setShowDepuracion] = useState(false);
  const [cantCand, setCantCand]         = useState('10');
  const [piso, setPiso]                 = useState('3');
  const [sizeMb, setSizeMb]             = useState('0');

  const cargarParametros = useCallback(async () => {
    const destino = await (globalThis as any).ferreteria.parametros.get({ clave: 'backup_destino_local' });
    const auto    = await (globalThis as any).ferreteria.parametros.get({ clave: 'backup_auto_habilitado' });
    const ret     = await (globalThis as any).ferreteria.parametros.get({ clave: 'backup_retencion_dias' });
    const certs   = await (globalThis as any).ferreteria.parametros.get({ clave: 'backup_incluir_certs' });
    const cant    = await (globalThis as any).ferreteria.parametros.get({ clave: 'backup_retencion_cantidad' });
    const pisoV   = await (globalThis as any).ferreteria.parametros.get({ clave: 'backup_retencion_piso' });
    const smb     = await (globalThis as any).ferreteria.parametros.get({ clave: 'backup_retencion_size_mb' });
    if (destino) {
      setDirectorio(destino);
    } else {
      const rutaDefault: string | null = await (globalThis as any).ferreteria.dialog
        .getDefaultBackupPath()
        .catch(() => null);
      setDirectorio(rutaDefault ?? '');
    }
    setAutoHab(auto ?? 'true');
    setRetencion(ret ?? '30');
    setIncluirCerts(certs ?? 'false');
    setCantCand(cant ?? '10');
    setPiso(pisoV ?? '3');
    setSizeMb(smb ?? '0');
  }, []);

  const cargarBackups = useCallback(async () => {
    if (!directorio) { setBackups([]); return; }
    try {
      const lista = await (globalThis as any).ferreteria.backup.listar({ directorio });
      setBackups(lista);
    } catch { setBackups([]); }
  }, [directorio]);

  const evaluarDep = useCallback(async () => {
    try {
      const r: ResumenDepuracion = await (globalThis as any).ferreteria.backup.evaluarDepuracion();
      setResumenDep(r.candidatos.length > 0 ? r : null);
    } catch { setResumenDep(null); }
  }, []);

  useEffect(() => { cargarParametros(); }, [cargarParametros]);
  useEffect(() => { cargarBackups(); }, [cargarBackups]);
  useEffect(() => { evaluarDep(); }, [evaluarDep]);

  async function handleExaminarCarpeta() {
    const ruta = await (globalThis as any).ferreteria.dialog.seleccionarCarpeta();
    if (ruta) {
      setDirectorio(ruta);
      setError(null);
      try {
        await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_destino_local', valor: ruta });
        setOk('Carpeta guardada.');
      } catch {
        // silencioso: el estado se actualiza igual
      }
      await cargarBackups();
    }
  }

  async function handleCrearBackup() {
    if (!directorio) {
      setError('Configurá una carpeta destino antes de crear un backup.');
      return;
    }
    setCreando(true);
    setError(null);
    setOk(null);
    try {
      await (globalThis as any).ferreteria.backup.ejecutar({
        tipo: 'manual',
        destino: directorio,
        appVersion: '1.0.0',
        sucursalId: 'local',
      });
      setOk('Backup creado exitosamente.');
      await cargarBackups();
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear backup');
    } finally {
      setCreando(false);
    }
  }

  async function handleEliminar(ruta: string) {
    if (!confirm('¿Eliminar este backup? Esta acción no se puede deshacer.')) return;
    try {
      await (globalThis as any).ferreteria.backup.eliminar({ ruta });
      await cargarBackups();
    } catch (e: any) {
      setError(e?.message ?? 'Error al eliminar');
    }
  }

  async function guardarParametros() {
    await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_destino_local',   valor: directorio });
    await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_auto_habilitado', valor: autoHabilitado });
    await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_retencion_dias',  valor: retencionDias });
    await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_incluir_certs',   valor: incluirCerts });
    await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_retencion_cantidad', valor: cantCand });
    await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_retencion_piso',     valor: piso });
    await (globalThis as any).ferreteria.parametros.set({ clave: 'backup_retencion_size_mb',  valor: sizeMb });
    setOk('Parámetros guardados.');
    await cargarBackups();
    await evaluarDep();
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Backups</h2>

      {/* Parámetros */}
      <section style={{ marginBottom: 32, padding: '16px 20px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)' }}>Configuración</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <label htmlFor="cbr-dir">Carpeta destino</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="cbr-dir"
                className="input"
                style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}
                value={directorio}
                onChange={e => setDirectorio(e.target.value)}
                placeholder="Ej: C:\Backups\Ferreteria"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleExaminarCarpeta}
                style={{ whiteSpace: 'nowrap' }}
              >
                Examinar…
              </button>
            </div>
            <span className="text-xs text-muted">Podés usar una carpeta de Google Drive Desktop o OneDrive.</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoHabilitado === 'true'} onChange={e => setAutoHab(e.target.checked ? 'true' : 'false')} />
            <span className="text-sm">Backup automático al cerrar caja</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span className="text-sm">Retención:</span>
            <input
              type="number"
              min={1}
              max={365}
              value={retencionDias}
              onChange={e => setRetencion(e.target.value)}
              style={{ width: 64, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, textAlign: 'right', background: 'var(--surface-2)', color: 'var(--ink)' }}
            />
            <span className="text-sm" style={{ color: 'var(--ink-2)' }}>días</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-sm">Conservar últimos:</span>
            <input
              type="number"
              min={1}
              value={cantCand}
              onChange={e => setCantCand(e.target.value)}
              style={{ width: 64, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, textAlign: 'right', background: 'var(--surface-2)', color: 'var(--ink)' }}
            />
            <span className="text-sm" style={{ color: 'var(--ink-2)' }}>backups</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-sm">Mínimo a conservar (piso):</span>
            <input
              type="number"
              min={1}
              value={piso}
              onChange={e => setPiso(e.target.value)}
              style={{ width: 64, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, textAlign: 'right', background: 'var(--surface-2)', color: 'var(--ink)' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-sm">Tope por carpeta:</span>
            <input
              type="number"
              min={0}
              value={sizeMb}
              onChange={e => setSizeMb(e.target.value)}
              style={{ width: 80, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, textAlign: 'right', background: 'var(--surface-2)', color: 'var(--ink)' }}
            />
            <span className="text-sm" style={{ color: 'var(--ink-2)' }}>MB (0 = sin tope)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={incluirCerts === 'true'} onChange={e => setIncluirCerts(e.target.checked ? 'true' : 'false')} />
            <span className="text-sm">Incluir certificados AFIP en backups</span>
          </label>
          {incluirCerts === 'true' && (
            <div role="alert" style={{
              padding: '12px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
              background: 'rgba(180,105,14,.1)', color: 'var(--warn)',
              border: '1px solid rgba(180,105,14,.25)',
            }}>
              <strong>Advertencia:</strong> Los certificados AFIP son credenciales fiscales. El backup se cifrará con contraseña. No compartas este archivo ni la contraseña.
            </div>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary" onClick={guardarParametros}>Guardar configuración</button>
        </div>
      </section>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className="btn-primary"
          onClick={handleCrearBackup}
          disabled={creando}
          style={{ opacity: creando ? .7 : 1, cursor: creando ? 'wait' : 'pointer' }}
        >
          {creando ? 'Creando backup…' : 'Crear backup ahora'}
        </button>
        <button className="btn-secondary" onClick={() => setShowWizard(true)}>
          Restaurar desde archivo…
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="alert-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div>
      )}
      {ok && (
        <div role="status" style={{ // NOSONAR
          marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: 'rgba(46,125,82,.1)', color: 'var(--ok)',
          border: '1px solid rgba(46,125,82,.25)',
        }}>{ok}</div>
      )}

      {resumenDep && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(180,105,14,.1)', color: 'var(--warn)', border: '1px solid rgba(180,105,14,.25)',
        }}>
          <span className="text-sm">
            {resumenDep.candidatos.length} backups depurables · {(resumenDep.bytesALiberar / 1048576).toFixed(1)} MB
          </span>
          <button className="btn-secondary" onClick={() => setShowDepuracion(true)}>Depurar</button>
        </div>
      )}

      {/* Lista de backups */}
      <section>
        <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)' }}>
          Backups en "{directorio || '—'}"
        </h3>
        {backups.length === 0 ? (
          <p className="text-sm text-muted">No hay backups en la carpeta configurada.</p>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--ink-2)' }}>Fecha</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--ink-2)' }}>Tipo</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--ink-2)' }}>Tamaño</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--ink-2)' }}>Certs</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--ink-2)' }}>Cifrado</th>
                <th style={{ padding: '6px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.ruta} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px' }}>{formatFecha(b.fecha)}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: b.tipo === 'manual' ? 'var(--accent-soft)' : 'var(--surface-2)',
                      color: b.tipo === 'manual' ? 'var(--accent-strong)' : 'var(--ink-2)',
                    }}>
                      {b.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(b.tamano_bytes)}</td>
                  <td style={{ padding: '8px' }}>{b.incluye_certs ? '✓' : '—'}</td>
                  <td style={{ padding: '8px' }}>{b.cifrado ? '✓' : '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <button className="btn-danger" onClick={() => handleEliminar(b.ruta)} style={{ fontSize: 12, padding: '3px 10px' }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showWizard && (
        <RestoreWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => { setShowWizard(false); cargarBackups(); }}
        />
      )}

      {showDepuracion && resumenDep && (
        <DepuracionBackupsModal
          resumen={resumenDep}
          onClose={() => setShowDepuracion(false)}
          onDone={() => { setShowDepuracion(false); evaluarDep(); cargarBackups(); }}
        />
      )}
    </div>
  );
}
