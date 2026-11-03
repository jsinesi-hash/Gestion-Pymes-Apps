import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { costoNeto } from '@ferreteria/shared';
import { useMotorPreciosV2Habilitado } from '../../../hooks/useMotorPrecios';
import { useFilaNavegable } from '../../../hooks/useFilaNavegable';
import { useCallIpc, bridge } from '@core/ui';
import { ProveedorAgregarProductosPanel } from './ProveedorAgregarProductosPanel';

// ADR-085 (SEC-2): campos del form de edición inline que pueden recibir un error de
// validación del backend, mapeados al `id` del control focoable correspondiente.
const ID_EDIT: Record<string, string> = {
  costo_centavos: 'pp_tab_edit_costo',
  codigo_proveedor: 'pp_tab_edit_codigo',
};

type VinculoProducto = {
  id: string;
  producto_id: string;
  nombre_corto: string;
  sku: string;
  costo_centavos: number;
  codigo_proveedor: string | null;
  preferido: boolean;
  // ADR-049 §1 — overrides + defaults (solo lectura en esta vista).
  bonificacion_pct: number | null;
  costo_financiero_pct: number | null;
  flete_pct: number | null;
  flete_centavos: number | null;
  otros_costos_centavos: number | null;
  bonificacion_pct_default: number;
  costo_financiero_pct_default: number;
  flete_pct_default: number;
};

function netoDe(v: VinculoProducto): number {
  return costoNeto(
    v.costo_centavos,
    {
      bonificacionPct: v.bonificacion_pct,
      costoFinancieroPct: v.costo_financiero_pct,
      fletePct: v.flete_pct,
      fleteCentavos: v.flete_centavos,
      otrosCostosCentavos: v.otros_costos_centavos,
    },
    {
      bonificacionPctDefault: v.bonificacion_pct_default,
      costoFinancieroPctDefault: v.costo_financiero_pct_default,
      fletePctDefault: v.flete_pct_default,
    },
  ).netoCentavos;
}

type EditState = {
  id: string;
  costo: string;
  codigo: string;
};

type SortCol = 'nombre_corto' | 'costo_centavos' | 'codigo_proveedor';
type SortDir = 'asc' | 'desc';

function centavosToARS(c: number) {
  return (c / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function arsToCentavos(s: string): number {
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : Math.round(n * 100);
}

// Íconos de orden alineados al listado de referencia (ProductosListado): ↕ / ↑ / ↓.
function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: SortDir }>) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function ThSort({ col, children, className, onSort, sortCol, sortDir }: Readonly<{
  col: SortCol;
  children: ReactNode;
  className?: string;
  onSort: (col: SortCol) => void;
  sortCol: SortCol;
  sortDir: SortDir;
}>) {
  return (
    <th
      className={className}
      onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {children} <SortIcon active={sortCol === col} dir={sortDir} />
    </th>
  );
}

// Íconos de acción por fila (mismo set/estilo que ConfigUsuarios y ProveedoresPanel).
const SVG_EDIT = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
const SVG_DELETE = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
const SVG_SAVE = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>);

