import { bridge } from '../../bridge';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEscapeAction } from '../../hooks/useEscapeAction';
import { nombreCompletoCliente } from '@ferreteria/shared';
import { CtaCteResumenCard } from '../credito/CtaCteResumenCard';
import { useAuth } from '../../auth/AuthContext';
import { useRegistrarVisto } from '../../hooks/useVistosRecientes';

type Cliente = {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido: string | null;
  nombre_fantasia: string | null;
  condicion_fiscal: string;
  telefono: string | null;
  telefono_adicional: string | null;
  email: string | null;
  domicilio: string | null;
  calle: string | null;
  numero: string | null;
  aclaracion: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  habilita_cuenta_corriente: boolean;
  activo: boolean;
  lista_precio_id: string | null;
};

type Props = {
  cargarListasPrecio?: () => Promise<{ id: string; nombre: string }[]>;
};

export function ClienteDetalle({ cargarListasPrecio }: Readonly<Props>) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Escape hace lo mismo que el botón «Volver» de más abajo.
  useEscapeAction(() => navigate('/clientes'), { layer: 'page' });
  const { can } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [bajaError, setBajaError] = useState<string | null>(null);

  async function cargar() {
    if (!id) return;
    const data = await bridge().cliente.get(id);
    setCliente(data);
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
  }, [id]);

  // ADR-083 (Task 7): resolver el nombre de la lista de precios asignada — `cliente.get`
  // sólo trae `lista_precio_id`, no el nombre.
  const [listas, setListas] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => {
    if (!cargarListasPrecio) return;
    cargarListasPrecio()
      .then((rows) => setListas(rows))
      .catch(() => {});
  }, [cargarListasPrecio]);

  // PERF-2: registrar el cliente como "visto recientemente" (no-op si el flag está off).
  const registrarVisto = useRegistrarVisto();
  useEffect(() => {
    if (cliente) registrarVisto({ tipo: 'cliente', id: cliente.id, etiqueta: nombreCompletoCliente(cliente) });
  }, [cliente?.id, registrarVisto]);

  async function handleDesactivar() {
    setBajaError(null);
    try {
      await bridge().cliente.desactivar({ id });
      await cargar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg.startsWith('TIENE_SALDO_CC:')) {
        const centavos = parseInt(msg.split(':')[1], 10);
        const pesos = (centavos / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
        setBajaError(`No se puede dar de baja: tiene saldo pendiente de ${pesos}`);
      } else {
        setBajaError(msg);
      }
    }
  }

  async function handleReactivar() {
    setBajaError(null);
    try {
      await bridge().cliente.reactivar({ id });
      await cargar();
    } catch (e) {
      setBajaError(e instanceof Error ? e.message : 'Error');
    }
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  if (!cliente) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Cliente no encontrado.</div>;

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate('/clientes')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>
          {nombreCompletoCliente(cliente)}
          {!cliente.activo && (
            <span className="badge badge-off" style={{ marginLeft: 10, fontSize: 12 }}>INACTIVO</span>
          )}
        </h1>
        <div className="detail-actions">
          <button className="btn-secondary" onClick={() => navigate(`/clientes/${id}/editar`)}>
            Editar
          </button>
          {can('cliente.baja') && (
            cliente.activo
              ? <button className="btn-secondary" onClick={handleDesactivar}>Dar de baja</button>
              : <button className="btn-secondary" onClick={handleReactivar}>Reactivar</button>
          )}
        </div>
      </div>

      {bajaError && (
        <div className="alert-danger" role="alert">{bajaError}</div>
      )}

      <div className="cards-grid">
        <div className="card">
          <div className="card-title">Datos del cliente</div>
          <div className="kv"><span className="k">Documento</span><span className="v">{cliente.tipo_documento} {cliente.numero_documento}</span></div>
          {cliente.nombre_fantasia && <div className="kv"><span className="k">Nombre fantasía</span><span className="v">{cliente.nombre_fantasia}</span></div>}
          <div className="kv"><span className="k">Condición fiscal</span><span className="v">{cliente.condicion_fiscal}</span></div>
          {cargarListasPrecio && (
            <div className="kv"><span className="k">Lista de precios</span><span className="v">
              {cliente.lista_precio_id ? (listas.find((l) => l.id === cliente.lista_precio_id)?.nombre ?? cliente.lista_precio_id) : 'Predeterminada'}
            </span></div>
          )}
          {cliente.telefono && <div className="kv"><span className="k">Teléfono</span><span className="v">{cliente.telefono}</span></div>}
          {cliente.telefono_adicional && <div className="kv"><span className="k">Teléfono adicional</span><span className="v">{cliente.telefono_adicional}</span></div>}
          {cliente.email && <div className="kv"><span className="k">Email</span><span className="v">{cliente.email}</span></div>}
          {cliente.habilita_cuenta_corriente && <div className="kv"><span className="k">Cuenta corriente</span><span className="v">Habilitada</span></div>}
        </div>

        {(() => {
          const calleLinea = [cliente.calle, cliente.numero, cliente.aclaracion].filter(Boolean).join(' ');
          const domicilioLinea = calleLinea || cliente.domicilio;
          const tieneDomicilio = domicilioLinea || cliente.localidad || cliente.provincia || cliente.codigo_postal;
          if (!tieneDomicilio) return null;
          return (
            <div className="card">
              <div className="card-title">Domicilio</div>
              {domicilioLinea && <div className="kv"><span className="k">Dirección</span><span className="v">{domicilioLinea}</span></div>}
              {cliente.localidad && <div className="kv"><span className="k">Localidad</span><span className="v">{cliente.localidad}</span></div>}
              {cliente.provincia && <div className="kv"><span className="k">Provincia</span><span className="v">{cliente.provincia}</span></div>}
              {cliente.codigo_postal && <div className="kv"><span className="k">CP</span><span className="v num">{cliente.codigo_postal}</span></div>}
            </div>
          );
        })()}
      </div>

      {cliente.habilita_cuenta_corriente && <CtaCteResumenCard clienteId={cliente.id} />}
    </div>
  );
}
