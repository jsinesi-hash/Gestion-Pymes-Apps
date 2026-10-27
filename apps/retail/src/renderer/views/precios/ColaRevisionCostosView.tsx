import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useImportacionCosto } from '../../hooks/useImportacionCosto';
import { formatCurrency, bridge } from '@core/ui';
import { useEscapeToClose } from '@core/ui';

type Candidato = { producto_id: string; sku: string; nombre_corto: string; score: number };

type FilaCola = {
  detalle_id: string;
  importacion_id: string;
  estado: string;
  costo_nuevo_centavos: number | null;
  fila_original: string | null;
  nombre_archivo: string;
  fecha_importacion: Date | null;
  proveedor_id: string;
  razon_social: string;
  // ADR-063 Lote 4
  nombre_producto_archivo: string | null;
  candidatos: Candidato[];
  preseleccion: { producto_id: string; score: number } | null;
};

type Producto = { id: string; nombre_corto: string; sku: string };

const pct = (score: number) => `${Math.round(score * 100)}%`;

export function ColaRevisionCostosView() {
  const ipc = useImportacionCosto();
  const [filas, setFilas] = useState<FilaCola[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [selectedFila, setSelectedFila] = useState<FilaCola | null>(null);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [origenSel, setOrigenSel] = useState<'manual' | 'similitud'>('manual');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingFila, setEditingFila] = useState<FilaCola | null>(null);
  const [editDatos, setEditDatos] = useState<Record<string, string>>({});
  const [editCosto, setEditCosto] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEscapeToClose(() => closeModal(), !!selectedFila);
  useEscapeToClose(() => closeEditModal(), !!editingFila);

  const loadCola = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await ipc.getColaRevision();
      // Defensa: normaliza los campos de sugerencia por si la fuente devuelve el shape previo.
      setFilas((rows ?? []).map((r: any) => ({
        ...r,
        nombre_producto_archivo: r.nombre_producto_archivo ?? null,
        candidatos: r.candidatos ?? [],
        preseleccion: r.preseleccion ?? null,
      })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCola(); }, [loadCola]);

  function handleSearch(value: string) {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      const result = await bridge().catalogo.producto.list({ busqueda: value.trim(), activo: true, pageSize: 10 });
      setSearchResults(result.items ?? []);
    }, 300);
  }

  // ADR-063 Lote 4: resuelve una fila. `origen='similitud'` cuando se aceptó una sugerencia
  // por nombre; `'manual'` cuando se buscó el producto a mano. Nada se escribe hasta acá.
  async function resolver(fila: FilaCola, productoId: string, origen: 'manual' | 'similitud') {
    setResolving(fila.detalle_id);
    setError(null);
    try {
      await ipc.resolverFila({ detalleId: fila.detalle_id, productoId, proveedorId: fila.proveedor_id, origen });
      setSelectedFila(null);
      setSelectedProducto(null);
      setSearch('');
      setSearchResults([]);
      await loadCola();
    } catch (e: any) {
      setError(e.message ?? 'Error al resolver la fila.');
    } finally { setResolving(null); }
  }

  async function handleResolver() {
    if (!selectedFila || !selectedProducto) return;
    await resolver(selectedFila, selectedProducto.id, origenSel);
  }

  async function handleDescartar(detalleId: string) {
    try {
      await ipc.descartarFila(detalleId);
      setConfirmDeleteId(null);
      await loadCola();
    } catch (e: any) {
      setError(e.message ?? 'Error al descartar la fila.');
    }
  }

  async function handleActualizar() {
    if (!editingFila) return;
    setSavingEdit(true);
    setError(null);
    try {
      const costoNum = Math.round(parseFloat(editCosto.replace(',', '.')) * 100);
      if (isNaN(costoNum)) { setError('Costo inválido.'); return; }
      await ipc.actualizarFila({
        detalleId: editingFila.detalle_id,
        costoNuevoCentavos: costoNum,
        datos: editDatos,
      });
      setEditingFila(null);
      await loadCola();
    } catch (e: any) {
      setError(e.message ?? 'Error al actualizar la fila.');
    } finally { setSavingEdit(false); }
  }

  function openModal(f: FilaCola) {
    setSelectedFila(f);
    setSearch('');
    setSearchResults([]);
    setError(null);
    // Pre-selección por umbral (opt-in): la fila llega con un candidato pre-marcado, que el
    // operador puede destildar/cambiar. Nada se persiste hasta confirmar.
    const pre = f.preseleccion ? f.candidatos.find(c => c.producto_id === f.preseleccion!.producto_id) : null;
    if (pre) {
      setSelectedProducto({ id: pre.producto_id, nombre_corto: pre.nombre_corto, sku: pre.sku });
      setOrigenSel('similitud');
    } else {
      setSelectedProducto(null);
      setOrigenSel('manual');
    }
  }

  function elegirCandidato(c: Candidato) {
    setSelectedProducto({ id: c.producto_id, nombre_corto: c.nombre_corto, sku: c.sku });
    setOrigenSel('similitud');
    setSearchResults([]);
  }

  function closeModal() {
    setSelectedFila(null);
    setError(null);
  }

  function closeEditModal() {
    setEditingFila(null);
    setError(null);
  }

  function openEditModal(f: FilaCola) {
    let datos: Record<string, string> = {};
    try { datos = JSON.parse(f.fila_original ?? '{}').datos ?? {}; } catch {}
    const costoStr = f.costo_nuevo_centavos != null ? (f.costo_nuevo_centavos / 100).toFixed(2) : '';
    setEditingFila(f);
    setEditDatos(datos);
    setEditCosto(costoStr);
    setError(null);
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        {loading ? (
          <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>Cargando…</span>
        ) : (
          <>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {filas.length === 0 ? 'Sin filas pendientes' : `${filas.length} fila${filas.length > 1 ? 's' : ''} sin asignar`}
            </span>
            {filas.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--warn)', background: 'rgba(180,105,14,.1)', border: '1px solid rgba(180,105,14,.2)' }}>
                Revisión pendiente
              </span>
            )}
          </>
        )}
      </div>

      {!loading && filas.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ink-3)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600 }}>No hay filas pendientes de revisión</span>
        </div>
      )}

      {!loading && filas.length > 0 && (
        <div className="table-wrap">
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Archivo</th>
                <th>Datos del archivo</th>
                <th>Sugerencia por nombre</th>
                <th className="r">Costo</th>
                <th className="c">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                let datosCrudos: Record<string, string> = {};
                try { datosCrudos = JSON.parse(f.fila_original ?? '{}').datos ?? {}; } catch {}
                return (
                  <tr key={f.detalle_id}>
                    <td className="p-name">{f.razon_social}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.nombre_archivo}</div>
                      {f.fecha_importacion && (
                        <div className="p-sub">{new Date(f.fecha_importacion).toLocaleDateString('es-AR')}</div>
                      )}
                    </td>
                    <td>
                      <span className="num" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                        {Object.entries(datosCrudos).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                      </span>
                    </td>
                    <td>
                      {f.candidatos.length === 0 ? (
                        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12.5 }}>
                            <span style={{ fontWeight: 600 }}>{f.candidatos[0].nombre_corto}</span>
                            <span className="num" style={{ color: 'var(--ink-3)', marginLeft: 6 }}>{pct(f.candidatos[0].score)}</span>
                          </span>
                          {f.preseleccion && (
                            <span title="Pre-seleccionado por umbral del proveedor" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent-strong)', background: 'var(--accent-soft)', border: '1px solid rgba(232,115,10,.25)', borderRadius: 999, padding: '1px 7px' }}>
                              sugerido
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: '3px 9px' }}
                            disabled={resolving !== null}
                            onClick={() => resolver(f, f.candidatos[0].producto_id, 'similitud')}
                          >
                            Aceptar
                          </button>
                          {f.candidatos.length > 1 && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: 11, padding: '3px 9px' }}
                              onClick={() => openModal(f)}
                            >
                              +{f.candidatos.length - 1}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="r num" style={{ fontWeight: 700 }}>
                      {f.costo_nuevo_centavos != null ? formatCurrency(f.costo_nuevo_centavos) : '—'}
                    </td>
                    <td className="c">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => openEditModal(f)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => openModal(f)}
                        >
                          Asignar
                        </button>
                        {confirmDeleteId === f.detalle_id ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--danger)' }}>¿Eliminar?</span>
                            <button
                              type="button"
                              className="btn-danger"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => handleDescartar(f.detalle_id)}
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)' }}
                            onClick={() => setConfirmDeleteId(f.detalle_id)}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de asignación */}
      {selectedFila && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal" style={{ width: 480 }}>
            <div className="modal-header">
              <span className="modal-title">Asignar a producto del catálogo</span>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                Buscá el producto del catálogo que corresponde a esta fila de <strong>{selectedFila.razon_social}</strong>.
                El costo <span className="num" style={{ fontWeight: 700 }}>
                  {selectedFila.costo_nuevo_centavos != null ? formatCurrency(selectedFila.costo_nuevo_centavos) : '—'}
                </span> se asignará al vínculo proveedor–producto.
              </p>

              {selectedFila.nombre_producto_archivo && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: -4 }}>
                  Nombre en el archivo: <strong style={{ color: 'var(--ink-2)' }}>{selectedFila.nombre_producto_archivo}</strong>
                </p>
              )}

              {selectedFila.candidatos.length > 0 && (
                <div className="field">
                  <label>SUGERENCIAS POR NOMBRE</label>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                    {selectedFila.candidatos.map((c, i) => (
                      <div
                        key={c.producto_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => elegirCandidato(c)}
                        onKeyDown={e => { if (e.key === 'Enter') elegirCandidato(c); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px var(--pad)', cursor: 'pointer', borderBottom: i < selectedFila.candidatos.length - 1 ? '1px solid var(--line)' : 'none', background: selectedProducto?.id === c.producto_id ? 'var(--accent-soft)' : 'transparent' }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.nombre_corto}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="num p-code">{c.sku}</span>
                          <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-strong)' }}>{pct(c.score)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <label>BUSCAR OTRO PRODUCTO</label>
                <div className="search" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input
                    autoFocus
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Nombre o SKU…"
                  />
                </div>
              </div>

              {searchResults.length > 0 && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                  {searchResults.map((p, i) => (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedProducto(p); setOrigenSel('manual'); setSearchResults([]); setSearch(p.nombre_corto); }}
                      onKeyDown={e => { if (e.key === 'Enter') { setSelectedProducto(p); setOrigenSel('manual'); setSearchResults([]); setSearch(p.nombre_corto); } }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px var(--pad)', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? '1px solid var(--line)' : 'none', background: selectedProducto?.id === p.id ? 'var(--accent-soft)' : 'transparent' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre_corto}</span>
                      <span className="num p-code">{p.sku}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedProducto && !searchResults.length && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px var(--pad)', background: 'var(--accent-soft)', borderRadius: 10, border: '1px solid rgba(232,115,10,.25)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-strong)' }}>{selectedProducto.nombre_corto}</span>
                  <span className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 4 }}>{selectedProducto.sku}</span>
                </div>
              )}

              {error && <div className="alert-danger">{error}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleResolver}
                disabled={!selectedProducto || resolving !== null}
                style={{ opacity: !selectedProducto || resolving !== null ? 0.5 : 1 }}
              >
                {resolving ? 'Asignando…' : 'Confirmar asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición de datos crudos */}
      {editingFila && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeEditModal() }}>
          <div className="modal" style={{ width: 460 }}>
            <div className="modal-header">
              <span className="modal-title">Editar datos de la fila</span>
              <button type="button" className="icon-btn" onClick={() => closeEditModal()} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {Object.keys(editDatos).map(col => (
                <div key={col} className="field">
                  <label>{col}</label>
                  <input
                    value={editDatos[col]}
                    onChange={e => setEditDatos(prev => ({ ...prev, [col]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="field">
                <label>COSTO ($)</label>
                <input
                  className="num"
                  value={editCosto}
                  onChange={e => setEditCosto(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {error && <div className="alert-danger">{error}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => closeEditModal()}>Cancelar</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleActualizar}
                disabled={savingEdit}
                style={{ opacity: savingEdit ? 0.5 : 1 }}
              >
                {savingEdit ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
