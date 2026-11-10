import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { bridge, propsFilaActivable, useAuth, traducirError } from '@core/ui';
type ItemSugerido = {
  producto_id: string;
  nombre_corto: string;
  cantidad_sugerida_uv: number;
  costo_centavos: number;
  codigo_proveedor: string | null;
  stock_minimo: number;
  stock_fisico: number;
  unidad_compra: string | null;
};

type GrupoSugerida = {
  proveedor_id: string;
  razon_social: string;
  items: ItemSugerido[];
};

type SinProveedor = {
  producto_id: string;
  nombre_corto: string;
  cantidad_sugerida_uv: number;
  stock_minimo: number;
  stock_fisico: number;
  unidad_compra: string | null;
};

type Sugerencia = {
  grupos: GrupoSugerida[];
  sin_proveedor: SinProveedor[];
};

type Proveedor = { id: string; razon_social: string };

type AsignForm = { proveedor_id: string; costo_str: string; codigo_proveedor: string };

function fmtARS(c: number) {
  return (c / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' }) {
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

const f = () => bridge();

export function OcSugeridaView() {
  const navigate = useNavigate();
  // Crear la OC y asignar proveedor es de quien gestiona proveedores; el resto solo ve la sugerencia.
  const gestiona = useAuth().can('proveedor.gestionar');
  const [sugerencia, setSugerencia]       = useState<Sugerencia | null>(null);
  const [loading, setLoading]             = useState(true);
  const [creando, setCreando]             = useState<string | null>(null);
  const [q, setQ]                         = useState('');
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('desc');
  const [asignandoId, setAsignandoId]     = useState<string | null>(null);
  const [proveedores, setProveedores]     = useState<Proveedor[]>([]);
  const [asignForm, setAsignForm]         = useState<AsignForm>({ proveedor_id: '', costo_str: '', codigo_proveedor: '' });
  const [asignando, setAsignando]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  function cargar() {
    setLoading(true);
    f().compras.oc.sugerir()
      .then((data: Sugerencia) => setSugerencia(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, []);

  async function handleCrearOC(grupo: GrupoSugerida) {
    setCreando(grupo.proveedor_id);
    setError(null);
    try {
      const { id: ocId } = await f().compras.oc.crear({ proveedor_id: grupo.proveedor_id, tipo: 'sugerida' });
      for (const item of grupo.items) {
        await f().compras.oc.agregarItem({
          orden_compra_id:         ocId,
          producto_id:             item.producto_id,
          descripcion:             item.nombre_corto,
          cantidad_pedida:         item.cantidad_sugerida_uv,
          costo_unitario_centavos: item.costo_centavos,
          alicuota_iva:            21,
        });
      }
      navigate(`/compras/ordenes/${ocId}`);
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally {
      setCreando(null);
    }
  }

  async function handleAbrirAsignacion(productoId: string) {
    if (asignandoId === productoId) { setAsignandoId(null); return; }
    setAsignandoId(productoId);
    setAsignForm({ proveedor_id: '', costo_str: '', codigo_proveedor: '' });
    if (proveedores.length === 0) {
      const lista = await f().compras.proveedor.list();
      setProveedores(lista ?? []);
    }
  }

  async function handleAsignar(productoId: string) {
    if (!asignForm.proveedor_id) return;
    setAsignando(true);
    setError(null);
    try {
      const costo_centavos = Math.round(parseFloat(asignForm.costo_str.replace(',', '.') || '0') * 100);
      const { id } = await f().compras.pp.upsert({
        producto_id:      productoId,
        proveedor_id:     asignForm.proveedor_id,
        costo_centavos,
        codigo_proveedor: asignForm.codigo_proveedor || undefined,
      });
      await f().compras.pp.setPreferido(id);
      setAsignandoId(null);
      cargar();
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally {
      setAsignando(false);
    }
  }

  const { grupos = [], sin_proveedor = [] } = sugerencia ?? {};

  const filteredGrupos = useMemo(() => {
    const qLow = q.toLowerCase();
    return grupos.map(g => ({
      ...g,
      items: g.items
        .filter(i => !qLow || i.nombre_corto.toLowerCase().includes(qLow))
        .sort((a, b) => sortDir === 'desc'
          ? b.cantidad_sugerida_uv - a.cantidad_sugerida_uv
          : a.cantidad_sugerida_uv - b.cantidad_sugerida_uv),
    })).filter(g => g.items.length > 0);
  }, [grupos, q, sortDir]);

  const filteredSinProv = useMemo(() => {
    const qLow = q.toLowerCase();
    return sin_proveedor
      .filter(i => !qLow || i.nombre_corto.toLowerCase().includes(qLow))
      .sort((a, b) => sortDir === 'desc'
        ? b.cantidad_sugerida_uv - a.cantidad_sugerida_uv
        : a.cantidad_sugerida_uv - b.cantidad_sugerida_uv);
  }, [sin_proveedor, q, sortDir]);

  const sinDatos = grupos.length === 0 && sin_proveedor.length === 0;

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Calculando sugerencias...</div>;

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>OC Sugerida</h1>
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}

      {!sinDatos && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="input"
            style={{ width: 260, fontSize: '0.85rem' }}
            placeholder="Buscar producto..."
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Buscar producto"
          />
        </div>
      )}

      {sinDatos && (
        <div className="card">
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
            No hay productos bajo el stock mínimo.
          </div>
        </div>
      )}

      {filteredGrupos.map(grupo => (
        <div key={grupo.proveedor_id} className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '15px' }}>{grupo.razon_social}</span>
            {gestiona && (
              <button className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}
                onClick={() => handleCrearOC(grupo)}
                disabled={creando === grupo.proveedor_id}>
                {creando === grupo.proveedor_id ? 'Creando...' : 'Crear OC y editar'}
              </button>
            )}
          </div>
          <div className="table-wrap" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cód. prov.</th>
                  <th>U. compra</th>
                  <th className="r">Mínimo</th>
                  <th className="r">Faltante</th>
                  <th className="r" style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                    Sugerida <SortIcon dir={sortDir} />
                  </th>
                  <th className="r">Costo unit.</th>
                  <th className="r">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {grupo.items.map(item => (
                  <tr key={item.producto_id}>
                    <td>{item.nombre_corto}</td>
                    <td>{item.codigo_proveedor ?? '—'}</td>
                    <td>{item.unidad_compra ?? '—'}</td>
                    <td className="r"><span className="num">{item.stock_minimo}</span></td>
                    <td className="r"><span className="num">{item.stock_minimo - item.stock_fisico}</span></td>
                    <td className="r"><span className="num">{item.cantidad_sugerida_uv}</span></td>
                    <td className="r"><span className="num">$ {fmtARS(item.costo_centavos)}</span></td>
                    <td className="r"><span className="num">$ {fmtARS(item.costo_centavos * item.cantidad_sugerida_uv)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {filteredSinProv.length > 0 && (
        <div className="card">
          <div className="card-title">Sin proveedor preferido asignado</div>
          <div className="table-wrap" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>U. compra</th>
                  <th className="r">Mínimo</th>
                  <th className="r">Faltante</th>
                  <th className="r" style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                    Sugerida <SortIcon dir={sortDir} />
                  </th>
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>
                {filteredSinProv.map(item => (
                  <React.Fragment key={item.producto_id}>
                    <tr {...(gestiona ? propsFilaActivable(() => handleAbrirAsignacion(item.producto_id)) : {})}>
                      <td>{item.nombre_corto}</td>
                      <td>{item.unidad_compra ?? '—'}</td>
                      <td className="r"><span className="num">{item.stock_minimo}</span></td>
                      <td className="r"><span className="num">{item.stock_minimo - item.stock_fisico}</span></td>
                      <td className="r"><span className="num">{item.cantidad_sugerida_uv}</span></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {gestiona && (
                          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                            {asignandoId === item.producto_id ? 'Cancelar' : 'Asignar proveedor'}
                          </span>
                        )}
                      </td>
                    </tr>
                    {asignandoId === item.producto_id && (
                      <tr>
                        <td colSpan={6} style={{ padding: '12px var(--pad)', background: 'var(--surface-2, var(--bg-2, #f5f5f5))' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <label className="form-label" style={{ margin: 0 }}>
                              Proveedor *
                              <select
                                className="input"
                                style={{ minWidth: 200, fontSize: '0.85rem' }}
                                value={asignForm.proveedor_id}
                                onChange={e => setAsignForm(f => ({ ...f, proveedor_id: e.target.value }))}
                                aria-label="Proveedor"
                              >
                                <option value="">Seleccionar...</option>
                                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                              </select>
                            </label>
                            <label className="form-label" style={{ margin: 0, maxWidth: 140 }}>
                              Costo unit. ($)
                              <input
                                className="input"
                                style={{ fontSize: '0.85rem' }}
                                type="number"
                                min={0}
                                step={1}
                                value={asignForm.costo_str}
                                onChange={e => setAsignForm(f => ({ ...f, costo_str: e.target.value }))}
                                placeholder="0"
                                aria-label="Costo unitario"
                              />
                            </label>
                            <label className="form-label" style={{ margin: 0, maxWidth: 160 }}>
                              Cód. proveedor
                              <input
                                className="input"
                                style={{ fontSize: '0.85rem' }}
                                value={asignForm.codigo_proveedor}
                                onChange={e => setAsignForm(f => ({ ...f, codigo_proveedor: e.target.value }))}
                                placeholder="Opcional"
                                aria-label="Código proveedor"
                              />
                            </label>
                            <button
                              className="btn-primary"
                              style={{ fontSize: '12px', padding: '5px 12px' }}
                              disabled={!asignForm.proveedor_id || asignando}
                              onClick={() => handleAsignar(item.producto_id)}
                            >
                              {asignando ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
