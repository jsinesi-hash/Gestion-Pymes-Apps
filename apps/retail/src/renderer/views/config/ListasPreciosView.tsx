import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useListasPrecios } from '../../hooks/useListasPrecios';
import { useAuth } from '@core/ui';
import { useMotorPreciosV2Habilitado } from '../../hooks/useMotorPrecios';
import { RecalcularModal } from './RecalcularModal';
import { CambiosProgramadosPanel } from './CambiosProgramadosPanel';
import { ReglasTab } from './ReglasTab';
import { useEscapeToClose } from '@core/ui';

type ModoCalculo = 'margen_costo' | 'pct_sobre_lista' | 'manual';

const MODO_LABEL: Record<ModoCalculo, string> = {
  margen_costo: 'Margen sobre costo',
  pct_sobre_lista: '% sobre lista',
  manual: 'Manual',
};

type ListaForm = {
  nombre: string;
  tipo: 'general' | 'especial';
  ajuste_porcentual: string;
  modo_calculo: ModoCalculo;
  predeterminada: boolean;
};

const emptyForm = (): ListaForm => ({
  nombre: '', tipo: 'general', ajuste_porcentual: '0', modo_calculo: 'pct_sobre_lista', predeterminada: false,
});

type TabKey = 'vigentes' | 'programados' | 'detalle' | 'reglas';

type VigenteSortCol = 'nombre' | 'sku' | 'precio';
type VigenteSortDir = 'asc' | 'desc';

// Íconos de orden alineados al listado de referencia (ProductosListado/ProveedorProductosTab): ↕ / ↑ / ↓.
function VigenteSortIcon({ active, dir }: Readonly<{ active: boolean; dir: VigenteSortDir }>) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function VigenteThSort({ col, children, className, onSort, sortCol, sortDir }: Readonly<{
  col: VigenteSortCol;
  children: ReactNode;
  className?: string;
  onSort: (col: VigenteSortCol) => void;
  sortCol: VigenteSortCol;
  sortDir: VigenteSortDir;
}>) {
  return (
    <th
      className={className}
      onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {children} <VigenteSortIcon active={sortCol === col} dir={sortDir} />
    </th>
  );
}

