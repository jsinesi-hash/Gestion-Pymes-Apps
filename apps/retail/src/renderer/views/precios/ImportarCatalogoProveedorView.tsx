import React, { useState, useEffect, useRef } from 'react';
import { useImportacionCatalogo } from '../../hooks/useImportacionCatalogo';
import { useEscapeToClose } from '@core/ui';
import { formatCurrency } from '@core/ui';

type Proveedor = { id: string; razon_social: string; codigo: string | null };

export type FilaCatalogo = {
  fila_num: number;
  gtin_archivo: string | null;
  codigo_producto_prov: string | null;
  codigo_interno_archivo: string | null;
  producto_id: string | null;
  nombre_producto: string | null;
  sku_producto: string | null;
  matched_by: 'gtin' | 'codigo_interno' | 'similitud' | null;
  costo_centavos: number | null;
  costo_anterior_centavos: number | null;
  accion: 'crear' | 'actualizar' | 'sin_matchear' | 'error';
  motivo: string | null;
  datos: Record<string, string>;
  // ADR-063 Lote 4: candidatos por similitud de nombre (sólo filas sin_matchear).
  nombre_producto_archivo?: string | null;
  candidatos?: { producto_id: string; sku: string; nombre_corto: string; score: number }[];
};

const ACCION_BADGE: Record<FilaCatalogo['accion'], { label: string; color: string; bg: string; border: string }> = {
  crear:        { label: 'Crear vínculo', color: 'var(--ok)',     bg: 'rgba(46,125,82,.1)',  border: 'rgba(46,125,82,.2)' },
  actualizar:   { label: 'Actualizar',    color: 'var(--accent-strong)', bg: 'var(--accent-soft)', border: 'rgba(232,115,10,.25)' },
  sin_matchear: { label: 'Sin identificar', color: 'var(--warn)',  bg: 'rgba(180,105,14,.1)', border: 'rgba(180,105,14,.2)' },
  error:        { label: 'Error',         color: 'var(--danger)', bg: 'rgba(192,57,43,.08)', border: 'rgba(192,57,43,.15)' },
};

const STEPS = ['Archivo y proveedor', 'Previsualizar', 'Aplicado'];

const TEMPLATE_CSV =
  'EAN;COD_PRODUCTO_PROV;COD_INTERNO;DESCRIPCION;COSTO\n' +
  '7798000001234;A-1001;;Ejemplo Tornillo hexagonal M6x20;125.50\n' +
  ';A-1002;P-0000123-4;Ejemplo Clavo 2" (identificado por código interno);38.00\n' +
  '7798000001235;A-1003;;Ejemplo Producto sin costo (solo vínculo);\n';

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'plantilla-catalogo-proveedor.csv'; a.click();
  URL.revokeObjectURL(url);
}

type Resultado = { creados: number; actualizados: number; sin_identificar: number; errores: number; preferidos_asignados: number };
export type FilaImpactada = FilaCatalogo & { preferido_asignado: boolean };
type ProductoConsulta = { id: string; sku: string; gtin_barcode: string | null; nombre_corto: string; codigo_proveedor: string | null };
type FiltroImpacto = 'all' | 'crear' | 'actualizar' | 'preferido' | 'sin_matchear' | 'error';

