import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@core/ui';
import { AppShell } from './AppShell';
import { buildNavRetail } from '../../shell/navRetail';
import { CRUMBS_RETAIL, LEAF_KEYWORDS_RETAIL } from '../../shell/crumbsRetail';
import {
  COMANDOS_ACCION, COMANDOS_NAV,
  buscadorProductos, buscadorClientes, buscadorProveedores,
} from '../../shell/comandosRetail';
import { useRemitosHabilitado } from '../../hooks/useRemitos';
import { usePresupuestosHabilitado } from '../../hooks/usePresupuestos';
import { useAgendaHabilitado } from '../../hooks/useAgenda';
import { useMotorPreciosV2Habilitado } from '../../hooks/useMotorPrecios';
import { useHubPreciosHabilitado } from '../../hooks/useHubPrecios';
import { CampanaAgenda } from '../agenda/CampanaAgenda';
import { useMenuAcciones } from '../../hooks/useMenuAcciones';
import { ActualizacionPropuestaModal } from './ActualizacionPropuestaModal';
import { NovedadesVersionModal } from './NovedadesVersionModal';

// Identidad estable (no recrear el arreglo en cada render → no re-dispara el sweep de la
// paleta). El buscadorClientes es genérico (bridge().cliente.list()) y en B5 pasa al core.
const BUSCADORES_RETAIL = [buscadorProductos, buscadorClientes, buscadorProveedores];

/**
 * Overlays propios de Retail (ADR: actualización descargada y novedades post-update) más la
 * suscripción al menú nativo (useMenuAcciones). Salieron de AppShell (que ahora es genérico);
 * el modal de depuración de backups —del core— se quedó en AppShell y se pinta por encima de
 * éstos. `hayModalCore` avisa cuándo hay un modal del core tapando: en ese caso estos overlays
 * no se muestran (no se apilan), preservando el comportamiento previo (novedades solo si no
 * hay depuración ni propuesta).
 */
function RetailShellOverlays({ hayModalCore }: Readonly<{ hayModalCore: boolean }>) {
  const { session } = useAuth();
  useMenuAcciones();
  const [propuestaVersion, setPropuestaVersion] = useState<string | null>(null);
  const [novedades, setNovedades] = useState<{ titulo: string; notas: string[] } | null>(null);
  // Flag por-instancia (no de módulo): el shell se desmonta al hacer logout y se remonta al
  // login (ver ProtectedRoute), así que un ref resetea la propuesta en cada login de
  // Supervisor sin perder el "posponer" durante la misma sesión (el shell permanece montado
  // entre navegaciones de rutas hijas).
  const actualizacionPospuestaRef = useRef(false);

  // Propuesta de actualización: solo Supervisor, una vez por sesión.
  useEffect(() => {
    if (actualizacionPospuestaRef.current) return;
    if (session?.rolNombre !== 'SUPERVISOR') return;
    let vivo = true;
    (async () => {
      try {
        const est = await (globalThis as any).ferreteria.actualizacion.estado();
        if (vivo && est?.estado === 'downloaded' && est.version) setPropuestaVersion(est.version);
      } catch { /* sin updater o backend no disponible: silencioso */ }
    })();
    return () => { vivo = false; };
  }, [session?.rolNombre]);

  // Novedades post-actualización: cualquier rol, una vez por versión.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await (globalThis as any).ferreteria.actualizacion.notasPostUpdate();
        if (vivo && r) setNovedades({ titulo: r.titulo, notas: r.notas });
      } catch { /* silencioso */ }
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <>
      {!hayModalCore && propuestaVersion && (
        <ActualizacionPropuestaModal
          version={propuestaVersion}
          onInstalar={() => { (globalThis as any).ferreteria.actualizacion.instalarYReiniciar(); }}
          onPosponer={() => { actualizacionPospuestaRef.current = true; setPropuestaVersion(null); }}
        />
      )}

      {!hayModalCore && !propuestaVersion && novedades && (
        <NovedadesVersionModal
          titulo={novedades.titulo}
          notas={novedades.notas}
          onContinuar={async () => {
            try { await (globalThis as any).ferreteria.actualizacion.marcarVersionVista(); } catch { /* noop */ }
            setNovedades(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Shell de Retail: compone el AppShell genérico con el NAV, breadcrumb, comandos y buscadores
 * de la ferretería, más la campana de agenda y los overlays propios. Los feature flags se
 * leen acá y se traducen en el NAV que recibe el shell.
 */
export function RetailShell() {
  const remitos = useRemitosHabilitado();
  const presupuestos = usePresupuestosHabilitado();
  const agenda = useAgendaHabilitado();
  const motorV2 = useMotorPreciosV2Habilitado();
  const hub = useHubPreciosHabilitado();
  const nav = useMemo(
    () => buildNavRetail({ remitos, presupuestos, agenda, motorV2, hub }),
    [remitos, presupuestos, agenda, motorV2, hub],
  );
  return (
    <AppShell
      nombreApp="Ferretería"
      nav={nav}
      crumbs={CRUMBS_RETAIL}
      leafKeywords={LEAF_KEYWORDS_RETAIL}
      comandos={{ accion: COMANDOS_ACCION, nav: COMANDOS_NAV }}
      buscadores={BUSCADORES_RETAIL}
      headerExtras={<CampanaAgenda />}
      overlays={(ctx) => <RetailShellOverlays hayModalCore={ctx.hayModalCore} />}
    />
  );
}
