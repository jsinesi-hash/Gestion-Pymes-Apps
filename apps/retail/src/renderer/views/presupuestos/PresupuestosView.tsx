import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ymdLocal, exportPresupuestos } from '@ferreteria/shared';
import { ExportarButton } from '../../components/export/ExportarButton';
import {
  usePresupuestos, usePresupuestoConfig, presupuestoApi,
  type PresupuestoListado, type PresupuestoEstado,
} from '../../hooks/usePresupuestos';
import { PresupuestoFormModal } from './PresupuestoFormModal';
import { PresupuestoDetalleModal } from './PresupuestoDetalleModal';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { SearchBox } from '../../components/SearchBox';
import { usePersistentListState } from '../../hooks/usePersistentListState';
import { resaltarCoincidencia } from '../../lib/resaltar';
import { useCallIpc } from '../../hooks/useCallIpc';

// ADR-085 (SEC-2): único campo de cabecera con control propio en los modales de
// emisión/anulación de esta vista (ambos operan por `id`, sin exponer un control editable
// para ese campo); cualquier rechazo va a la región general de error del modal en curso.
const CAMPO_VALIDEZ = 'validez_dias';

const ESTADOS = [
  { valor: 'activos', label: 'Activos (Borrador + Emitido)' },
  { valor: '', label: 'Todos' },
  { valor: 'borrador', label: 'Borrador' },
  { valor: 'emitido', label: 'Emitido' },
  { valor: 'vencido', label: 'Vencido' },
  { valor: 'convertido', label: 'Convertido' },
  { valor: 'anulado', label: 'Anulado' },
];

type CampoOrden = 'numero' | 'cliente' | 'estado' | 'fecha_validez' | 'total';

function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: 'asc' | 'desc' }>) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function ymd(v: PresupuestoListado['fecha_validez']): string {
  if (!v) return '';
  try { return ymdLocal(v instanceof Date ? v : new Date(v)); } catch { return ''; }
}

