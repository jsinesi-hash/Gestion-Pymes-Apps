import { useMemo, useState } from 'react';
import { ymdLocal, exportRemitos } from '@ferreteria/shared';
import { ExportarButton } from '../../components/export/ExportarButton';
import { useRemitos, remitoApi, type RemitoListado } from '../../hooks/useRemitos';
import { RemitoDetalleModal } from './RemitoDetalleModal';
import { EditarRemitoModal } from './EditarRemitoModal';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { SearchBox, usePersistentListState, useCallIpc } from '@core/ui';
import { resaltarCoincidencia } from '../../lib/resaltar';

// ADR-085 (SEC-2): el modal inline de conformar/anular comparte un único input
// ("accion-valor") para recibido_por y motivo — nunca se muestran a la vez, así que
// no hace falta un id distinto por campo para rutear el foco.
const CAMPOS_ERROR = new Set(['recibido_por', 'motivo']);

const ESTADOS = [
  { valor: '', label: 'Todos' },
  { valor: 'emitido', label: 'Emitido' },
  { valor: 'conformado', label: 'Conformado' },
  { valor: 'anulado', label: 'Anulado' },
];

function fmtFecha(v: RemitoListado['fecha_emision']) {
  if (!v) return '—';
  try {
    return (v instanceof Date ? v : new Date(v)).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  } catch { return '—'; }
}

function fechaYmd(v: RemitoListado['fecha_emision']) {
  try {
    return ymdLocal(v instanceof Date ? v : new Date(v));
  } catch { return ''; }
}

function EstadoBadge({ estado }: Readonly<{ estado: RemitoListado['estado'] }>) {
  if (estado === 'conformado') {
    return <span className="badge ok"><span className="bd" />Conformado</span>;
  }
  if (estado === 'anulado') {
    return <span className="badge off"><span className="bd" />Anulado</span>;
  }
  return <span className="badge-warn">Emitido</span>;
}

type AccionActiva = { tipo: 'conformar' | 'anular'; remito: RemitoListado } | null;

type CampoOrden = 'numero' | 'fecha_emision' | 'venta_numero_interno' | 'cliente_nombre_completo' | 'estado' | 'recibido_por';

