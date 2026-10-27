import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchBox, usePersistentListState, bridge } from '@core/ui';
import { resaltarCoincidencia } from '@core/ui';
import { ExportarButton } from '@core/ui';
import { exportProveedores } from '@ferreteria/shared';

type Proveedor = {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  tipo_documento: string;
  numero_documento: string;
  condicion_fiscal: string;
  codigo: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
};

export function ProveedoresListado() {
  const navigate = useNavigate();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = usePersistentListState('proveedores-busqueda', '');

  useEffect(() => {
    setLoading(true);
    bridge().compras.proveedor.list()
      .then((data: Proveedor[]) => setProveedores(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = proveedores.filter(p =>
    p.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.nombre_fantasia ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
    p.numero_documento.includes(busqueda)
  );

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <SearchBox
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por razón social, nombre fantasia o CUIT..."
        />
        <div className="ml-auto" />
        <ExportarButton definicion={exportProveedores} />
        <Link to="/compras/proveedores/nuevo">
          <button className="btn-primary">+ Nuevo proveedor</button>
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Razón social</th>
                <th>Tipo</th>
                <th>Número</th>
                <th>Condición fiscal</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th className="c">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin resultados</td></tr>
              )}
              {filtered.map(p => {
                const abrirDetalle = () => navigate(`/compras/proveedores/${p.id}`);
                return (
                <tr
                  key={p.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle de ${p.razon_social}`}
                  style={{ cursor: 'pointer' }}
                  onClick={abrirDetalle}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      abrirDetalle();
                    }
                  }}
                >
                  <td><span className="num">{p.codigo ?? '—'}</span></td>
                  <td>
                    <div className="p-name">{resaltarCoincidencia(p.razon_social, busqueda)}</div>
                    {p.nombre_fantasia && <div className="p-sub">{p.nombre_fantasia}</div>}
                  </td>
                  <td>{p.tipo_documento}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className="num">{p.numero_documento}</span></td>
                  <td>{p.condicion_fiscal}</td>
                  <td>{p.telefono ?? '—'}</td>
                  <td>{p.email ?? '—'}</td>
                  <td className="c">
                    <span className={`badge ${p.activo ? 'ok' : 'off'}`}>
                      <span className="bd" />{p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
