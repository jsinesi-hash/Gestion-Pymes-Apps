import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  costoNeto,
  resolverComponentesComerciales,
  type OverrideComercialProducto,
  type DefaultsComercialProveedor,
} from '@ferreteria/shared';
import { useMotorPreciosV2Habilitado } from '../../hooks/useMotorPrecios';
import { useEscapeToClose, bridge } from '@core/ui';
import { useAuth } from '@core/ui';
import { useCallIpc } from '@core/ui';

// ADR-085 (SEC-2): campos de cada form que pueden recibir un error de validación del
// backend, mapeados al `id` del control focoable correspondiente (los dos forms usan
// nombres de campo iguales para el costo, así que los ids del DOM van prefijados para
// no colisionar si ambos llegaran a estar abiertos a la vez).
const ID_ALTA: Record<string, string> = {
  proveedor_id: 'pp_add_proveedor_id',
  costo_centavos: 'pp_add_costo_centavos',
  codigo_proveedor: 'pp_add_codigo_proveedor',
};
const ID_OVERRIDE: Record<string, string> = {
  costo_centavos: 'pp_ov_costo_bruto',
  bonificacion_pct: 'pp_ov_bonificacion_pct',
  costo_financiero_pct: 'pp_ov_costo_financiero_pct',
  flete_pct: 'pp_ov_flete_pct',
  flete_centavos: 'pp_ov_flete_centavos',
  otros_costos_centavos: 'pp_ov_otros_costos_centavos',
};

type VinculoProveedor = {
  id: string;
  proveedor_id: string;
  razon_social: string;
  costo_centavos: number;
  codigo_proveedor: string | null;
  preferido: boolean;
  // ADR-049 §1 — overrides (null = hereda) + defaults del proveedor.
  bonificacion_pct: number | null;
  costo_financiero_pct: number | null;
  flete_pct: number | null;
  flete_centavos: number | null;
  otros_costos_centavos: number | null;
  bonificacion_pct_default: number;
  costo_financiero_pct_default: number;
  flete_pct_default: number;
};

