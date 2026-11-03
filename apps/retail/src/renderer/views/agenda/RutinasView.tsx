import { useMemo, useState } from 'react';
import { useRutinas, agendaApi, toDate, type Rutina, type FrecuenciaTipo } from '../../hooks/useAgenda';
import { RutinaFormModal } from './RutinaFormModal';
import { Modal } from '@core/ui';

const FREC_LABEL: Record<FrecuenciaTipo, string> = {
  unica: 'Única', diaria: 'Diaria', semanal: 'Semanal', mensual: 'Mensual', cada_n_dias: 'Cada N días',
};

type CampoOrden = 'nombre' | 'frecuencia_tipo' | 'proximo_disparo' | 'activa';

function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: 'asc' | 'desc' }>) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function fmt(v: Rutina['proximo_disparo']): string {
  const d = toDate(v);
  return d ? d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
}

export function RutinasView() {
  const { rutinas, cargando, error, recargar } = useRutinas();
  const [texto, setTexto] = useState('');
  const [filtroActiva, setFiltroActiva] = useState<'' | 'activa' | 'pausada'>('');
  const [orden, setOrden] = useState<CampoOrden>('nombre');
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('asc');
  const [formAbierto, setFormAbierto] = useState(false);
  const [editar, setEditar] = useState<Rutina | null>(null);
  const [eliminar, setEliminar] = useState<Rutina | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [accionError, setAccionError] = useState<string | null>(null);

  function handleOrdenar(campo: CampoOrden) {
    if (orden === campo) setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrden(campo); setOrdenDir('asc'); }
  }

  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const base = rutinas.filter((r) => {
      if (filtroActiva === 'activa' && !r.activa) return false;
      if (filtroActiva === 'pausada' && r.activa) return false;
      if (t && !r.nombre.toLowerCase().includes(t)) return false;
      return true;
    });
    const valor = (r: Rutina): string | number => {
      if (orden === 'nombre') return r.nombre.toLowerCase();
      if (orden === 'frecuencia_tipo') return r.frecuencia_tipo;
      if (orden === 'proximo_disparo') return toDate(r.proximo_disparo)?.getTime() ?? 0;
      return r.activa ? 1 : 0;
    };
    return [...base].sort((a, b) => {
      const va = valor(a); const vb = valor(b);
      let cmp = 0; if (va < vb) cmp = -1; else if (va > vb) cmp = 1;
      return ordenDir === 'asc' ? cmp : -cmp;
    });
  }, [rutinas, texto, filtroActiva, orden, ordenDir]);

  async function accion(fn: () => Promise<unknown>) {
    setProcesando(true);
    setAccionError(null);
    try { await fn(); await recargar(); setEliminar(null); }
    catch (e) { setAccionError(e instanceof Error ? e.message : 'Error al procesar la rutina.'); }
    finally { setProcesando(false); }
  }

  const th = (campo: CampoOrden, label: string) => (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar(campo)}>
      {label} <SortIcon active={orden === campo} dir={ordenDir} />
    </th>
  );

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <button type="button" className="btn-primary" onClick={() => { setEditar(null); setFormAbierto(true); }}>+ Nueva rutina</button>
        <div className="search" style={{ marginLeft: 12 }}>
          <input placeholder="Buscar por nombre…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginLeft: 'auto' }}>
          Estado
          <select className="input" style={{ width: 150, fontSize: '0.85rem' }} value={filtroActiva} onChange={(e) => setFiltroActiva(e.target.value as any)}>
            <option value="">Todas</option>
            <option value="activa">Activas</option>
            <option value="pausada">Pausadas</option>
          </select>
        </label>
      </div>

      {(error || (accionError && !eliminar)) && <div className="alert-danger" role="alert">{error || accionError}</div>}
      {cargando && <div className="text-muted" style={{ padding: 'var(--pad)' }}>Cargando…</div>}
      {!cargando && !error && filtradas.length === 0 && (
        <div className="text-muted" style={{ padding: 'var(--pad)', textAlign: 'center' }}>No hay rutinas.</div>
      )}

      {!cargando && filtradas.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {th('nombre', 'Nombre')}
                {th('frecuencia_tipo', 'Frecuencia')}
                {th('proximo_disparo', 'Próximo disparo')}
                {th('activa', 'Estado')}
                <th className="r">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}>
                  <td>{r.nombre}</td>
                  <td>{FREC_LABEL[r.frecuencia_tipo]}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmt(r.proximo_disparo)}</td>
                  <td>{r.activa ? <span className="badge ok"><span className="bd" />Activa</span> : <span className="badge off"><span className="bd" />Pausada</span>}</td>
                  <td className="r">
                    <div className="row-act">
                      <button type="button" className="ia" title="Editar" aria-label="Editar" onClick={() => { setEditar(r); setFormAbierto(true); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {r.activa
                        ? <button type="button" className="ia" title="Pausar" aria-label="Pausar" disabled={procesando} onClick={() => accion(() => agendaApi().rutina.pausar({ id: r.id }))}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          </button>
                        : <button type="button" className="ia" title="Reanudar" aria-label="Reanudar" disabled={procesando} onClick={() => accion(() => agendaApi().rutina.reanudar({ id: r.id }))}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </button>}
                      <button type="button" className="ia del" title="Eliminar" aria-label="Eliminar" onClick={() => setEliminar(r)}>
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

      {formAbierto && (
        <RutinaFormModal rutina={editar} onClose={() => setFormAbierto(false)}
          onGuardado={() => { setFormAbierto(false); void recargar(); }} />
      )}

      {eliminar && (
        <Modal ariaLabel="Eliminar rutina" ancho={420} onClose={() => setEliminar(null)} bloqueado={procesando}>
          <div className="modal-header"><span className="modal-title">Eliminar «{eliminar.nombre}»</span></div>
          <div className="modal-body">
            <div className="text-muted text-xs">La rutina se da de baja y deja de generar eventos. Los eventos ya creados no se tocan.</div>
            {accionError && <div className="alert-danger" role="alert" style={{ marginTop: 8 }}>{accionError}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setEliminar(null)} disabled={procesando}>Cancelar</button>
            <button type="button" className="btn-danger" disabled={procesando} onClick={() => accion(() => agendaApi().rutina.eliminar({ id: eliminar.id }))}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
