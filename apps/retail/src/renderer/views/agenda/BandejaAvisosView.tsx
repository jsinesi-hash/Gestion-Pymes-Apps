import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAvisos, agendaApi, parsePayload, toDate, type Aviso, type AvisoCanal, type AvisoEstado } from '../../hooks/useAgenda';
import { Modal } from '@core/ui';

const CANALES: Array<{ valor: string; label: string }> = [
  { valor: '', label: 'Todos los canales' },
  { valor: 'in_app', label: 'En la app' },
  { valor: 'email', label: 'Email' },
  { valor: 'whatsapp', label: 'WhatsApp' },
];
const ESTADOS: Array<{ valor: string; label: string }> = [
  { valor: 'activos', label: 'Activos (pendiente + fallido)' },
  { valor: '', label: 'Todos' },
  { valor: 'pendiente', label: 'Pendiente' },
  { valor: 'enviado', label: 'Enviado' },
  { valor: 'fallido', label: 'Fallido' },
  { valor: 'descartado', label: 'Descartado' },
];

const CANAL_LABEL: Record<AvisoCanal, string> = { in_app: 'En la app', email: 'Email', whatsapp: 'WhatsApp' };

type CampoOrden = 'generado_at' | 'canal' | 'estado' | 'intentos' | 'enviado_at';

function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: 'asc' | 'desc' }>) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function fmt(v: Aviso['generado_at']): string {
  const d = toDate(v);
  return d ? d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
}

function EstadoBadge({ estado }: Readonly<{ estado: AvisoEstado }>) {
  if (estado === 'enviado') return <span className="badge ok"><span className="bd" />Enviado</span>;
  if (estado === 'descartado') return <span className="badge off"><span className="bd" />Descartado</span>;
  if (estado === 'fallido') return <span className="badge" style={{ color: 'var(--danger)' }}><span className="bd" />Fallido</span>;
  return <span className="badge-warn">Pendiente</span>;
}

const PESO_ESTADO: Record<AvisoEstado, number> = { fallido: 0, pendiente: 1, enviado: 2, descartado: 3 };