function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: 'asc' | 'desc' }>) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export function RemitosView() {
  // ADR-057: el listado abre filtrado por estado "Emitido" (el usuario puede
  // cambiar a otros estados o "Todos" desde el select).
  const [estado, setEstado] = usePersistentListState('remitos-estado', 'emitido');
  const { remitos, cargando, error, recargar } = useRemitos(estado ? { estado } : {});

  const [texto, setTexto] = usePersistentListState('remitos-busqueda', '');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [accion, setAccion] = useState<AccionActiva>(null);
  const [valor, setValor] = useState('');
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [orden, setOrden] = useState<CampoOrden>('numero');
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('desc');
  const callIpc = useCallIpc();

  // Modal inline de conformar/anular (no un componente propio como los demás de este archivo).
  useEscapeToClose(() => setAccion(null), !!accion);

  function handleOrdenar(campo: CampoOrden) {
    if (orden === campo) setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrden(campo); setOrdenDir('asc'); }
  }

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const base = remitos.filter((r) => {
      if (t) {
        const coincide = r.numero.toLowerCase().includes(t)
          || (r.venta_numero_interno ?? '').toLowerCase().includes(t)
          || (r.cliente_nombre_completo ?? '').toLowerCase().includes(t);
        if (!coincide) return false;
      }
      if (fechaDesde || fechaHasta) {
        const ymd = fechaYmd(r.fecha_emision);
        if (fechaDesde && ymd < fechaDesde) return false;
        if (fechaHasta && ymd > fechaHasta) return false;
      }
      return true;
    });

    const valorOrden = (r: RemitoListado): string | number => {
      if (orden === 'fecha_emision') return fechaYmd(r.fecha_emision);
      if (orden === 'numero') return r.numero_secuencial;
      return (r[orden] ?? '').toString().toLowerCase();
    };

    return [...base].sort((a, b) => {
      const va = valorOrden(a);
      const vb = valorOrden(b);
      let cmp = 0;
      if (va < vb) cmp = -1;
      else if (va > vb) cmp = 1;
      return ordenDir === 'asc' ? cmp : -cmp;
    });
  }, [remitos, texto, fechaDesde, fechaHasta, orden, ordenDir]);

  async function imprimir(remito: RemitoListado) {
    try {
      await remitoApi().imprimir?.({ id: remito.id });
    } catch {
      // impresion cancelada o fallida — el dialogo del SO ya informo al usuario
    }
  }

  function abrir(tipo: 'conformar' | 'anular', remito: RemitoListado) {
    setAccion({ tipo, remito });
    setValor('');
    setErrorAccion(null);
  }

  async function confirmarAccion() {
    if (!accion) return;
    const texto2 = valor.trim();
    if (texto2 === '') {
      setErrorAccion(accion.tipo === 'conformar'
        ? 'Indicá quién recibió la mercadería.'
        : 'Indicá el motivo de la anulación.');
      return;
    }

    setProcesando(true);
    setErrorAccion(null);
    const r = accion.tipo === 'conformar'
      ? await callIpc(() => remitoApi().conformar({ id: accion.remito.id, recibido_por: texto2 }), { success: 'Remito conformado' })
      : await callIpc(() => remitoApi().anular({ id: accion.remito.id, motivo: texto2 }), { success: 'Remito anulado' });
    setProcesando(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      // Un único input sirve a recibido_por y motivo (nunca se muestran a la vez), así
      // que cualquier error de esos dos campos -o general- se enfoca en "accion-valor".
      setErrorAccion(r.traducido.mensaje);
      const campo = r.traducido.campo;
      if (!campo || CAMPOS_ERROR.has(campo)) {
        document.getElementById('accion-valor')?.focus();
      }
      return;
    }
    setAccion(null);
    await recargar();
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <SearchBox
          value={texto}
          onChange={setTexto}
          placeholder="Buscar por cliente, número de remito o venta..."
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
          Desde
          <input
            type="date" className="filter" style={{ fontWeight: 400 }}
            value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
          Hasta
          <input
            type="date" className="filter" style={{ fontWeight: 400 }}
            value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
          Estado
          <select
            id="filtro-estado"
            className="input"
            style={{ width: 150, fontSize: '0.85rem' }}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            {ESTADOS.map((e) => <option key={e.valor || 'todos'} value={e.valor}>{e.label}</option>)}
          </select>
        </label>
        <div className="ml-auto" />
        <ExportarButton definicion={exportRemitos} />
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}
      {cargando && <div className="text-muted" style={{ padding: 'var(--pad)' }}>Cargando…</div>}

      {!cargando && !error && filtrados.length === 0 && (
        <div className="text-muted" style={{ padding: 'var(--pad)', textAlign: 'center' }}>
          No hay remitos para el filtro seleccionado.
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('numero')}>
                  Número <SortIcon active={orden === 'numero'} dir={ordenDir} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('fecha_emision')}>
                  Fecha <SortIcon active={orden === 'fecha_emision'} dir={ordenDir} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('venta_numero_interno')}>
                  Venta <SortIcon active={orden === 'venta_numero_interno'} dir={ordenDir} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('cliente_nombre_completo')}>
                  Cliente <SortIcon active={orden === 'cliente_nombre_completo'} dir={ordenDir} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('estado')}>
                  Estado <SortIcon active={orden === 'estado'} dir={ordenDir} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('recibido_por')}>
                  Recibido por <SortIcon active={orden === 'recibido_por'} dir={ordenDir} />
                </th>
                <th className="r">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetalleId(r.id)}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{r.numero}</td>
                  <td>{fmtFecha(r.fecha_emision)}</td>
                  <td className="num">{r.venta_numero_interno ?? '—'}</td>
                  <td>{r.cliente_nombre_completo ? resaltarCoincidencia(r.cliente_nombre_completo, texto) : '—'}</td>
                  <td><EstadoBadge estado={r.estado} /></td>
                  <td>{r.recibido_por ?? '—'}</td>
                  <td className="r">
                    <div className="row-act" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="ia" title={`Imprimir ${r.numero}`} aria-label="Imprimir" onClick={() => { void imprimir(r); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      {r.estado === 'emitido' && (
                        <button type="button" className="ia" title={`Editar ${r.numero}`} aria-label="Editar" onClick={() => setEditarId(r.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      )}
                      {r.estado === 'emitido' && (
                        <button type="button" className="ia" title={`Conformar ${r.numero}`} aria-label="Conformar" onClick={() => abrir('conformar', r)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                      )}
                      {r.estado !== 'anulado' && (
                        <button type="button" className="ia del" title={`Anular ${r.numero}`} aria-label="Anular" onClick={() => abrir('anular', r)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {accion && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 460 }} role="dialog" aria-label={accion.tipo === 'conformar' ? 'Conformar remito' : 'Anular remito'}>
            <div className="modal-header">
              <span className="modal-title">
                {accion.tipo === 'conformar' ? 'Conformar' : 'Anular'} {accion.remito.numero}
              </span>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="accion-valor">
                {accion.tipo === 'conformar' ? 'Recibido por' : 'Motivo de la anulación'}
              </label>
              <input
                id="accion-valor"
                className="input"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                autoFocus
              />
              {accion.tipo === 'anular' && (
                <div className="text-muted text-xs">
                  Anular libera las cantidades entregadas: vuelven a quedar pendientes.
                  No genera movimientos de stock.
                </div>
              )}
              {errorAccion && <div className="alert-danger" role="alert">{errorAccion}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setAccion(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={accion.tipo === 'anular' ? 'btn-danger' : 'btn-primary'}
                onClick={confirmarAccion}
                disabled={procesando}
              >
                {accion.tipo === 'conformar' ? 'Confirmar entrega' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalleId && (
        <RemitoDetalleModal remitoId={detalleId} onClose={() => setDetalleId(null)} />
      )}

      {editarId && (
        <EditarRemitoModal
          remitoId={editarId}
          onClose={() => setEditarId(null)}
          onEditado={() => { setEditarId(null); void recargar(); }}
        />
      )}
    </div>
  );
}
