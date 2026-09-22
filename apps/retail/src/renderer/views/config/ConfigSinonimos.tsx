import { useState, useEffect, useCallback } from 'react';
import { useCallIpc } from '@core/ui';
import { ExportarButton } from '../../components/export/ExportarButton';
import { exportSinonimos } from '@ferreteria/shared';

// ADR-085 (SEC-2): campos del form de grupo que pueden mostrar un error inline. Sus inputs
// llevan un `id` igual a la clave, para poder enfocar el control cuando el backend rechaza por él.
const CAMPOS_ERROR = new Set(['canonico', 'sinonimos', 'abreviaturas', 'rubro', 'nota', 'grupo_id']);

type Grupo = {
  grupo_id: string;
  canonico: string;
  sinonimos: string[];
  abreviaturas: string[];
  rubro: string | null;
  nota: string | null;
  origen: 'seed' | 'manual' | 'import';
  total_terminos: number;
};

type FormState = {
  grupo_id?: string;
  canonico: string;
  sinonimos: string;      // separados por coma
  abreviaturas: string;   // separados por coma
  rubro: string;
  nota: string;
};

const VACIO: FormState = { canonico: '', sinonimos: '', abreviaturas: '', rubro: '', nota: '' };

const parseTerminos = (s: string): string[] =>
  s.split(/[,\n]/).map(x => x.trim()).filter(x => x.length > 0);