export function ImportarCatalogoProveedorView() {
  const ipc = useImportacionCatalogo();
  const [step, setStep] = useState<'seleccion' | 'preview' | 'confirmado'>('seleccion');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [filePath, setFilePath] = useState('');
  const [filas, setFilas] = useState<FilaCatalogo[]>([]);
  const [filtro, setFiltro] = useState<'all' | FilaCatalogo['accion']>('all');
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [filasImpactadas, setFilasImpactadas] = useState<FilaImpactada[]>([]);
  const [filtroImpacto, setFiltroImpacto] = useState<FiltroImpacto>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-054: buscador "Consultar productos" (solo lectura, espejo del de Importar Costos).
  const [modalBuscar, setModalBuscar] = useState(false);
  const [buscarQuery, setBuscarQuery] = useState('');
  const [buscarResultados, setBuscarResultados] = useState<ProductoConsulta[]>([]);
  const buscarDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEscapeToClose(() => setModalBuscar(false), modalBuscar);

  useEffect(() => {
    (window as any).ferreteria.compras.proveedor.list().then((list: Proveedor[]) =>
      setProveedores(list.filter((p: any) => p.activo !== false)),
    );
  }, []);

  const proveedorActual = proveedores.find(p => p.id === proveedorId) ?? null;
  const currentStep = step === 'seleccion' ? 0 : step === 'preview' ? 1 : 2;

  async function handleSeleccionarArchivo() {
    const p = await ipc.seleccionarArchivo();
    if (p) setFilePath(p);
  }

  async function handleSiguiente() {
    if (!proveedorId || !filePath) { setError('Seleccioná proveedor y archivo.'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await ipc.parseArchivo({ filePath, proveedorId }) as { filas: FilaCatalogo[] };
      setFilas(res.filas);
      setStep('preview');
    } catch (e: any) {
      setError(e.message ?? 'Error al parsear el archivo.');
    } finally { setLoading(false); }
  }

  async function handleEditarCelda(filaNum: number, datos: Record<string, string>) {
    try {
      const r = await ipc.revalidarFila({ proveedorId, datos }) as Omit<FilaCatalogo, 'fila_num' | 'datos'>;
      setFilas(prev => prev.map(f => f.fila_num === filaNum ? { ...f, datos, ...r } : f));
    } catch (e: any) {
      setError(e.message ?? 'Error al re-validar la fila.');
    }
  }

  // ADR-063 Lote 4: aceptar un candidato por similitud convierte una fila sin_matchear en un
  // vínculo (actualizar). No crea productos; el gate humano es este click. Nada se persiste
  // hasta Confirmar. matched_by='similitud' para el historial.
  function aceptarCandidato(filaNum: number, c: { producto_id: string; sku: string; nombre_corto: string }) {
    setFilas(prev => prev.map(f => f.fila_num === filaNum
      ? { ...f, producto_id: c.producto_id, nombre_producto: c.nombre_corto, sku_producto: c.sku,
          accion: 'actualizar', matched_by: 'similitud', motivo: null }
      : f));
  }

  async function handleConfirmar() {
    setLoading(true);
    try {
      const nombreArchivo = filePath.split(/[\\/]/).pop() || filePath;
      const r = await ipc.confirmar({ proveedorId, nombreArchivo, filas }) as Resultado & { filas?: FilaImpactada[] };
      setResultado(r);
      setFilasImpactadas(r.filas ?? []);
      setFiltroImpacto('all');
      setStep('confirmado');
    } catch (e: any) {
      setError(e.message ?? 'Error al confirmar.');
    } finally { setLoading(false); setModalConfirmar(false); }
  }

  function handleBuscar(value: string) {
    setBuscarQuery(value);
    if (buscarDebounceRef.current) clearTimeout(buscarDebounceRef.current);
    if (value.trim().length < 2) { setBuscarResultados([]); return; }
    buscarDebounceRef.current = setTimeout(async () => {
      const res = await ipc.buscarProductos({ proveedorId, busqueda: value.trim() }) as ProductoConsulta[];
      setBuscarResultados(res ?? []);
    }, 250);
  }

  function abrirBuscador() {
    setBuscarQuery(''); setBuscarResultados([]); setModalBuscar(true);
  }

  // ADR-054: exporta las filas impactadas del filtro activo como CSV.
  function exportarImpactados() {
    const rows = filasImpactadasFiltradas;
    const esc = (v: string | number | null) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Linea', 'Producto', 'SKU', 'COD_PRODUCTO_PROV', 'Costo', 'Estado', 'Preferido'];
    const lines = rows.map(f => [
      f.fila_num,
      f.nombre_producto ?? '',
      f.sku_producto ?? '',
      f.codigo_producto_prov ?? '',
      f.costo_centavos != null ? (f.costo_centavos / 100).toFixed(2) : '',
      f.accion,
      f.preferido_asignado ? 'sí' : '',
    ].map(esc).join(';'));
    const csv = [header.join(';'), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `impactados-catalogo-${filtroImpacto}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep('seleccion'); setProveedorId(''); setFilePath(''); setFilas([]); setResultado(null); setFiltro('all');
    setFilasImpactadas([]); setFiltroImpacto('all');
  }

  const counts = {
    all: filas.length,
    crear: filas.filter(f => f.accion === 'crear').length,
    actualizar: filas.filter(f => f.accion === 'actualizar').length,
    sin_matchear: filas.filter(f => f.accion === 'sin_matchear').length,
    error: filas.filter(f => f.accion === 'error').length,
  };
  const aplicables = counts.crear + counts.actualizar;
  const filasFiltradas = filas.filter(f => filtro === 'all' || f.accion === filtro);
  const columnas = filas.length > 0 ? Object.keys(filas[0].datos) : [];

  // ADR-054: filas impactadas (post-confirmación) filtradas por chip.
  const impactoCounts = {
    all: filasImpactadas.length,
    crear: filasImpactadas.filter(f => f.accion === 'crear').length,
    actualizar: filasImpactadas.filter(f => f.accion === 'actualizar').length,
    preferido: filasImpactadas.filter(f => f.preferido_asignado).length,
    sin_matchear: filasImpactadas.filter(f => f.accion === 'sin_matchear').length,
    error: filasImpactadas.filter(f => f.accion === 'error').length,
  };
  const filasImpactadasFiltradas = filasImpactadas.filter(f =>
    filtroImpacto === 'all' ? true
    : filtroImpacto === 'preferido' ? f.preferido_asignado
    : f.accion === filtroImpacto,
  );

  const chip = (key: 'all' | FilaCatalogo['accion'], label: string, color: string) => (
    <button key={key} type="button" onClick={() => setFiltro(key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
        padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${filtro === key ? 'var(--accent)' : 'var(--line)'}`,
        background: filtro === key ? 'var(--accent-soft)' : 'var(--surface)',
        color: filtro === key ? 'var(--accent-strong)' : 'var(--ink-2)',
      }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      {label} ({key === 'all' ? counts.all : counts[key]})
    </button>
  );

  return (
    <div className="flex-col gap-4" style={{ height: '100%', position: 'relative' }}>
      <div className="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: 0, flexShrink: 0, padding: 'var(--pad)' }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, background: i < currentStep ? 'var(--ok)' : i === currentStep ? 'var(--accent)' : 'var(--surface-2)', color: i <= currentStep ? '#fff' : 'var(--ink-3)', border: i > currentStep ? '1.5px solid var(--line)' : 'none' }}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: i === currentStep ? 'var(--ink)' : i < currentStep ? 'var(--ok)' : 'var(--ink-3)' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1.5, background: i < currentStep ? 'var(--ok)' : 'var(--line)', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}

      {proveedorActual && step !== 'seleccion' && (
        <div className="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, padding: '10px var(--pad)' }}>
          <span className="text-sm text-muted">Proveedor:</span>
          <strong>{proveedorActual.razon_social}</strong>
          {proveedorActual.codigo && <span className="tag num">{proveedorActual.codigo}</span>}
        </div>
      )}

      {/* PASO 1 */}
      {step === 'seleccion' && (
        <div className="panel" style={{ flex: 1 }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', gap: '1.1rem' }}>
            <div className="field" style={{ width: '100%', maxWidth: 320 }}>
              <label>PROVEEDOR</label>
              <select className="input" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
                <option value="">— Seleccioná un proveedor —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
            </div>

            <div style={{ width: '100%', maxWidth: 640 }}>
              <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
                Asocia productos de tu catálogo a este proveedor con el <strong>código del producto del proveedor</strong> y (opcional) su costo. Columnas esperadas:
              </p>
              <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 120 }}>
                <table style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>EAN</th>
                      <th>COD_PRODUCTO_PROV <span style={{ color: 'var(--danger)' }}>*</span></th>
                      <th>COD_INTERNO</th>
                      <th>DESCRIPCION</th>
                      <th>COSTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
                      <td>7798000001234</td><td>A-1001</td><td>—</td><td>Ejemplo Tornillo M6x20</td><td>125.50</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                <span><span style={{ color: 'var(--danger)' }}>*</span> obligatorio</span>
                <span>el producto se identifica por EAN o código interno (no se crean productos nuevos)</span>
                <span>COSTO es opcional</span>
              </div>
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <button type="button" onClick={downloadTemplate} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                  ↓ Descargar plantilla .csv de ejemplo
                </button>
              </div>
            </div>

            <div
              role="button" aria-label="Seleccionar archivo CSV o XLSX" tabIndex={0}
              onClick={handleSeleccionarArchivo}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleSeleccionarArchivo(); }}
              style={{ width: '100%', maxWidth: 640, border: '2px dashed var(--line)', borderRadius: 16, padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', cursor: 'pointer', textAlign: 'center' }}
            >
              <div className="font-bold" style={{ fontSize: '1rem' }}>Elegir archivo</div>
              <div className="text-muted text-sm">Hacé clic para elegir un archivo (.csv o .xlsx)</div>
              {filePath && <div className="text-sm num" style={{ fontWeight: 600 }}>{filePath}</div>}
            </div>

            <button type="button" className="btn-primary" onClick={handleSiguiente}
              disabled={loading || !proveedorId || !filePath}
              style={{ opacity: loading || !proveedorId || !filePath ? 0.5 : 1 }}>
              {loading ? 'Procesando…' : 'Siguiente →'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 2 — preview */}
      {step === 'preview' && (
        <div className="panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="toolbar" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {chip('all', 'Todos', 'var(--ink-3)')}
              {chip('crear', 'Crear vínculo', 'var(--ok)')}
              {chip('actualizar', 'Actualizar', 'var(--accent)')}
              {chip('sin_matchear', 'Sin identificar', 'var(--warn)')}
              {chip('error', 'Error', 'var(--danger)')}
            </div>
            <div className="ml-auto" style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={abrirBuscador}>Consultar productos</button>
              <button type="button" className="btn-secondary" onClick={reset}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={() => setModalConfirmar(true)}
                disabled={loading || aplicables === 0} style={{ opacity: loading || aplicables === 0 ? 0.5 : 1 }}>
                {`Confirmar (${aplicables}) →`}
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Línea</th>
                  {columnas.map(c => <th key={c}>{c}</th>)}
                  <th>Producto</th>
                  <th className="r">Costo anterior</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map(f => (
                  <tr key={f.fila_num}>
                    <td><span className="num text-muted" style={{ fontSize: 11.5 }}>{f.fila_num}</span></td>
                    {columnas.map(c => (
                      <td key={c} contentEditable suppressContentEditableWarning
                        style={{ fontFamily: 'var(--mono-font)', fontSize: 13, cursor: 'text' }}
                        onBlur={e => handleEditarCelda(f.fila_num, { ...f.datos, [c]: e.currentTarget.textContent ?? '' })}>
                        {f.datos[c]}
                      </td>
                    ))}
                    <td className="text-muted" style={{ fontSize: 12.5 }}>
                      {f.nombre_producto
                        ? <>{f.nombre_producto}{f.sku_producto ? <span className="num text-muted"> ({f.sku_producto})</span> : null}{f.matched_by === 'similitud' && <span title="Asignado por similitud" style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--accent-strong)' }}>~sim</span>}</>
                        : (f.accion === 'sin_matchear' && f.candidatos && f.candidatos.length > 0)
                          ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {f.candidatos.slice(0, 3).map(c => (
                                <div key={c.producto_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button type="button" className="btn-secondary" style={{ fontSize: 10.5, padding: '2px 7px' }}
                                    onClick={() => aceptarCandidato(f.fila_num, c)}>
                                    Asignar
                                  </button>
                                  <span style={{ fontSize: 12 }}>{c.nombre_corto}</span>
                                  <span className="num text-muted" style={{ fontSize: 11 }}>{c.sku}</span>
                                  <span className="num" style={{ fontSize: 11, color: 'var(--accent-strong)', fontWeight: 700 }}>{Math.round(c.score * 100)}%</span>
                                </div>
                              ))}
                            </div>
                          )
                          : '—'}
                    </td>
                    <td className="r text-muted" style={{ fontSize: 12.5 }}>{f.costo_anterior_centavos != null ? formatCurrency(f.costo_anterior_centavos) : '—'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: ACCION_BADGE[f.accion].color, background: ACCION_BADGE[f.accion].bg, border: `1px solid ${ACCION_BADGE[f.accion].border}` }}>
                        {ACCION_BADGE[f.accion].label}
                      </span>
                      {f.motivo && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3, maxWidth: 240 }}>{f.motivo}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '12px var(--pad)', borderTop: '1px solid var(--line)', flexShrink: 0, fontSize: 13, color: 'var(--ink-2)' }}>
            Las celdas son editables — corregí un EAN o código interno y la fila se vuelve a identificar. Un producto que no está en tu catálogo queda <strong>sin identificar</strong> (creá el producto primero). Si el producto no tenía proveedor preferido, este queda como preferido; si ya tenía uno, no se toca.
          </div>
        </div>
      )}

      {modalConfirmar && (
        <div className="modal-overlay" role="dialog" aria-label="Confirmar catálogo">
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Confirmar catálogo</span></div>
            <div className="modal-body">
              <p>Se van a <strong>crear {counts.crear}</strong> y <strong>actualizar {counts.actualizar}</strong> vínculos con <strong>{proveedorActual?.razon_social ?? ''}</strong>.</p>
              <p className="text-sm text-muted">A los productos que hoy no tienen proveedor preferido, este proveedor les queda como preferido.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setModalConfirmar(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleConfirmar} disabled={loading}>{loading ? 'Aplicando…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consultar productos (solo lectura) */}
      {modalBuscar && (
        <div className="modal-overlay" role="dialog" aria-label="Consultar productos" onClick={e => { if (e.target === e.currentTarget) setModalBuscar(false); }}>
          <div className="modal" style={{ width: 520 }}>
            <div className="modal-header">
              <span className="modal-title">Consultar productos</span>
              <button type="button" className="icon-btn" onClick={() => setModalBuscar(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
                Buscá un producto del catálogo por nombre, SKU o EAN. Se muestra el código que este proveedor ya tiene para el producto (si está vinculado).
              </p>
              <div className="field">
                <label>BUSCAR PRODUCTO</label>
                <div className="search" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input autoFocus value={buscarQuery} onChange={e => handleBuscar(e.target.value)} placeholder="Nombre, SKU o EAN…" />
                </div>
              </div>
              {buscarResultados.length > 0 && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                  {buscarResultados.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px var(--pad)', borderBottom: i < buscarResultados.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre_corto}</div>
                        <div className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{p.sku}{p.gtin_barcode ? ` · EAN ${p.gtin_barcode}` : ''}</div>
                      </div>
                      {p.codigo_proveedor
                        ? <span className="tag num" title="Código de este proveedor">{p.codigo_proveedor}</span>
                        : <span className="text-xs text-muted">sin vincular</span>}
                    </div>
                  ))}
                </div>
              )}
              {buscarQuery.trim().length >= 2 && buscarResultados.length === 0 && (
                <div className="text-sm text-muted" style={{ padding: '8px 2px' }}>Sin resultados.</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setModalBuscar(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 3 — resultado */}
      {step === 'confirmado' && resultado && (
        <div className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem var(--pad) 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ok)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>✓</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>Catálogo aplicado</div>
                <div className="text-sm text-muted">Se actualizaron las relaciones producto-proveedor.</div>
              </div>
            </div>
          </div>
          <div style={{ padding: 'var(--pad)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div className="tag" style={{ fontSize: 13 }}>Vínculos creados: <strong>{resultado.creados}</strong></div>
            <div className="tag" style={{ fontSize: 13 }}>Actualizados: <strong>{resultado.actualizados}</strong></div>
            <div className="tag" style={{ fontSize: 13 }}>Preferido asignado: <strong>{resultado.preferidos_asignados}</strong></div>
            {resultado.sin_identificar > 0 && <div className="tag" style={{ fontSize: 13, color: 'var(--warn)' }}>Sin identificar: <strong>{resultado.sin_identificar}</strong></div>}
            {resultado.errores > 0 && <div className="tag" style={{ fontSize: 13, color: 'var(--danger)' }}>Con error: <strong>{resultado.errores}</strong></div>}
          </div>

          {/* ADR-054: tabla única de productos impactados con chips de filtro + export */}
          <div className="toolbar" style={{ borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {([
              ['all', 'Todos', 'var(--ink-3)'],
              ['crear', 'Creados', 'var(--ok)'],
              ['actualizar', 'Actualizados', 'var(--accent)'],
              ['preferido', 'Preferido', 'var(--accent-strong)'],
              ['sin_matchear', 'Sin identificar', 'var(--warn)'],
              ['error', 'Con error', 'var(--danger)'],
            ] as [FiltroImpacto, string, string][])
              .filter(([key]) => key === 'all' || impactoCounts[key] > 0)
              .map(([key, label, color]) => (
                <button key={key} type="button" onClick={() => setFiltroImpacto(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${filtroImpacto === key ? 'var(--accent)' : 'var(--line)'}`,
                    background: filtroImpacto === key ? 'var(--accent-soft)' : 'var(--surface)',
                    color: filtroImpacto === key ? 'var(--accent-strong)' : 'var(--ink-2)',
                  }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                  {label} ({impactoCounts[key]})
                </button>
              ))}
            <button type="button" className="btn-secondary" style={{ marginLeft: 'auto' }}
              onClick={exportarImpactados} disabled={filasImpactadasFiltradas.length === 0}>
              ↓ Exportar CSV
            </button>
          </div>

          <div className="table-wrap">
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>Producto</th>
                  <th>COD_PRODUCTO_PROV</th>
                  <th className="r">Costo</th>
                  <th className="c">Preferido</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasImpactadasFiltradas.map(f => (
                  <tr key={f.fila_num}>
                    <td><span className="num text-muted" style={{ fontSize: 11.5 }}>{f.fila_num}</span></td>
                    <td className="text-muted" style={{ fontSize: 12.5 }}>
                      {f.nombre_producto ?? '—'}{f.sku_producto ? <span className="num text-muted"> ({f.sku_producto})</span> : null}
                    </td>
                    <td className="num" style={{ fontSize: 12.5 }}>{f.codigo_producto_prov ?? '—'}</td>
                    <td className="r" style={{ fontSize: 12.5 }}>{f.costo_centavos != null ? formatCurrency(f.costo_centavos) : '—'}</td>
                    <td className="c">{f.preferido_asignado ? '★' : ''}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: ACCION_BADGE[f.accion].color, background: ACCION_BADGE[f.accion].bg, border: `1px solid ${ACCION_BADGE[f.accion].border}` }}>
                        {ACCION_BADGE[f.accion].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '14px var(--pad)', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <button type="button" className="btn-primary" onClick={reset}>Nueva importación</button>
          </div>
        </div>
      )}
    </div>
  );
}
