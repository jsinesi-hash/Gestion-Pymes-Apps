import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEscapeAction } from '../../../hooks/useEscapeAction';
import { ProveedorProductosTab } from './ProveedorProductosTab';

type Proveedor = {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  razon_social: string;
  nombre_fantasia: string | null;
  condicion_fiscal: string;
  codigo: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  email: string | null;
  persona_contacto: string | null;
  observaciones: string | null;
  activo: boolean;
};

type Tab = 'datos' | 'productos';

const TAB_LABELS: Record<Tab, string> = {
  datos:     'Datos',
  productos: 'Productos',
};

export function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Escape hace lo mismo que el botón «Volver» de más abajo.
  useEscapeAction(() => navigate(-1), { layer: 'page' });
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('datos');

  useEffect(() => {
    if (!id) return;
    (globalThis as any).ferreteria.compras.proveedor.get(id)
      .then((data: Proveedor | null) => setProveedor(data))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDeactivate() {
    if (!id || !proveedor) return;
    if (!window.confirm(`¿Dar de baja a "${proveedor.razon_social}"? Esta acción es reversible editando el proveedor.`)) return;
    setConfirmando(true);
    try {
      await (globalThis as any).ferreteria.compras.proveedor.deactivate(id);
      setProveedor(p => p ? { ...p, activo: false } : p);
    } finally {
      setConfirmando(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  if (!proveedor) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Proveedor no encontrado.</div>;

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver
        </button>
        <h1>{proveedor.razon_social}</h1>
        <div className="detail-actions">
          <Link to={`/compras/proveedores/${id}/editar`}>
            <button className="btn-secondary">Editar</button>
          </Link>
          {proveedor.activo && (
            <button className="btn-danger" onClick={handleDeactivate} disabled={confirmando}>
              Dar de baja
            </button>
          )}
        </div>
      </div>

      {proveedor.nombre_fantasia && (
        <p className="text-muted">{proveedor.nombre_fantasia}</p>
      )}

      <div style={{
        display: 'flex',
        gap: '2px',
        borderBottom: '2px solid var(--border)',
      }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--accent)' : 'inherit',
              opacity: activeTab === tab ? 1 : 0.7,
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'datos' && (
        <div className="cards-grid">
          <div className="card">
            <div className="card-title">Identificación fiscal</div>
            <div className="kv"><span className="k">Código</span><span className="v num">{proveedor.codigo ?? '—'}</span></div>
            <div className="kv"><span className="k">Tipo documento</span><span className="v">{proveedor.tipo_documento}</span></div>
            <div className="kv"><span className="k">Número</span><span className="v num">{proveedor.numero_documento}</span></div>
            <div className="kv"><span className="k">Condición fiscal</span><span className="v">{proveedor.condicion_fiscal}</span></div>
            <div className="kv"><span className="k">Estado</span>
              <span className={`v badge ${proveedor.activo ? 'ok' : 'off'}`}>
                <span className="bd" />{proveedor.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Contacto</div>
            <div className="kv"><span className="k">Teléfono</span><span className="v">{proveedor.telefono ?? '—'}</span></div>
            <div className="kv"><span className="k">Email</span><span className="v">{proveedor.email ?? '—'}</span></div>
            <div className="kv"><span className="k">Persona de contacto</span><span className="v">{proveedor.persona_contacto ?? '—'}</span></div>
          </div>

          <div className="card">
            <div className="card-title">Domicilio</div>
            <div className="kv"><span className="k">Dirección</span><span className="v">{proveedor.domicilio ?? '—'}</span></div>
            <div className="kv"><span className="k">Localidad</span><span className="v">{proveedor.localidad ?? '—'}</span></div>
            <div className="kv"><span className="k">Provincia</span><span className="v">{proveedor.provincia ?? '—'}</span></div>
            <div className="kv"><span className="k">CP</span><span className="v num">{proveedor.codigo_postal ?? '—'}</span></div>
          </div>

          {proveedor.observaciones && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-title">Observaciones</div>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{proveedor.observaciones}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'productos' && id && (
        <ProveedorProductosTab proveedorId={id} />
      )}
    </div>
  );
}
