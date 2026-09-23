import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAppProfile } from '../AppProfile';
import { bridge } from '../bridge';

/**
 * ADR-080 (PERF-1). Reemplaza el <Navigate to="/productos"> fijo de la ruta índice.
 * Espera a resolver el flag (evita el flash de navegar a /productos antes de saberlo).
 * Flag off → /productos. Flag on → pantalla configurada (si hay permiso), si no el default
 * por rol (Supervisor→/dashboard, Operador→/pos), con fallback a /productos.
 */
export function InicioRedirect() {
  const { session, can } = useAuth();
  const { navegacion } = useAppProfile();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      let habilitado = false;
      try {
        const v = await bridge()?.parametros?.get?.({ clave: 'inicio_personalizable_habilitado' });
        habilitado = v === 'true';
      } catch { habilitado = false; }
      if (!vigente) return;
      if (!habilitado || !session) { setDestino(navegacion.inicioFallback); return; }
      setDestino(navegacion.resolverPantallaInicio(session.rolNombre, session.preferencias.pantalla_inicio, can));
    })();
    return () => { vigente = false; };
  }, [session, can, navegacion]);

  if (destino === null) return null; // esperando la resolución del flag
  return <Navigate to={destino} replace />;
}
