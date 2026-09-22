import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSustitutosHabilitado } from '../../hooks/useSustitutosHabilitado';
import { useEquivalencias, type EquivalenciaItem } from '../../hooks/useEquivalencias';
import { useCallIpc } from '@core/ui';

// ADR-085 (SEC-2): campos que pueden recibir un error de validación del backend.
// `producto_relacionado_id` se elige mediante el buscador (no hay un input de id propio),
// así que su control focoable es el input de búsqueda; `tipo` es el <select>.
const CAMPOS_ERROR = new Set(['producto_relacionado_id', 'tipo']);

type Props = { productoId: string; discontinuado: boolean };

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Grupo({ titulo, items, onQuitar }: { titulo: string; items: EquivalenciaItem[]; onQuitar: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="text-muted text-xs" style={{ marginBottom: 4 }}>{titulo}</div>
      {items.map(it => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <Link to={`/productos/${it.producto_id}`} style={{ fontWeight: 600, flex: 1 }}>{it.nombre_corto}</Link>
          {it.marca_nombre && <span className="text-muted text-xs">{it.marca_nombre}</span>}
          {it.discontinuado && <span className="badge off text-xs">discontinuado</span>}
          <span className="num" style={{ minWidth: 90, textAlign: 'right' }}>$ {fmt(it.precio_final_centavos)}</span>
          <span className="num text-xs" style={{ minWidth: 60, textAlign: 'right', opacity: 0.8 }}>stock {it.stock_fisico}</span>
          <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => onQuitar(it.id)}>Quitar</button>
        </div>
      ))}
    </div>
  );
}

export function EquivalenciasPanel({ productoId, discontinuado }: Readonly<Props>) {
  const habilitado = useSustitutosHabilitado();
  const { data, refetch } = useEquivalencias(productoId, habilitado);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [tipo, setTipo] = useState<'equivalente' | 'reemplazo'>('equivalente');
  const [marcarDiscontinuado, setMarcarDiscontinuado] = useState(false);
  const [disc, setDisc] = useState(discontinuado);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const callIpc = useCallIpc();

  if (!habilitado) return null;

  const f = () => (globalThis as any).ferreteria;

  async function buscar(q: string) {
    setBusqueda(q);
    setErrors(e => { const n = { ...e }; delete n.producto_relacionado_id; return n; });
    if (!q.trim()) { setResultados([]); return; }
    const r = await f().catalogo.producto.list({ busqueda: q.trim(), activo: true, page: 1, pageSize: 6 });
    setResultados(r.items.filter((p: any) => p.id !== productoId));
  }

  function cambiarTipo(nuevo: 'equivalente' | 'reemplazo') {
    setTipo(nuevo);
    setErrors(e => { const n = { ...e }; delete n.tipo; return n; });
  }

  async function agregar(relacionadoId: string) {
    // ERR-1/SEC-2 (ADR-085): callIpc traduce y muestra el error por toast; si el backend
    // rechaza un campo de validación, lo enrutamos al control focoable correspondiente.
    const r = await callIpc(
      () => f().catalogo.producto.equivalencia.add({ producto_id: productoId, producto_relacionado_id: relacionadoId, tipo }),
      { success: 'Equivalencia agregada' },
    );
    if (!r.ok) {
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      }
      return;
    }
    if (tipo === 'reemplazo' && marcarDiscontinuado) {
      await f().catalogo.producto.setDiscontinuado({ id: productoId, discontinuado: true });
      setDisc(true);
    }
    setBusqueda(''); setResultados([]);
    await refetch();
  }

  async function quitar(id: string) {
    // El remove no tiene un control de formulario propio (se dispara desde el botón
    // "Quitar" de cada fila): un VALIDATION:id no tiene dónde enfocar, así que se
    // muestra únicamente por el toast que ya emite callIpc.
    const r = await callIpc(
      () => f().catalogo.producto.equivalencia.remove({ id }),
      { success: 'Equivalencia quitada' },
    );
    if (!r.ok) return;
    await refetch();
  }

  async function toggleDiscontinuado() {
    const nuevo = !disc;
    await f().catalogo.producto.setDiscontinuado({ id: productoId, discontinuado: nuevo });
    setDisc(nuevo);
  }

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Equivalentes y reemplazos</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={disc} onChange={toggleDiscontinuado} /> Discontinuado
        </label>
      </div>

      <div style={{ padding: '0 var(--pad) var(--pad)' }}>
      <Grupo titulo="Equivalentes" items={data.equivalentes} onQuitar={quitar} />
      <Grupo titulo="Reemplazado por" items={data.reemplazado_por} onQuitar={quitar} />
      <Grupo titulo="Reemplaza a" items={data.reemplaza_a} onQuitar={quitar} />

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            id="tipo"
            value={tipo}
            onChange={e => cambiarTipo(e.target.value as 'equivalente' | 'reemplazo')}
            className={`input${errors.tipo ? ' error' : ''}`}
            style={{ width: 150 }}
          >
            <option value="equivalente">Equivalente</option>
            <option value="reemplazo">Reemplazado por</option>
          </select>
          <input
            id="producto_relacionado_id"
            className={`input${errors.producto_relacionado_id ? ' error' : ''}`}
            style={{ flex: 1 }}
            placeholder="Buscar producto a relacionar…"
            value={busqueda}
            onChange={e => buscar(e.target.value)}
          />
        </div>
        {errors.tipo && <span className="field-error">{errors.tipo}</span>}
        {errors.producto_relacionado_id && <span className="field-error">{errors.producto_relacionado_id}</span>}
        {tipo === 'reemplazo' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={marcarDiscontinuado} onChange={e => setMarcarDiscontinuado(e.target.checked)} />
            Marcar este producto como discontinuado al agregar
          </label>
        )}
        {resultados.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 8 }}>
            {resultados.map((p: any) => (
              <button key={p.id} type="button" onClick={() => agregar(p.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 600 }}>{p.nombre_corto}</span>
                <span className="text-muted text-xs" style={{ marginLeft: 8 }}>{p.sku}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
