import { useState, useEffect, useMemo } from 'react';
import { margenRealPct, precioConMargen } from '@ferreteria/shared';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useCallIpc } from '@core/ui';

// ADR-049 §2 — Reglas de margen por lista (reemplaza el tab «Ajustes por producto»).
// Una sola regla aplica por producto (producto → marca → rubro → proveedor → lista).

// ADR-085 (SEC-2): campos del form que pueden mostrar un error inline. Sus controles llevan
// un `id` igual a la clave, para poder enfocar el control cuando el backend rechaza por él.
// `lista_precio_id` no tiene control en este modal (viene de la pestaña) → error general.
const CAMPOS_ERROR = new Set([
  'tipo', 'objetivo_id', 'margen_pct', 'margen_min_pct', 'margen_max_pct',
  'redondeo_modo', 'redondeo_valor', 'prioridad',
]);

type ReglaTipo = 'producto' | 'marca' | 'rubro' | 'proveedor' | 'lista';
type RedondeoModo = 'ninguno' | 'terminacion_90' | 'terminacion_99' | 'multiplo';

type Regla = {
  id: string;
  tipo: ReglaTipo;
  objetivo_id: string | null;
  margen_pct: number;
  margen_min_pct: number | null;
  margen_max_pct: number | null;
  redondeo_modo: RedondeoModo;
  redondeo_valor: number | null;
  prioridad: number;
};

type Opcion = { id: string; nombre: string; sku?: string; gtin_barcode?: string | null };

const TIPO_LABEL: Record<ReglaTipo, string> = {
  producto: 'Producto', marca: 'Marca', rubro: 'Rubro', proveedor: 'Proveedor', lista: 'Lista (base)',
};
const REDONDEO_LABEL: Record<RedondeoModo, string> = {
  ninguno: 'Ninguno', terminacion_90: 'Term. ,90', terminacion_99: 'Term. ,99', multiplo: 'Múltiplo',
};

const f = () => (globalThis as any).ferreteria;

type FormState = {
  tipo: ReglaTipo;
  objetivo_id: string;
  margen_pct: string;
  margen_min_pct: string;
  margen_max_pct: string;
  redondeo_modo: RedondeoModo;
  redondeo_valor: string;
  prioridad: string;
};

const emptyForm = (): FormState => ({
  tipo: 'lista', objetivo_id: '', margen_pct: '40',
  margen_min_pct: '', margen_max_pct: '',
  redondeo_modo: 'ninguno', redondeo_valor: '', prioridad: '100',
});

/** Margen real sobre precio a partir del markup, para mostrar al lado (dato derivado). */
function margenRealDeMarkup(markupPct: number): number {
  return margenRealPct(precioConMargen(10000, markupPct), 10000);
}

