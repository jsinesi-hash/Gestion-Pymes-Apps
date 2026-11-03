import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFilaNavegable } from '../../../hooks/useFilaNavegable';
import { SearchBox, usePersistentListState, bridge } from '@core/ui';
import { resaltarCoincidencia } from '@core/ui';
import { ExportarButton } from '@core/ui';
import { exportTransportistas } from '@ferreteria/shared';

type Transportista = {
  id: string;
  razon_social: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
};

export function TransportistasListado() {
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = usePersistentListState('transportistas-busqueda', '');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    bridge().transportista.list({ incluirInactivos: true })
      .then((data: Transportista[]) => setTransportistas(data))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = transportistas.filter(t =>
    t.razon_social.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <SearchBox
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por razón social..."
        />
        <div className="ml-auto" />
        <ExportarButton definicion={exportTransportistas} />
        <Link to="/remitos/transportistas/nuevo">
          <button className="btn-primary">+ Nuevo transportista</button>
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Razón social</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th className="c">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin resultados</td></tr>
              )}
              {filtrados.map(t => {
                const filaProps = useFilaNavegable(() => navigate(`/remitos/transportistas/${t.id}/editar`), `Editar ${t.razon_social}`);
                return (
                <tr key={t.id} {...filaProps}>
                  <td><div className="p-name">{resaltarCoincidencia(t.razon_social, busqueda)}</div></td>
                  <td>{t.telefono ?? '—'}</td>
                  <td>{t.email ?? '—'}</td>
                  <td className="c">
                    <span className={`badge ${t.activo ? 'ok' : 'off'}`}>
                      <span className="bd" />{t.activo ? 'Activo' : 'Inactivo'}
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