function pesos(centavos: number): string {
  return (centavos / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

function fmtFecha(v: PresupuestoListado['fecha_validez']) {
  if (!v) return '—';
  try {
    return (v instanceof Date ? v : new Date(v)).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  } catch { return '—'; }
}

function EstadoBadge({ estado }: Readonly<{ estado: PresupuestoEstado }>) {
  if (estado === 'convertido') return <span className="badge ok"><span className="bd" />Convertido</span>;
  if (estado === 'anulado') return <span className="badge off"><span className="bd" />Anulado</span>;
  if (estado === 'vencido') return <span className="badge off"><span className="bd" />Vencido</span>;
  if (estado === 'emitido') return <span className="badge-warn">Emitido</span>;
  return <span className="badge">Borrador</span>;
}

export function PresupuestosView() {
  const navigate = useNavigate();
  const validezDefault = usePresupuestoConfig();
  const [estado, setEstado] = usePersistentListState('presupuestos-estado', 'activos');
  const [texto, setTexto] = usePersistentListState('presupuestos-busqueda', '');
  const [orden, setOrden] = useState<CampoOrden>('numero');
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('desc');
  // Trae todo (incluye anulados/convertidos); el filtrado por estado/texto/orden es client-side.
  const { presupuestos, cargando, error, recargar } = usePresupuestos({ incluir_inactivos: true });

  function handleOrdenar(campo: CampoOrden) {
    if (orden === campo) setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrden(campo); setOrdenDir('asc'); }
  }

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const base = presupuestos.filter((p) => {
      if (estado === 'activos') { if (p.estado !== 'borrador' && p.estado !== 'emitido') return false; }
      else if (estado) { if (p.estado !== estado) return false; }
      if (t) {
        const coincide = (p.numero ?? '').toLowerCase().includes(t)
          || (p.cliente_nombre_completo ?? '').toLowerCase().includes(t);
        if (!coincide) return false;
      }
      return true;
    });

    const valor = (p: PresupuestoListado): string | number => {
      if (orden === 'numero') return p.numero_secuencial ?? 0;
      if (orden === 'fecha_validez') return ymd(p.fecha_validez);
      if (orden === 'total') return p.total_centavos;
      if (orden === 'cliente') return (p.cliente_nombre_completo ?? '').toLowerCase();
      return p.estado;
    };

    return [...base].sort((a, b) => {
      const va = valor(a); const vb = valor(b);
      let cmp = 0;
      if (va < vb) cmp = -1; else if (va > vb) cmp = 1;
      return ordenDir === 'asc' ? cmp : -cmp;
    });
  }, [presupuestos, estado, texto, orden, ordenDir]);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [emitir, setEmitir] = useState<PresupuestoListado | null>(null);
  const [validezEmitir, setValidezEmitir] = useState(15);
  const [anular, setAnular] = useState<PresupuestoListado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [errorValidezEmitir, setErrorValidezEmitir] = useState<string | null>(null);
  const callIpc = useCallIpc();

  useEscapeToClose(() => setEmitir(null), !!emitir && !procesando);
  useEscapeToClose(() => setAnular(null), !!anular && !procesando);

  function abrirNuevo() { setEditarId(null); setFormAbierto(true); }
  function abrirEditar(p: PresupuestoListado) { setEditarId(p.id); setFormAbierto(true); }

  function abrirEmitir(p: PresupuestoListado) {
    setEmitir(p); setValidezEmitir(p.validez_dias || validezDefault); setErrorAccion(null); setErrorValidezEmitir(null);
  }

  async function confirmarEmitir() {
    if (!emitir) return;
    setProcesando(true); setErrorAccion(null); setErrorValidezEmitir(null);
    const r = await callIpc(
      () => presupuestoApi().emitir({ id: emitir.id, validez_dias: validezEmitir }),
      { success: 'Presupuesto emitido' },
    );
    setProcesando(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del modal.
      if (r.traducido.campo === CAMPO_VALIDEZ) {
        setErrorValidezEmitir(r.traducido.mensaje);
        document.getElementById('validez_dias')?.focus();
      } else {
        setErrorAccion(r.traducido.mensaje);
      }
      return;
    }
    setEmitir(null);
    await recargar();
  }

  async function confirmarAnular() {
    if (!anular) return;
    setProcesando(true); setErrorAccion(null);
    const r = await callIpc(
      () => presupuestoApi().anular({ id: anular.id }),
      { success: 'Presupuesto anulado' },
    );
    setProcesando(false);
    if (!r.ok) { setErrorAccion(r.traducido.mensaje); return; }
    setAnular(null);
    await recargar();
  }

  async function imprimir(p: PresupuestoListado) {
    try { await presupuestoApi().imprimir({ id: p.id }); }
    catch { /* dialogo del SO ya informo */ }
  }

  function convertir(p: PresupuestoListado) {
    navigate('/pos', { state: { presupuestoId: p.id } });
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <button type="button" className="btn-primary" onClick={abrirNuevo}>+ Nuevo presupuesto</button>
        <div style={{ marginLeft: 12, flex: 1, display: 'flex' }}>
          <SearchBox
            value={texto}
            onChange={setTexto}
            placeholder="Buscar por cliente o número de presupuesto…"
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginLeft: 'auto' }}>
          Estado
          <select className="input" style={{ width: 200, fontSize: '0.85rem' }} value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e.valor || 'todos'} value={e.valor}>{e.label}</option>)}
          </select>
        </label>
        <ExportarButton definicion={exportPresupuestos} />
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}
      {cargando && <div className="text-muted" style={{ padding: 'var(--pad)' }}>Cargando…</div>}

      {!cargando && !error && filtrados.length === 0 && (
        <div className="text-muted" style={{ padding: 'var(--pad)', textAlign: 'center' }}>
          No hay presupuestos para el filtro seleccionado.
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
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('cliente')}>
                  Cliente <SortIcon active={orden === 'cliente'} dir={ordenDir} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('estado')}>
                  Estado <SortIcon active={orden === 'estado'} dir={ordenDir} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('fecha_validez')}>
                  Válido hasta <SortIcon active={orden === 'fecha_validez'} dir={ordenDir} />
                </th>
                <th className="r" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleOrdenar('total')}>
                  Total <SortIcon active={orden === 'total'} dir={ordenDir} />
                </th>
                <th className="r">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setDetalleId(p.id)}>
                  <td className="num">{p.numero ?? '—'}</td>
                  <td>{resaltarCoincidencia(p.cliente_nombre_completo ?? 'Consumidor Final', texto)}</td>
                  <td><EstadoBadge estado={p.estado} /></td>
                  <td>{fmtFecha(p.fecha_validez)}</td>
                  <td className="num r">{pesos(p.total_centavos)}</td>
                  <td className="r">
                    {p.estado === 'borrador' && (
                      <>
                        <button type="button" className="btn-secondary" onClick={(e) => { e.stopPropagation(); abrirEditar(p); }}>Editar</button>
                        <button type="button" className="btn-primary" onClick={(e) => { e.stopPropagation(); abrirEmitir(p); }}>Emitir</button>
                      </>
                    )}
                    {(p.estado === 'emitido' || p.estado === 'vencido') && (
                      <>
                        <button type="button" className="btn-primary" onClick={(e) => { e.stopPropagation(); convertir(p); }}>Convertir</button>
                        <button type="button" className="btn-secondary" onClick={(e) => { e.stopPropagation(); void imprimir(p); }}>PDF</button>
                      </>
                    )}
                    {p.estado !== 'anulado' && p.estado !== 'convertido' && (
                      <button type="button" className="btn-danger" onClick={(e) => { e.stopPropagation(); setAnular(p); setErrorAccion(null); }}>Anular</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalleId && (
        <PresupuestoDetalleModal presupuestoId={detalleId} onClose={() => setDetalleId(null)} />
      )}

      {formAbierto && (
        <PresupuestoFormModal
          presupuestoId={editarId}
          validezDefault={validezDefault}
          onClose={() => setFormAbierto(false)}
          onGuardado={() => { setFormAbierto(false); void recargar(); }}
        />
      )}

      {emitir && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 420 }} role="dialog" aria-label="Emitir presupuesto">
            <div className="modal-header"><span className="modal-title">Emitir presupuesto</span></div>
            <div className="modal-body" style={{ display: 'grid', gap: 8 }}>
              <div className="text-muted text-xs">
                Al emitir se asigna número, se congela el precio de cada línea y se calcula la fecha de validez.
              </div>
              <label style={{ display: 'grid', gap: 4 }}>
                Validez (días)
                <input id="validez_dias" className={`input${errorValidezEmitir ? ' error' : ''}`} type="number" min={1} value={validezEmitir}
                  onChange={(e) => { setValidezEmitir(Number(e.target.value)); setErrorValidezEmitir(null); }} autoFocus />
                {errorValidezEmitir && <span className="field-error">{errorValidezEmitir}</span>}
              </label>
              {errorAccion && <div className="alert-danger" role="alert">{errorAccion}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setEmitir(null)} disabled={procesando}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={confirmarEmitir} disabled={procesando}>Confirmar emisión</button>
            </div>
          </div>
        </div>
      )}

      {anular && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 420 }} role="dialog" aria-label="Anular presupuesto">
            <div className="modal-header"><span className="modal-title">Anular {anular.numero ?? 'borrador'}</span></div>
            <div className="modal-body" style={{ display: 'grid', gap: 8 }}>
              <div className="text-muted text-xs">El presupuesto queda anulado y deja de estar disponible.</div>
              {errorAccion && <div className="alert-danger" role="alert">{errorAccion}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setAnular(null)} disabled={procesando}>Cancelar</button>
              <button type="button" className="btn-danger" onClick={confirmarAnular} disabled={procesando}>Confirmar anulación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
