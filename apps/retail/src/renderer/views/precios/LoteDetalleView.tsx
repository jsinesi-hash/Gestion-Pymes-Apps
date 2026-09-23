import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@core/ui';

// ADR-049 §4/§8 — detalle de un lote: reporte de impacto + tabla + acciones.

const f = () => (globalThis as any).ferreteria;

type Batch = {
  id: string; lista_precio_id: string; lista_nombre: string | null; proveedor_id: string | null; origen: string;
  estado: string; productos_ok: number; advertencias: number; errores: number; excluidas: number;
  impacto_incremento_centavos: number; fecha_creacion: number;
};
type Fila = {
  id: string; producto_id: string; nombre_corto: string; sku: string;
  costo_neto_centavos: number | null; precio_anterior_centavos: number | null;
  precio_propuesto_centavos: number; margen_nuevo_pct: number | null;
  regla_precio_id: string | null; variacion_pct: number | null;
  estado_validacion: 'ok' | 'advertencia' | 'error' | 'excluida'; motivo_validacion: string | null;
};

const VAL_BADGE: Record<string, string> = { ok: 'ok', advertencia: 'warn', error: 'err', excluida: 'off' };
const VAL_LABEL: Record<string, string> = { ok: 'OK', advertencia: 'Advertencia', error: 'Error', excluida: 'Excluida' };

