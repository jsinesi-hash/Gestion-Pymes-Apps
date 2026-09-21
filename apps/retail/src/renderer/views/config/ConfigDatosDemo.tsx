import { useState, useEffect, useCallback } from 'react';

type Estado = {
  totalProductos: number;
  productosDemo: number;
  hayProductos: boolean;
  hayDemo: boolean;
};

// ADR-062: carga/vaciado a demanda del catálogo demo genérico. Una instalación arranca
// en blanco; desde acá el Supervisor puede cargar 15 productos de muestra para evaluar la
// app, y vaciarlos antes de operar en serio.
export function ConfigDatosDemo() {
  const [estado, setEstado]   = useState<Estado | null>(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [ok, setOk]           = useState<string | null>(null);

  const cargarEstado = useCallback(async () => {
    try {
      const e = await (globalThis as any).ferreteria.demoCatalog.estado();
      setEstado(e);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo leer el estado del catálogo.');
    }
  }, []);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  async function handleCargar() {
    setBusy(true); setError(null); setOk(null);
    try {
      const res = await (globalThis as any).ferreteria.demoCatalog.cargar();
      if (res.yaHabiaProductos) {
        setError('El catálogo ya tiene productos: el demo sólo se carga sobre un catálogo vacío.');
      } else {
        setOk(`Se cargaron ${res.sembrados} productos demo.`);
      }
      setEstado(res.estado);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar el catálogo demo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVaciar() {
    if (!confirm('¿Vaciar el catálogo demo? Se eliminarán los productos de muestra (no toca los productos que hayas cargado vos). Esta acción no se puede deshacer.')) return;
    setBusy(true); setError(null); setOk(null);
    try {
      const res = await (globalThis as any).ferreteria.demoCatalog.vaciar();
      setOk(`Se eliminaron ${res.eliminados} productos demo.`);
      setEstado(res.estado);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo vaciar el catálogo demo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Datos demo</h2>
      <p className="text-sm text-muted" style={{ marginBottom: 20, lineHeight: 1.5 }}>
        Cargá un catálogo de muestra (15 productos de ferretería con precio, stock y algún
        caso borde) para probar la app. No es dato real: vacialo antes de empezar a operar.
        Sólo se puede cargar sobre un catálogo vacío.
      </p>

      <section style={{ padding: '16px 20px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)' }}>Estado del catálogo</h3>
        {estado === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          <p className="text-sm" data-testid="demo-estado" style={{ lineHeight: 1.6 }}>
            {estado.hayProductos
              ? <>El catálogo tiene <strong>{estado.totalProductos}</strong> producto(s){estado.hayDemo ? <>, de los cuales <strong>{estado.productosDemo}</strong> son demo.</> : <> (ninguno es demo).</>}</>
              : <>El catálogo está <strong>vacío</strong>.</>}
          </p>
        )}
      </section>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          className="btn-primary"
          onClick={handleCargar}
          disabled={busy || !!estado?.hayProductos}
          title={estado?.hayProductos ? 'El catálogo ya tiene productos' : undefined}
          style={{ opacity: (busy || estado?.hayProductos) ? .6 : 1, cursor: (busy || estado?.hayProductos) ? 'not-allowed' : 'pointer' }}
        >
          {busy ? 'Procesando…' : 'Cargar catálogo demo'}
        </button>
        <button
          className="btn-danger"
          onClick={handleVaciar}
          disabled={busy || !estado?.hayDemo}
          style={{ opacity: (busy || !estado?.hayDemo) ? .6 : 1, cursor: (busy || !estado?.hayDemo) ? 'not-allowed' : 'pointer' }}
        >
          Vaciar catálogo demo
        </button>
      </div>

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
    </div>
  );
}
