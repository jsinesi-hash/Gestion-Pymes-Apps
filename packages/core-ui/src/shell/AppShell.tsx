import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { buildBreadcrumb, type Seccion } from './breadcrumb';
import type { Comando } from './comandos';
import type { ResumenDepuracion } from '@ferreteria/shared';
import { useAuth } from '../auth/AuthContext';
import { useAppProfile } from '../AppProfile';
import { useInicioPersonalizableHabilitado } from '../hooks/useInicioPersonalizable';
import { usePreferencias } from '../hooks/usePreferencias';
import { AppearanceDrawer } from './AppearanceDrawer';
import { CommandPalette, type Buscador } from './CommandPalette';
import { DepuracionBackupsModal, depuracionPospuestaVigente } from './DepuracionBackupsModal';
import { PantallaBloqueo } from './PantallaBloqueo';
import { useIdleLock } from '../hooks/useIdleLock';
import { useBloqueoInactividad } from '../hooks/useBloqueoInactividad';
import { bridge } from '../bridge';

// ADR-076 Tarea 11: "Ahora no" pospone la consulta de depuración por el resto de la
// sesión (hasta reiniciar la app) — flag a nivel de módulo, no de componente, para que
// sobreviva a remounts de AppShell dentro de la misma sesión.
let depuracionPospuestaEnSesion = false;

const SVG_CHEVRON_DOWN = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>);
const SVG_CHEVRON_RIGHT = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>);
// ADR-080 (PERF-1): estrella de favorito. `fill` se controla por CSS (.nav-fav-star.on).
const SVG_STAR = (<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg>);

// `end`: marca coincidencia exacta de ruta. Solo hace falta cuando el `to` de un item
// es prefijo del de un hermano (ej. /remitos vs /remitos/transportistas); sin esto se
// encienden los dos. No ponerlo por defecto: los items con rutas de detalle propias
// (/clientes/:id, /compras/ordenes/:id) deben seguir resaltados dentro de ellas.
export type NavItem = { label: string; to?: string; icon: JSX.Element; permiso?: string; disabled?: boolean; end?: true };
export type NavGroup = {
  key: string; label: string; icon: JSX.Element;
  items: NavItem[]; permiso?: string; standalone?: true;
};

// Task B4: contexto que AppShell pasa a los overlays de la app (forma-función de la prop
// `overlays`). `hayModalCore` avisa si hay un modal propio del core (hoy: la depuración de
// backups) tapando la pantalla, para que los overlays de la app no se apilen encima.
export type OverlaysCtx = { hayModalCore: boolean };
export type AppShellProps = {
  nombreApp: string;
  nav: NavGroup[];                    // ya filtrado por flags de la app; el shell filtra por permiso
  crumbs: readonly Seccion[];
  leafKeywords?: Record<string, string>;
  comandos: { accion: Comando[]; nav: Comando[] };
  buscadores: Buscador[];
  headerExtras?: ReactNode;           // p. ej. CampanaAgenda (Retail)
  overlays?: ReactNode | ((ctx: OverlaysCtx) => ReactNode); // modales propios de la app
  onMount?: () => void;               // hooks propios de la app
};

// ADR-080 (PERF-1): busca el NavItem real (label/icon) de un path favorito para pintarlo en
// el grupo "Favoritos". `end: true` evita que un favorito encienda por prefijo dentro del grupo.
function encontrarNavItem(groups: NavGroup[], path: string): NavItem | undefined {
  for (const g of groups) {
    const it = g.items.find(i => i.to === path);
    if (it) return { ...it, end: true };
  }
  return undefined;
}

