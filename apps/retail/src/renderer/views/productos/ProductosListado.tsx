import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalogoContext, type ProductoSortCol } from '../../context/CatalogoContext';
import { useProductos } from '../../hooks/useProductos';
import { useProductosSimilares } from '../../hooks/useProductosSimilares';
import { useBusquedaSimilaresHabilitado } from '../../hooks/useBusquedaSimilaresHabilitado';
import { useCategorias } from '../../hooks/useCategorias';
import { useMarcas } from '../../hooks/useMarcas';
import { useFilaNavegable } from '../../hooks/useFilaNavegable';
import { ExportarButton } from '@core/ui';
import { exportProductos } from '@ferreteria/shared';
import { VistosRecientesPanel } from '@core/ui';

const PAGE_SIZE = 20;

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 4 }}>↕</span>;
  return <span style={{ fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

// BUG-1: la fila vive en su propio componente para que useFilaNavegable() se llame en
// el cuerpo de un componente y no dentro de items.map() (rules-of-hooks). El tipo del
// producto se infiere de useProductos(); usamos un alias laxo para no acoplar el archivo
// a la forma exacta del row.
type ProductoRow = {
  id: string; sku: string; nombre_corto: string;
  precio_venta_lista?: number; stock_fisico?: number | null; activo: boolean;
  ubicacion_sector?: string | null; ubicacion_estante?: string | null; ubicacion_posicion?: string | null;
};

function ProductoFila({ producto: p, onOpen }: { producto: ProductoRow; onOpen: () => void }) {
  const filaProps = useFilaNavegable(onOpen, `Ver detalle de ${p.nombre_corto}`);
  return (
    <tr {...filaProps}>
      <td><span className="p-name">{p.nombre_corto}</span></td>
      <td className="c" style={{ whiteSpace: 'nowrap' }}><span className="num p-code">{p.sku}</span></td>
      <td className="r"><span className="num">$ {p.precio_venta_lista?.toLocaleString('es-AR')}</span></td>
      <td className="c"><span className="num">{p.stock_fisico ?? 0}</span></td>
      <td className="c">{p.ubicacion_sector ?? <span style={{ opacity: 0.4 }}>—</span>}</td>
      <td className="c">{p.ubicacion_estante ?? <span style={{ opacity: 0.4 }}>—</span>}</td>
      <td className="c">{p.ubicacion_posicion ?? <span style={{ opacity: 0.4 }}>—</span>}</td>
      <td className="c">
        <span className={`badge ${p.activo ? 'ok' : 'off'}`}>
          <span className="bd" />{p.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
    </tr>
  );
}

export function ProductosListado() {
  const {
    busqueda, setBusqueda,
    busquedaUbicacion, setBusquedaUbicacion,
    filtros, setFiltros,
    sortBy, sortDir, toggleSort,
    pagina, setPagina,
  } = useCatalogoContext();
  const navigate = useNavigate();
  const { items, total, loading } = useProductos(PAGE_SIZE);
  const categorias = useCategorias();
  const { marcas } = useMarcas();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Modo "Buscar similares" (detrás de flag): usa el servicio único de búsqueda por
  // similitud (matcher token-set de ADR-063). Reutiliza la misma caja de búsqueda; con el
  // modo apagado la pantalla se comporta exactamente como antes.
  const similaresHabilitado = useBusquedaSimilaresHabilitado();
  const [modoSimilitud, setModoSimilitud] = useState(false);
  const { items: similares, loading: loadingSim } =
    useProductosSimilares(modoSimilitud ? busqueda : '');

  const th = (col: ProductoSortCol, label: string, extraClass = '') => (
    <th
      className={extraClass || undefined}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => toggleSort(col)}
    >
      {label} <SortIcon active={sortBy === col} dir={sortDir} />
    </th>
  );

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            placeholder="Buscar por nombre, SKU o EAN..."
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
          />
        </div>
        {similaresHabilitado && (
          <button
            type="button"
            className={modoSimilitud ? 'btn-primary' : 'btn'}
            aria-pressed={modoSimilitud}
            title="Buscar productos por similitud de nombre (revisar duplicados / por característica)"
            onClick={() => setModoSimilitud(m => !m)}
          >
            Buscar similares
          </button>
        )}
        <div className="search" style={{ display: modoSimilitud ? 'none' : undefined }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C8.69 2 6 4.69 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.31-2.69-6-6-6z"/><circle cx="12" cy="8" r="2"/>
          </svg>
          <input
            placeholder="Buscar ubicación (sector, estante, posición o código)…"
            value={busquedaUbicacion}
            onChange={e => setBusquedaUbicacion(e.target.value)}
          />
        </div>
        <select className="filter" value={filtros.categoria_id ?? ''} onChange={e => {
          setFiltros({ categoria_id: e.target.value || undefined });
        }}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="filter" value={filtros.marca_id ?? ''} onChange={e => {
          setFiltros({ marca_id: e.target.value || undefined });
        }}>
          <option value="">Todas las marcas</option>
          {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select className="filter"
          value={filtros.activo === undefined ? '' : String(filtros.activo)}
          onChange={e => {
            setFiltros({ activo: e.target.value === '' ? undefined : e.target.value === 'true' });
          }}
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <div className="ml-auto" />
        <ExportarButton
          definicion={exportProductos}
          filtrosActivos={{ busqueda: busqueda || undefined, ...filtros }}
        />
        <Link to="/productos/nuevo">
          <button className="btn-primary">+ Nuevo producto</button>
        </Link>
      </div>

      <VistosRecientesPanel />

      {modoSimilitud ? (
        loadingSim ? (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Buscando similares...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="c">SKU</th>
                  <th className="r">Precio</th>
                  <th className="r">Stock</th>
                  <th className="r">Similitud</th>
                </tr>
              </thead>
              <tbody>
                {similares.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    {busqueda.trim() ? 'Sin resultados' : 'Escribí para buscar por similitud'}
                  </td></tr>
                )}
                {similares.map(s => (
                  <tr
                    key={s.producto_id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalle de ${s.nombre_corto}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/productos/${s.producto_id}`)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/productos/${s.producto_id}`); } }}
                  >
                    <td><span className="p-name">{s.nombre_corto}</span></td>
                    <td className="c"><span className="num p-code">{s.sku}</span></td>
                    <td className="r"><span className="num">$ {(s.precio_final_centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></td>
                    <td className="r"><span className="num">{s.stock_fisico}</span></td>
                    <td className="r"><span className="num">{Math.round(s.score * 100)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {th('nombre_corto', 'Nombre')}
                  {th('sku', 'SKU', 'c')}
                  {th('precio_venta_lista', 'Precio lista', 'r')}
                  {th('stock_fisico', 'Stock', 'c')}
                  {th('ubicacion_sector', 'Sector', 'c')}
                  {th('ubicacion_estante', 'Estante', 'c')}
                  {th('ubicacion_posicion', 'Posición', 'c')}
                  <th className="c">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin resultados</td></tr>
                )}
                {items.map(p => (
                  <ProductoFila key={p.id} producto={p} onOpen={() => navigate(`/productos/${p.id}`)} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <span>{total} resultado{total === 1 ? '' : 's'}</span>
            {totalPages > 1 && (
              <div className="pg-btns">
                <button className="pg" onClick={() => setPagina(pagina - 1)} disabled={pagina === 1}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`pg${p === pagina ? ' active' : ''}`} onClick={() => setPagina(p)}>{p}</button>
                ))}
                <button className="pg" onClick={() => setPagina(pagina + 1)} disabled={pagina >= totalPages}>›</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