// ADR-067 — ABM de sinónimos de búsqueda (Supervisor). Incluye el toggle del flag
// `sinonimos_habilitado` (sin él, la expansión de búsqueda no se aplica).
export function ConfigSinonimos() {
  const [grupos, setGrupos]     = useState<Grupo[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [flag, setFlag]         = useState<'true' | 'false'>('false');
  const [flagSimil, setFlagSimil] = useState<'true' | 'false'>('false');
  const [form, setForm]         = useState<FormState | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [ok, setOk]             = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const callIpc = useCallIpc();
  const [importar, setImportar] = useState<null | {
    csv: string; nombre: string;
    preview?: { grupos: number; errores: string[]; advertencias: string[] };
    reemplazar: boolean;
  }>(null);

  const cargar = useCallback(async (q = '') => {
    try {
      const lista = await (globalThis as any).ferreteria.sinonimo.list({ busqueda: q });
      setGrupos(lista);
    } catch (e: any) { setError(e?.message ?? 'No se pudo listar.'); }
  }, []);

  const cargarFlag = useCallback(async () => {
    const v = await (globalThis as any).ferreteria.parametros.get({ clave: 'sinonimos_habilitado' });
    setFlag(v === 'true' ? 'true' : 'false');
  }, []);

  const cargarFlagSimil = useCallback(async () => {
    const v = await (globalThis as any).ferreteria.parametros.get({ clave: 'busqueda_similares_habilitado' });
    setFlagSimil(v === 'true' ? 'true' : 'false');
  }, []);

  useEffect(() => { cargar(); cargarFlag(); cargarFlagSimil(); }, [cargar, cargarFlag, cargarFlagSimil]);

  async function toggleFlag() {
    const nuevo = flag === 'true' ? 'false' : 'true';
    setError(null); setOk(null);
    try {
      await (globalThis as any).ferreteria.parametros.set({ clave: 'sinonimos_habilitado', valor: nuevo });
      setFlag(nuevo);
      setOk(nuevo === 'true' ? 'Búsqueda por sinónimos activada.' : 'Búsqueda por sinónimos desactivada.');
    } catch (e: any) { setError(e?.message ?? 'No se pudo cambiar el estado.'); }
  }

  async function toggleFlagSimil() {
    const nuevo = flagSimil === 'true' ? 'false' : 'true';
    setError(null); setOk(null);
    try {
      await (globalThis as any).ferreteria.parametros.set({ clave: 'busqueda_similares_habilitado', valor: nuevo });
      setFlagSimil(nuevo);
      setOk(nuevo === 'true' ? 'Búsqueda por similitud activada.' : 'Búsqueda por similitud desactivada.');
    } catch (e: any) { setError(e?.message ?? 'No se pudo cambiar el estado.'); }
  }

  async function guardar() {
    if (!form) return;
    setError(null); setOk(null); setFieldErrors({});
    const payload = {
      canonico: form.canonico.trim(),
      sinonimos: parseTerminos(form.sinonimos),
      abreviaturas: parseTerminos(form.abreviaturas),
      rubro: form.rubro.trim() || null,
      nota: form.nota.trim() || null,
    };
    if (!payload.canonico) { setError('El término canónico es obligatorio.'); return; }
    // ADR-085 (SEC-2): callIpc traduce y muestra el error por toast; sólo cerramos el
    // modal y recargamos si salió bien.
    const r = form.grupo_id
      ? await callIpc(
          () => (globalThis as any).ferreteria.sinonimo.update({ grupo_id: form.grupo_id, ...payload }),
          { success: 'Grupo de sinónimos guardado' },
        )
      : await callIpc(
          () => (globalThis as any).ferreteria.sinonimo.create(payload),
          { success: 'Grupo de sinónimos guardado' },
        );
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setFieldErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    setForm(null);
    await cargar(busqueda);
  }

  async function borrar(g: Grupo) {
    if (!confirm(`¿Eliminar el grupo "${g.canonico}" (${g.total_terminos} términos)?`)) return;
    setError(null); setOk(null);
    const r = await callIpc(
      () => (globalThis as any).ferreteria.sinonimo.delete({ grupo_id: g.grupo_id }),
      { success: 'Grupo eliminado' },
    );
    if (!r.ok) { setError(r.traducido.mensaje); return; }
    await cargar(busqueda);
  }

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-seleccionar el mismo archivo
    if (!file) return;
    setError(null); setOk(null);
    const csv = await file.text();
    try {
      const preview = await (globalThis as any).ferreteria.sinonimo.importarValidar({ csv });
      setImportar({ csv, nombre: file.name, preview, reemplazar: false });
    } catch (err: any) { setError(err?.message ?? 'No se pudo leer el archivo.'); }
  }

  async function confirmarImport() {
    if (!importar) return;
    setError(null); setOk(null);
    try {
      const res = await (globalThis as any).ferreteria.sinonimo.importar({ csv: importar.csv, reemplazar: importar.reemplazar });
      if (res.errores?.length) { setError(res.errores.join(' · ')); return; }
      setOk(`Importados ${res.gruposImportados} grupos${res.advertencias?.length ? ` (${res.advertencias.length} advertencias)` : ''}.`);
      setImportar(null);
      await cargar(busqueda);
    } catch (err: any) { setError(err?.message ?? 'No se pudo importar.'); }
  }

  function editar(g: Grupo) {
    setFieldErrors({});
    setForm({
      grupo_id: g.grupo_id,
      canonico: g.canonico,
      sinonimos: g.sinonimos.join(', '),
      abreviaturas: g.abreviaturas.join(', '),
      rubro: g.rubro ?? '',
      nota: g.nota ?? '',
    });
  }

  return (
    <div className="panel" style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sinónimos de búsqueda</h2>
      <p className="text-sm text-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Grupos de términos equivalentes: al buscar un producto, cualquier término del grupo
        encuentra a los demás. Las <strong>abreviaturas</strong> disparan la búsqueda pero no
        se usan como texto a buscar (evitan falsos positivos). Los acentos no importan.
      </p>

      {/* Toggle del flag */}
      <section style={{ padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="text-sm">
          Expansión por sinónimos en la búsqueda: <strong>{flag === 'true' ? 'Activada' : 'Desactivada'}</strong>
          <div className="text-xs text-muted">Con esto apagado, los grupos se administran pero no afectan la búsqueda.</div>
        </div>
        <button className={flag === 'true' ? 'btn-secondary' : 'btn-primary'} onClick={toggleFlag}>
          {flag === 'true' ? 'Desactivar' : 'Activar'}
        </button>
      </section>

      {/* Toggle del flag de búsqueda por similitud (Catálogo → "Buscar similares") */}
      <section style={{ padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="text-sm">
          Búsqueda por similitud en Catálogo: <strong>{flagSimil === 'true' ? 'Activada' : 'Desactivada'}</strong>
          <div className="text-xs text-muted">Habilita el modo "Buscar similares" en el listado de productos: rankea por parecido de nombre (token-set) para revisar duplicados o buscar por característica.</div>
        </div>
        <button
          className={flagSimil === 'true' ? 'btn-secondary' : 'btn-primary'}
          aria-label={flagSimil === 'true' ? 'Desactivar búsqueda por similitud' : 'Activar búsqueda por similitud'}
          onClick={toggleFlagSimil}
        >
          {flagSimil === 'true' ? 'Desactivar' : 'Activar'}
        </button>
      </section>

      {/* Toolbar */}
      <div className="toolbar">
        <input
          className="input"
          placeholder="Buscar término…"
          value={busqueda}
          style={{ flex: 1 }}
          onChange={e => { setBusqueda(e.target.value); cargar(e.target.value); }}
        />
        <label className="btn-secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
          Importar CSV…
          <input type="file" accept=".csv,text/csv" onChange={onArchivo} style={{ display: 'none' }} />
        </label>
        <ExportarButton definicion={exportSinonimos} />
        <button className="btn-primary" onClick={() => { setFieldErrors({}); setForm({ ...VACIO }); }}>Nuevo grupo</button>
      </div>

      {error && <div className="alert-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {ok && (
        <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(46,125,82,.1)', color: 'var(--ok)', border: '1px solid rgba(46,125,82,.25)' }}>{ok}</div>
      )}

      {/* Tabla de grupos */}
      {grupos.length === 0 ? (
        <p className="text-sm text-muted">No hay grupos {busqueda ? 'para esa búsqueda' : 'cargados'}.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Canónico</th>
                <th>Sinónimos</th>
                <th>Abreviaturas</th>
                <th>Rubro</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grupos.map(g => (
                <tr
                  key={g.grupo_id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Editar grupo ${g.canonico}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => editar(g)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editar(g); } }}
                >
                  <td><div className="p-name">{g.canonico}</div></td>
                  <td>{g.sinonimos.join(', ') || '—'}</td>
                  <td>{g.abreviaturas.join(', ') || '—'}</td>
                  <td>{g.rubro ?? '—'}</td>
                  <td className="c" onClick={e => e.stopPropagation()}>
                    <div className="row-act" style={{ justifyContent: 'center' }}>
                      <button className="ia" title="Editar" aria-label="Editar" onClick={() => editar(g)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="ia del" title="Eliminar" aria-label="Eliminar" onClick={() => borrar(g)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal importar CSV */}
      {importar && (
        <div role="dialog" aria-label="Importar sinónimos" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 24, width: 560, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Importar sinónimos</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 14 }}>Archivo: <strong>{importar.nombre}</strong></p>
            {importar.preview && (
              <div className="text-sm" style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                <div>Grupos en el archivo: <strong>{importar.preview.grupos}</strong></div>
                {importar.preview.errores.length > 0 && (
                  <div className="alert-danger" role="alert">
                    <strong>{importar.preview.errores.length} error(es) — no se puede importar:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {importar.preview.errores.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
                {importar.preview.advertencias.length > 0 && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(180,105,14,.1)', color: 'var(--warn)', border: '1px solid rgba(180,105,14,.25)' }}>
                    {importar.preview.advertencias.length} advertencia(s) (no bloquean).
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={importar.reemplazar} onChange={e => setImportar({ ...importar, reemplazar: e.target.checked })} />
                  <span>Reemplazar importaciones anteriores (no toca los grupos creados a mano)</span>
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setImportar(null)}>Cancelar</button>
              <button className="btn-primary" disabled={!!importar.preview?.errores.length} onClick={confirmarImport}
                style={{ opacity: importar.preview?.errores.length ? .6 : 1 }}>
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal alta/edición */}
      {form && (
        <div role="dialog" aria-label="Grupo de sinónimos" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 24, width: 560, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{form.grupo_id ? 'Editar grupo' : 'Nuevo grupo'}</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="field">
                <label htmlFor="canonico">Término canónico *</label>
                <input
                  id="canonico"
                  className={`input${fieldErrors.canonico ? ' error' : ''}`}
                  value={form.canonico}
                  onChange={e => { setForm({ ...form, canonico: e.target.value }); setFieldErrors(fe => { const n = { ...fe }; delete n.canonico; return n; }); }}
                />
                {fieldErrors.canonico && <span className="field-error">{fieldErrors.canonico}</span>}
              </div>
              <div className="field">
                <label htmlFor="sinonimos">Sinónimos (separados por coma)</label>
                <textarea
                  id="sinonimos"
                  className={`input${fieldErrors.sinonimos ? ' error' : ''}`}
                  rows={2}
                  value={form.sinonimos}
                  onChange={e => { setForm({ ...form, sinonimos: e.target.value }); setFieldErrors(fe => { const n = { ...fe }; delete n.sinonimos; return n; }); }}
                  placeholder="pinza, tenaza, pliers"
                />
                {fieldErrors.sinonimos && <span className="field-error">{fieldErrors.sinonimos}</span>}
              </div>
              <div className="field">
                <label htmlFor="abreviaturas">Abreviaturas (solo disparan la búsqueda)</label>
                <textarea
                  id="abreviaturas"
                  className={`input${fieldErrors.abreviaturas ? ' error' : ''}`}
                  rows={1}
                  value={form.abreviaturas}
                  onChange={e => { setForm({ ...form, abreviaturas: e.target.value }); setFieldErrors(fe => { const n = { ...fe }; delete n.abreviaturas; return n; }); }}
                  placeholder="alic., alic"
                />
                {fieldErrors.abreviaturas && <span className="field-error">{fieldErrors.abreviaturas}</span>}
              </div>
              <div className="field">
                <label htmlFor="rubro">Rubro</label>
                <input
                  id="rubro"
                  className={`input${fieldErrors.rubro ? ' error' : ''}`}
                  value={form.rubro}
                  onChange={e => { setForm({ ...form, rubro: e.target.value }); setFieldErrors(fe => { const n = { ...fe }; delete n.rubro; return n; }); }}
                />
                {fieldErrors.rubro && <span className="field-error">{fieldErrors.rubro}</span>}
              </div>
              <div className="field">
                <label htmlFor="nota">Nota</label>
                <input
                  id="nota"
                  className={`input${fieldErrors.nota ? ' error' : ''}`}
                  value={form.nota}
                  onChange={e => { setForm({ ...form, nota: e.target.value }); setFieldErrors(fe => { const n = { ...fe }; delete n.nota; return n; }); }}
                />
                {fieldErrors.nota && <span className="field-error">{fieldErrors.nota}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