export function VigentesTab({ listaId, listaNombre, onSuccess }: { listaId: string; listaNombre: string; onSuccess?: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRecalcular, setShowRecalcular] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [sortCol, setSortCol] = useState<VigenteSortCol>('nombre');
  const [sortDir, setSortDir] = useState<VigenteSortDir>('asc');
  const { can } = useAuth();

  async function load() {
    setLoading(true);
    try {
      const data = await (globalThis as any).ferreteria.precios.valor.listarVigentesPorLista(listaId);
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [listaId]);

  function handleSort(col: VigenteSortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const rowsFiltradas = useMemo(() => {
    let result = rows;
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      result = result.filter((r: any) =>
        (r.nombre_corto ?? '').toLowerCase().includes(q) ||
        (r.sku ?? '').toLowerCase().includes(q) ||
        (r.gtin_barcode ?? '').toLowerCase().includes(q),
      );
    }
    return [...result].sort((a: any, b: any) => {
      let cmp: number;
      if (sortCol === 'precio') {
        cmp = a.precio_centavos - b.precio_centavos;
      } else if (sortCol === 'sku') {
        cmp = (a.sku ?? '').localeCompare(b.sku ?? '', 'es-AR', { sensitivity: 'base' });
      } else {
        cmp = (a.nombre_corto ?? '').localeCompare(b.nombre_corto ?? '', 'es-AR', { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, filtro, sortCol, sortDir]);

  return (
    <div>
      <div className="toolbar" style={{ background: 'none', border: 'none', padding: '0 var(--pad)' }}>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            placeholder="Buscar por nombre, SKU o EAN…"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
        </div>
        <div className="ml-auto" />
        {can('config.fiscal') && (
          <button type="button" className="btn-primary" onClick={() => setShowRecalcular(true)}>Recalcular masivo</button>
        )}
      </div>
      {showRecalcular && (
        <RecalcularModal listaId={listaId} listaNombre={listaNombre}
          onClose={() => setShowRecalcular(false)}
          onSuccess={() => { load(); onSuccess?.(); }} />
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <VigenteThSort col="nombre" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Producto</VigenteThSort>
              <VigenteThSort col="sku" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>SKU</VigenteThSort>
              <VigenteThSort col="precio" className="r" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>Precio vigente</VigenteThSort>
              <th>Desde</th>
              <th>Origen</th>
              <th>Promo</th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.map((r: any) => (
              <tr key={r.producto_id}>
                <td>{r.nombre_corto}</td>
                <td className="num p-code">{r.sku}</td>
                <td className="r num">${(r.precio_centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-muted text-sm">{new Date(r.fecha_desde).toLocaleDateString('es-AR')}</td>
                <td className="text-muted text-sm">{r.origen}</td>
                <td>
                  {r.precio_promocion_centavos != null && (
                    <span style={{ color: 'var(--color-success, #10b981)', fontWeight: 600, fontSize: 12 }}>
                      En promo ${(r.precio_promocion_centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rowsFiltradas.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, fontSize: 13 }}>
                  {rows.length === 0 ? 'Sin precios cargados aún' : `Sin resultados para "${filtro}".`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalleAjustesTab({ listaId, listaAjuste }: { listaId: string; listaAjuste: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    (globalThis as any).ferreteria.precios.detalle.listByLista?.(listaId)
      .then((data: any[]) => setRows(data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [listaId]);

  if (loading) return <div style={{ padding: 'var(--pad)', opacity: 0.5 }}>Cargando...</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th className="r">Ajuste general</th>
            <th className="r">Ajuste específico</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.producto_id ?? r.id}>
              <td>{r.producto_id}</td>
              <td className="r num">{listaAjuste >= 0 ? '+' : ''}{listaAjuste}%</td>
              <td className="r num" style={{ color: 'var(--accent-strong)' }}>
                {r.ajuste_porcentual >= 0 ? '+' : ''}{r.ajuste_porcentual}%
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, fontSize: 13 }}>
                Sin ajustes específicos por producto
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ListasPreciosView() {
  const { listas, loading, refetch } = useListasPrecios();
  const { can } = useAuth();
  const isSupervisor = can('config.fiscal');
  const motorV2 = useMotorPreciosV2Habilitado();
  const colCount = motorV2 ? 6 : 5;

  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState<ListaForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected lista for detail tabs
  const [selectedListaId, setSelectedListaId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('vigentes');

  const selectedLista = listas.find((l: any) => l.id === selectedListaId) ?? null;

  function openCrear() {
    setForm(emptyForm());
    setModal({ open: true });
    setError(null);
  }

  function openEditar(lista: any) {
    setForm({
      nombre: lista.nombre,
      tipo: lista.tipo,
      ajuste_porcentual: String(lista.ajuste_porcentual),
      modo_calculo: (lista.modo_calculo as ModoCalculo) ?? 'pct_sobre_lista',
      predeterminada: lista.predeterminada,
    });
    setModal({ open: true, id: lista.id });
    setError(null);
  }

  async function handleGuardar() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nombre: form.nombre,
        tipo: form.tipo,
        ajuste_porcentual: Number.parseFloat(form.ajuste_porcentual) || 0,
        predeterminada: form.predeterminada,
        ...(motorV2 ? { modo_calculo: form.modo_calculo } : {}),
      };
      if (modal.id) {
        await (globalThis as any).ferreteria.precios.lista.update({ id: modal.id, ...payload });
      } else {
        await (globalThis as any).ferreteria.precios.lista.create(payload);
      }
      setModal({ open: false });
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDesactivar(id: string) {
    try {
      await (globalThis as any).ferreteria.precios.lista.deactivate({ id });
      if (selectedListaId === id) setSelectedListaId(null);
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? 'Error al desactivar');
    }
  }

  return (
    <div className="flex-col gap-4">
      <div className="toolbar" style={{ background: 'none', border: 'none', padding: 0 }}>
        <h2 style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>Listas de precios</h2>
        {isSupervisor && (
          <button type="button" className="btn-primary" onClick={openCrear}>+ Nueva lista</button>
        )}
      </div>

      <div className="panel">
        {loading ? (
          <p className="text-muted" style={{ padding: 'var(--pad)', opacity: 0.5 }}>Cargando...</p>
        ) : (
          <div className="table-wrap" style={{ flex: 'none' }}>
            <table>
              <thead>
                <tr>
                  {['Nombre', 'Tipo', 'Ajuste', ...(motorV2 ? ['Modo de cálculo'] : []), 'Estado', ''].map(h => (
                    <th key={h || 'acciones'}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listas.map((lista: any) => (
                  <tr key={lista.id} style={{ opacity: lista.activo ? 1 : 0.45, cursor: 'pointer', background: lista.id === selectedListaId ? 'var(--row-selected-bg, rgba(0,0,0,.04))' : undefined }}
                    onClick={() => { setSelectedListaId(lista.id === selectedListaId ? null : lista.id); setTab('vigentes'); }}>
                    <td>
                      <span className="p-name">{lista.nombre}</span>
                      {lista.predeterminada && (
                        <span className="badge ok" style={{ marginLeft: 8 }}>
                          <span className="bd" />Predeterminada
                        </span>
                      )}
                    </td>
                    <td className="text-muted text-sm">
                      {lista.tipo === 'general' ? 'Tipo general' : 'Tipo especial'}
                    </td>
                    <td>
                      <span className="num">{lista.ajuste_porcentual >= 0 ? '+' : ''}{lista.ajuste_porcentual}%</span>
                    </td>
                    {motorV2 && (
                      <td className="text-muted text-sm">
                        {MODO_LABEL[(lista.modo_calculo as ModoCalculo) ?? 'pct_sobre_lista']}
                      </td>
                    )}
                    <td>
                      <span className={`badge ${lista.activo ? 'ok' : 'off'}`}>
                        <span className="bd" />{lista.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {isSupervisor && lista.activo && (
                        <div className="row-act">
                          <button type="button" className="btn-secondary" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => openEditar(lista)}>
                            Editar
                          </button>
                          {!lista.predeterminada && (
                            <button type="button" className="btn-danger" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => handleDesactivar(lista.id)}>
                              Desactivar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {listas.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="text-muted" style={{ padding: '2rem', textAlign: 'center', opacity: 0.4 }}>
                      Sin listas de precios
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLista && (
        <div className="panel">
          <div style={{ padding: '12px var(--pad) 0', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', gap: 4 }}>
            <span style={{ fontWeight: 700, marginRight: 12, fontSize: 14, alignSelf: 'center' }}>{selectedLista.nombre}</span>
            {(motorV2 ? (['vigentes', 'reglas'] as TabKey[]) : (['vigentes', 'programados', 'detalle'] as TabKey[])).map(t => (
              <button key={t} type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 14px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: tab === t ? '2px solid var(--accent, #f59e0b)' : '2px solid transparent',
                  fontWeight: tab === t ? 700 : 400,
                  color: tab === t ? 'var(--accent-strong, #b45309)' : undefined,
                }}>
                {t === 'vigentes' ? 'Precios vigentes' : t === 'programados' ? 'Cambios programados' : t === 'reglas' ? 'Reglas' : 'Ajustes por producto'}
              </button>
            ))}
          </div>
          <div style={{ padding: '8px 0' }}>
            {tab === 'vigentes' && (
              <VigentesTab listaId={selectedLista.id} listaNombre={selectedLista.nombre} />
            )}
            {tab === 'reglas' && motorV2 && (
              <ReglasTab listaId={selectedLista.id} />
            )}
            {tab === 'programados' && !motorV2 && (
              <CambiosProgramadosPanel listaId={selectedLista.id} />
            )}
            {tab === 'detalle' && !motorV2 && (
              <DetalleAjustesTab listaId={selectedLista.id} listaAjuste={selectedLista.ajuste_porcentual} />
            )}
          </div>
        </div>
      )}

      {modal.open && (
        <div className="modal-overlay" role="dialog"> {/* NOSONAR */}
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal.id ? 'Editar lista' : 'Nueva lista'}</span>
            </div>
            <div className="modal-body">
              <div className="field">
                <label htmlFor="lp-nombre">Nombre</label>
                <input id="lp-nombre" aria-label="nombre" className="input"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="lp-tipo">Tipo</label>
                <select id="lp-tipo" className="input"
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'general' | 'especial' }))}
                >
                  <option value="general">Tipo general</option>
                  <option value="especial">Tipo especial</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="lp-ajuste">Ajuste porcentual (con signo, ej. -10 o +5)</label>
                <input id="lp-ajuste" type="number" aria-label="ajuste porcentual" className="input num"
                  value={form.ajuste_porcentual}
                  onChange={e => setForm(f => ({ ...f, ajuste_porcentual: e.target.value }))}
                />
              </div>
              {motorV2 && (
                <div className="field">
                  <label htmlFor="lp-modo">Modo de cálculo</label>
                  <select id="lp-modo" aria-label="modo de cálculo" className="input"
                    value={form.modo_calculo}
                    onChange={e => setForm(f => ({ ...f, modo_calculo: e.target.value as ModoCalculo }))}
                  >
                    <option value="pct_sobre_lista">% sobre lista</option>
                    <option value="margen_costo">Margen sobre costo</option>
                    <option value="manual">Manual</option>
                  </select>
                  <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                    «Margen sobre costo» usa las reglas de la lista; el ajuste % solo aplica en «% sobre lista».
                  </div>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox"
                  checked={form.predeterminada}
                  onChange={e => setForm(f => ({ ...f, predeterminada: e.target.checked }))}
                />
                {' '}Marcar como predeterminada
              </label>
              {error && <div className="alert-danger" role="alert">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setModal({ open: false })}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleGuardar}
                disabled={saving || !form.nombre.trim()} style={{ opacity: saving ? 0.7 : 1 }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
