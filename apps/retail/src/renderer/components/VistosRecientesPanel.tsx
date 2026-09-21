import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVistosRecientes, useVistosRecientesHabilitado, type VistoReciente } from '../hooks/useVistosRecientes';
import { VistosRecientemente } from './VistosRecientemente';

// Contenedor listo para montar (ADR-081 / PERF-2): junta sesión, flag y navegación. No
// renderiza nada con el flag apagado ni sin ítems. Se monta donde el usuario aterriza según
// su rol (Dashboard del Supervisor; encabezado de Productos/Clientes del Operador).
export function VistosRecientesPanel({ titulo }: { titulo?: string }) {
  const { session, can } = useAuth();
  const habilitado = useVistosRecientesHabilitado();
  const vistos = useVistosRecientes(habilitado ? session?.id : null);
  const navigate = useNavigate();

  if (!habilitado) return null;

  const abrir = (v: VistoReciente) =>
    navigate(v.tipo === 'producto' ? `/productos/${v.id}` : `/clientes/${v.id}`);

  return <VistosRecientemente vistos={vistos} can={can} onAbrir={abrir} titulo={titulo} />;
}