export function ReglasTab({ listaId }: Readonly<{ listaId: string }>) {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [marcas, setMarcas] = useState<Opcion[]>([]);
  const [rubros, setRubros] = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Opcion[]>([]);
  const [productos, setProductos] = useState<Opcion[]>([]);
  const [modal, setModal] = useState<{ id?: string } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState('');
  const callIpc = useCallIpc();

  useEscapeToClose(() => setModal(null), !!modal);

  async function load() {
    const data = await f().precios?.reglas?.listByLista?.(listaId).catch(() => []);
    setReglas(data ?? []);
  }

  useEffect(() => { load(); }, [listaId]);

  useEffect(() => {
    (f().catalogo?.marca?.list?.() ?? Promise.resolve([])).then((d: any[]) =>
      setMarcas((d ?? []).map((m: any) => ({ id: m.id, nombre: m.nombre })))).catch(() => {});
    (f().catalogo?.categoria?.list?.() ?? Promise.resolve([])).then((d: any[]) =>
      setRubros((d ?? []).map((c: any) => ({ id: c.id, nombre: c.nombre })))).catch(() => {});
    (f().compras?.proveedor?.list?.() ?? Promise.resolve([])).then((d: any[]) =>
      setProveedores((d ?? []).map((p: any) => ({ id: p.id, nombre: p.razon_social })))).catch(() => {});
    (f().catalogo?.producto?.list?.({ page: 1, pageSize: 9999, activo: true }) ?? Promise.resolve({ items: [] }))
      .then((d: any) => setProductos((d?.items ?? []).map((p: any) => ({
        id: p.id, nombre: p.nombre_corto, sku: p.sku, gtin_barcode: p.gtin_barcode,
      }))))
      .catch(() => {});
  }, []);

  function opcionesDe(tipo: ReglaTipo): Opcion[] {
    switch (tipo) {
      case 'marca':     return marcas;
      case 'rubro':     return rubros;
      case 'proveedor': return proveedores;
      case 'producto':  return productos;
      default:          return [];
    }
  }

  function nombreObjetivo(r: Regla): string {
    if (r.tipo === 'lista') return '— (toda la lista)';
    const found = opcionesDe(r.tipo).find(o => o.id === r.objetivo_id);
    return found?.nombre ?? r.objetivo_id ?? '—';
  }

  function abrirCrear() { setForm(emptyForm()); setError(null); setErrors({}); setModal({}); }
  function abrirEditar(r: Regla) {
    setForm({
      tipo: r.tipo,
      objetivo_id: r.objetivo_id ?? '',
      margen_pct: String(r.margen_pct),
      margen_min_pct: r.margen_min_pct != null ? String(r.margen_min_pct) : '',
      margen_max_pct: r.margen_max_pct != null ? String(r.margen_max_pct) : '',
      redondeo_modo: r.redondeo_modo,
      redondeo_valor: r.redondeo_valor != null ? String(r.redondeo_valor) : '',
      prioridad: String(r.prioridad),
    });
    setError(null);
    setErrors({});
    setModal({ id: r.id });
  }

  // ADR-085 (SEC-2): setter común — limpia el error inline del campo al tocarlo.
  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(s => ({ ...s, [field]: value }));
    setErrors(e => { if (!(field in e)) return e; const n = { ...e }; delete n[field]; return n; });
  }

  async function guardar() {
    if (form.tipo !== 'lista' && !form.objetivo_id) {
      setErrors(e => ({ ...e, objetivo_id: 'Elegí un objetivo para la regla.' }));
      document.getElementById('objetivo_id')?.focus();
      return;
    }
    setSaving(true); setError(null); setErrors({});
    const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));
    const r = await callIpc<{ id: string }>(
      () => f().precios.reglas.upsert({
        ...(modal?.id ? { id: modal.id } : {}),
        lista_precio_id: listaId,
        tipo: form.tipo,
        objetivo_id: form.tipo === 'lista' ? null : form.objetivo_id,
        margen_pct: Number(form.margen_pct) || 0,
        margen_min_pct: numOrNull(form.margen_min_pct),
        margen_max_pct: numOrNull(form.margen_max_pct),
        redondeo_modo: form.redondeo_modo,
        redondeo_valor: form.redondeo_modo === 'multiplo' ? (numOrNull(form.redondeo_valor)) : null,
        prioridad: Number(form.prioridad) || 100,
      }),
      { success: 'Regla guardada' },
    );
    setSaving(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    setModal(null);
    await load();
  }

  async function eliminar(id: string) {
    const r = await callIpc(() => f().precios.reglas.remove(id));
    if (!r.ok) return;
    await load();
  }

  const markupNum = Number(form.margen_pct) || 0;

  const reglasFiltradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return reglas;
    return reglas.filter(r => {
      if (nombreObjetivo(r).toLowerCase().includes(q)) return true;
      if (TIPO_LABEL[r.tipo].toLowerCase().includes(q)) return true;
      if (r.tipo === 'producto') {
        const prod = productos.find(p => p.id === r.objetivo_id);
        if (prod?.sku?.toLowerCase().includes(q)) return true;
        if (prod?.gtin_barcode?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reglas, filtro, productos, marcas, rubros, proveedores]);

  return (
    <div>
      {error && <div className="alert-error" style={{ margin: '4px var(--pad)' }}>{error}</div>}
      <div className="toolbar" style={{ background: 'none', border: 'none', padding: '8px var(--pad)' }}>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            placeholder="Buscar por objetivo, SKU o EAN…"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
        </div>
        <div className="ml-auto" />
        <button type="button" className="btn-primary" onClick={abrirCrear}>+ Nueva regla</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Objetivo</th>
              <th className="r">Margen (markup)</th>
              <th className="r">Margen real</th>
              <th>Redondeo</th>
              <th className="r">Prioridad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reglasFiltradas.map(r => (
              <tr key={r.id}>
                <td>{TIPO_LABEL[r.tipo]}</td>
                <td>{nombreObjetivo(r)}</td>
                <td className="r num">{r.margen_pct}%</td>
                <td className="r num text-muted">{margenRealDeMarkup(r.margen_pct).toFixed(1)}%</td>
                <td className="text-sm">
                  {REDONDEO_LABEL[r.redondeo_modo]}{r.redondeo_modo === 'multiplo' && r.redondeo_valor ? ` (${r.redondeo_valor})` : ''}
                </td>
                <td className="r num">{r.prioridad}</td>
                <td>
                  <div className="row-act">
                    <button type="button" className="ia" aria-label="Editar" onClick={() => abrirEditar(r)}>&#x270e;</button>
                    <button type="button" className="ia del" aria-label="Eliminar" onClick={() => eliminar(r.id)}>&#xd7;</button>
                  </div>
                </td>
              </tr>
            ))}
            {reglasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, fontSize: 13 }}>
                  {reglas.length === 0
                    ? 'Sin reglas de margen. La lista usa el fallback hasta que definas una.'
                    : 'Ninguna regla coincide con el filtro.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>{modal.id ? 'Editar regla' : 'Nueva regla'}</h2>
              <button className="ia" aria-label="Cerrar" onClick={() => setModal(null)}>&#x2715;</button>
            </div>
            <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div className="label-txt">Tipo</div>
                <select id="tipo" className={`input${errors.tipo ? ' error' : ''}`} aria-label="tipo de regla" value={form.tipo}
                  onChange={e => { setField('tipo', e.target.value as ReglaTipo); setField('objetivo_id', ''); }}>
                  <option value="lista">Lista (base)</option>
                  <option value="rubro">Rubro</option>
                  <option value="marca">Marca</option>
                  <option value="proveedor">Proveedor</option>
                  <option value="producto">Producto</option>
                </select>
                {errors.tipo && <span className="field-error">{errors.tipo}</span>}
              </label>
              {form.tipo !== 'lista' && (
                <label>
                  <div className="label-txt">Objetivo</div>
                  <select id="objetivo_id" className={`input${errors.objetivo_id ? ' error' : ''}`} aria-label="objetivo" value={form.objetivo_id}
                    onChange={e => setField('objetivo_id', e.target.value)}>
                    <option value="">— seleccionar —</option>
                    {opcionesDe(form.tipo).map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                  {errors.objetivo_id && <span className="field-error">{errors.objetivo_id}</span>}
                </label>
              )}
              <label>
                <div className="label-txt">Margen % (markup sobre costo)</div>
                <input id="margen_pct" className={`input num${errors.margen_pct ? ' error' : ''}`} type="number" step="0.01" aria-label="margen" value={form.margen_pct}
                  onChange={e => setField('margen_pct', e.target.value)} />
                {errors.margen_pct && <span className="field-error">{errors.margen_pct}</span>}
                <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                  Margen real sobre precio: <b>{margenRealDeMarkup(markupNum).toFixed(1)}%</b>
                </div>
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1 }}>
                  <div className="label-txt">Margen mín. %</div>
                  <input id="margen_min_pct" className={`input num${errors.margen_min_pct ? ' error' : ''}`} type="number" step="0.01" value={form.margen_min_pct}
                    placeholder="—" onChange={e => setField('margen_min_pct', e.target.value)} />
                  {errors.margen_min_pct && <span className="field-error">{errors.margen_min_pct}</span>}
                </label>
                <label style={{ flex: 1 }}>
                  <div className="label-txt">Margen máx. %</div>
                  <input id="margen_max_pct" className={`input num${errors.margen_max_pct ? ' error' : ''}`} type="number" step="0.01" value={form.margen_max_pct}
                    placeholder="—" onChange={e => setField('margen_max_pct', e.target.value)} />
                  {errors.margen_max_pct && <span className="field-error">{errors.margen_max_pct}</span>}
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1 }}>
                  <div className="label-txt">Redondeo</div>
                  <select id="redondeo_modo" className={`input${errors.redondeo_modo ? ' error' : ''}`} aria-label="redondeo" value={form.redondeo_modo}
                    onChange={e => setField('redondeo_modo', e.target.value as RedondeoModo)}>
                    <option value="ninguno">Ninguno</option>
                    <option value="terminacion_90">Terminación ,90</option>
                    <option value="terminacion_99">Terminación ,99</option>
                    <option value="multiplo">Múltiplo</option>
                  </select>
                  {errors.redondeo_modo && <span className="field-error">{errors.redondeo_modo}</span>}
                </label>
                {form.redondeo_modo === 'multiplo' && (
                  <label style={{ flex: 1 }}>
                    <div className="label-txt">Valor (centavos)</div>
                    <input id="redondeo_valor" className={`input num${errors.redondeo_valor ? ' error' : ''}`} type="number" value={form.redondeo_valor}
                      placeholder="100 = $1" onChange={e => setField('redondeo_valor', e.target.value)} />
                    {errors.redondeo_valor && <span className="field-error">{errors.redondeo_valor}</span>}
                  </label>
                )}
                <label style={{ flex: 1 }}>
                  <div className="label-txt">Prioridad</div>
                  <input id="prioridad" className={`input num${errors.prioridad ? ' error' : ''}`} type="number" value={form.prioridad}
                    onChange={e => setField('prioridad', e.target.value)} />
                  {errors.prioridad && <span className="field-error">{errors.prioridad}</span>}
                </label>
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="button" className="btn-primary" disabled={saving} onClick={guardar}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
