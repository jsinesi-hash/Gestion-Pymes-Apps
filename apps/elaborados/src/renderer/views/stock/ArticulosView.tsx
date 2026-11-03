import { useState, useEffect } from 'react';
import { useAuth, rutearCampoError, useToast, traducirError, Modal } from '@core/ui';
import { useArticulos, type ArticuloRow } from '../../hooks/useArticulos';

const TIPO_LABEL: Record<ArticuloRow['tipo'], string> = {
  insumo: 'Insumo', elaborado: 'Elaborado', reventa: 'Reventa',
};

type ModalState = { mode: 'create' } | { mode: 'edit'; articulo: ArticuloRow } | null;

export function ArticulosView() {
  const { can } = useAuth();
  const { articulos, loading, crear, actualizar, obtenerReceta, guardarReceta } = useArticulos();
  const [modal, setModal] = useState<ModalState>(null);
  const [soloNegativos, setSoloNegativos] = useState(false);
  const [recetaDe, setRecetaDe] = useState<ArticuloRow | null>(null);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  const puedeGestionar = can('articulo.gestionar');
  const visibles = soloNegativos ? articulos.filter((a) => (a.stock ?? 0) < 0) : articulos;
  const hayNegativos = articulos.some((a) => (a.stock ?? 0) < 0);

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
          <input type="checkbox" checked={soloNegativos} onChange={(e) => setSoloNegativos(e.target.checked)} />
          Solo en negativo {hayNegativos && <span className="badge off"><span className="bd" />!</span>}
        </label>
        <div className="ml-auto" />
        {puedeGestionar && (
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            + Nuevo artículo
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th><th>Tipo</th><th>Unidad</th><th className="c">Stock</th>
              <th className="c">Bloquea sin stock</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin resultados</td></tr>
            )}
            {visibles.map((a) => (
              <tr key={a.id}>
                <td>{a.nombre}</td>
                <td>{TIPO_LABEL[a.tipo]}</td>
                <td>{a.unidad}</td>
                <td className="c" style={(a.stock ?? 0) < 0 ? { color: 'var(--danger, #c0392b)', fontWeight: 600 } : undefined}>
                  {a.stock ?? 0}
                </td>
                <td className="c">{a.bloquea_sin_stock ? 'Sí' : 'No'}</td>
                <td>
                  {puedeGestionar && (
                    <button className="btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', articulo: a })}>
                      Editar
                    </button>
                  )}
                  {a.tipo === 'elaborado' && can('receta.gestionar') && (
                    <button className="btn-secondary btn-sm" onClick={() => setRecetaDe(a)}>
                      Receta
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ArticuloModal
          initial={modal.mode === 'edit' ? modal.articulo : null}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            if (modal.mode === 'edit') {
              await actualizar({
                id: modal.articulo.id,
                nombre: payload.nombre,
                bloquea_sin_stock: payload.bloquea_sin_stock,
                stock_minimo: payload.stock_minimo,
              });
            } else {
              await crear(payload);
            }
          }}
        />
      )}

      {recetaDe && (
        <RecetaModal
          articulo={recetaDe}
          articulos={articulos}
          onClose={() => setRecetaDe(null)}
          obtenerReceta={obtenerReceta}
          guardarReceta={guardarReceta}
        />
      )}
    </div>
  );
}

