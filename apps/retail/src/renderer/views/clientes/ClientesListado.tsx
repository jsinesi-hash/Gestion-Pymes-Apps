import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExportarButton } from '../../components/export/ExportarButton';
import { exportClientes, nombreCompletoCliente } from '@ferreteria/shared';
import { SearchBox, usePersistentListState } from '@core/ui';
import { resaltarCoincidencia } from '../../lib/resaltar';
import { VistosRecientesPanel } from '../../components/VistosRecientesPanel';

type ClienteRow = {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido: string | null;
  condicion_fiscal: string;
  habilita_cuenta_corriente: boolean;
  telefono: string | null;
  email: string | null;
  activo: boolean;
};

type FiltroActivo = 'activos' | 'inactivos' | 'todos';

export function ClientesListado() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [busqueda, setBusqueda] = usePersistentListState('clientes-busqueda', '');
  const [filtroActivo, setFiltroActivo] = usePersistentListState<FiltroActivo>('clientes-filtro-activo', 'activos');
  const [loading, setLoading] = useState(true);

  function cargar(filtro: FiltroActivo) {
    const incluirInactivos = filtro !== 'activos';
    (globalThis as any).ferreteria.cliente.list({ incluirInactivos })
      .then((data: ClienteRow[]) => {
        const filtrados = filtro === 'inactivos' ? data.filter(c => !c.activo) : data;
        setClientes(filtrados);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(filtroActivo); }, [filtroActivo]);

  const filtrados = clientes.filter(c =>
    nombreCompletoCliente(c).toLowerCase().includes(busqueda.toLowerCase()) ||
    c.numero_documento.includes(busqueda),
  );

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <SearchBox
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre o documento..."
        />
        <select
          className="input"
          value={filtroActivo}
          onChange={e => setFiltroActivo(e.target.value as FiltroActivo)}
          style={{ width: 'auto', fontSize: '0.85rem' }}
        >
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
          <option value="todos">Todos</option>
        </select>
        <div className="ml-auto" />
        <ExportarButton definicion={exportClientes} />
        <button className="btn-primary" onClick={() => navigate('/clientes/nuevo')}>
          + Nuevo cliente
        </button>
      </div>

      <VistosRecientesPanel />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre y apellido</th>
              <th>Tipo</th>
              <th>Número</th>
              <th>Condición fiscal</th>
              <th>Teléfono</th>
              <th className="c">Cta. Cte.</th>
              <th className="c">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin clientes</td></tr>
            )}
            {filtrados.map(c => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                <td>{resaltarCoincidencia(nombreCompletoCliente(c), busqueda)}</td>
                <td>{c.tipo_documento}</td>
                <td className="num">{c.numero_documento}</td>
                <td>{c.condicion_fiscal}</td>
                <td>{c.telefono ?? '—'}</td>
                <td className="c">{c.habilita_cuenta_corriente ? '✔' : ''}</td>
                <td className="c">
                  <span className={`badge ${c.activo ? 'ok' : 'off'}`}>
                    <span className="bd" />{c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
