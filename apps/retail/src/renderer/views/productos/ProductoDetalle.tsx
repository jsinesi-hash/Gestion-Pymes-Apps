import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEscapeAction } from '@core/ui';
import { useProducto } from '../../hooks/useProducto';
import { useRegistrarVisto } from '@core/ui';
import { useExistencias } from '../../hooks/useExistencias';
import { StockEntradaModal } from '../stock/StockEntradaModal';
import { StockAjusteModal } from '../stock/StockAjusteModal';
import { StockMermaModal } from '../stock/StockMermaModal';
import { PrecioPanel } from './PrecioPanel';
import { ProveedoresPanel } from './ProveedoresPanel';
import { PresentacionesPanel } from './PresentacionesPanel';
import { EquivalenciasPanel } from './EquivalenciasPanel';

function fmtStock(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

export function ProductoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Escape hace lo mismo que el botón «Volver» de más abajo.
  useEscapeAction(() => navigate(-1), { layer: 'page' });
  const { producto, loading, error } = useProducto(id);
  const { existencias, refetch: refetchEx } = useExistencias(id ?? '');
  const [stockModal, setStockModal] = useState<'entrada' | 'ajuste' | 'merma' | null>(null);

  // PERF-2: registrar el producto como "visto recientemente" (no-op si el flag está off).
  const registrarVisto = useRegistrarVisto();
  useEffect(() => {
    if (producto) registrarVisto({ tipo: 'producto', id: producto.id, etiqueta: producto.nombre_corto });
  }, [producto?.id, registrarVisto]);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  if (error || !producto) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Producto no encontrado.</div>;

  async function handlePrintLabel() {
    await (globalThis as any).ferreteria.catalogo.print.productLabel({ id, format: 'label' });
  }

  const stockBajoBadge = existencias?.stockMinimo != null && existencias.stockMinimo > 0 && existencias.stockFisico != null && existencias.stockFisico <= existencias.stockMinimo ? ' stock-low' : ' pos';
  const stockNumClass = existencias?.stockFisico === 0 ? ' neg' : stockBajoBadge;

  const faltaStock = (existencias?.stockFisico ?? 0) <= 0;
  const faltaCosto = (producto.precio_costo_promedio ?? 0) <= 0;

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>{producto.nombre_corto}</h1>
        <div className="detail-actions">
          <Link to={`/productos/${id}/editar`}><button className="btn-secondary">Editar</button></Link>
          <button className="btn-secondary" onClick={handlePrintLabel}>Imprimir etiqueta</button>
          <button className="btn-secondary" onClick={() => navigate(`/stock/${producto.id}/kardex`)}>Kardex</button>
          <button className="btn-secondary" onClick={() => setStockModal('entrada')}>Entrada</button>
          <button className="btn-secondary" onClick={() => setStockModal('ajuste')}>Ajuste</button>
          <button className="btn-secondary" onClick={() => setStockModal('merma')}>Merma</button>
        </div>
      </div>

      {producto.nombre_largo && producto.nombre_largo !== producto.nombre_corto && (
        <p className="text-muted">{producto.nombre_largo}</p>
      )}

      {(faltaStock || faltaCosto) && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <div className="card-title">Para vender falta:</div>
          <div style={{ padding: '12px var(--pad)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {faltaStock && <button className="btn-secondary" onClick={() => setStockModal('entrada')}>Cargar stock</button>}
            {faltaCosto && <button className="btn-secondary" onClick={() => setStockModal('entrada')}>Cargar costo</button>}
          </div>
        </div>
      )}

      <div className="cards-grid">
        <div className="card">
          <div className="card-title">Identificación</div>
          <div className="kv"><span className="k">SKU</span><span className="v num">{producto.sku}</span></div>
          {producto.gtin_barcode && (
            <div className="kv"><span className="k">EAN/Barcode</span><span className="v num">{producto.gtin_barcode}</span></div>
          )}
          <div className="kv"><span className="k">Estado</span>
            <span className={`v badge ${producto.activo ? 'ok' : 'off'}`}>
              <span className="bd" />{producto.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Precio y unidades</div>
          <div className="kv"><span className="k">Precio lista</span><span className="v big num">$ {producto.precio_venta_lista?.toLocaleString('es-AR')}</span></div>
          <div className="kv"><span className="k">Unidad venta</span><span className="v">{producto.unidad_venta}</span></div>
          {producto.unidad_compra && (
            <div className="kv"><span className="k">Unidad compra</span><span className="v">{producto.unidad_compra}</span></div>
          )}
          {producto.descripcion_tecnica && (
            <div className="kv"><span className="k">Descripción</span><span className="v muted">{producto.descripcion_tecnica}</span></div>
          )}
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-title">Ubicación en depósito</div>
          {producto.ubicacion_codigo ? (
            <div style={{ padding: '12px var(--pad)' }}>
              📍{' '}<span className="tag num" style={{ fontWeight: 700, fontSize: '14px' }}>{producto.ubicacion_codigo}</span>
              <span className="text-muted text-sm" style={{ marginLeft: '10px' }}>
                Sector {producto.ubicacion_sector} · Estante {producto.ubicacion_estante} · Posición {producto.ubicacion_posicion}
              </span>
            </div>
          ) : (
            <div style={{ padding: '12px var(--pad)', opacity: 0.5, fontStyle: 'italic' }}>Sin ubicación asignada</div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Stock</div>
          <div className="kv">
            <span className="k">Stock actual</span>
            <span className={`v big num${stockNumClass}`}>
              {fmtStock(existencias?.stockFisico)}
            </span>
          </div>
          <div className="kv">
            <span className="k">Stock mínimo</span>
            <span className="v num">{fmtStock(existencias?.stockMinimo)}</span>
          </div>
          {existencias?.stockMaximo != null && (
            <div className="kv">
              <span className="k">Stock máximo</span>
              <span className="v num">{fmtStock(existencias.stockMaximo)}</span>
            </div>
          )}
        </div>
      </div>

      <ProveedoresPanel productoId={producto.id} />

      <PresentacionesPanel productoId={producto.id} />

      <PrecioPanel productoId={producto.id} precioVentaLista={producto.precio_venta_lista ?? 0} />

      {id && <EquivalenciasPanel productoId={id} discontinuado={!!producto.discontinuado} />}

      {stockModal === 'entrada' && (
        <StockEntradaModal productoId={producto.id} onClose={() => setStockModal(null)} onSuccess={() => { setStockModal(null); refetchEx(); }} />
      )}
      {stockModal === 'ajuste' && (
        <StockAjusteModal productoId={producto.id} onClose={() => setStockModal(null)} onSuccess={() => { setStockModal(null); refetchEx(); }} />
      )}
      {stockModal === 'merma' && (
        <StockMermaModal productoId={producto.id} onClose={() => setStockModal(null)} onSuccess={() => { setStockModal(null); refetchEx(); }} />
      )}
    </div>
  );
}
