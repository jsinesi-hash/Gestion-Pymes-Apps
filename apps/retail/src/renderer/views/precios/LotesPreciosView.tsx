import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { bridge } from '@core/ui';
// ADR-049 §4/§8 — listado de lotes de precios.

type BatchRow = {
  id: string;
  lista_nombre: string;
  proveedor_id: string | null;
  origen: string;
  estado: string;
  productos_ok: number;
  advertencias: number;
  errores: number;
  excluidas: number;
  impacto_incremento_centavos: number;
  fecha_creacion: number;
};

const f = () => bridge();

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'off', validado: 'ok', pendiente_aprobacion: 'warn', aprobado: 'ok',
  publicado: 'ok', validacion_fallida: 'err', cancelado: 'off', revertido: 'off',
};
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador', validado: 'Validado', pendiente_aprobacion: 'Pend. aprobación',
  aprobado: 'Aprobado', publicado: 'Publicado', validacion_fallida: 'Validación fallida',
  cancelado: 'Cancelado', revertido: 'Revertido',
};
const ORIGEN_LABEL: Record<string, string> = {
  PROVIDER_COST_UPDATE: 'Costo proveedor', MARGIN_UPDATE: 'Margen', SUPPLIER_CHANGE: 'Cambio proveedor',
  PRODUCT_CREATED: 'Alta producto', PROMOTION_CREATED: 'Promoción', MANUAL_RECALCULATION: 'Recálculo manual',
  ROLLBACK: 'Reversión',
};

function ars(c: number) {
  const s = (Math.abs(c) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  return (c < 0 ? '−$ ' : '$ ') + s;
}

export function LotesPreciosView() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'activos' | 'todos' | string>('activos');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const arg = filtro === 'activos' ? { soloActivos: true }
        : filtro === 'todos' ? { soloActivos: false }
        : { estado: filtro };
      const data = await f().precios.batch.listar(arg).catch(() => []);
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-col gap-4">
      <div className="toolbar" style={{ background: 'none', border: 'none', padding: 0 }}>
        <h2 style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>Lotes de precios</h2>
        <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Estado
          <select className="input" aria-label="filtro estado" value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="activos">Activos</option>
            <option value="publicado">Publicados</option>
            <option value="revertido">Revertidos</option>
            <option value="cancelado">Cancelados</option>
            <option value="todos">Todos</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lote</th>
                <th>Lista</th>
                <th>Origen</th>
                <th>Estado</th>
                <th className="r">OK / Adv / Err</th>
                <th className="r">Impacto</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(b => (
                <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigate(b.id)}>
                  <td><code className="text-xs">#{b.id.slice(0, 8)}</code></td>
                  <td>{b.lista_nombre}</td>
                  <td className="text-sm">{ORIGEN_LABEL[b.origen] ?? b.origen}</td>
                  <td><span className={`badge ${ESTADO_BADGE[b.estado] ?? 'off'}`}><span className="bd" />{ESTADO_LABEL[b.estado] ?? b.estado}</span></td>
                  <td className="r num">
                    <span style={{ color: 'var(--color-success, #10b981)' }}>{b.productos_ok}</span>
                    {' / '}<span style={{ color: 'var(--color-warning, #d97706)' }}>{b.advertencias}</span>
                    {' / '}<span style={{ color: b.errores ? 'var(--color-danger, #dc2626)' : undefined }}>{b.errores}</span>
                  </td>
                  <td className="r num">{ars(b.impacto_incremento_centavos)}</td>
                  <td className="text-sm text-muted">{new Date(b.fecha_creacion).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, fontSize: 13 }}>Sin lotes {filtro === 'activos' ? 'activos' : ''}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
