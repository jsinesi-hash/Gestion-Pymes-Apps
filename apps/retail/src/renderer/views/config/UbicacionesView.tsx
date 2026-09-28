import { useState, useEffect } from 'react';
import { useAuth } from '@core/ui';
import { useEscapeToClose } from '@core/ui';
import { rutearCampoError } from '@core/ui';
import { useToast } from '@core/ui';
import { canonicalizarUbicacion } from '@ferreteria/shared';
import { ExportarButton } from '@core/ui';
import { exportUbicaciones } from '@ferreteria/shared';

type UbicacionRow = {
  id: string; codigo: string; sector: string; estante: string; posicion: string;
  descripcion: string | null; activo: boolean; cantidad_productos: number;
};
type ModalState = { mode: 'create' } | { mode: 'edit'; ubicacion: UbicacionRow } | null;
type DeleteState = { ubicacion: UbicacionRow } | null;

const ubi = () => (globalThis as any).ferreteria.catalogo.ubicacion;

export function UbicacionesView() {
  const { can } = useAuth();
  const [rows, setRows] = useState<UbicacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [del, setDel] = useState<DeleteState>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'activas' | 'inactivas' | 'todas'>('activas');

  async function cargar() { setRows(await ubi().listAll()); }
  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  const q = busqueda.trim().toLowerCase();
  const filtradas = rows.filter(u => {
    if (filtroEstado === 'activas' && !u.activo) return false;
    if (filtroEstado === 'inactivas' && u.activo) return false;
    if (q && !u.codigo.toLowerCase().includes(q) && !(u.descripcion ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input placeholder="Buscar por código o descripción..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input" value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as 'activas' | 'inactivas' | 'todas')}
          style={{ width: 'auto', fontSize: '0.85rem' }}>
          <option value="activas">Solo activas</option>
          <option value="inactivas">Solo inactivas</option>
          <option value="todas">Todas</option>
        </select>
        <div className="ml-auto" />
        <ExportarButton definicion={exportUbicaciones} />
        {can('usuario.administrar') && <DedupBoton onDone={cargar} />}
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>+ Nueva ubicación</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th><th className="c">Sector</th><th className="c">Estante</th><th className="c">Posición</th>
              <th>Descripción</th><th className="c">Productos</th><th className="c">Estado</th><th className="c">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin resultados</td></tr>
            )}
            {filtradas.map(u => (
              <tr key={u.id}>
                <td style={{ whiteSpace: 'nowrap' }}><code>{u.codigo}</code></td>
                <td className="c">{u.sector}</td><td className="c">{u.estante}</td><td className="c">{u.posicion}</td>
                <td>{u.descripcion ?? ''}</td>
                <td className="c">{u.cantidad_productos}</td>
                <td className="c">
                  <span className={`badge ${u.activo ? 'ok' : 'off'}`}><span className="bd" />{u.activo ? 'Activa' : 'Inactiva'}</span>
                </td>
                <td className="c">
                  {u.activo && (
                    <div className="row-act" style={{ justifyContent: 'center' }}>
                      <button className="ia" title="Editar" aria-label="Editar" onClick={() => setModal({ mode: 'edit', ubicacion: u })}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="ia del" title="Eliminar" aria-label="Eliminar" onClick={() => setDel({ ubicacion: u })}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UbicacionModal
          initial={modal.mode === 'edit' ? modal.ubicacion : null}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await cargar(); }}
        />
      )}
      {del && (
        <EliminarModal
          ubicacion={del.ubicacion}
          destinos={rows.filter(r => r.activo && r.id !== del.ubicacion.id)}
          onClose={() => setDel(null)}
          onDone={async () => { setDel(null); await cargar(); }}
        />
      )}
    </div>
  );
}

