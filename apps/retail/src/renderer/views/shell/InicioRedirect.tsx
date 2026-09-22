import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { navegacionRetail } from '../../../common/navegacion';
import { useAuth } from '../../context/AuthContext';

/**
 * ADR-080 (PERF-1). Reemplaza el <Navigate to="/productos"> fijo de la ruta índice.
 * Espera a resolver el flag (evita el flash de navegar a /productos antes de saberlo).
 * Flag off → /productos. Flag on → pantalla configurada (si hay permiso), si no el default
 * por rol (Supervisor→/dashboard, Operador→/pos), con fallback a /productos.
 */
export function InicioRedirect() {
  const { session, can } = useAuth();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      let habilitado = false;
      try {
        const v = await (globalThis as any).ferreteria?.parametros?.get?.({ clave: 'inicio_personalizable_habilitado' });
        habilitado = v === 'true';
      } catch { habilitado = false; }
      if (!vigente) return;
      if (!habilitado || !session) { setDestino(navegacionRetail.inicioFallback); return; }
      setDestino(navegacionRetail.resolverPantallaInicio(session.rolNombre, session.preferencias.pantalla_inicio, can));
    })();
    return () => { vigente = false; };
  }, [session, can]);

  if (destino === null) return null; // esperando la resolución del flag
  return <Navigate to={destino} replace />;
}
