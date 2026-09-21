import { useEffect, useMemo, useState } from 'react';
import { resolverPrecio, nombreCompletoCliente } from '@ferreteria/shared';
import { presupuestoApi } from '../../hooks/usePresupuestos';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useCallIpc } from '../../hooks/useCallIpc';

// ADR-085 (SEC-2): campos de cabecera con control propio en este form. `lineas.*` y
// cualquier otro campo sin control dedicado caen en la región general de error.
const CAMPOS_ERROR = new Set(['cliente_id', 'validez_dias', 'descuento_global_pct', 'observaciones']);

type Cliente = { id: string; nombre: string; apellido: string | null; numero_documento?: string; tipo_documento?: string };
type ProductoBusqueda = { id: string; nombre_corto: string; sku: string; stock_fisico?: number | null };

type LineaForm = {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  descuento_linea_pct: number;
  precioListaCentavos: number;
  presentacion_id: string | null;
  stock: number;
};

function f() { return (globalThis as any).ferreteria; }

function pesos(centavos: number): string {
  return (centavos / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

export type PresupuestoFormModalProps = {
  presupuestoId?: string | null; // null/undefined = nuevo
  validezDefault: number;
  onClose: () => void;
  onGuardado: () => void;
};

export function PresupuestoFormModal({ presupuestoId, validezDefault, onClose, onGuardado }: Readonly<PresupuestoFormModalProps>) {
  const editando = !!presupuestoId;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState(0);
  const [validezDias, setValidezDias] = useState(validezDefault);
  const [observaciones, setObservaciones] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [listaId, setListaId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const callIpc = useCallIpc();

  useEscapeToClose(onClose, !guardando);

  // Carga inicial: clientes + lista predeterminada, y si edita, el presupuesto.
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const [cs, listas] = await Promise.all([
          f().cliente.list({}), f().precios.lista.list({}),
        ]);
        if (!vigente) return;
        setClientes(cs ?? []);
        const pred = (listas ?? []).find((l: any) => l.predeterminada);
        setListaId(pred?.id ?? null);

        if (presupuestoId) {
          const p = await presupuestoApi().obtener({ id: presupuestoId });
          if (!vigente) return;
          setClienteId(p.cliente_id ?? '');
          setDescuentoGlobalPct(p.descuento_global_pct ?? 0);
          setValidezDias(p.validez_dias ?? validezDefault);
          setObservaciones(p.observaciones ?? '');
          const dets = p.lineas ?? [];
          const stocks = await Promise.all(dets.map((l: any) =>
            f().catalogo.existencias.get({ producto_id: l.producto_id }).catch(() => null)));
          if (!vigente) return;
          setLineas(dets.map((l: any, i: number) => ({
            producto_id: l.producto_id,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            descuento_linea_pct: l.descuento_linea_pct ?? 0,
            precioListaCentavos: l.precio_unitario_centavos ?? 0,
            presentacion_id: l.presentacion_id ?? null,
            stock: stocks[i]?.stock_fisico ?? 0,
          })));
        }
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { vigente = false; };
  }, [presupuestoId, validezDefault]);

  // Busqueda de productos (debounce simple).
  useEffect(() => {
    const t = busqueda.trim();
    if (t.length < 2) { setResultados([]); return; }
    let vigente = true;
    const timer = setTimeout(() => {
      // producto.list es paginado (nombre + SKU vía `busqueda`) y devuelve { items, total }
      f().catalogo.producto.list({ busqueda: t, activo: true, page: 1, pageSize: 8 })
        .then((res: any) => { if (vigente) setResultados(res?.items ?? []); })
        .catch(() => { if (vigente) setResultados([]); });
    }, 200);
    return () => { vigente = false; clearTimeout(timer); };
  }, [busqueda]);

  async function agregarProducto(prod: ProductoBusqueda) {
    setBusqueda('');
    setResultados([]);
    if (lineas.some((l) => l.producto_id === prod.id)) return;
    let precio = 0;
    try {
      if (listaId) {
        const r = await f().precios.valor.getPrecioEnLista({ productoId: prod.id, listaId });
        precio = r?.precio_centavos ?? 0;
      }
    } catch { /* preview 0; el server resuelve el fallback */ }
    setLineas((prev) => [...prev, {
      producto_id: prod.id, descripcion: prod.nombre_corto,
      cantidad: 1, descuento_linea_pct: 0, precioListaCentavos: precio, presentacion_id: null,
      stock: prod.stock_fisico ?? 0,
    }]);
  }

  function actualizarLinea(id: string, campo: 'cantidad' | 'descuento_linea_pct', valor: number) {
    setLineas((prev) => prev.map((l) => l.producto_id === id ? { ...l, [campo]: valor } : l));
  }
  function quitarLinea(id: string) {
    setLineas((prev) => prev.filter((l) => l.producto_id !== id));
  }

  const preview = useMemo(() => resolverPrecio({
    lineas: lineas.map((l) => ({
      precioListaCentavos: l.precioListaCentavos, ajustePct: 0,
      descuentoLineaPct: l.descuento_linea_pct, cantidad: l.cantidad,
    })),
    descuentoGlobalPct,
  }), [lineas, descuentoGlobalPct]);

  function payload() {
    return {
      cliente_id: clienteId || null,
      validez_dias: validezDias,
      descuento_global_pct: descuentoGlobalPct,
      observaciones: observaciones || null,
      lineas: lineas.map((l) => ({
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        descuento_linea_pct: l.descuento_linea_pct,
        presentacion_id: l.presentacion_id,
      })),
    };
  }

  async function guardar() {
    if (lineas.length === 0) { setError('Agregá al menos un producto.'); return; }
    if (lineas.some((l) => !Number.isFinite(l.cantidad) || l.cantidad <= 0)) {
      setError('Todas las cantidades deben ser mayores a 0.'); return;
    }
    setGuardando(true);
    setError(null);
    setFieldErrors({});
    const r = editando
      ? await callIpc(() => presupuestoApi().editar({ id: presupuestoId, ...payload() }), { success: 'Presupuesto guardado' })
      : await callIpc(() => presupuestoApi().crear(payload()), { success: 'Presupuesto creado' });
    setGuardando(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      const campo = r.traducido.campo;
      if (campo === 'cliente_id') {
        // El buscador de cliente sólo está montado cuando no hay uno seleccionado.
        setFieldErrors((prev) => ({ ...prev, cliente_id: r.traducido.mensaje }));
        setClienteOpen(true);
        requestAnimationFrame(() => document.getElementById('cliente_id')?.focus());
      } else if (campo && CAMPOS_ERROR.has(campo)) {
        setFieldErrors((prev) => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    onGuardado();
  }

  const clienteSel = clientes.find((c) => c.id === clienteId) ?? null;
  const clienteResultados = clienteQuery.trim().length >= 1
    ? clientes.filter((c) => {
        const q = clienteQuery.toLowerCase();
        return nombreCompletoCliente(c).toLowerCase().includes(q)
          || (c.numero_documento ?? '').toLowerCase().includes(q);
      }).slice(0, 10)
    : [];

  function seleccionarCliente(c: Cliente) { setClienteId(c.id); setClienteOpen(false); setClienteQuery(''); }
  function quitarCliente() { setClienteId(''); setClienteOpen(false); setClienteQuery(''); }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 760, maxWidth: '95vw', maxHeight: '90vh' }} role="dialog" aria-label={editando ? 'Editar presupuesto' : 'Nuevo presupuesto'}>
        <div className="modal-header">
          <span className="modal-title">{editando ? 'Editar presupuesto' : 'Nuevo presupuesto'}</span>
        </div>
        {/* min-height:0 + overflow-y hacen que el cuerpo scrollee dentro del 90vh,
            manteniendo cabecera y pie (con botones) siempre visibles. */}
        <div className="modal-body" style={{ display: 'grid', gap: 12, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 240 }}>
              <span>Cliente</span>
              {clienteSel && !clienteOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreCompletoCliente(clienteSel)}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{clienteSel.tipo_documento} · {clienteSel.numero_documento}</div>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => { setClienteOpen(true); setClienteQuery(''); }}>Cambiar</button>
                  <button type="button" className="btn-secondary" onClick={quitarCliente} title="Consumidor Final">✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input id="cliente_id" className={`input${fieldErrors.cliente_id ? ' error' : ''}`}
                    placeholder="Buscar cliente por nombre o documento… (vacío = Consumidor Final)"
                    value={clienteQuery}
                    onChange={(e) => { setClienteQuery(e.target.value); setClienteOpen(true); setFieldErrors((prev) => ({ ...prev, cliente_id: '' })); }} />
                  {fieldErrors.cliente_id && <span className="field-error">{fieldErrors.cliente_id}</span>}
                  {clienteResultados.length > 0 && (
                    <ul style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, listStyle: 'none', margin: '4px 0 0', padding: 0, maxHeight: 240, overflowY: 'auto' }}>
                      {clienteResultados.map((c) => (
                        <li key={c.id} role="button" tabIndex={0}
                          onClick={() => seleccionarCliente(c)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') seleccionarCliente(c); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{nombreCompletoCliente(c)}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>{c.tipo_documento} · {c.numero_documento}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <label style={{ display: 'grid', gap: 4, width: 130 }}>
              Validez (días)
              <input id="validez_dias" className={`input${fieldErrors.validez_dias ? ' error' : ''}`} type="number" min={1} value={validezDias}
                onChange={(e) => { setValidezDias(Number(e.target.value)); setFieldErrors((prev) => ({ ...prev, validez_dias: '' })); }} />
              {fieldErrors.validez_dias && <span className="field-error">{fieldErrors.validez_dias}</span>}
            </label>
            <label style={{ display: 'grid', gap: 4, width: 140 }}>
              Desc. global (%)
              <input id="descuento_global_pct" className={`input${fieldErrors.descuento_global_pct ? ' error' : ''}`} type="number" min={0} max={100} value={descuentoGlobalPct}
                onChange={(e) => { setDescuentoGlobalPct(Number(e.target.value)); setFieldErrors((prev) => ({ ...prev, descuento_global_pct: '' })); }} />
              {fieldErrors.descuento_global_pct && <span className="field-error">{fieldErrors.descuento_global_pct}</span>}
            </label>
          </div>

          <div style={{ position: 'relative' }}>
            <input className="input" placeholder="Buscar producto por nombre o SKU…"
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            {resultados.length > 0 && (
              <div className="dropdown" style={{ position: 'absolute', zIndex: 10, background: 'var(--bg-1, #fff)', border: '1px solid var(--line, #ccc)', width: '100%', maxHeight: 240, overflowY: 'auto' }}>
                {resultados.map((r) => (
                  <button type="button" key={r.id} className="dropdown-item"
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', padding: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => void agregarProducto(r)}>
                    <span>{r.nombre_corto} <span className="text-muted">({r.sku})</span></span>
                    <span className="text-muted" style={{ color: (r.stock_fisico ?? 0) <= 0 ? 'var(--danger, #b00)' : undefined }}>
                      stock {r.stock_fisico ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cap de ~5 filas: a partir de ahí la lista scrollea sola (thead es sticky),
              sin empujar el buscador de producto, el total ni el pie del modal. */}
          <div className="table-wrap" style={{ maxHeight: 300 }}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th><th className="r">Stock</th><th className="r">Cantidad</th><th className="r">P. unit.</th>
                  <th className="r">Desc. %</th><th className="r">Subtotal</th><th />
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 && (
                  <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 12 }}>Sin líneas. Buscá un producto para agregar.</td></tr>
                )}
                {lineas.map((l, i) => (
                  <tr key={l.producto_id}>
                    <td>{l.descripcion}</td>
                    <td className="num r" style={{ color: l.stock < l.cantidad ? 'var(--danger, #b00)' : undefined, fontWeight: l.stock < l.cantidad ? 700 : undefined }}
                      title={l.stock < l.cantidad ? 'Stock insuficiente: se puede cotizar, pero la venta requerirá stock' : undefined}>
                      {l.stock}{l.stock < l.cantidad ? ' ⚠' : ''}
                    </td>
                    <td className="r">
                      <input className="input" type="number" min={0} step="any" style={{ width: 80, textAlign: 'right' }}
                        aria-label={`cantidad ${l.descripcion}`}
                        value={l.cantidad} onChange={(e) => actualizarLinea(l.producto_id, 'cantidad', Number(e.target.value))} />
                    </td>
                    <td className="num r">{pesos(l.precioListaCentavos)}</td>
                    <td className="r">
                      <input className="input" type="number" min={0} max={100} style={{ width: 70, textAlign: 'right' }}
                        aria-label={`descuento ${l.descripcion}`}
                        value={l.descuento_linea_pct} onChange={(e) => actualizarLinea(l.producto_id, 'descuento_linea_pct', Number(e.target.value))} />
                    </td>
                    <td className="num r">{pesos(preview.lineas[i]?.subtotalCentavos ?? 0)}</td>
                    <td className="r">
                      <button type="button" className="btn-danger" onClick={() => quitarLinea(l.producto_id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label style={{ display: 'grid', gap: 4 }}>
            Observaciones
            <input id="observaciones" className={`input${fieldErrors.observaciones ? ' error' : ''}`} value={observaciones}
              onChange={(e) => { setObservaciones(e.target.value); setFieldErrors((prev) => ({ ...prev, observaciones: '' })); }} />
            {fieldErrors.observaciones && <span className="field-error">{fieldErrors.observaciones}</span>}
          </label>

          <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 700 }}>
            Total: {pesos(preview.totalCentavos)}
          </div>

          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>
      </div>
    </div>
  );
}
