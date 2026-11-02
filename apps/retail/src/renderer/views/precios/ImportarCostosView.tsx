import React, { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useImportacionCosto } from '../../hooks/useImportacionCosto';
import { formatCurrency, bridge, Modal } from '@core/ui';
import { useImportacionCostoWizard } from '../../context/ImportacionCostoWizardContext';
import { descargarReporteImportacion, type ColumnaReporte } from '../../lib/reporteImportacion';

type Proveedor = { id: string; razon_social: string; codigo: string | null };
export type FilaPreview = {
  fila_num: number;
  codigo_proveedor_archivo: string | null;
  gtin_archivo: string | null;
  codigo_interno_archivo: string | null;
  producto_id: string | null;
  nombre_producto: string | null;
  costo_anterior_centavos: number | null;
  costo_nuevo_centavos: number | null;
  estado: 'matched' | 'sin_matchear' | 'error_formato';
  matched_by: 'codigo_proveedor' | 'gtin' | 'codigo_interno' | 'similitud' | null;
  motivo: string | null;
  advertencia: string | null;
  nombre_producto_archivo?: string | null;
  candidatos?: { producto_id: string; sku: string; nombre_corto: string; score: number }[];
  datos: Record<string, string>;
};

export const ESTADO_PREVIEW: Record<FilaPreview['estado'], { label: string; color: string; bg: string; border: string }> = {
  matched:       { label: 'Identificado',     color: 'var(--ok)',     bg: 'rgba(46,125,82,.1)',  border: 'rgba(46,125,82,.2)' },
  error_formato: { label: 'Error de formato', color: 'var(--danger)', bg: 'rgba(192,57,43,.08)', border: 'rgba(192,57,43,.15)' },
  sin_matchear:  { label: 'Sin identificar',  color: 'var(--warn)',   bg: 'rgba(180,105,14,.1)', border: 'rgba(180,105,14,.2)' },
};

const STEPS = ['Archivo y proveedor', 'Previsualizar', 'Aplicado'];

function stepIndex(step: 'seleccion' | 'preview' | 'confirmado'): number {
  if (step === 'seleccion') return 0;
  if (step === 'preview') return 1;
  return 2;
}

// COD_PRODUCTO_PROV = el código que el PROVEEDOR le puso al producto (no nuestro SKU).
// COD_INTERNO = nuestro SKU interno. Cascada de matching: EAN → COD_PRODUCTO_PROV → COD_INTERNO.
const TEMPLATE_CSV =
  'EAN;COD_PRODUCTO_PROV;COD_INTERNO;DESCRIPCION;COSTO\n' +
  '7798000001234;A-1001;;Ejemplo Tornillo hexagonal M6x20;125.50\n' +
  ';A-1002;P-0000123-4;Ejemplo Clavo 2" (sin EAN, con código del proveedor);38.00\n' +
  '7798000001235;;;Ejemplo Producto identificado solo por EAN;210.75\n';

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-importacion-costos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Followup ADR-051: edición 100% en el frontend — ya no hay ningún detalle persistido
// en la base — recién se graba al Confirmar. Pero el RE-MATCHING sí necesita la base
// (buscar el producto por el EAN/código editado), así que al editar una celda se llama
// al handler importacionCosto:revalidarFila, que re-mapea y re-matchea la fila entera.

// producto_id que aparecen en más de una fila (mismo producto cargado dos veces). Se
// deriva en vivo de las filas — al confirmar, el último costo del duplicado pisa al
// anterior, así que se avisa para que el usuario corrija la lista antes.
function calcularDuplicados(filas: FilaPreview[]): Set<string> {
  const conteo = new Map<string, number>();
  for (const f of filas) {
    if (f.producto_id) conteo.set(f.producto_id, (conteo.get(f.producto_id) ?? 0) + 1);
  }
  const dup = new Set<string>();
  for (const [id, n] of conteo) if (n > 1) dup.add(id);
  return dup;
}