function ars(c: number | null) {
  if (c == null) return '—';
  return '$ ' + (c / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function Kpi({ label, value, tone }: Readonly<{ label: string; value: string | number; tone?: string }>) {
  return (
    <div className="card" style={{ padding: '12px 16px', minWidth: 120 }}>
      <div className="text-xs text-muted">{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: tone }}>{value}</div>
    </div>
  );
}

export function LoteDetalleView() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  // Volver al listado del contexto actual: dentro del hub conserva las pestañas.
  const { pathname } = useLocation();
  const lotesBase = pathname.startsWith('/precios/hub') ? '/precios/hub/lotes' : '/precios/lotes';
  const [batch, setBatch] = useState<Batch | null>(null);
  const [detalle, setDetalle] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [filtroVal, setFiltroVal] = useState<string>('todas');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await f().precios.batch.obtener(id);
      setBatch(res?.batch ?? null);
      setDetalle(res?.detalle ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function accion(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); }
    catch (e: any) { setError(e?.message ?? 'Error'); }
    finally { setBusy(false); }
  }

  const filas = useMemo(() => {
    let r = detalle;
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(d => d.nombre_corto.toLowerCase().includes(s) || d.sku.toLowerCase().includes(s));
    }
    if (filtroVal !== 'todas') r = r.filter(d => d.estado_validacion === filtroVal);
    return r;
  }, [detalle, q, filtroVal]);

  if (loading) return <div style={{ padding: 'var(--pad)', opacity: 0.5 }}>Cargando...</div>;
  if (!batch) return (
    <div className="flex-col gap-4">
      <Link className="back" to={lotesBase}>← Lotes de precios</Link>
      <p className="text-muted">Lote no encontrado.</p>
    </div>
  );

  const puedeAprobar = can('precio.aprobar');
  const puedeGestionar = can('config.fiscal');
  const hayErrores = batch.errores > 0;

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <Link className="back" to={lotesBase}>← Lotes de precios</Link>
        <h1 style={{ fontSize: 21 }}>Lote #{batch.id.slice(0, 8)}</h1>
        <div className="text-muted text-sm">Lista: {batch.lista_nombre ?? '—'}</div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Kpi label="Estado" value={batch.estado} />
        <Kpi label="OK" value={batch.productos_ok} tone="var(--color-success, #10b981)" />
        <Kpi label="Advertencias" value={batch.advertencias} tone="var(--color-warning, #d97706)" />
        <Kpi label="Errores" value={batch.errores} {...(hayErrores ? { tone: 'var(--color-danger, #dc2626)' } : {})} />
        <Kpi label="Excluidas" value={batch.excluidas} />
        <Kpi label="Impacto" value={ars(batch.impacto_incremento_centavos)} />
      </div>

      {/* Acciones según estado + permiso */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(batch.estado === 'validado' || batch.estado === 'validacion_fallida') && (
          <>
            {puedeGestionar && (
              <button className="btn-secondary" disabled={busy}
                onClick={() => accion(() => f().precios.batch.revalidar(batch.id))}>
                Re-validar
              </button>
            )}
            {hayErrores && puedeGestionar && (
              <button className="btn-secondary" disabled={busy}
                onClick={() => accion(() => f().precios.batch.excluirErrores(batch.id))}>
                Excluir errores
              </button>
            )}
            <button className="btn-primary" disabled={busy || hayErrores || !puedeAprobar}
              onClick={() => accion(() => f().precios.batch.aprobar(batch.id))}>
              Aprobar
            </button>
            {hayErrores && (
              <span className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
                Hay {batch.errores} fila{batch.errores !== 1 ? 's' : ''} en error: excluilas para poder aprobar.
              </span>
            )}
            {!puedeAprobar && !hayErrores && (
              <span className="text-sm text-muted">Requiere permiso de aprobación (Supervisor).</span>
            )}
          </>
        )}
        {batch.estado === 'aprobado' && puedeAprobar && (
          <button className="btn-primary" disabled={busy}
            onClick={() => accion(() => f().precios.batch.publicar(batch.id))}>
            Publicar
          </button>
        )}
        {batch.estado === 'publicado' && puedeAprobar && (
          <button className="btn-secondary" disabled={busy}
            onClick={() => accion(() => f().precios.batch.revertir(batch.id))}>
            Revertir
          </button>
        )}
      </div>

      <div className="toolbar" style={{ background: 'none', border: 'none', padding: 0, gap: 8 }}>
        <input className="input" style={{ width: 240 }} placeholder="Buscar por nombre o SKU…"
          value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" aria-label="filtro validación" value={filtroVal} onChange={e => setFiltroVal(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="ok">OK</option>
          <option value="advertencia">Advertencia</option>
          <option value="error">Error</option>
          <option value="excluida">Excluida</option>
        </select>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="r">Costo neto</th>
                <th className="r">Precio anterior</th>
                <th className="r">Precio nuevo</th>
                <th className="r">Margen</th>
                <th className="r">Variación</th>
                <th>Validación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(d => (
                <tr key={d.id}>
                  <td>
                    <Link to={`/productos/${d.producto_id}`} className="crumb-link" style={{ fontWeight: 500 }}>
                      {d.nombre_corto}
                    </Link>
                    <div className="num text-xs text-muted">{d.sku}</div>
                  </td>
                  <td className="r num">{ars(d.costo_neto_centavos)}</td>
                  <td className="r num">{ars(d.precio_anterior_centavos)}</td>
                  <td className="r num" style={{ fontWeight: 700 }}>{ars(d.precio_propuesto_centavos)}</td>
                  <td className="r num text-muted">{d.margen_nuevo_pct != null ? `${d.margen_nuevo_pct.toFixed(1)}%` : '—'}</td>
                  <td className="r num">{d.variacion_pct != null ? `${d.variacion_pct >= 0 ? '+' : ''}${d.variacion_pct.toFixed(1)}%` : '—'}</td>
                  <td>
                    <span className={`badge ${VAL_BADGE[d.estado_validacion]}`}><span className="bd" />{VAL_LABEL[d.estado_validacion]}</span>
                    {d.motivo_validacion && <div className="text-xs text-muted">{d.motivo_validacion}</div>}
                  </td>
                  <td>
                    {d.estado_validacion === 'error' && puedeGestionar
                      && (batch.estado === 'validado' || batch.estado === 'validacion_fallida') && (
                      <button className="ia del" aria-label="Excluir fila" title="Excluir del lote" disabled={busy}
                        onClick={() => accion(() => f().precios.batch.excluirFila(d.id))}>&#xd7;</button>
                    )}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, fontSize: 13 }}>Sin filas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
