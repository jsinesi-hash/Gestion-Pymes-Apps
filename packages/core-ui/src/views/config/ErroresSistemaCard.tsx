import { useCallback, useEffect, useState } from 'react';
import { bridge } from '../../bridge';
import { traducirError } from '../../lib/errores';

// ADR-140: errores de los jobs programados y errores no capturados del proceso main, que antes solo
// iban al log. Vive en «Backup y restauración» (pantalla de Supervisor); el main exige el mismo
// permiso que esa pantalla.
type ErrorSistema = { id: string; fecha: number; origen: string; mensaje: string; detalle: string | null };

const ORIGENES: Record<string, string> = {
  'tarea:avisos-reintentos': 'Avisos (reintentos)',
  'tarea:cambios-programados': 'Cambios de precio programados',
  'tarea:presupuestos-vencidos': 'Presupuestos vencidos',
  'main:uncaughtException': 'Error inesperado',
  'main:unhandledRejection': 'Promesa rechazada sin capturar',
};

const nombreDeOrigen = (origen: string): string => ORIGENES[origen] ?? origen;
const formatearFecha = (ms: number): string => new Date(ms).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' });

export function ErroresSistemaCard() {
  const [errores, setErrores] = useState<ErrorSistema[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const sistema = bridge()?.sistema;
      // Un main anterior no tiene el canal: sin errores que mostrar, sin ruido.
      if (!sistema?.erroresListar) { setErrores([]); return; }
      setErrores(await sistema.erroresListar());
    } catch (e) {
      setError(traducirError(e).mensaje);
      setErrores((previo) => previo ?? []);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function limpiar() {
    setLimpiando(true);
    setError(null);
    try {
      await bridge().sistema.erroresLimpiar();
      setConfirmando(false);
      setDetalleAbierto(null);
      await cargar();
    } catch (e) {
      setError(traducirError(e).mensaje);
      setConfirmando(false);
    } finally {
      setLimpiando(false);
    }
  }

  const cargando = errores === null;
  const hayErrores = (errores?.length ?? 0) > 0;

  return (
    <div className="card">
      <div className="card-title">Errores del sistema</div>
      <p className="text-sm text-muted">
        Fallas de las tareas en segundo plano (avisos, cambios de precio programados, vencimiento de
        presupuestos) y errores inesperados de la aplicación. Se conservan los últimos 100.
      </p>

      {error && <div className="alert-danger" role="alert">{error}</div>}

      {cargando && <p className="text-sm text-muted">Cargando…</p>}
      {!cargando && !hayErrores && <p className="text-sm text-muted">Sin errores registrados.</p>}

      {hayErrores && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Fecha</th>
              <th style={{ padding: '6px 8px' }}>Origen</th>
              <th style={{ padding: '6px 8px' }}>Mensaje</th>
              <th style={{ padding: '6px 8px' }} />
            </tr>
          </thead>
          <tbody>
            {errores!.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{formatearFecha(e.fecha)}</td>
                <td style={{ padding: '6px 8px' }}>{nombreDeOrigen(e.origen)}</td>
                <td style={{ padding: '6px 8px', wordBreak: 'break-word' }}>
                  {e.mensaje}
                  {detalleAbierto === e.id && e.detalle && (
                    <pre style={{ margin: '6px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{e.detalle}</pre>
                  )}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {e.detalle && (
                    <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => setDetalleAbierto(detalleAbierto === e.id ? null : e.id)}>
                      {detalleAbierto === e.id ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={() => void cargar()} disabled={cargando || limpiando}>
          Actualizar
        </button>
        {!confirmando && (
          <button type="button" className="btn-secondary" onClick={() => setConfirmando(true)}
            disabled={cargando || limpiando || !hayErrores}>
            Limpiar registro
          </button>
        )}
        {confirmando && (
          <>
            <span className="text-sm">Se borran todos los errores registrados. ¿Seguro?</span>
            <button type="button" className="btn-danger" onClick={() => void limpiar()} disabled={limpiando}>
              {limpiando ? 'Limpiando…' : 'Sí, limpiar'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmando(false)} disabled={limpiando}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