export function BandejaAvisosView() {
  const navigate = useNavigate();
  const { avisos, cargando, error, recargar } = useAvisos();
  const [texto, setTexto] = useState('');
  const [canal, setCanal] = useState('');
  const [estado, setEstado] = useState('activos');
  const [orden, setOrden] = useState<CampoOrden>('generado_at');
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('desc');
  const [traza, setTraza] = useState<Aviso | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [accionError, setAccionError] = useState<string | null>(null);

  function handleOrdenar(campo: CampoOrden) {
    if (orden === campo) setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrden(campo); setOrdenDir('asc'); }
  }

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const base = avisos.filter((a) => {
      if (canal && a.canal !== canal) return false;
      if (estado === 'activos') { if (a.estado !== 'pendiente' && a.estado !== 'fallido') return false; }
      else if (estado) { if (a.estado !== estado) return false; }
      if (t) {
        const pl = parsePayload(a.payload);
        const coincide = (pl.titulo ?? '').toLowerCase().includes(t)
          || (pl.cuerpo ?? '').toLowerCase().includes(t)
          || (a.destinatario_contacto ?? '').toLowerCase().includes(t);
        if (!coincide) return false;
      }
      return true;
    });
    const valor = (a: Aviso): string | number => {
      if (orden === 'generado_at') return toDate(a.generado_at)?.getTime() ?? 0;
      if (orden === 'enviado_at') return toDate(a.enviado_at)?.getTime() ?? 0;
      if (orden === 'intentos') return a.intentos;
      if (orden === 'canal') return a.canal;
      return a.estado;
    };
    return [...base].sort((a, b) => {
      // Fallidos SIEMPRE arriba, sin importar el orden elegido.
      if (PESO_ESTADO[a.estado] !== PESO_ESTADO[b.estado]) return PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado];
      const va = valor(a); const vb = valor(b);
      let cmp = 0;
      if (va < vb) cmp = -1; else if (va > vb) cmp = 1;
      return ordenDir === 'asc' ? cmp : -cmp;
    });
  }, [avisos, texto, canal, estado, orden, ordenDir]);

  async function accion(fn: () => Promise<unknown>) {
    setProcesando(true);
    setAccionError(null);
    try { await fn(); await recargar(); }
    catch (e) { setAccionError(e instanceof Error ? e.message : 'Error al procesar el aviso.'); }
    finally { setProcesando(false); }
  }

  function abrirOrigen(a: Aviso) {
    if (a.origen_tipo === 'agenda_evento' && a.agenda_evento_id) navigate('/agenda');
  }

  const th = (campo: CampoOrden, label: string, cls = '') => (
    <th className={cls} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar(campo)}>
      {label} <SortIcon active={orden === campo} dir={ordenDir} />
    </th>
  );

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="search">
          <input placeholder="Buscar por título, cuerpo o destinatario…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginLeft: 'auto' }}>
          Canal
          <select className="input" style={{ width: 150, fontSize: '0.85rem' }} value={canal} onChange={(e) => setCanal(e.target.value)}>
            {CANALES.map((c) => <option key={c.valor || 'todos'} value={c.valor}>{c.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
          Estado
          <select className="input" style={{ width: 210, fontSize: '0.85rem' }} value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e.valor || 'todos'} value={e.valor}>{e.label}</option>)}
          </select>
        </label>
      </div>

      {(error || accionError) && <div className="alert-danger" role="alert">{error || accionError}</div>}
      {cargando && <div className="text-muted" style={{ padding: 'var(--pad)' }}>Cargando…</div>}

      {!cargando && !error && filtrados.length === 0 && (
        <div className="text-muted" style={{ padding: 'var(--pad)', textAlign: 'center' }}>No hay avisos para el filtro seleccionado.</div>
      )}

      {!cargando && filtrados.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Título</th>
                {th('canal', 'Canal')}
                {th('estado', 'Estado')}
                {th('intentos', 'Intentos', 'c')}
                {th('generado_at', 'Generado')}
                {th('enviado_at', 'Enviado')}
                <th className="r">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => {
                const pl = parsePayload(a.payload);
                return (
                  <tr key={a.id}>
                    <td>{pl.titulo || '—'}</td>
                    <td>{CANAL_LABEL[a.canal]}</td>
                    <td><EstadoBadge estado={a.estado} /></td>
                    <td className="num c">{a.intentos}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmt(a.generado_at)}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmt(a.enviado_at)}</td>
                    <td className="r">
                      <div className="row-act">
                        {(a.estado === 'fallido' || a.estado === 'pendiente') && (
                          <button type="button" className="ia" title="Reintentar" aria-label="Reintentar" disabled={procesando}
                            onClick={() => accion(() => agendaApi().aviso.reintentar({ id: a.id }))}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                          </button>
                        )}
                        {a.estado !== 'descartado' && (
                          <button type="button" className="ia del" title="Descartar" aria-label="Descartar" disabled={procesando}
                            onClick={() => accion(() => agendaApi().aviso.descartar({ id: a.id }))}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                        <button type="button" className="ia" title="Traza" aria-label="Traza" onClick={() => setTraza(a)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                        {a.agenda_evento_id && (
                          <button type="button" className="ia" title="Abrir origen" aria-label="Abrir origen" onClick={() => abrirOrigen(a)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
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

      {traza && (
        <Modal ariaLabel="Traza de intentos" ancho={460} onClose={() => setTraza(null)}>
          <div className="modal-header"><span className="modal-title">Traza del aviso</span></div>
          <div className="modal-body" style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <div><b>Canal:</b> {CANAL_LABEL[traza.canal]}</div>
            <div><b>Estado:</b> {traza.estado}</div>
            <div><b>Intentos:</b> {traza.intentos}</div>
            <div><b>Generado:</b> {fmt(traza.generado_at)}</div>
            <div><b>Enviado:</b> {fmt(traza.enviado_at)}</div>
            <div><b>Próximo intento:</b> {fmt(traza.proximo_intento_at)}</div>
            <div><b>Último error:</b> {traza.ultimo_error ?? '—'}</div>
            {traza.destinatario_contacto && <div><b>Destino:</b> {traza.destinatario_contacto}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setTraza(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
