import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, bridge } from '@core/ui';
import type { MenuAccion } from '../../main/menu/appMenuTemplate';

// Mapa acción → ruta. Las acciones que no navegan (cerrar-sesion) se manejan aparte.
const RUTA_POR_ACCION: Partial<Record<MenuAccion, string>> = {
  'nueva-venta': '/pos',
  'importar-datos': '/importar',
  'backup': '/config/backup-restore',
  'abrir-caja': '/caja',
  'cerrar-caja': '/caja/cerrar',
  'movimiento-caja': '/caja',
  'buscar-producto': '/productos',
  'entrada-stock': '/stock',
  'recepcion-compra': '/compras/ordenes',
  'cobro-ctacte': '/credito',
  'ventas-espera': '/pos',
};

/**
 * Suscribe la app a las acciones del menú nativo (canal 'menu:accion' vía preload) y
 * las rutea con el router en memoria. Debe montarse dentro del árbol del router
 * (se invoca desde AppShell).
 */
export function useMenuAcciones(): void {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const api = bridge()?.menu;
    if (!api?.onAccion) return;

    const unsub = api.onAccion((payload: { action: string }) => {
      if (payload.action === 'cerrar-sesion') {
        void logout();
        return;
      }
      const ruta = RUTA_POR_ACCION[payload.action as MenuAccion];
      if (ruta) navigate(ruta);
    });

    return typeof unsub === 'function' ? unsub : undefined;
  }, [navigate, logout]);
}
