import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ymdHmLocal } from '@ferreteria/shared';
import {
  useAgendaEventos, agendaApi, toDate,
  type AgendaEvento, type EventoOrigen,
} from '../../hooks/useAgenda';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

const ORIGENES: Array<{ valor: string; label: string }> = [
  { valor: '', label: 'Todos los orígenes' },
  { valor: 'rutina', label: 'Rutina' },
  { valor: 'manual', label: 'Manual' },
  { valor: 'orden_compra', label: 'Orden de compra' },
  { valor: 'recepcion', label: 'Recepción' },
  { valor: 'bajo_minimo', label: 'Bajo mínimo' },
  { valor: 'cierre_caja', label: 'Cierre de caja' },
];

const ORIGEN_LABEL: Record<EventoOrigen, string> = {
  rutina: 'Rutina', manual: 'Manual', orden_compra: 'Orden de compra',
  recepcion: 'Recepción', bajo_minimo: 'Bajo mínimo', cierre_caja: 'Cierre de caja',
};

type CampoOrden = 'titulo' | 'origen' | 'fecha' | 'estado';

function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: 'asc' | 'desc' }>) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function fmtFechaHora(v: AgendaEvento['fecha']): string {
  const d = toDate(v);
  if (!d) return '—';
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function EstadoBadge({ estado }: Readonly<{ estado: AgendaEvento['estado'] }>) {
  if (estado === 'completada') return <span className="badge ok"><span className="bd" />Completada</span>;
  if (estado === 'descartada') return <span className="badge off"><span className="bd" />Descartada</span>;
  if (estado === 'pospuesta') return <span className="badge-warn">Pospuesta</span>;
  return <span className="badge">Pendiente</span>;
}

function inicioDeHoy(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function finDeHoy(): Date { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

export function AgendaEventosView() {
  const navigate = useNavigate();
  const { eventos, cargando, error, recargar } = useAgendaEventos();
  const [texto, setTexto] = useState('');
  const [origen, setOrigen] = useState('');
  const [incluirCerradas, setIncluirCerradas] = useState(false);
  const [orden, setOrden] = useState<CampoOrden>('fecha');
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('asc');
  const [ventanaDias, setVentanaDias] = useState(14);

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [posponer, setPosponer] = useState<AgendaEvento | null>(null);
  const [descartar, setDescartar] = useState<AgendaEvento | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEscapeToClose(() => setDescartar(null), !!descartar && !procesando);

  useEffect(() => {
    const p = (globalThis as any).ferreteria?.parametros?.get?.({ clave: 'agenda_ventana_proximos_dias' });
    if (p?.then) p.then((v: string | null) => { const n = Number.parseInt(v ?? '14', 10); if (Number.isFinite(n)) setVentanaDias(n); }).catch(() => {});
  }, []);

  function handleOrdenar(campo: CampoOrden) {
    if (orden === campo) setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrden(campo); setOrdenDir('asc'); }
  }

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const base = eventos.filter((e) => {
      if (!incluirCerradas && (e.estado === 'completada' || e.estado === 'descartada')) return false;
      if (origen && e.origen !== origen) return false;
      if (t) {
        const coincide = e.titulo.toLowerCase().includes(t) || (e.descripcion ?? '').toLowerCase().includes(t);
        if (!coincide) return false;
      }
      return true;
    });
    const valor = (e: AgendaEvento): string | number => {
      if (orden === 'fecha') return toDate(e.fecha)?.getTime() ?? 0;
      if (orden === 'titulo') return e.titulo.toLowerCase();
      if (orden === 'origen') return e.origen;
      return e.estado;
    };
    return [...base].sort((a, b) => {
      const va = valor(a); const vb = valor(b);
      let cmp = 0;
      if (va < vb) cmp = -1; else if (va > vb) cmp = 1;
      return ordenDir === 'asc' ? cmp : -cmp;
    });
  }, [eventos, texto, origen, incluirCerradas, orden, ordenDir]);

  const zonas = useMemo(() => {
    const hoy0 = inicioDeHoy().getTime();
    const hoy1 = finDeHoy().getTime();
    const limiteProx = finDeHoy().getTime() + ventanaDias * 24 * 3600 * 1000;
    const atrasadas: AgendaEvento[] = [];
    const hoy: AgendaEvento[] = [];
    const proximos: AgendaEvento[] = [];
    for (const e of filtrados) {
      const f = toDate(e.fecha)?.getTime() ?? 0;
      if (f < hoy0) atrasadas.push(e);
      else if (f <= hoy1) hoy.push(e);
      else if (f <= limiteProx) proximos.push(e);
      else proximos.push(e);   // mas alla de la ventana igual va a Proximos (no se pierde)
    }
    return { atrasadas, hoy, proximos };
  }, [filtrados, ventanaDias]);

  async function accion(fn: () => Promise<unknown>) {
    setProcesando(true); setErrorAccion(null);
    try { await fn(); await recargar(); setPosponer(null); setDescartar(null); }
    catch (e) { setErrorAccion(e instanceof Error ? e.message : String(e)); }
    finally { setProcesando(false); }
  }

  function abrirOrigen(e: AgendaEvento) {
    if (e.orden_compra_id) navigate(`/compras/ordenes/${e.orden_compra_id}`);
    else if (e.proveedor_id) navigate(`/compras/proveedores/${e.proveedor_id}`);
    else if (e.producto_id) navigate(`/productos/${e.producto_id}`);
  }

  function tieneOrigenNavegable(e: AgendaEvento): boolean {
    return Boolean(e.orden_compra_id || e.proveedor_id || e.producto_id);
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <button type="button" className="btn-primary" onClick={() => setNuevoAbierto(true)}>+ Nuevo evento</button>
        <div className="search" style={{ marginLeft: 12 }}>
          <input placeholder="Buscar por título o descripción…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginLeft: 'auto' }}>
          Origen
          <select className="input" style={{ width: 180, fontSize: '0.85rem' }} value={origen} onChange={(e) => setOrigen(e.target.value)}>
            {ORIGENES.map((o) => <option key={o.valor || 'todos'} value={o.valor}>{o.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={incluirCerradas} onChange={(e) => setIncluirCerradas(e.target.checked)} />
          Incluir completadas/descartadas
        </label>
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}
      {cargando && <div className="text-muted" style={{ padding: 'var(--pad)' }}>Cargando…</div>}

      {!cargando && !error && filtrados.length === 0 && (
        <div className="text-muted" style={{ padding: 'var(--pad)', textAlign: 'center' }}>
          No hay eventos para el filtro seleccionado.
        </div>
      )}

      {!cargando && filtrados.length > 0 && (
        <div className="table-wrap">
          <Zona titulo="Atrasadas" eventos={zonas.atrasadas} destaca
            {...{ orden, ordenDir, handleOrdenar, fmtFechaHora, abrirOrigen, tieneOrigenNavegable,
              onCompletar: (e: AgendaEvento) => accion(() => agendaApi().agenda.completar({ id: e.id })),
              onPosponer: setPosponer, onDescartar: setDescartar }} />
          <Zona titulo="Hoy" eventos={zonas.hoy}
            {...{ orden, ordenDir, handleOrdenar, fmtFechaHora, abrirOrigen, tieneOrigenNavegable,
              onCompletar: (e: AgendaEvento) => accion(() => agendaApi().agenda.completar({ id: e.id })),
              onPosponer: setPosponer, onDescartar: setDescartar }} />
          <Zona titulo="Próximos" eventos={zonas.proximos}
            {...{ orden, ordenDir, handleOrdenar, fmtFechaHora, abrirOrigen, tieneOrigenNavegable,
              onCompletar: (e: AgendaEvento) => accion(() => agendaApi().agenda.completar({ id: e.id })),
              onPosponer: setPosponer, onDescartar: setDescartar }} />
        </div>
      )}

      {nuevoAbierto && (
        <NuevoEventoModal onClose={() => setNuevoAbierto(false)} onGuardado={() => { setNuevoAbierto(false); void recargar(); }} />
      )}

      {posponer && (
        <PosponerModal evento={posponer} procesando={procesando} error={errorAccion}
          onClose={() => setPosponer(null)}
          onConfirmar={(fechaISO, nota) => accion(() => agendaApi().agenda.posponer({ id: posponer.id, pospuesto_para: fechaISO, nota }))} />
      )}

      {descartar && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 420 }} role="dialog" aria-label="Descartar evento">
            <div className="modal-header"><span className="modal-title">Descartar «{descartar.titulo}»</span></div>
            <div className="modal-body" style={{ display: 'grid', gap: 8 }}>
              <div className="text-muted text-xs">El evento queda descartado y sale del listado activo.</div>
              {errorAccion && <div className="alert-danger" role="alert">{errorAccion}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setDescartar(null)} disabled={procesando}>Cancelar</button>
              <button type="button" className="btn-danger" onClick={() => accion(() => agendaApi().agenda.descartar({ id: descartar.id }))} disabled={procesando}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Zona(props: Readonly<{
  titulo: string; eventos: AgendaEvento[]; destaca?: boolean;
  orden: CampoOrden; ordenDir: 'asc' | 'desc'; handleOrdenar: (c: CampoOrden) => void;
  fmtFechaHora: (v: AgendaEvento['fecha']) => string;
  abrirOrigen: (e: AgendaEvento) => void; tieneOrigenNavegable: (e: AgendaEvento) => boolean;
  onCompletar: (e: AgendaEvento) => void; onPosponer: (e: AgendaEvento) => void; onDescartar: (e: AgendaEvento) => void;
}>) {
  const { titulo, eventos, destaca, orden, ordenDir, handleOrdenar, fmtFechaHora,
    abrirOrigen, tieneOrigenNavegable, onCompletar, onPosponer, onDescartar } = props;
  if (eventos.length === 0) return null;
  const th = (campo: CampoOrden, label: string) => (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar(campo)}>
      {label} <SortIcon active={orden === campo} dir={ordenDir} />
    </th>
  );
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: destaca ? 'var(--danger)' : 'var(--ink-2)', padding: '6px 4px' }}>
        {titulo} <span className="text-muted" style={{ fontWeight: 500 }}>({eventos.length})</span>
      </div>
      <table>
        <thead>
          <tr>
            {th('titulo', 'Título')}
            {th('origen', 'Origen')}
            {th('fecha', 'Fecha')}
            {th('estado', 'Estado')}
            <th className="r">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e.id}>
              <td>{e.titulo}</td>
              <td>{ORIGEN_LABEL[e.origen]}</td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(e.fecha)}</td>
              <td><EstadoBadge estado={e.estado} /></td>
              <td className="r">
                <div className="row-act">
                  {e.estado !== 'completada' && e.estado !== 'descartada' && (
                    <>
                      <button type="button" className="ia" title="Completar" aria-label="Completar" onClick={() => onCompletar(e)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button type="button" className="ia" title="Posponer" aria-label="Posponer" onClick={() => onPosponer(e)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                      </button>
                      <button type="button" className="ia del" title="Descartar" aria-label="Descartar" onClick={() => onDescartar(e)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </>
                  )}
                  {tieneOrigenNavegable(e) && (
                    <button type="button" className="ia" title="Abrir origen" aria-label="Abrir origen" onClick={() => abrirOrigen(e)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PosponerModal(props: Readonly<{
  evento: AgendaEvento; procesando: boolean; error: string | null;
  onClose: () => void; onConfirmar: (fechaISO: string, nota: string) => void;
}>) {
  const { evento, procesando, error, onClose, onConfirmar } = props;
  const manana = ymdHmLocal(new Date(Date.now() + 86400000));
  const [fecha, setFecha] = useState(manana);
  const [nota, setNota] = useState('');

  useEscapeToClose(onClose, !procesando);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 420 }} role="dialog" aria-label="Posponer evento">
        <div className="modal-header"><span className="modal-title">Posponer «{evento.titulo}»</span></div>
        <div className="modal-body" style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            Nueva fecha
            <input className="input" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} autoFocus />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Nota (opcional)
            <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} />
          </label>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={procesando}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={() => onConfirmar(new Date(fecha).toISOString(), nota)} disabled={procesando}>Posponer</button>
        </div>
      </div>
    </div>
  );
}

function NuevoEventoModal(props: Readonly<{ onClose: () => void; onGuardado: () => void }>) {
  const { onClose, onGuardado } = props;
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(ymdHmLocal(new Date(Date.now() + 3600000)));
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, !procesando);

  async function guardar() {
    if (!titulo.trim()) { setError('El título es obligatorio.'); return; }
    setProcesando(true); setError(null);
    try {
      await agendaApi().agenda.crearEvento({ titulo: titulo.trim(), descripcion: descripcion.trim() || null, fecha: new Date(fecha).toISOString() });
      onGuardado();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setProcesando(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 460 }} role="dialog" aria-label="Nuevo evento">
        <div className="modal-header"><span className="modal-title">Nuevo evento</span></div>
        <div className="modal-body" style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            Título
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Descripción (opcional)
            <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Fecha
            <input className="input" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={procesando}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={guardar} disabled={procesando}>Crear evento</button>
        </div>
      </div>
    </div>
  );
}