function ArticuloModal({ initial, onClose, onSave }: {
  initial: ArticuloRow | null;
  onClose: () => void;
  // Siempre manda la forma completa (tipo/unidad incluidos, con los valores de estado
  // actuales como placeholder en modo edición): así ArticulosView puede rutear a
  // `crear`/`actualizar` con tipos correctamente angostos, sin `as any`. En modo edición
  // el padre descarta tipo/unidad del payload — no se leen.
  onSave: (payload: {
    nombre: string; tipo: ArticuloRow['tipo']; unidad: ArticuloRow['unidad'];
    bloquea_sin_stock: boolean; stock_minimo: number | null;
  }) => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [tipo, setTipo] = useState<ArticuloRow['tipo']>(initial?.tipo ?? 'insumo');
  const [unidad, setUnidad] = useState<ArticuloRow['unidad']>(initial?.unidad ?? 'kg');
  const [bloqueaSinStock, setBloqueaSinStock] = useState(initial?.bloquea_sin_stock ?? true);
  const [stockMinimo, setStockMinimo] = useState(initial?.stock_minimo?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campoError, setCampoError] = useState<{ campo: string; mensaje: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setError(null); setCampoError(null);
    try {
      await onSave({
        nombre: nombre.trim(),
        tipo,
        unidad,
        bloquea_sin_stock: bloqueaSinStock,
        stock_minimo: stockMinimo.trim() === '' ? null : Number(stockMinimo),
      });
      toast.success('Artículo guardado');
      onClose();
    } catch (e) {
      const r = rutearCampoError(e, { nombre: 'articulo-nombre' });
      if (r.campo) setCampoError({ campo: r.campo, mensaje: r.mensaje });
      else setError(r.mensaje);
    } finally { setSaving(false); }
  }

  return (
    <Modal ariaLabel={initial ? 'Editar artículo' : 'Nuevo artículo'} onClose={onClose} bloqueado={saving} as="form" onSubmit={handleSubmit}>
      <div className="modal-header">
        <span className="modal-title">{initial ? 'Editar artículo' : 'Nuevo artículo'}</span>
      </div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="articulo-nombre">Nombre *</label>
          <input id="articulo-nombre" className={`input${campoError?.campo === 'nombre' ? ' error' : ''}`}
            type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          {campoError?.campo === 'nombre' && <span className="field-error">{campoError.mensaje}</span>}
        </div>
        {!initial && (
          <>
            <div className="field">
              <label htmlFor="articulo-tipo">Tipo *</label>
              <select id="articulo-tipo" className="input" value={tipo} onChange={(e) => setTipo(e.target.value as ArticuloRow['tipo'])}>
                <option value="insumo">Insumo</option>
                <option value="elaborado">Elaborado</option>
                <option value="reventa">Reventa</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="articulo-unidad">Unidad *</label>
              <select id="articulo-unidad" className="input" value={unidad} onChange={(e) => setUnidad(e.target.value as ArticuloRow['unidad'])}>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="u">u</option>
              </select>
            </div>
          </>
        )}
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={bloqueaSinStock} onChange={(e) => setBloqueaSinStock(e.target.checked)} />
            Bloquea la venta/ajuste sin stock
          </label>
        </div>
        <div className="field">
          <label htmlFor="articulo-stock-min">Stock mínimo</label>
          <input id="articulo-stock-min" className="input" type="number" step="any"
            value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} />
        </div>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={!nombre.trim() || saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

function RecetaModal({ articulo, articulos, onClose, obtenerReceta, guardarReceta }: {
  articulo: ArticuloRow;
  articulos: ArticuloRow[];
  onClose: () => void;
  obtenerReceta: (id: string) => Promise<{ rinde_cantidad: number; items: { articulo_id: string; cantidad: number }[] } | null>;
  guardarReceta: (p: { articulo_id: string; rinde_cantidad: number; items: { articulo_id: string; cantidad: number }[] }) => Promise<void>;
}) {
  const toast = useToast();
  const [rinde, setRinde] = useState('12');
  const [items, setItems] = useState<{ articulo_id: string; cantidad: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insumos = articulos.filter((a) => a.tipo === 'insumo');

  useEffect(() => {
    obtenerReceta(articulo.id).then((r) => {
      if (r) {
        setRinde(String(r.rinde_cantidad));
        setItems(r.items.map((i) => ({ articulo_id: i.articulo_id, cantidad: String(i.cantidad) })));
      } else if (insumos[0]) {
        setItems([{ articulo_id: insumos[0].id, cantidad: '' }]);
      }
      setLoading(false);
    });
  }, [articulo.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await guardarReceta({
        articulo_id: articulo.id,
        rinde_cantidad: Number(rinde),
        items: items.filter((i) => i.cantidad.trim() !== '').map((i) => ({ articulo_id: i.articulo_id, cantidad: Number(i.cantidad) })),
      });
      toast.success('Receta guardada');
      onClose();
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally { setSaving(false); }
  }

  if (loading) return null;

  return (
    <Modal ariaLabel={`Receta de ${articulo.nombre}`} onClose={onClose} bloqueado={saving} as="form" onSubmit={handleSubmit}>
      <div className="modal-header"><span className="modal-title">Receta — {articulo.nombre}</span></div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="receta-rinde">Rinde (en {articulo.unidad}) *</label>
          <input id="receta-rinde" className="input" type="number" step="any" required value={rinde} onChange={(e) => setRinde(e.target.value)} />
        </div>
        {items.map((item, i) => (
          <div key={i} className="flex-row gap-2">
            <select className="input" value={item.articulo_id}
              onChange={(e) => setItems(items.map((it, idx) => idx === i ? { ...it, articulo_id: e.target.value } : it))}>
              {insumos.map((ins) => <option key={ins.id} value={ins.id}>{ins.nombre}</option>)}
            </select>
            <input className="input" type="number" step="any" placeholder="Cantidad" value={item.cantidad}
              onChange={(e) => setItems(items.map((it, idx) => idx === i ? { ...it, cantidad: e.target.value } : it))} />
          </div>
        ))}
        <button type="button" className="btn-secondary btn-sm"
          onClick={() => setItems([...items, { articulo_id: insumos[0]?.id ?? '', cantidad: '' }])}>
          + Agregar insumo
        </button>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar receta'}</button>
      </div>
    </Modal>
  );
}