function centavosToARS(c: number) {
  return (c / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

// ADR-052 — estilos compactos del editor de overrides (label y campo reducidos
// respecto del resto del formulario, que quedaba desproporcionado).
const ovLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 3 };
const ovInputStyle = { fontSize: 13, padding: '6px 8px', width: '100%', boxSizing: 'border-box' as const };

function overrideDe(v: VinculoProveedor): OverrideComercialProducto {
  return {
    bonificacionPct: v.bonificacion_pct,
    costoFinancieroPct: v.costo_financiero_pct,
    fletePct: v.flete_pct,
    fleteCentavos: v.flete_centavos,
    otrosCostosCentavos: v.otros_costos_centavos,
  };
}

function defaultsDe(v: VinculoProveedor): DefaultsComercialProveedor {
  return {
    bonificacionPctDefault: v.bonificacion_pct_default,
    costoFinancieroPctDefault: v.costo_financiero_pct_default,
    fletePctDefault: v.flete_pct_default,
  };
}

const f = () => bridge();

/** Campo de override: vacío = heredar (null). */
function toNumOrNull(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** % con herencia: null si el valor ingresado coincide con el default del proveedor (sigue heredando). */
function overrideODefault(input: string, def: number): number | null {
  const n = toNumOrNull(input);
  if (n == null) return null;
  return n === def ? null : n;
}

type OverrideForm = {
  costo_bruto: string;
  bonificacion_pct: string;
  costo_financiero_pct: string;
  flete_pct: string;
  flete: string; // en pesos; se convierte a centavos al guardar
  otros: string; // en pesos
};

type ProveedorLite = { id: string; razon_social: string; activo: boolean };

type AddForm = {
  proveedor_id: string;
  costo: string;
  codigo: string;
  preferido: boolean;
};

const ADD_FORM_INICIAL: AddForm = { proveedor_id: '', costo: '', codigo: '', preferido: false };

export function ProveedoresPanel({ productoId }: Readonly<{ productoId: string }>) {
  const habilitado = useMotorPreciosV2Habilitado();
  const { can } = useAuth();
  const puedeGestionar = can('proveedor.gestionar');
  const callIpc = useCallIpc();
  const [vinculos, setVinculos] = useState<VinculoProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OverrideForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ADR-083 — alta rápida de proveedor asociado desde el detalle del producto.
  const [proveedores, setProveedores] = useState<ProveedorLite[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(ADD_FORM_INICIAL);
  const [savingAdd, setSavingAdd] = useState(false);

  useEscapeToClose(() => { setEditId(null); setForm(null); }, !!form);
  useEscapeToClose(cerrarAlta, showAdd);

  async function load() {
    const data = await f().compras.pp.listByProducto(productoId).catch(() => []);
    setVinculos(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [productoId]);

  useEffect(() => {
    if (!puedeGestionar) return;
    f().compras.proveedor.list().then(setProveedores).catch(() => setProveedores([]));
  }, [puedeGestionar]);

  function abrirAlta() {
    setError(null);
    setAddForm(ADD_FORM_INICIAL);
    setShowAdd(true);
  }

  function cerrarAlta() {
    setShowAdd(false);
    setAddForm(ADD_FORM_INICIAL);
    setError(null);
  }

  async function guardarAlta() {
    if (!addForm.proveedor_id) {
      setError('Elegí un proveedor.');
      return;
    }
    const costoNum = addForm.costo.trim() === '' ? 0 : Number(addForm.costo.replace(',', '.'));
    const costoCentavos = Number.isFinite(costoNum) ? Math.round(costoNum * 100) : 0;
    setSavingAdd(true);
    setError(null);
    // ADR-085 (SEC-2): callIpc traduce y muestra el error por toast; si el backend
    // rechaza un campo de validación, lo enrutamos al control focoable correspondiente.
    const r = await callIpc<{ id: string }>(
      () => f().compras.pp.upsert({
        producto_id: productoId,
        proveedor_id: addForm.proveedor_id,
        costo_centavos: costoCentavos,
        codigo_proveedor: addForm.codigo.trim() || undefined,
      }),
      { success: 'Proveedor asociado' },
    );
    if (!r.ok) {
      setSavingAdd(false);
      setError(r.traducido.mensaje);
      const campo = r.traducido.campo;
      if (campo && ID_ALTA[campo]) document.getElementById(ID_ALTA[campo])?.focus();
      return;
    }
    try {
      if (vinculos.length === 0 || addForm.preferido) {
        await f().compras.pp.setPreferido(r.data.id);
      }
      cerrarAlta();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar el proveedor');
    } finally {
      setSavingAdd(false);
    }
  }

  // ADR-052 — elegir el proveedor preferido desde el detalle. Update optimista
  // (un único preferido activo, ADR-036) + rollback si el IPC falla.
  async function elegirPreferido(v: VinculoProveedor) {
    if (v.preferido) return;
    const previo = vinculos;
    setError(null);
    setVinculos(vs => vs.map(x => ({ ...x, preferido: x.id === v.id })));
    try {
      await f().compras.pp.setPreferido(v.id);
      await load();
    } catch (err) {
      setVinculos(previo); // rollback
      setError(err instanceof Error ? err.message : 'Error al cambiar el preferido');
    }
  }

  function abrirOverride(v: VinculoProveedor) {
    setError(null);
    setEditId(v.id);
    const efectivo = resolverComponentesComerciales(overrideDe(v), defaultsDe(v));
    setForm({
      costo_bruto: (v.costo_centavos / 100).toString(),
      bonificacion_pct: efectivo.bonificacionPct.toString(),
      costo_financiero_pct: efectivo.costoFinancieroPct.toString(),
      flete_pct: efectivo.fletePct.toString(),
      flete: v.flete_centavos != null ? (v.flete_centavos / 100).toString() : '',
      otros: v.otros_costos_centavos != null ? (v.otros_costos_centavos / 100).toString() : '',
    });
  }

  async function guardarOverride() {
    if (!editId || !form) return;
    const v = vinculos.find(x => x.id === editId);
    if (!v) return;
    const costoBruto = Number(form.costo_bruto);
    if (form.costo_bruto.trim() === '' || !Number.isFinite(costoBruto) || costoBruto < 0) {
      setError('El costo bruto debe ser un número mayor o igual a 0.');
      return;
    }
    setSaving(true);
    setError(null);
    const fleteCent = toNumOrNull(form.flete);
    const otrosCent = toNumOrNull(form.otros);
    // ADR-085 (SEC-2): callIpc traduce y muestra el error por toast; si el backend
    // rechaza un campo de validación, lo enrutamos al control focoable correspondiente.
    const r = await callIpc(
      () => f().compras.pp.setOverrides(editId, {
        costo_centavos: Math.round(costoBruto * 100),
        bonificacion_pct: overrideODefault(form.bonificacion_pct, v.bonificacion_pct_default),
        costo_financiero_pct: overrideODefault(form.costo_financiero_pct, v.costo_financiero_pct_default),
        flete_pct: overrideODefault(form.flete_pct, v.flete_pct_default),
        flete_centavos: fleteCent != null ? Math.round(fleteCent * 100) : null,
        otros_costos_centavos: otrosCent != null ? Math.round(otrosCent * 100) : null,
      }),
      { success: 'Costo de proveedor guardado' },
    );
    setSaving(false);
    if (!r.ok) {
      setError(r.traducido.mensaje);
      const campo = r.traducido.campo;
      if (campo && ID_OVERRIDE[campo]) document.getElementById(ID_OVERRIDE[campo])?.focus();
      return;
    }
    setEditId(null);
    setForm(null);
    await load();
  }

  // ADR-083 — encabezado con botón de alta + form inline, compartidos entre las dos ramas
  // (flag apagado / encendido) para no duplicar el markup del alta.
  const cardHeader = (
    <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span>Proveedores</span>
      {puedeGestionar && !showAdd && (
        <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={abrirAlta}>
          + Agregar proveedor
        </button>
      )}
    </div>
  );

  const addFormBlock = showAdd && (
    <div style={{ padding: '12px var(--pad)', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <label>
          <span style={ovLabelStyle}>Proveedor</span>
          <select
            id="pp_add_proveedor_id"
            className="input"
            style={ovInputStyle}
            value={addForm.proveedor_id}
            onChange={e => setAddForm({ ...addForm, proveedor_id: e.target.value })}
          >
            <option value="">Elegir...</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.razon_social}</option>
            ))}
          </select>
        </label>
        <label>
          <span style={ovLabelStyle}>Costo bruto ($)</span>
          <input
            id="pp_add_costo_centavos"
            className="input num"
            style={ovInputStyle}
            type="number"
            step="0.01"
            placeholder="opcional"
            value={addForm.costo}
            onChange={e => setAddForm({ ...addForm, costo: e.target.value })}
          />
        </label>
        <label>
          <span style={ovLabelStyle}>Código</span>
          <input
            id="pp_add_codigo_proveedor"
            className="input"
            style={ovInputStyle}
            type="text"
            placeholder="opcional"
            value={addForm.codigo}
            onChange={e => setAddForm({ ...addForm, codigo: e.target.value })}
          />
        </label>
        {vinculos.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
            <input
              type="checkbox"
              checked={addForm.preferido}
              onChange={e => setAddForm({ ...addForm, preferido: e.target.checked })}
            />
            <span style={{ fontSize: 12.5 }}>Marcar como preferido</span>
          </label>
        )}
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-secondary" onClick={cerrarAlta}>Cancelar</button>
        <button type="button" className="btn-primary" disabled={savingAdd} onClick={guardarAlta}>
          {savingAdd ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );

  // ── Flag apagado: comportamiento previo a ADR-049 (lista simple, solo lectura) ──
  if (!habilitado) {
    return (
      <div className="card">
        {cardHeader}
        {!showAdd && error && (
          <div className="alert-error" style={{ margin: '4px var(--pad)' }}>{error}</div>
        )}
        {addFormBlock}
        {loading ? (
          <div style={{ padding: '12px var(--pad)', opacity: 0.5 }}>Cargando...</div>
        ) : vinculos.length === 0 ? (
          <div style={{ padding: '12px var(--pad)', opacity: 0.5, fontStyle: 'italic' }}>
            Sin proveedores asociados. Para agregar uno, ir al detalle del proveedor en{' '}
            <Link to="/compras/proveedores" style={{ color: 'var(--accent)' }}>Compras → Proveedores</Link>.
          </div>
        ) : (
          vinculos.map(v => (
            <Link
              key={v.id}
              to={`/compras/proveedores/${v.proveedor_id}`}
              style={{ display: 'block', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ padding: '10px var(--pad)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <span style={{ fontWeight: 500 }}>{v.razon_social}</span>
                  {v.preferido && (
                    <span className="badge ok" style={{ marginLeft: '8px', fontSize: '11px', padding: '1px 6px' }}>
                      <span className="bd" />preferido
                    </span>
                  )}
                </div>
                <span className="num" style={{ minWidth: '100px' }}>$ {centavosToARS(v.costo_centavos)}</span>
                {v.codigo_proveedor && (
                  <span className="num" style={{ opacity: 0.6, fontSize: '12px' }}>{v.codigo_proveedor}</span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    );
  }

  // ── Flag encendido: costo neto desglosado + edición de overrides por producto ──
  return (
    <div className="card">
      {cardHeader}
      {!showAdd && error && (
        <div className="alert-error" style={{ margin: '4px var(--pad)' }}>{error}</div>
      )}
      {addFormBlock}
      {loading ? (
        <div style={{ padding: '12px var(--pad)', opacity: 0.5 }}>Cargando...</div>
      ) : vinculos.length === 0 ? (
        <div style={{ padding: '12px var(--pad)', opacity: 0.5, fontStyle: 'italic' }}>
          Sin proveedores asociados. Para agregar uno, ir al detalle del proveedor en{' '}
          <Link to="/compras/proveedores" style={{ color: 'var(--accent)' }}>Compras → Proveedores</Link>.
        </div>
      ) : (
        <div className="table-wrap" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th className="c">Pref.</th>
                <th>Proveedor</th>
                <th>Cód. prov.</th>
                <th className="num">Costo bruto</th>
                <th className="num">Bonif.</th>
                <th className="num">Flete</th>
                <th className="num" title="Costo financiero">Cost. Finan.</th>
                <th className="num">Costo neto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vinculos.map(v => {
                const efectivo = resolverComponentesComerciales(overrideDe(v), defaultsDe(v));
                const neto = costoNeto(v.costo_centavos, overrideDe(v), defaultsDe(v));
                const ov = (b: unknown) => (b != null ? { fontWeight: 700, color: 'var(--accent)' } : undefined);
                return (
                  <tr key={v.id} style={v.preferido ? { background: 'var(--accent-soft)' } : undefined}>
                    <td className="c" style={{ fontWeight: 800 }}>
                      {v.preferido ? (
                        <span style={{ color: 'var(--accent)' }} title="Proveedor preferido">●</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => elegirPreferido(v)}
                          aria-label={`Marcar ${v.razon_social} como preferido`}
                          title="Marcar como preferido"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--border)', font: 'inherit', fontWeight: 800 }}
                        >○</button>
                      )}
                    </td>
                    <td>
                      <Link to={`/compras/proveedores/${v.proveedor_id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>
                        {v.razon_social}
                      </Link>
                    </td>
                    <td><code className="text-xs">{v.codigo_proveedor ?? '—'}</code></td>
                    <td className="num">$ {centavosToARS(v.costo_centavos)}</td>
                    <td className="num" style={ov(v.bonificacion_pct)} title={v.bonificacion_pct != null ? 'Override del producto' : 'Heredado del proveedor'}>
                      {efectivo.bonificacionPct !== 0 ? `−${efectivo.bonificacionPct.toLocaleString('es-AR')}%` : '—'}
                    </td>
                    <td className="num" style={ov(v.flete_centavos ?? v.flete_pct)}>
                      {neto.fleteCentavos !== 0 ? `$ ${centavosToARS(neto.fleteCentavos)}` : '—'}
                    </td>
                    <td className="num" style={ov(v.costo_financiero_pct)}>
                      {efectivo.costoFinancieroPct !== 0 ? `+${efectivo.costoFinancieroPct.toLocaleString('es-AR')}%` : '—'}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>$ {centavosToARS(neto.netoCentavos)}</td>
                    <td>
                      <div className="row-act">
                        <button className="ia" onClick={() => abrirOverride(v)} aria-label="Ajustar costos" title="Ajustar costos de este producto">&#x270e;</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '9px var(--pad)', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-muted, inherit)', opacity: 0.75 }}>
            Bonif. y Cost. Finan. se <b>heredan del proveedor</b> (se editan en su ficha); acá se
            sobrescriben por excepción. El costo neto del preferido alimenta las reglas de margen.
          </div>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => { setEditId(null); setForm(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header" style={{ padding: '12px var(--pad)' }}>
              <h2 style={{ fontSize: 15, margin: 0 }}>Ajustes de costo del producto</h2>
              <button className="ia" aria-label="Cerrar" onClick={() => { setEditId(null); setForm(null); }}>&#x2715;</button>
            </div>
            <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="text-muted text-xs">
                Los campos traen el <b>valor vigente</b> del proveedor. Cambiá un % para fijarlo propio del producto;
                dejalo igual (o vacío) para <b>seguir heredando</b>. El Costo bruto es propio del producto.
              </div>
              <label>
                <span style={ovLabelStyle}>Costo bruto ($)</span>
                <input id="pp_ov_costo_bruto" className="input num" style={ovInputStyle} type="number" step="0.01" value={form.costo_bruto}
                  onChange={e => setForm({ ...form, costo_bruto: e.target.value })} />
              </label>
              {/* Campos de a pares (uno al lado del otro), no apilados (ADR-052). */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <label>
                  <span style={ovLabelStyle}>Bonif. %</span>
                  <input id="pp_ov_bonificacion_pct" className="input num" style={ovInputStyle} type="number" step="0.01" value={form.bonificacion_pct}
                    onChange={e => setForm({ ...form, bonificacion_pct: e.target.value })} />
                </label>
                <label>
                  <span style={ovLabelStyle}>Cost. fin. %</span>
                  <input id="pp_ov_costo_financiero_pct" className="input num" style={ovInputStyle} type="number" step="0.01" value={form.costo_financiero_pct}
                    onChange={e => setForm({ ...form, costo_financiero_pct: e.target.value })} />
                </label>
                <label title="Flete % (prorrateo)">
                  <span style={ovLabelStyle}>Flete %</span>
                  <input id="pp_ov_flete_pct" className="input num" style={ovInputStyle} type="number" step="0.01" value={form.flete_pct}
                    onChange={e => setForm({ ...form, flete_pct: e.target.value })} />
                </label>
                <label title="Flete $ absoluto — pisa al %">
                  <span style={ovLabelStyle}>Flete $</span>
                  <input id="pp_ov_flete_centavos" className="input num" style={ovInputStyle} type="number" step="0.01" value={form.flete}
                    placeholder="peso/vol."
                    onChange={e => setForm({ ...form, flete: e.target.value })} />
                </label>
                <label>
                  <span style={ovLabelStyle}>Otros $</span>
                  <input id="pp_ov_otros_costos_centavos" className="input num" style={ovInputStyle} type="number" step="0.01" value={form.otros}
                    placeholder="opcional"
                    onChange={e => setForm({ ...form, otros: e.target.value })} />
                </label>
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => { setEditId(null); setForm(null); }}>Cancelar</button>
                <button type="button" className="btn-primary" disabled={saving} onClick={guardarOverride}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