// Config por columna de datos (keyeada por el nombre de header del archivo, en mayúsculas):
// relabel de cabeceras largas + control de ancho. Las columnas "angostas" van con
// white-space:nowrap para que se ajusten al contenido; DESCRIPCION es la única que envuelve
// y absorbe el ancho sobrante, así ocupa menos líneas.
type ColCfg = { label?: string; th?: CSSProperties; td?: CSSProperties };
const NOWRAP: CSSProperties = { whiteSpace: 'nowrap' };
const COL_CFG: Record<string, ColCfg> = {
  EAN:               { th: NOWRAP, td: NOWRAP },
  COD_PRODUCTO_PROV: { label: 'COD_PROD_PROV', th: NOWRAP, td: NOWRAP },
  COD_INTERNO:       { label: 'SKU INT',       th: NOWRAP, td: NOWRAP },
  DESCRIPCION:       { th: { minWidth: 300 },  td: { minWidth: 300 } },
  COSTO:             { th: NOWRAP, td: NOWRAP },
};

export function CostoFilasTable({
  filas, editable, onEditarCelda, onAsignarCandidato, duplicados,
}: {
  filas: FilaPreview[];
  editable: boolean;
  onEditarCelda?: (filaNum: number, datos: Record<string, string>) => void;
  // Asignar un candidato sugerido por similitud (sólo en previsualización editable). Marca
  // la fila como matched por 'similitud' — nada se persiste hasta Confirmar.
  onAsignarCandidato?: (filaNum: number, c: { producto_id: string; sku: string; nombre_corto: string }) => void;
  // producto_id que aparecen en más de una fila (calculado en el padre). El costo del
  // duplicado no se aplica en silencio: se avisa acá.
  duplicados?: Set<string>;
}) {
  const columnas = filas.length > 0 ? Object.keys(filas[0].datos) : [];
  return (
    <div className="table-wrap">
      <table style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ width: '1%', textAlign: 'center', whiteSpace: 'nowrap' }}>Línea</th>
            {columnas.map(c => {
              const cfg = COL_CFG[c.toUpperCase()];
              return <th key={c} style={cfg?.th}>{cfg?.label ?? c}</th>;
            })}
            <th style={{ minWidth: 200 }}>Producto matcheado</th>
            <th className="r" style={NOWRAP}>Costo ant.</th>
            <th style={{ minWidth: 130 }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const esDuplicado = !!(f.producto_id && duplicados?.has(f.producto_id));
            return (
            <tr key={f.fila_num}>
              <td style={{ textAlign: 'center' }}><span className="num text-muted" style={{ fontSize: 11.5 }}>{f.fila_num}</span></td>
              {columnas.map(c => {
                const cfg = COL_CFG[c.toUpperCase()];
                return (
                <td
                  key={c}
                  contentEditable={editable}
                  suppressContentEditableWarning={editable}
                  style={{ fontFamily: 'var(--mono-font)', fontSize: 13, cursor: editable ? 'text' : 'default', ...cfg?.td }}
                  onBlur={editable ? (e => onEditarCelda?.(f.fila_num, { ...f.datos, [c]: e.currentTarget.textContent ?? '' })) : undefined}
                >
                  {f.datos[c]}
                </td>
                );
              })}
              <td className="text-muted" style={{ fontSize: 12.5 }}>
                {f.nombre_producto
                  ? <>{f.nombre_producto}{f.matched_by === 'similitud' && <span title="Asignado por similitud" style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--accent-strong)' }}>~sim</span>}</>
                  : (editable && f.estado === 'sin_matchear' && onAsignarCandidato && f.candidatos && f.candidatos.length > 0)
                    ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {f.candidatos.slice(0, 3).map(c => (
                          <div key={c.producto_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button type="button" className="btn-secondary" style={{ fontSize: 10.5, padding: '2px 7px' }}
                              onClick={() => onAsignarCandidato(f.fila_num, c)}>
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
              <td className="r text-muted" style={{ fontSize: 12.5 }}>
                {f.costo_anterior_centavos != null ? formatCurrency(f.costo_anterior_centavos) : '—'}
              </td>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: ESTADO_PREVIEW[f.estado].color, background: ESTADO_PREVIEW[f.estado].bg, border: `1px solid ${ESTADO_PREVIEW[f.estado].border}` }}>
                  {ESTADO_PREVIEW[f.estado].label}
                </span>
                {f.motivo && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3, maxWidth: 240 }}>{f.motivo}</div>
                )}
                {esDuplicado && (
                  <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 3, maxWidth: 240, fontWeight: 600 }}>
                    ⚠ Producto duplicado en el archivo — se aplicará el último costo. Revisá la lista.
                  </div>
                )}
                {!esDuplicado && f.advertencia && (
                  <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 3, maxWidth: 240, fontWeight: 600 }}>⚠ {f.advertencia}</div>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function descargarCsvCostos(filas: FilaPreview[], filtro: string) {
  const dinamicas = filas.length > 0 ? Object.keys(filas[0].datos) : [];
  const columnas: ColumnaReporte<FilaPreview>[] = [
    { header: 'fila', valor: f => f.fila_num },
    ...dinamicas.map(c => ({ header: c, valor: (f: FilaPreview) => f.datos[c] ?? '' })),
    { header: 'producto_matcheado', valor: f => f.nombre_producto ?? '' },
    { header: 'costo_anterior', valor: f => f.costo_anterior_centavos ?? '' },
    { header: 'estado', valor: f => f.estado },
    { header: 'motivo', valor: f => f.motivo ?? '' },
  ];
  descargarReporteImportacion(filas, columnas, `costos_${filtro}`);
}

