import { useEffect, useState } from 'react';
import { useAuth, useEscapeToClose, useToast, traducirError } from '@core/ui';
import {
  useListasPrecio, type ListaPrecioRow, type ListaCrearPayload, type ListaActualizarPayload, type PrecioListaRow,
} from '../../hooks/useListasPrecio';
import { useProductosVenta, type ProductoVentaRow } from '../../hooks/useProductosVenta';

const pesos = (centavos: number) => `$${(centavos / 100).toFixed(2)}`;
const ajusteTexto = (pct: number) => (pct === 0 ? 'Sin ajuste' : `${pct > 0 ? '+' : ''}${pct}%`);

export function ListasPrecioView() {
  const { can } = useAuth();
  const { listas, loading, crear, actualizar, preciosDe, fijarPrecio } = useListasPrecio();
  const { productos } = useProductosVenta();
  const [modal, setModal] = useState<{ lista: ListaPrecioRow | null } | null>(null);
  const [editandoPrecios, setEditandoPrecios] = useState<ListaPrecioRow | null>(null);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  const puedeGestionar = can('lista_precio.gestionar');

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="ml-auto" />
        {puedeGestionar && <button className="btn-primary" onClick={() => setModal({ lista: null })}>+ Nueva lista</button>}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th className="c">Ajuste</th><th className="c">Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {listas.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin listas de precio</td></tr>
            )}
            {listas.map((l) => (
              <tr key={l.id}>
                <td>{l.nombre}</td>
                <td className="c">{ajusteTexto(l.ajuste_porcentual)}</td>
                <td className="c">
                  <span className={`badge ${l.activo ? 'ok' : 'off'}`}><span className="bd" />{l.activo ? 'Activa' : 'Inactiva'}</span>
                </td>
                <td>
                  {puedeGestionar && (
                    <>
                      <button className="btn-secondary btn-sm" onClick={() => setModal({ lista: l })}>Editar</button>{' '}
                      <button className="btn-secondary btn-sm" onClick={() => setEditandoPrecios(l)}>Precios</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <ListaModal lista={modal.lista} onClose={() => setModal(null)} onCrear={crear} onActualizar={actualizar} />
      )}
      {editandoPrecios && (
        <PreciosModal
          lista={editandoPrecios}
          productos={productos.filter((p) => p.activo)}
          onClose={() => setEditandoPrecios(null)}
          preciosDe={preciosDe}
          fijarPrecio={fijarPrecio}
        />
      )}
    </div>
  );
}

function ListaModal({ lista, onClose, onCrear, onActualizar }: {
  lista: ListaPrecioRow | null;
  onClose: () => void;
  onCrear: (p: ListaCrearPayload) => Promise<void>;
  onActualizar: (p: ListaActualizarPayload) => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(lista?.nombre ?? '');
  const [ajuste, setAjuste] = useState(String(lista?.ajuste_porcentual ?? 0));
  const [activo, setActivo] = useState(lista?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pct = Number(ajuste);
    if (!nombre.trim() || ajuste.trim() === '' || !Number.isFinite(pct)) return;
    setSaving(true); setError(null);
    try {
      if (lista) await onActualizar({ id: lista.id, nombre: nombre.trim(), ajuste_porcentual: pct, activo });
      else await onCrear({ nombre: nombre.trim(), ajuste_porcentual: pct });
      toast.success(lista ? 'Lista actualizada' : 'Lista creada');
      onClose();
    } catch (err) {
      setError(traducirError(err).mensaje);
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header"><span className="modal-title">{lista ? 'Editar lista' : 'Nueva lista de precio'}</span></div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="lista-nombre">Nombre *</label>
            <input id="lista-nombre" className="input" type="text" required maxLength={60} value={nombre}
              onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="lista-ajuste">Ajuste sobre el precio base (%)</label>
            <input id="lista-ajuste" className="input" type="number" step="any" min="-100" max="1000" value={ajuste}
              onChange={(e) => setAjuste(e.target.value)} />
            <small style={{ opacity: 0.7 }}>Se aplica a los productos que no tengan un precio propio en la lista. Ej.: -10 = 10% de descuento.</small>
          </div>
          {lista && (
            <div className="field">
              <label><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Lista activa</label>
            </div>
          )}
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={!nombre.trim() || saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

function PreciosModal({ lista, productos, onClose, preciosDe, fijarPrecio }: {
  lista: ListaPrecioRow;
  productos: ProductoVentaRow[];
  onClose: () => void;
  preciosDe: (lista_precio_id: string) => Promise<PrecioListaRow[]>;
  fijarPrecio: (p: { lista_precio_id: string; producto_venta_id: string; precio_centavos: number | null }) => Promise<unknown>;
}) {
  const [absolutos, setAbsolutos] = useState<Map<string, number>>(new Map());
  const [edicion, setEdicion] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, true);

  useEffect(() => {
    let vigente = true;
    preciosDe(lista.id)
      .then((rows) => { if (vigente) setAbsolutos(new Map(rows.map((r) => [r.producto_venta_id, r.precio_centavos]))); })
      .catch((e) => { if (vigente) setError(traducirError(e).mensaje); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [lista.id, preciosDe]);

  async function guardar(p: ProductoVentaRow, centavos: number | null) {
    setError(null);
    try {
      await fijarPrecio({ lista_precio_id: lista.id, producto_venta_id: p.id, precio_centavos: centavos });
      setAbsolutos((m) => {
        const n = new Map(m);
        if (centavos === null) n.delete(p.id); else n.set(p.id, centavos);
        return n;
      });
      setEdicion((e) => { const { [p.id]: _omit, ...resto } = e; return resto; });
    } catch (e) {
      setError(traducirError(e).mensaje);
    }
  }

  return (
    <div role="dialog" className="modal-overlay">
      <div className="modal" style={{ maxWidth: '48rem', width: '100%' }}>
        <div className="modal-header"><span className="modal-title">Precios — {lista.nombre}</span></div>
        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
            Los productos sin precio propio usan el precio base {ajusteTexto(lista.ajuste_porcentual).toLowerCase()}.
          </p>
          {error && <div className="alert-danger" role="alert">{error}</div>}
          {cargando ? <div style={{ opacity: 0.5 }}>Cargando...</div> : (
            <table>
              <thead><tr><th>Producto</th><th className="c">Base</th><th className="c">Precio en la lista ($)</th><th /></tr></thead>
              <tbody>
                {productos.map((p) => {
                  const propio = absolutos.get(p.id);
                  const valor = edicion[p.id] ?? (propio !== undefined ? (propio / 100).toFixed(2) : '');
                  const efectivo = Math.max(0, Math.round(p.precio_centavos * (1 + lista.ajuste_porcentual / 100)));
                  const nuevo = valor.trim() === '' ? NaN : Math.round(Number(valor) * 100);
                  const valido = Number.isFinite(nuevo) && nuevo >= 0 && nuevo !== propio;
                  return (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td className="c">{pesos(p.precio_centavos)}</td>
                      <td className="c">
                        <input aria-label={`Precio de ${p.nombre}`} className="input" type="number" step="0.01" min="0"
                          placeholder={(efectivo / 100).toFixed(2)} value={valor}
                          onChange={(e) => setEdicion((m) => ({ ...m, [p.id]: e.target.value }))} />
                      </td>
                      <td>
                        <button type="button" className="btn-primary btn-sm" disabled={!valido}
                          aria-label={`Guardar precio de ${p.nombre}`} onClick={() => guardar(p, nuevo)}>Guardar</button>{' '}
                        {propio !== undefined && (
                          <button type="button" className="btn-secondary btn-sm"
                            aria-label={`Quitar precio de ${p.nombre}`} onClick={() => guardar(p, null)}>Quitar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
