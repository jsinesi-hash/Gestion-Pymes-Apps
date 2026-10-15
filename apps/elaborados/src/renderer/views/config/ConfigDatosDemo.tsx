import { useCallback, useEffect, useState } from 'react';
import { bridge, traducirError } from '@core/ui';

type Estado = { hayCatalogo: boolean; hayDemo: boolean; articulosDemo: number; productosDemo: number; enUso: string[] };

// ADR-110: carga y vaciado a demanda del catálogo demo de heladería (equivalente a Datos demo de Retail, ADR-062).
// Una instalación arranca con el seed base; desde acá el Supervisor puede cargar el demo para evaluar la app
// y vaciarlo antes de operar en serio.
export function ConfigDatosDemo() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      setEstado((await (bridge() as any).demoCatalog.estado()) as Estado);
    } catch (e) {
      setError(traducirError(e).mensaje);
    }
  }, []);

  useEffect(() => { void cargarEstado(); }, [cargarEstado]);

  async function handleCargar() {
    setBusy(true); setError(null); setOk(null);
    try {
      const r = await (bridge() as any).demoCatalog.seedHeladeria();
      if (r.yaHabiaCatalogo) setError('El catálogo ya tiene productos: el demo solo se carga sobre un catálogo vacío.');
      else setOk('Se cargó el catálogo demo de heladería.');
      setEstado(r.estado as Estado);
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally {
      setBusy(false);
    }
  }

  async function handleVaciar() {
    setBusy(true); setError(null); setOk(null); setConfirmando(false);
    try {
      const r = await (bridge() as any).demoCatalog.vaciar();
      setOk(`Se eliminaron ${r.eliminados} registros demo.`);
      setEstado(r.estado as Estado);
    } catch (e) {
      setError(traducirError(e).mensaje);
      void cargarEstado();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 640, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Datos demo</h2>
      <p className="text-muted" style={{ margin: 0 }}>
        El catálogo demo carga insumos, 8 sabores con receta, envases y productos de venta de una heladería para
        probar el sistema. Podés vaciarlo antes de cargar tus datos reales.
      </p>

      {estado && (
        <div>
          {estado.hayDemo
            ? <span>Hay datos demo cargados: {estado.articulosDemo} artículos y {estado.productosDemo} productos de venta.</span>
            : <span>No hay datos demo cargados.</span>}
          {estado.hayCatalogo && !estado.hayDemo && (
            <div className="text-muted">El demo solo se carga sobre un catálogo vacío.</div>
          )}
          {estado.enUso.length > 0 && (
            <div className="text-muted">Ya se usaron en: {estado.enUso.join(', ')}. Por eso no se pueden vaciar.</div>
          )}
        </div>
      )}

      {error && <div role="alert" style={{ color: 'var(--danger, #b00020)' }}>{error}</div>}
      {ok && <div role="status">{ok}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-primary" disabled={busy || !estado || estado.hayCatalogo} onClick={handleCargar}>
          Cargar catálogo demo
        </button>
        {!confirmando && (
          <button type="button" className="btn-secondary" disabled={busy || !estado?.hayDemo} onClick={() => setConfirmando(true)}>
            Vaciar datos demo
          </button>
        )}
        {confirmando && (
          <>
            <button type="button" className="btn-danger" disabled={busy} onClick={handleVaciar}>Confirmar vaciado</button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmando(false)}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