function UbicacionModal({ initial, onClose, onSaved }: {
  initial: UbicacionRow | null; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [sector, setSector] = useState(initial?.sector ?? '');
  const [estante, setEstante] = useState(initial?.estante ?? '');
  const [posicion, setPosicion] = useState(initial?.posicion ?? '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-082 (SEC-2): error inline ruteado al campo que el backend rechazó.
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);
  useEscapeToClose(onClose, !saving);

  const preview = sector && estante && posicion
    ? canonicalizarUbicacion(sector, estante, posicion).codigo : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setCampoError(null);
    try {
      if (initial) {
        await ubi().update({ id: initial.id, descripcion: descripcion.trim() || null });
      } else {
        await ubi().create({ sector: sector.trim(), estante: estante.trim(), posicion: posicion.trim(), descripcion: descripcion.trim() || null });
      }
      toast.success('Ubicación guardada');
      await onSaved();
    } catch (err) {
      // ADR-082: primero ruteamos un rechazo por campo; si no, preservamos el mensaje
      // específico de YA_EXISTE y caemos al mensaje general traducido.
      const r = rutearCampoError(err, { sector: 'ub-sector', estante: 'ub-estante', posicion: 'ub-posicion', descripcion: 'ub-desc' });
      if (r.campo) { setCampoError({ campo: r.campo, mensaje: r.mensaje }); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.startsWith('YA_EXISTE:') ? `Ya existe la ubicación ${msg.split(':')[1]}. Editala en la lista.` : r.mensaje);
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header"><span className="modal-title">{initial ? `Editar ${initial.codigo}` : 'Nueva ubicación'}</span></div>
        <div className="modal-body">
          {!initial && (
            <div className="flex-row gap-2">
              <div className="field"><label htmlFor="ub-sector">Sector *</label>
                <input id="ub-sector" className={`input${campoError?.campo === 'sector' ? ' error' : ''}`} required value={sector} onChange={e => setSector(e.target.value)} autoFocus />
                {campoError?.campo === 'sector' && <span className="field-error">{campoError.mensaje}</span>}</div>
              <div className="field"><label htmlFor="ub-estante">Estante *</label>
                <input id="ub-estante" className={`input${campoError?.campo === 'estante' ? ' error' : ''}`} required value={estante} onChange={e => setEstante(e.target.value)} />
                {campoError?.campo === 'estante' && <span className="field-error">{campoError.mensaje}</span>}</div>
              <div className="field"><label htmlFor="ub-posicion">Posición *</label>
                <input id="ub-posicion" className={`input${campoError?.campo === 'posicion' ? ' error' : ''}`} required value={posicion} onChange={e => setPosicion(e.target.value)} />
                {campoError?.campo === 'posicion' && <span className="field-error">{campoError.mensaje}</span>}</div>
            </div>
          )}
          {!initial && preview && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Se guardará como <code>{preview}</code></div>
          )}
          <div className="field"><label htmlFor="ub-desc">Descripción</label>
            <input id="ub-desc" className={`input${campoError?.campo === 'descripcion' ? ' error' : ''}`} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" />
            {campoError?.campo === 'descripcion' && <span className="field-error">{campoError.mensaje}</span>}</div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving || (!initial && !(sector && estante && posicion))}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EliminarModal({ ubicacion, destinos, onClose, onDone }: {
  ubicacion: UbicacionRow; destinos: UbicacionRow[]; onClose: () => void; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [reasignarA, setReasignarA] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeToClose(onClose, !saving);
  const tieneProductos = ubicacion.cantidad_productos > 0;

  async function confirmar() {
    setSaving(true); setError(null);
    try {
      const payload: { id: string; reasignarA?: string | null } = { id: ubicacion.id };
      if (tieneProductos) payload.reasignarA = reasignarA === '__null__' ? null : reasignarA;
      await ubi().delete(payload);
      toast.success('Ubicación dada de baja');
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Eliminar {ubicacion.codigo}</span></div>
        <div className="modal-body">
          {tieneProductos ? (
            <>
              <p>Esta ubicación tiene <b>{ubicacion.cantidad_productos}</b> producto(s). Elegí a dónde moverlos antes de darla de baja:</p>
              <div className="field"><label htmlFor="ub-reasignar">Reasignar productos a</label>
                <select id="ub-reasignar" className="input" value={reasignarA} onChange={e => setReasignarA(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  <option value="__null__">Sin ubicación</option>
                  {destinos.map(d => <option key={d.id} value={d.id}>{d.codigo}</option>)}
                </select>
              </div>
            </>
          ) : <p>Se dará de baja la ubicación <code>{ubicacion.codigo}</code>. ¿Confirmás?</p>}
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={saving || (tieneProductos && !reasignarA)}>
            {saving ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

type DedupGrupoUI = {
  codigo: string;
  sobreviviente: { id: string; codigo: string };
  duplicados: { id: string; codigo: string }[];
  productos_a_reasignar: number;
};

function DedupBoton({ onDone }: { onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [grupos, setGrupos] = useState<DedupGrupoUI[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir() {
    setOpen(true);
    setError(null);
    try {
      setGrupos(await ubi().dedupPreview());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  async function aplicar() {
    setSaving(true);
    setError(null);
    try { await ubi().dedupAplicar(); await onDone(); setOpen(false); setGrupos(null); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSaving(false); }
  }

  return (
    <>
      <button className="btn-secondary" onClick={abrir}>Detectar duplicados</button>
      {open && (
        <div role="dialog" className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Deduplicar ubicaciones</span></div>
            <div className="modal-body">
              {error && <div className="alert-danger" role="alert">{error}</div>}
              {grupos === null && !error && <p>Analizando…</p>}
              {grupos !== null && grupos.length === 0 && <p>No se detectaron duplicados.</p>}
              {grupos !== null && grupos.length > 0 && (
                <>
                  <p>{grupos.length} grupo(s) con duplicados. Se conservará el código canónico y se reasignarán sus productos:</p>
                  <ul>
                    {grupos.map(g => (
                      <li key={g.codigo}>
                        <b>{g.codigo}</b> ← se dan de baja {g.duplicados.map(d => d.codigo).join(', ')}
                        {g.productos_a_reasignar > 0 && ` (${g.productos_a_reasignar} producto/s se mueven a ${g.codigo})`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setOpen(false); setGrupos(null); }} disabled={saving}>Cancelar</button>
              <button className="btn-primary" onClick={aplicar} disabled={saving || !grupos || grupos.length === 0}>
                {saving ? 'Aplicando…' : 'Fusionar duplicados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