export function ProveedorProductosTab({ proveedorId }: Readonly<{ proveedorId: string }>) {
  const navigate = useNavigate();
  const motorV2 = useMotorPreciosV2Habilitado();
  const [vinculos, setVinculos] = useState<VinculoProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<SortCol>('nombre_corto');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [showAdd, setShowAdd] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const callIpc = useCallIpc();

  const refresh = useCallback(() => {
    bridge().compras.proveedor.productos.listar(proveedorId)
      .then((data: VinculoProducto[]) => { setVinculos(data); setLoadError(null); })
      .catch(() => setLoadError('No se pudo cargar la lista de productos.'))
      .finally(() => setLoading(false));
  }, [proveedorId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const vinculosOrdenados = useMemo(() => {
    return [...vinculos].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortCol === 'costo_centavos') {
        av = a.costo_centavos;
        bv = b.costo_centavos;
      } else if (sortCol === 'codigo_proveedor') {
        av = a.codigo_proveedor ?? '';
        bv = b.codigo_proveedor ?? '';
      } else {
        av = a.nombre_corto;
        bv = b.nombre_corto;
      }
      const cmp = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, 'es-AR', { sensitivity: 'base' })
        : av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [vinculos, sortCol, sortDir]);

  async function handleDesasociar(id: string, nombre: string) {
    if (!window.confirm(`¿Quitar el producto "${nombre}" de este proveedor?`)) return;
    try {
      await bridge().compras.proveedor.productos.desasociar(id);
      setActionError(null);
      refresh();
    } catch {
      setActionError('No se pudo quitar el producto. Intentá de nuevo.');
    }
  }

  async function handleSaveEdit() {
    if (!editState) return;
    setSaving(true);
    // ADR-085 (SEC-2): callIpc traduce y muestra el error por toast; si el backend
    // rechaza un campo de validación, lo enrutamos al control focoable correspondiente.
    const r = await callIpc(
      () => bridge().compras.proveedor.productos.actualizar(editState.id, {
        costo_centavos:   arsToCentavos(editState.costo),
        codigo_proveedor: editState.codigo.trim() || null,
      }),
      { success: 'Costo de proveedor guardado' },
    );
    setSaving(false);
    if (!r.ok) {
      setActionError(r.traducido.mensaje);
      const campo = r.traducido.campo;
      if (campo && ID_EDIT[campo]) document.getElementById(ID_EDIT[campo])?.focus();
      return;
    }
    setEditState(null);
    setActionError(null);
    refresh();
  }

  async function handleTogglePreferido(id: string, setTo: boolean) {
    try {
      await bridge().compras.proveedor.productos.actualizar(id, { preferido: setTo });
      setActionError(null);
      refresh();
    } catch {
      setActionError('No se pudo actualizar el preferido. Intentá de nuevo.');
    }
  }

  if (loading) return <div style={{ padding: '12px', opacity: 0.5 }}>Cargando...</div>;
  if (loadError) return <div style={{ padding: '12px', color: 'var(--error, #c0392b)' }}>{loadError}</div>;

  // ADR-084 — el alta masiva es una PANTALLA a ancho completo que reemplaza la lista (no un
  // modal): se sale sólo con «Volver» o al confirmar, sin perder la carga por un click afuera.
  if (showAdd) {
    return (
      <ProveedorAgregarProductosPanel
        proveedorId={proveedorId}
        asociadosIds={new Set(vinculos.map(v => v.producto_id))}
        onClose={(added) => { setShowAdd(false); if (added) refresh(); }}
      />
    );
  }

  const colCount = 5 + (motorV2 ? 1 : 0);

  return (
    <div className="panel">
      <div className="toolbar">
        <div className="ml-auto" />
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Agregar productos</button>
      </div>

      {actionError && (
        <div style={{ margin: 'var(--pad) var(--pad) 0', padding: '8px 12px', color: 'var(--error, #c0392b)', background: 'var(--error-subtle, #fff5f5)', borderRadius: '4px', fontSize: '13px' }}>
          {actionError}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <ThSort col="nombre_corto" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Producto</ThSort>
              <ThSort col="costo_centavos" className="r" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Costo</ThSort>
              {motorV2 && <th className="r" title="Costo neto efectivo (bruto + condiciones del proveedor)">Costo neto</th>}
              <ThSort col="codigo_proveedor" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Código proveedor</ThSort>
              <th className="c">Preferido</th>
              <th className="r">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vinculos.length === 0 && (
              <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                Este proveedor no tiene productos asociados.
              </td></tr>
            )}
            {vinculosOrdenados.map(v => {
              const filaProps = useFilaNavegable(() => navigate(`/productos/${v.producto_id}`), `Ver detalle del producto ${v.sku}`);
              return editState?.id === v.id ? (
                <tr key={v.id}>
                  <td>
                    <div className="p-name">{v.nombre_corto}</div>
                    <div className="num p-code">{v.sku}</div>
                  </td>
                  <td className="r">
                    <input
                      id="pp_tab_edit_costo"
                      className="input num"
                      style={{ width: '100px', textAlign: 'right' }}
                      value={editState.costo}
                      onChange={e => setEditState(s => s ? { ...s, costo: e.target.value } : s)}
                    />
                  </td>
                  {motorV2 && <td className="r num" style={{ opacity: 0.4 }}>—</td>}
                  <td>
                    <input
                      id="pp_tab_edit_codigo"
                      className="input"
                      style={{ width: '130px' }}
                      value={editState.codigo}
                      onChange={e => setEditState(s => s ? { ...s, codigo: e.target.value } : s)}
                    />
                  </td>
                  <td className="c">—</td>
                  <td>
                    <div className="row-act">
                      <button className="ia" title="Guardar" aria-label="Guardar" onClick={handleSaveEdit} disabled={saving}>{SVG_SAVE}</button>
                      <button className="ia del" title="Cancelar" aria-label="Cancelar" onClick={() => setEditState(null)}>{SVG_DELETE}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={v.id} {...filaProps}>
                  <td>
                    <div className="p-name">{v.nombre_corto}</div>
                    <div className="num p-code">{v.sku}</div>
                  </td>
                  <td className="r">
                    <span className="num">$ {centavosToARS(v.costo_centavos)}</span>
                  </td>
                  {motorV2 && (
                    <td className="r">
                      <span className="num" style={{ fontWeight: 600 }}>$ {centavosToARS(netoDe(v))}</span>
                    </td>
                  )}
                  <td style={{ opacity: v.codigo_proveedor ? 1 : 0.3 }}>
                    <span className="num p-code">
                      {v.codigo_proveedor ?? '—'}
                    </span>
                  </td>
                  <td className="c" onClick={e => e.stopPropagation()}>
                    <button
                      title={v.preferido ? 'Quitar preferido' : 'Marcar como preferido'}
                      aria-label={v.preferido ? 'Quitar preferido' : 'Marcar como preferido'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                      onClick={() => handleTogglePreferido(v.id, !v.preferido)}
                    >
                      {v.preferido ? (
                        <span className="badge ok"><span className="bd" />preferido</span>
                      ) : (
                        <span style={{ opacity: 0.3, fontSize: '16px', lineHeight: 1 }}>☆</span>
                      )}
                    </button>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="row-act">
                      <button
                        className="ia"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => setEditState({
                          id:     v.id,
                          costo:  centavosToARS(v.costo_centavos),
                          codigo: v.codigo_proveedor ?? '',
                        })}
                      >{SVG_EDIT}</button>
                      <button
                        className="ia del"
                        title="Quitar"
                        aria-label="Quitar"
                        onClick={() => handleDesasociar(v.id, v.nombre_corto)}
                      >{SVG_DELETE}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {vinculos.length > 0 && (
        <div className="table-footer">
          <span>{vinculosOrdenados.length} producto{vinculosOrdenados.length === 1 ? '' : 's'}</span>
        </div>
      )}
    </div>
  );
}