type ProductoLookup = { id: string; sku: string; gtin_barcode: string | null; nombre_corto: string; codigo_proveedor: string | null };

function ConsultarProductosModal({ proveedorId, onClose }: { proveedorId: string; onClose: () => void }) {
  const ipc = useImportacionCosto();
  const [search, setSearch] = useState('');
  const [resultados, setResultados] = useState<ProductoLookup[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const items = await ipc.buscarProductos({ proveedorId, busqueda: value.trim() }) as ProductoLookup[];
        setResultados(items);
      } finally { setBuscando(false); }
    }, 300);
  }

  return (
    <Modal ariaLabel="Consultar productos" ancho={620} onClose={onClose} cerrarAlClickFuera>
      <div className="modal-header">
        <span className="modal-title">Consultar productos</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="modal-body">
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>
          Buscá por nombre, código interno (SKU) o EAN para chequear los datos de un producto sin salir de la importación. El código del proveedor es el que tiene guardado este producto para el proveedor de la carga.
        </p>
        <div className="field">
          <label>BUSCAR</label>
          <input
            autoFocus
            className="input"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Nombre, SKU o EAN…"
          />
        </div>
        {buscando && <div className="text-sm text-muted" style={{ marginTop: 8 }}>Buscando…</div>}
        {!buscando && resultados.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10, maxHeight: 320 }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr><th>Código interno</th><th>EAN</th><th>Cód. proveedor</th><th>Descripción</th></tr>
              </thead>
              <tbody>
                {resultados.map(p => (
                  <tr key={p.id}>
                    <td className="num">{p.sku}</td>
                    <td className="num">{p.gtin_barcode ?? '—'}</td>
                    <td className="num">{p.codigo_proveedor ?? '—'}</td>
                    <td>{p.nombre_corto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!buscando && search.trim().length >= 2 && resultados.length === 0 && (
          <div className="text-sm text-muted" style={{ marginTop: 8 }}>Sin resultados.</div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

export function ImportarCostosView() {
  const ipc = useImportacionCosto();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Ir al lote conservando el contexto (hub ↔ montaje plano), para no perder las pestañas.
  const lotesBase = pathname.startsWith('/precios/hub') ? '/precios/hub/lotes' : '/precios/lotes';
  const { wizard, setWizard, resetWizard } = useImportacionCostoWizard();
  const { step, proveedorId, filePath, filas, filterPreview, filterResultado, batchesGenerados } = wizard;

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [modalConfirmarAbierto, setModalConfirmarAbierto] = useState(false);
  const [modalConsultaAbierto, setModalConsultaAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bridge().compras.proveedor.list().then((list: Proveedor[]) =>
      setProveedores(list.filter((p: any) => p.activo !== false))
    );
  }, []);

  const proveedorActual = proveedores.find(p => p.id === proveedorId) ?? null;

  function setProveedorId(id: string) { setWizard(w => ({ ...w, proveedorId: id })); }
  function setFilePath(p: string) { setWizard(w => ({ ...w, filePath: p })); }
  function setStep(s: 'seleccion' | 'preview' | 'confirmado') { setWizard(w => ({ ...w, step: s })); }
  function setFilterPreview(f: 'all' | FilaPreview['estado'] | 'propuestos') { setWizard(w => ({ ...w, filterPreview: f })); }
  function setFilterResultado(f: 'all' | FilaPreview['estado']) { setWizard(w => ({ ...w, filterResultado: f })); }

  async function handleSeleccionarArchivo() {
    const p = await ipc.seleccionarArchivo();
    if (!p) return;
    setFilePath(p);
  }

  // followup ADR-051: "Siguiente" solo lee y calcula el matching — no escribe nada en
  // la base. Recién se persiste todo junto al Confirmar.
  async function handleSiguienteSeleccion() {
    if (!proveedorId || !filePath) { setError('Seleccioná proveedor y archivo.'); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await ipc.parseArchivo({ filePath, proveedorId });
      setWizard(w => ({ ...w, filas: result.filas, step: 'preview' }));
    } catch (e: any) {
      setError(e.message ?? 'Error al parsear el archivo.');
    } finally { setLoading(false); }
  }

  // Editar una celda (EAN, código de proveedor, código interno o costo) re-corre el
  // matching REAL contra la base — por eso es async y pasa por IPC. Corregir un EAN
  // inválido por uno válido ahora sí re-identifica el producto (fix del bug reportado).
  async function handleEditarCelda(filaNum: number, datos: Record<string, string>) {
    try {
      const r = await ipc.revalidarFila({ proveedorId, datos }) as {
        producto_id: string | null; nombre_producto: string | null;
        costo_anterior_centavos: number | null; costo_nuevo_centavos: number | null;
        estado: FilaPreview['estado']; matched_by: FilaPreview['matched_by']; motivo: string | null;
        advertencia: string | null;
        codigo_proveedor_archivo: string | null; gtin_archivo: string | null; codigo_interno_archivo: string | null;
        nombre_producto_archivo: string | null;
        candidatos: { producto_id: string; sku: string; nombre_corto: string; score: number }[];
      };
      setWizard(w => ({
        ...w,
        filas: w.filas.map(f => f.fila_num === filaNum ? { ...f, datos, ...r } : f),
      }));
    } catch (e: any) {
      setError(e.message ?? 'Error al re-validar la fila.');
    }
  }

  // Aceptar un candidato sugerido por similitud (client-side): la fila pasa a 'matched' por
  // 'similitud', para que cuente en Confirmar y se le aplique el costo del archivo. No hay
  // IPC ni persistencia hasta Confirmar. Se limpian candidatos/motivo de esa fila.
  function handleAsignarCandidato(filaNum: number, c: { producto_id: string; sku: string; nombre_corto: string }) {
    setWizard(w => ({
      ...w,
      filas: w.filas.map(f => f.fila_num === filaNum
        ? { ...f, producto_id: c.producto_id, nombre_producto: c.nombre_corto, estado: 'matched', matched_by: 'similitud', motivo: null, candidatos: [] }
        : f),
    }));
  }

  // Nada persistido todavía → cancelar es instantáneo, sin IPC.
  function handleCancelar() {
    resetWizard();
  }

  async function handleConfirmar() {
    setLoading(true);
    try {
      const nombreArchivo = filePath.split(/[\\/]/).pop() || filePath;
      const res = await ipc.confirmar({ proveedorId, nombreArchivo, filas });
      setWizard(w => ({ ...w, step: 'confirmado', batchesGenerados: res?.batches ?? [], filterResultado: 'all' }));
    } catch (e: any) {
      setError(e.message ?? 'Error al confirmar la importación.');
    } finally { setLoading(false); }
  }

  function handleImportarFaltantes() {
    // Reabre el flujo con el mismo proveedor precargado, para la tanda sin match/rechazada.
    setWizard(w => ({
      step: 'seleccion', proveedorId: w.proveedorId, filePath: '', filas: [],
      filterPreview: 'all', filterResultado: 'all', batchesGenerados: [],
    }));
  }

  const currentStep = stepIndex(step);

  return (
    <div className="flex-col gap-4" style={{ height: '100%', position: 'relative' }}>

      {/* Indicador de pasos */}
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

      {/* Proveedor actual — para saber a quién se le está cargando el costo (a partir del paso 2 en adelante) */}
      {proveedorActual && step !== 'seleccion' && (
        <div className="panel" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '10px var(--pad)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-sm text-muted">Proveedor:</span>
            <strong>{proveedorActual.razon_social}</strong>
            {proveedorActual.codigo && <span className="tag num">{proveedorActual.codigo}</span>}
          </div>
          <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setModalConsultaAbierto(true)}>
            Consultar productos
          </button>
        </div>
      )}

      {error && <div className="alert-danger" role="alert">{error}</div>}

      {/* ── PASO 1: Selección ─────────────────────────────────────────── */}
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

            {/* 1) Mini-preview de plantilla PRIMERO (ADR-051 A.1, mismo orden que UploadStep) */}
            <div style={{ width: '100%', maxWidth: 640 }}>
              <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
                Columnas esperadas para <strong>Importar Costos</strong>:
              </p>
              <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 120 }}>
                <table style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>EAN</th>
                      <th>COD_PRODUCTO_PROV</th>
                      <th>COD_INTERNO</th>
                      <th>DESCRIPCION</th>
                      <th>COSTO <span style={{ color: 'var(--danger)' }}>*</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
                      <td>7798000001234</td>
                      <td>A-1001</td>
                      <td>—</td>
                      <td>Ejemplo Tornillo hexagonal M6x20</td>
                      <td>125.50</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                <span><span style={{ color: 'var(--danger)' }}>*</span> obligatorio</span>
                <span>el resto es opcional</span>
                <span>con tener <strong>uno</strong> de los 3 identificadores (EAN, código del producto del proveedor o código interno) alcanza para identificar el producto</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
                El <strong>código del producto del proveedor</strong> es el que el proveedor le puso al producto; el <strong>código interno</strong> es tu SKU. El EAN y el código interno identifican cualquier producto del catálogo (aunque todavía no esté asociado a este proveedor); el vínculo se crea al confirmar.
              </div>
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  ↓ Descargar plantilla .csv de ejemplo
                </button>
              </div>
            </div>

            {/* 2) Selección de archivo por explorador — sin drag&drop (no funcionaba de
                forma confiable en Electron; ver decisión con el usuario). */}
            <div
              role="button"
              aria-label="Seleccionar archivo CSV o XLSX"
              tabIndex={0}
              onClick={handleSeleccionarArchivo}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleSeleccionarArchivo(); }}
              style={{ width: '100%', maxWidth: 640, border: '2px dashed var(--line)', borderRadius: 16, padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', cursor: 'pointer', textAlign: 'center' }}
            >
              <div className="font-bold" style={{ fontSize: '1rem' }}>Hacé clic para elegir un archivo (.csv o .xlsx)</div>
              {filePath && <div className="text-sm num" style={{ fontWeight: 600 }}>{filePath}</div>}
            </div>

            <div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSiguienteSeleccion}
                disabled={loading || !proveedorId || !filePath}
                style={{ opacity: loading || !proveedorId || !filePath ? 0.5 : 1 }}
              >
                {loading ? 'Procesando…' : 'Siguiente →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 3: Preview ──────────────────────────────────────────── */}
      {step === 'preview' && (() => {
        const tieneSugerencia = (f: FilaPreview) => f.estado === 'sin_matchear' && (f.candidatos?.length ?? 0) > 0;
        const counts = {
          all: filas.length,
          matched: filas.filter(f => f.estado === 'matched').length,
          error_formato: filas.filter(f => f.estado === 'error_formato').length,
          sin_matchear: filas.filter(f => f.estado === 'sin_matchear').length,
          propuestos: filas.filter(tieneSugerencia).length,
        };
        const filasFiltradas = filas.filter(f =>
          filterPreview === 'all' ? true
          : filterPreview === 'propuestos' ? tieneSugerencia(f)
          : f.estado === filterPreview,
        );
        const duplicados = calcularDuplicados(filas);
        const conAdvertencia = filas.filter(f => f.advertencia).length;

        const chip = (key: 'all' | FilaPreview['estado'] | 'propuestos', label: string, color: string) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterPreview(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${filterPreview === key ? 'var(--accent)' : 'var(--line)'}`,
              background: filterPreview === key ? 'var(--accent-soft)' : 'var(--surface)',
              color: filterPreview === key ? 'var(--accent-strong)' : 'var(--ink-2)',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            {label} ({counts[key]})
          </button>
        );

        return (
          <div className="panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="toolbar" style={{ flexShrink: 0, flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
                {chip('all', 'Todos', 'var(--ink-3)')}
                {chip('matched', 'Identificados', 'var(--ok)')}
                {chip('error_formato', 'Error de formato', 'var(--danger)')}
                {chip('sin_matchear', 'Sin identificar', 'var(--warn)')}
                {counts.propuestos > 0 && chip('propuestos', 'Con sugerencia', 'var(--accent-strong)')}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" className="btn-secondary" onClick={handleCancelar}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setModalConfirmarAbierto(true)}
                  disabled={loading || counts.matched === 0}
                  style={{ opacity: loading || counts.matched === 0 ? 0.5 : 1 }}
                >
                  {`Confirmar (${counts.matched} productos) →`}
                </button>
              </div>
            </div>

            {(duplicados.size > 0 || conAdvertencia > 0) && (
              <div style={{ margin: '0 var(--pad)', background: 'rgba(180,105,14,.08)', border: '1px solid rgba(180,105,14,.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: 'var(--ink-2)', flexShrink: 0 }}>
                {duplicados.size > 0 && <div>⚠ Hay <strong>{duplicados.size} producto{duplicados.size !== 1 ? 's' : ''} duplicado{duplicados.size !== 1 ? 's' : ''}</strong> en el archivo (más de una fila apunta al mismo producto).</div>}
                {conAdvertencia > 0 && <div>⚠ Hay <strong>{conAdvertencia} fila{conAdvertencia !== 1 ? 's' : ''}</strong> donde el código del producto no coincide con el guardado para este proveedor — revisá que sea la lista correcta.</div>}
              </div>
            )}

            <CostoFilasTable filas={filasFiltradas} editable onEditarCelda={handleEditarCelda} onAsignarCandidato={handleAsignarCandidato} duplicados={duplicados} />

            <details style={{ borderTop: '1px solid var(--line)', flexShrink: 0, fontSize: 13, color: 'var(--ink-2)' }}>
              <summary style={{ padding: '9px var(--pad)', cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>
                ⓘ Cómo funciona la edición y el matcheo
              </summary>
              <div style={{ padding: '0 var(--pad) 12px' }}>
                Las celdas de datos son editables — corregí un EAN, código del producto del proveedor, código interno o costo y la fila se vuelve a identificar sola contra el catálogo. El EAN y el código interno identifican cualquier producto del catálogo; el vínculo con este proveedor se crea al confirmar. Si una fila queda <strong>sin identificar</strong>, se ofrecen <strong>sugerencias por descripción</strong> — tocá «Asignar» para vincularla — o podés resolverla después en la Cola de Revisión. Nada de esto queda guardado hasta que confirmes — podés navegar a otra pantalla y volver sin perder el trabajo.
              </div>
            </details>
          </div>
        );
      })()}

      {modalConfirmarAbierto && (() => {
        const cantidad = filas.filter(f => f.estado === 'matched').length;
        return (
          <Modal ariaLabel="Confirmar importación">
            <div className="modal-header">
              <span className="modal-title">Confirmar importación</span>
            </div>
            <div className="modal-body">
              <p>Se va a actualizar el costo de <strong>{cantidad} producto{cantidad !== 1 ? 's' : ''}</strong> para <strong>{proveedorActual?.razon_social ?? ''}</strong>.</p>
              <p>Esta acción no se puede deshacer desde acá — quedará registrada en el Historial de importaciones.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setModalConfirmarAbierto(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => { setModalConfirmarAbierto(false); await handleConfirmar(); }}
                disabled={loading}
              >
                {loading ? 'Aplicando…' : 'Confirmar'}
              </button>
            </div>
          </Modal>
        );
      })()}

      {modalConsultaAbierto && <ConsultarProductosModal proveedorId={proveedorId} onClose={() => setModalConsultaAbierto(false)} />}

      {/* ── PASO 4: Aplicado ─────────────────────────────────────────── */}
      {step === 'confirmado' && (() => {
        const counts = {
          all: filas.length,
          matched: filas.filter(f => f.estado === 'matched').length,
          error_formato: filas.filter(f => f.estado === 'error_formato').length,
          sin_matchear: filas.filter(f => f.estado === 'sin_matchear').length,
        };
        const filasFiltradas = filas.filter(f => filterResultado === 'all' || f.estado === filterResultado);

        const chip = (key: 'all' | FilaPreview['estado'], label: string, color: string) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterResultado(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${filterResultado === key ? 'var(--accent)' : 'var(--line)'}`,
              background: filterResultado === key ? 'var(--accent-soft)' : 'var(--surface)',
              color: filterResultado === key ? 'var(--accent-strong)' : 'var(--ink-2)',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            {label} ({counts[key]})
          </button>
        );

        return (
          <div className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem var(--pad) 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ok)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>✓</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Importación aplicada</div>
                  <div className="text-sm text-muted">Los costos se actualizaron correctamente.</div>
                </div>
              </div>
            </div>

            {/* ADR-049 §7: sin este bloque el circuito se corta — el usuario cree que terminó
                y el lote queda esperando en una pantalla que no sabe que existe. */}
            {batchesGenerados.length > 0 && (
              <div style={{ margin: '14px var(--pad) 0', background: 'var(--accent-soft)', border: '1px solid rgba(232,115,10,.3)', borderRadius: 10, padding: '13px 15px' }}>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, marginBottom: 9 }}>
                  {batchesGenerados.length === 1
                    ? <>Se generó el <strong>lote #{batchesGenerados[0].id.slice(0, 8)}</strong> con los precios propuestos.</>
                    : <>Se generaron <strong>{batchesGenerados.length} lotes</strong> con los precios propuestos.</>}
                  <br />
                  <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>Los precios de venta no cambiaron todavía.</span>
                </div>
                {batchesGenerados.map(b => (
                  <button key={b.id} type="button" className="btn-primary" style={{ marginTop: 4 }} onClick={() => navigate(`${lotesBase}/${b.id}`)}>
                    Revisar lote #{b.id.slice(0, 8)} →
                  </button>
                ))}
              </div>
            )}

            <div className="toolbar" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chip('all', 'Todos', 'var(--ink-3)')}
                {chip('matched', 'Actualizados', 'var(--ok)')}
                {chip('error_formato', 'Rechazados', 'var(--danger)')}
                {chip('sin_matchear', 'Sin matchear', 'var(--warn)')}
              </div>
              <div className="ml-auto">
                <button type="button" className="btn-link" style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }} onClick={() => descargarCsvCostos(filasFiltradas, filterResultado)}>
                  ↓ Descargar filtro actual (.csv)
                </button>
              </div>
            </div>

            <CostoFilasTable filas={filasFiltradas} editable={false} />

            <div style={{ padding: '14px var(--pad)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={handleImportarFaltantes}>
                Importar faltantes
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={resetWizard}
              >
                Nueva importación
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