export function AppShell(props: Readonly<AppShellProps>) {
  const { session, logout, can } = useAuth();
  const { navegacion } = useAppProfile();
  const inicioPersonalizable = useInicioPersonalizableHabilitado();
  const { toggleFavorito } = usePreferencias();
  const minutosBloqueo = useBloqueoInactividad();
  const { locked, unlock } = useIdleLock(minutosBloqueo);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Hooks propios de la app (p. ej. suscripción al menú nativo). Se ejecuta una vez al montar.
  const { onMount } = props;
  useEffect(() => { onMount?.(); }, [onMount]);

  // ADR-076 Tarea 11: consulta diferida de depuración de backups al arranque, solo para
  // Supervisor (permiso backup.crear). Backup es del core → se queda en AppShell. El banner
  // permanente en Config (Tarea 10) es el punto de entrada siempre disponible; esto es el
  // aviso "una vez por sesión".
  const [depResumen, setDepResumen] = useState<ResumenDepuracion | null>(null);

  useEffect(() => {
    if (depuracionPospuestaEnSesion) return;
    // Postergación persistente por terminal (botones "Postergar 5/15/30 días" del modal).
    if (depuracionPospuestaVigente()) return;
    if (!can('backup.crear')) return;
    let vivo = true;
    (async () => {
      try {
        const r: ResumenDepuracion = await bridge().backup.evaluarDepuracion();
        if (vivo && r.candidatos.length > 0) setDepResumen(r);
      } catch {
        // silencioso: sin candidatos, sin permiso, o backend no disponible todavía.
      }
    })();
    return () => { vivo = false; };
  }, [can]);

  const navGroups = props.nav;

  // ADR-080 (PERF-1): grupo "Favoritos" al tope, solo con el flag on y ≥1 favorito válido.
  // Cada favorito toma label/icon de su NavItem real (no se duplican textos). Los favoritos
  // sin permiso para el rol quedan fuera vía el filtro `visibleItems` del render.
  const favoritos: string[] = session?.preferencias?.favoritos ?? [];
  const favItems: NavItem[] = inicioPersonalizable
    ? favoritos
        .filter(p => navegacion.esRutaNavegable(p))
        .map(p => encontrarNavItem(navGroups, p))
        .filter((i): i is NavItem => Boolean(i))
    : [];
  const gruposConFavoritos: NavGroup[] = favItems.length > 0
    ? [{ key: 'favoritos', label: 'Favoritos', icon: SVG_STAR, items: favItems }, ...navGroups]
    : navGroups;

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set([...props.nav.map(g => g.key), 'favoritos'])
  );

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // NAV-1 (ADR-077): breadcrumb jerárquico y clicable, derivado de la ruta.
  const migas = buildBreadcrumb(location.pathname, props.crumbs, props.leafKeywords);
  const visibleGroups = gruposConFavoritos.filter(g => !g.permiso || can(g.permiso));

  // `item.end` corta el match por prefijo (ver comentario del type NavItem): sin esto,
  // un ítem cuyo `to` es prefijo del `to` de un ítem de OTRO grupo (ej. "Remitos"
  // /remitos vs "Transportistas" /remitos/transportistas, ahora en Configuración)
  // encendería el header de ambos grupos a la vez.
  function isGroupActive(group: NavGroup) {
    return group.items.some(item => {
      if (!item.to) return false;
      if (location.pathname === item.to) return true;
      return !item.end && location.pathname.startsWith(item.to + '/');
    });
  }

  // ADR-080 (PERF-1): estrella de favorito junto a un ítem navegable (no dentro del propio
  // grupo Favoritos). Devuelve null cuando el flag está apagado → sidebar idéntico a hoy.
  function renderStar(item: NavItem, groupKey: string) {
    if (!inicioPersonalizable || groupKey === 'favoritos' || !item.to || !navegacion.esRutaNavegable(item.to)) return null;
    const to = item.to;
    const on = favoritos.includes(to);
    return (
      <button
        type="button"
        className={`nav-fav-star${on ? ' on' : ''}`}
        aria-label={on ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorito(to); }}
      >
        {SVG_STAR}
      </button>
    );
  }

  const overlaysNode = typeof props.overlays === 'function'
    ? props.overlays({ hayModalCore: Boolean(depResumen) })
    : props.overlays;

  return (
    <div className="app-shell">
      <nav className={`side${collapsed ? ' collapsed' : ''}`} aria-label="Menú principal">
        <div className="side-top">
          <div className="logo" />
          <span className="side-name">{props.nombreApp}</span>
        </div>

        <div className="nav-body">
          {visibleGroups.map(group => {
            const visibleItems = group.items.filter(i => !i.permiso || can(i.permiso));
            if (visibleItems.length === 0) return null;

            // ADR-080: el grupo "Favoritos" nunca colapsa a link directo — siempre header +
            // hijos, aunque tenga un solo favorito.
            if ((group.standalone || visibleItems.length === 1) && group.key !== 'favoritos') {
              const item = visibleItems[0];
              // Sin destino no hay NavLink posible (los ítems deshabilitados van por la otra rama).
              if (!item?.to) return null;
              const star = renderStar(item, group.key);
              if (!star) {
                return (
                  <NavLink key={group.key} to={item.to} end={item.end ?? false}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-txt">{item.label}</span>
                  </NavLink>
                );
              }
              return (
                <div key={group.key} className="nav-fav-row">
                  <NavLink to={item.to} end={item.end ?? false}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-txt">{item.label}</span>
                  </NavLink>
                  {star}
                </div>
              );
            }

            if (collapsed) {
              return visibleItems.map(item => (
                item.disabled || !item.to
                  ? (
                    <span key={item.label} className="nav-item"
                      title="Próximamente" style={{ opacity: 0.45, cursor: 'default' }}>
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-txt">{item.label}</span>
                    </span>
                  )
                  : (
                    <NavLink key={item.to} to={item.to} end={item.end ?? false}
                      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-txt">{item.label}</span>
                    </NavLink>
                  )
              ));
            }

            const isOpen = openGroups.has(group.key);
            const active = isGroupActive(group);

            return (
              <div key={group.key}>
                <button
                  type="button"
                  className={`nav-group-header${active ? ' active' : ''}${isOpen ? ' open' : ''}`}
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className="nav-icon">{group.icon}</span>
                  <span className="nav-txt">{group.label}</span>
                  <span className="nav-chevron">{isOpen ? SVG_CHEVRON_DOWN : SVG_CHEVRON_RIGHT}</span>
                </button>
                {isOpen && (
                  <div className="nav-group-children">
                    {visibleItems.map(item => (
                      item.disabled || !item.to
                        ? (
                          <span
                            key={item.label}
                            className="nav-item nav-item-child"
                            title="Próximamente"
                            style={{ opacity: 0.45, cursor: 'default', userSelect: 'none' }}
                          >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-txt">{item.label}</span>
                          </span>
                        )
                        : (inicioPersonalizable && group.key !== 'favoritos' && item.to && navegacion.esRutaNavegable(item.to))
                        ? (
                          <div key={item.to} className="nav-fav-row">
                            <NavLink to={item.to} end={item.end ?? false}
                              className={({ isActive }) => `nav-item nav-item-child${isActive ? ' active' : ''}`}>
                              <span className="nav-icon">{item.icon}</span>
                              <span className="nav-txt">{item.label}</span>
                            </NavLink>
                            {renderStar(item, group.key)}
                          </div>
                        )
                        : (
                          <NavLink key={item.to} to={item.to} end={item.end ?? false}
                            className={({ isActive }) => `nav-item nav-item-child${isActive ? ' active' : ''}`}>
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-txt">{item.label}</span>
                          </NavLink>
                        )
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="side-collapse" onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expandir' : 'Contraer'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            {collapsed
              ? <><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></>
              : <><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></>
            }
          </svg>
        </button>
      </nav>

      <div className="shell">
        <header className="app-header">
          <nav className="crumb" aria-label="Ruta de navegación">
            {migas.map((m, i) => {
              const last = i === migas.length - 1;
              return (
                <span key={`${m.label}-${i}`} className="crumb-item">
                  {m.to && !last
                    ? <Link to={m.to} className="crumb-link">{m.label}</Link>
                    : <span className={last ? 'crumb-current' : 'crumb-group'}
                        aria-current={last ? 'page' : undefined}>{m.label}</span>}
                  {!last && <span className="crumb-sep" aria-hidden="true">›</span>}
                </span>
              );
            })}
          </nav>
          <div className="ml-auto" />
          <div className="sess">
            <span className="chip"><span className="dot" />Caja activa</span>
            {session && (
              <span className="chip">{session.nombreCompleto} · {session.rolNombre}</span>
            )}
            {props.headerExtras}
            <button className="icon-btn" onClick={() => setDrawerOpen(true)} title="Apariencia">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            </button>
            <button className="btn-secondary" style={{ padding: '7px 12px', fontSize: '13px' }} onClick={logout}>
              Salir
            </button>
          </div>
        </header>
        {/* Revisión 2026-10-20 (P1): una excepción de render en la pantalla se contiene acá (el
            menú y los providers por encima, como el carrito del POS, siguen en pie) y el aviso se
            descarta al navegar a otra ruta. */}
        <main className="main-content">
          <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
        </main>
      </div>

      {drawerOpen && <AppearanceDrawer onClose={() => setDrawerOpen(false)} />}

      <CommandPalette disabled={locked} comandos={props.comandos} buscadores={props.buscadores} />

      {locked && <PantallaBloqueo onUnlock={unlock} />}

      {/* Overlays propios de la app (Retail: actualización/novedades). Se pintan ANTES que
          el modal de depuración del core para que éste quede arriba en z-order; los overlays
          de la app se auto-gatean con `hayModalCore` para no apilarse. */}
      {overlaysNode}

      {depResumen && (
        <DepuracionBackupsModal
          resumen={depResumen}
          onClose={() => { depuracionPospuestaEnSesion = true; setDepResumen(null); }}
          onDone={() => { setDepResumen(null); }}
        />
      )}
    </div>
  );
}
