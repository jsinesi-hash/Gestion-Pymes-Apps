import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { buildBreadcrumb } from '../../lib/breadcrumb';
import type { ResumenDepuracion } from '@ferreteria/shared';
import { navegacionRetail } from '../../../common/navegacion';
import { useAuth } from '../../context/AuthContext';
import { useInicioPersonalizableHabilitado } from '../../hooks/useInicioPersonalizable';
import { usePreferencias } from '../../hooks/usePreferencias';
import { AppearanceDrawer } from './AppearanceDrawer';
import { CommandPalette } from './CommandPalette';
import { useRemitosHabilitado } from '../../hooks/useRemitos';
import { usePresupuestosHabilitado } from '../../hooks/usePresupuestos';
import { useAgendaHabilitado } from '../../hooks/useAgenda';
import { useMotorPreciosV2Habilitado } from '../../hooks/useMotorPrecios';
import { useHubPreciosHabilitado } from '../../hooks/useHubPrecios';
import { CampanaAgenda } from '../agenda/CampanaAgenda';
import { useMenuAcciones } from '../../hooks/useMenuAcciones';
import { DepuracionBackupsModal, depuracionPospuestaVigente } from '../config/DepuracionBackupsModal';
import { ActualizacionPropuestaModal } from './ActualizacionPropuestaModal';
import { NovedadesVersionModal } from './NovedadesVersionModal';
import { PantallaBloqueo } from './PantallaBloqueo';
import { useIdleLock, useBloqueoInactividad } from '@core/ui';

// ADR-076 Tarea 11: "Ahora no" pospone la consulta de depuración por el resto de la
// sesión (hasta reiniciar la app) — flag a nivel de módulo, no de componente, para que
// sobreviva a remounts de AppShell dentro de la misma sesión.
let depuracionPospuestaEnSesion = false;

const SVG_POS = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h2l2 13h11l2-9H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>);
const SVG_CAJA = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>);
const SVG_PRODUCTOS = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>);
const SVG_STOCK = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>);
const SVG_REABASTECIMIENTO =(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>);
const SVG_DASHBOARD = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>);
const SVG_IMPORTAR = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>);
const SVG_ORDENES = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>);
const SVG_PROVEEDORES = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>);
const SVG_CLIENTES = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>);
const SVG_CREDITO = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>);
const SVG_ETIQUETAS = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>);
const SVG_CONFIG = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>);

const SVG_MI_CUENTA = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const SVG_USUARIOS = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>);
const SVG_SISTEMA = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>);
const SVG_BACKUP = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>);

const SVG_AGENDA = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);

const SVG_CHEVRON_DOWN = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>);
const SVG_CHEVRON_RIGHT = (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>);
// ADR-080 (PERF-1): estrella de favorito. `fill` se controla por CSS (.nav-fav-star.on).
const SVG_STAR = (<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg>);

// `end`: marca coincidencia exacta de ruta. Solo hace falta cuando el `to` de un item
// es prefijo del de un hermano (ej. /remitos vs /remitos/transportistas); sin esto se
// encienden los dos. No ponerlo por defecto: los items con rutas de detalle propias
// (/clientes/:id, /compras/ordenes/:id) deben seguir resaltados dentro de ellas.
type NavItem = { label: string; to?: string; icon: JSX.Element; permiso?: string; disabled?: boolean; end?: true };
type NavGroup = {
  key: string; label: string; icon: JSX.Element;
  items: NavItem[]; permiso?: string; standalone?: true;
};

// Orden del sidebar — combina dos decisiones de PO tomadas en ramas paralelas sin verse
// (Fase 3 de "ajustes varios" y ADR-051 §8 de "mejoras a la carga masiva"): se mantiene
// el agrupamiento de Fase 3 (menos grupos de un solo ítem: Caja vive en Facturación,
// Stock vive en Catálogo, Transportistas vive en Configuración) pero reposicionado cerca
// del principio del sidebar, como pedía ADR-051 §8. Orden final: Punto de venta ·
// Facturación (con Caja) · Catálogo (con Stock) · Abastecimiento · Precios (grupo
// condicional, ver buildNavGroups) · Clientes · Reportes · Agenda · Configuración ·
// Sistema.
export const NAV_GROUPS: NavGroup[] = [
  // ADR-046: "Presupuestos" vive dentro del grupo Punto de venta, detrás del flag
  // presupuestos_habilitado (ver visibleItems). Con el flag apagado el grupo queda con
  // un solo item y se renderiza como link directo.
  { key: 'pos', label: 'Punto de venta', icon: SVG_POS,
    items: [
      // ADR-055: el sub-ítem se muestra como "POS" (pedido de producto).
      { label: 'POS', to: '/pos', icon: SVG_POS, end: true },
      { label: 'Presupuestos', to: '/presupuestos', icon: SVG_ORDENES, permiso: 'presupuesto.crear' },
    ]},
  // ADR-045 + Fase 3 (ajustes-varios): el ítem "Remitos" queda oculto mientras el flag
  // remitos_habilitado esté en false (ver visibleItems) — antes ese flag ocultaba el
  // GRUPO entero, pero ahora "Caja" vive en este mismo grupo (se mudó desde su grupo
  // standalone) y Caja es una pantalla siempre disponible, sin relación con el flag de
  // Remitos: no puede quedar oculta si alguien apaga/nunca prendió Remitos. Transportistas
  // se mudó al grupo Configuración. Reposicionado cerca del principio del sidebar
  // (ADR-051 §8) manteniendo el agrupamiento de Fase 3.
  { key: 'facturacion', label: 'Facturación', icon: SVG_ORDENES, permiso: 'remito.crear',
    items: [
      { label: 'Remitos', to: '/remitos', icon: SVG_ORDENES, permiso: 'remito.crear', end: true },
      { label: 'Caja', to: '/caja', icon: SVG_CAJA },
    ]},
  { key: 'catalogo', label: 'Catálogo', icon: SVG_PRODUCTOS,
    items: [
      { label: 'Productos',   to: '/productos',   icon: SVG_PRODUCTOS },
      // ADR-053: "Ubicaciones" (LocalizacionView) se dio de baja; su capacidad de
      // localización vive ahora en el Listado de Productos (columnas Sector/Estante/
      // Posición + buscador de ubicación).
      // Fase 3 (ajustes-varios): Stock se mudó acá desde su grupo standalone.
      // `end: true` corta el match por prefijo para que rutas hijas como
      // /stock/:id/kardex no enciendan este ítem — mismo patrón que "Remitos" en el
      // grupo Facturación (ver más arriba).
      { label: 'Stock', to: '/stock', icon: SVG_STOCK, end: true },
    ]},
  { key: 'abastecimiento', label: 'Abastecimiento', icon: SVG_ORDENES, permiso: 'compra.recibir',
    items: [
      // ADR-055: Proveedores por encima de Órdenes de compra (pedido de producto).
      { label: 'Proveedores',         to: '/compras/proveedores',    icon: SVG_PROVEEDORES,      permiso: 'proveedor.gestionar' },
      { label: 'Órdenes de compra',   to: '/compras/ordenes',        icon: SVG_ORDENES,          permiso: 'compra.recibir' },
      // ADR-057: "Reposición sugerida" (/stock/reabastecimiento) se dio de baja; su
      // funcionalidad está cubierta por "OC Sugerida" (/compras/ordenes/sugerida).
    ]},
  { key: 'clientes', label: 'Clientes', icon: SVG_CLIENTES, permiso: 'ctacte.cobrar',
    items: [
      { label: 'Clientes',           to: '/clientes', icon: SVG_CLIENTES, permiso: 'ctacte.cobrar' },
      { label: 'Cuentas corrientes', to: '/credito',  icon: SVG_CREDITO,  permiso: 'ctacte.cobrar' },
    ]},
  { key: 'reportes', label: 'Reportes', icon: SVG_DASHBOARD, permiso: 'dashboard.ver',
    items: [
      { label: 'Dashboard',   to: '/dashboard',       icon: SVG_DASHBOARD, permiso: 'dashboard.ver' },
      { label: 'Ventas',      to: '/reportes/ventas', icon: SVG_DASHBOARD, permiso: 'dashboard.ver' },
    ]},
  // ADR-047: grupo Agenda (alta de nav autorizada por el ADR). Visible para ambos roles,
  // detras del flag agenda_habilitado (ver visibleGroups).
  { key: 'agenda', label: 'Agenda', icon: SVG_AGENDA,
    items: [
      { label: 'Eventos',  to: '/agenda',         icon: SVG_AGENDA, end: true },
      { label: 'Avisos',   to: '/agenda/avisos',  icon: SVG_ETIQUETAS },
      { label: 'Rutinas',  to: '/agenda/rutinas', icon: SVG_REABASTECIMIENTO },
    ]},
  // ADR-080 (NAV-3): "Configuración" aligerado a solo catálogos operativos. Los ítems de
  // precios y las importaciones salieron de acá — van al hub de Precios (o al grupo Precios
  // del motor v2); con ambos flags apagados caen en "Sistema" (ver buildNavGroups /
  // PRECIOS_FALLBACK_ITEMS). "Importar datos" (/importar, import masiva) pasó a "Sistema" en
  // ADR-080, pero ADR-083 lo volvió a mover: ahora es el primer ítem de este grupo (pedido de PO).
  { key: 'configuracion', label: 'Configuración', icon: SVG_CONFIG,
    items: [
      // ADR-083: "Importar datos" se movió desde Sistema al tope de Configuración (pedido de PO).
      { label: 'Importar datos', to: '/importar', icon: SVG_IMPORTAR, permiso: 'import.masiva' },
      { label: 'Etiquetas',      to: '/etiquetas',              icon: SVG_ETIQUETAS },
      { label: 'Categorías',     to: '/config/categorias',      icon: SVG_CONFIG,      permiso: 'usuario.administrar' },
      { label: 'Marcas',         to: '/config/marcas',          icon: SVG_CONFIG,      permiso: 'usuario.administrar' },
      { label: 'Unidades',       to: '/config/unidades',        icon: SVG_CONFIG,      permiso: 'usuario.administrar' },
      { label: 'Ubicaciones',    to: '/config/ubicaciones',     icon: SVG_CONFIG },
      // ADR-069: "Sinónimos" se mudó desde el grupo Sistema a Configuración, debajo de Ubicaciones.
      { label: 'Sinónimos',      to: '/config/sinonimos',       icon: SVG_CONFIG,      permiso: 'usuario.administrar' },
      { label: 'Transportistas', to: '/remitos/transportistas', icon: SVG_PROVEEDORES, permiso: 'transportista.gestionar' },
    ]},
  { key: 'sistema', label: 'Sistema', icon: SVG_SISTEMA,
    items: [
      { label: 'Mi cuenta',      to: '/config/mi-cuenta',         icon: SVG_MI_CUENTA },
      { label: 'Usuarios',       to: '/config/usuarios',          icon: SVG_USUARIOS,  permiso: 'usuario.administrar' },
      { label: 'Roles y permisos', to: '/config/roles-permisos',  icon: SVG_USUARIOS,  permiso: 'usuario.administrar' },
      { label: 'Funcionalidades', to: '/config/funcionalidades',  icon: SVG_SISTEMA,   permiso: 'config.fiscal' },
      { label: 'Backup/Restore', to: '/config/backup-restore',    icon: SVG_BACKUP,    permiso: 'backup.crear' },
      { label: 'Email / SMTP',   to: '/config/smtp',              icon: SVG_CONFIG,    permiso: 'config.fiscal' },
      { label: 'Datos demo',     to: '/config/datos-demo',        icon: SVG_CONFIG,    permiso: 'usuario.administrar' },
    ]},
];

// ADR-049 §10 — grupo de navegación "precios" (alta autorizada por el ADR, como los
// grupos "Facturación"/"Agenda"). Con el flag motor_precios_v2_habilitado en true, los
// ítems de precios se muestran en este grupo. Las rutas NO cambian (paths intactos).
// ADR-056 Lote 4: grupo renombrado a "Precios / Costos"; "Importar costos" subió una
// posición (queda entre "Lotes de precios" e "Importar Catálogo del Proveedor"); "Importar
// catálogo prov." → "Importar Catálogo del Proveedor"; el submenú de revisión →
// "Revisión de Costos y Catálogo".
const PRECIOS_GROUP: NavGroup = {
  key: 'precios', label: 'Precios / Costos', icon: SVG_CREDITO, permiso: 'config.fiscal',
  items: [
    { label: 'Listas de precios',    to: '/config/listas-de-precios',      icon: SVG_CREDITO,  permiso: 'config.fiscal' },
    { label: 'Lotes de precios',     to: '/precios/lotes',                 icon: SVG_ORDENES,  permiso: 'config.fiscal' },
    { label: 'Importar costos',      to: '/precios/importar-costos',       icon: SVG_IMPORTAR, permiso: 'import.masiva' },
    { label: 'Importar Catálogo del Proveedor', to: '/precios/importar-catalogo-proveedor', icon: SVG_IMPORTAR, permiso: 'import.masiva' },
    { label: 'Revisión de Costos y Catálogo', to: '/precios/revision-historial', icon: SVG_IMPORTAR, permiso: 'import.masiva' },
  ],
};

// ADR-080 (NAV-3): los 4 ítems de precios ya no viven en Configuración. Van al hub
// (hub_precios) o al grupo Precios/Costos (motor v2); con ambos apagados, este arreglo se
// inyecta como fallback dentro del grupo Sistema. Mismos label/to/permiso que en el hub.
const PRECIOS_FALLBACK_ITEMS: NavItem[] = [
  { label: 'Listas de precios',    to: '/config/listas-de-precios',      icon: SVG_CREDITO,  permiso: 'config.fiscal' },
  { label: 'Importar costos',      to: '/precios/importar-costos',       icon: SVG_IMPORTAR, permiso: 'import.masiva' },
  { label: 'Importar Catálogo del Proveedor', to: '/precios/importar-catalogo-proveedor', icon: SVG_IMPORTAR, permiso: 'import.masiva' },
  { label: 'Revisión de Costos y Catálogo', to: '/precios/revision-historial', icon: SVG_IMPORTAR, permiso: 'import.masiva' },
];

// ADR-078 (PRICE-1): con hub_precios_habilitado en true, un único ítem "Precios y Costos"
// → /precios/hub reemplaza a los ítems de precios dispersos. Gana sobre el reagrupamiento
// del motor v2.
const PRECIOS_HUB_ITEM: NavGroup = {
  key: 'precios-hub', label: 'Precios y Costos', icon: SVG_CREDITO, permiso: 'config.fiscal', standalone: true,
  items: [{ label: 'Precios y Costos', to: '/precios/hub', icon: SVG_CREDITO, permiso: 'config.fiscal' }],
};

/**
 * Inserta el grupo de precios después de Abastecimiento según los flags: con el hub
 * (ADR-078) un único ítem "Precios y Costos"; con el motor v2 (ADR-049 §10) el grupo
 * "Precios / Costos". Con ambos apagados, los ítems de precios —que ya no viven en
 * Configuración (ADR-080 / NAV-3)— caen como fallback dentro del grupo Sistema. Los paths
 * nunca cambian, solo la ubicación en el sidebar.
 */
function buildNavGroups(motorV2: boolean, hubPrecios: boolean): NavGroup[] {
  const inyectarFallbackEnSistema = !hubPrecios && !motorV2;
  const out: NavGroup[] = [];
  for (const g of NAV_GROUPS) {
    if (g.key === 'abastecimiento') {
      out.push(g);
      if (hubPrecios) out.push(PRECIOS_HUB_ITEM);
      else if (motorV2) out.push(PRECIOS_GROUP);
    } else if (g.key === 'sistema' && inyectarFallbackEnSistema) {
      out.push({ ...g, items: [...g.items, ...PRECIOS_FALLBACK_ITEMS] });
    } else {
      out.push(g);
    }
  }
  return out;
}

// ADR-080 (PERF-1): busca el NavItem real (label/icon) de un path favorito para pintarlo en
// el grupo "Favoritos". `end: true` evita que un favorito encienda por prefijo dentro del grupo.
function encontrarNavItem(groups: NavGroup[], path: string): NavItem | undefined {
  for (const g of groups) {
    const it = g.items.find(i => i.to === path);
    if (it) return { ...it, end: true };
  }
  return undefined;
}

export function AppShell() {
  const { session, logout, can } = useAuth();
  useMenuAcciones();
  const inicioPersonalizable = useInicioPersonalizableHabilitado();
  const { toggleFavorito } = usePreferencias();
  const remitosHabilitado = useRemitosHabilitado();
  const presupuestosHabilitado = usePresupuestosHabilitado();
  const agendaHabilitado = useAgendaHabilitado();
  const motorPreciosV2 = useMotorPreciosV2Habilitado();
  const hubPrecios = useHubPreciosHabilitado();
  const minutosBloqueo = useBloqueoInactividad();
  const { locked, unlock } = useIdleLock(minutosBloqueo);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // ADR-076 Tarea 11: consulta diferida de depuración de backups al arranque, solo para
  // Supervisor (permiso backup.crear). El banner permanente en Config (Tarea 10) es el
  // punto de entrada siempre disponible; esto es el aviso "una vez por sesión".
  const [depResumen, setDepResumen] = useState<ResumenDepuracion | null>(null);
  const [propuestaVersion, setPropuestaVersion] = useState<string | null>(null);
  const [novedades, setNovedades] = useState<{ titulo: string; notas: string[] } | null>(null);
  // Flag por-instancia (no de módulo): AppShell se desmonta al hacer logout y se
  // remonta al login (ver ProtectedRoute), así que un ref resetea la propuesta en
  // cada login de Supervisor sin perder el "posponer" durante la misma sesión
  // (AppShell permanece montado entre navegaciones de rutas hijas).
  const actualizacionPospuestaRef = useRef(false);

  useEffect(() => {
    if (depuracionPospuestaEnSesion) return;
    // Postergación persistente por terminal (botones "Postergar 5/15/30 días" del modal).
    if (depuracionPospuestaVigente()) return;
    if (!can('backup.crear')) return;
    let vivo = true;
    (async () => {
      try {
        const r: ResumenDepuracion = await (globalThis as any).ferreteria.backup.evaluarDepuracion();
        if (vivo && r.candidatos.length > 0) setDepResumen(r);
      } catch {
        // silencioso: sin candidatos, sin permiso, o backend no disponible todavía.
      }
    })();
    return () => { vivo = false; };
  }, [can]);

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

  const navGroups = buildNavGroups(motorPreciosV2, hubPrecios);

  // ADR-080 (PERF-1): grupo "Favoritos" al tope, solo con el flag on y ≥1 favorito válido.
  // Cada favorito toma label/icon de su NavItem real (no se duplican textos). Los favoritos
  // sin permiso para el rol quedan fuera vía el filtro `visibleItems` del render.
  const favoritos: string[] = session?.preferencias?.favoritos ?? [];
  const favItems: NavItem[] = inicioPersonalizable
    ? favoritos
        .filter(p => navegacionRetail.esRutaNavegable(p))
        .map(p => encontrarNavItem(navGroups, p))
        .filter((i): i is NavItem => Boolean(i))
    : [];
  const gruposConFavoritos: NavGroup[] = favItems.length > 0
    ? [{ key: 'favoritos', label: 'Favoritos', icon: SVG_STAR, items: favItems }, ...navGroups]
    : navGroups;

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set([...NAV_GROUPS.map(g => g.key), 'precios', 'favoritos'])
  );

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // NAV-1 (ADR-077): breadcrumb jerárquico y clicable, derivado de la ruta.
  const migas = buildBreadcrumb(location.pathname);
  const visibleGroups = gruposConFavoritos.filter(g =>
    (!g.permiso || can(g.permiso)) &&
    // Feature flag ADR-047: grupo Agenda oculto mientras agenda_habilitado este en false.
    (g.key !== 'agenda' || agendaHabilitado)
  );

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
    if (!inicioPersonalizable || groupKey === 'favoritos' || !item.to || !navegacionRetail.esRutaNavegable(item.to)) return null;
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

  return (
    <div className="app-shell">
      <nav className={`side${collapsed ? ' collapsed' : ''}`} aria-label="Menú principal">
        <div className="side-top">
          <div className="logo" />
          <span className="side-name">Ferretería</span>
        </div>

        <div className="nav-body">
          {visibleGroups.map(group => {
            const visibleItems = group.items.filter(i =>
              (!i.permiso || can(i.permiso)) &&
              // ADR-046: item Presupuestos oculto mientras el flag este en false.
              (i.to !== '/presupuestos' || presupuestosHabilitado) &&
              // ADR-045 + Fase 3: item Remitos oculto mientras remitos_habilitado este en
              // false (antes gateaba el grupo Facturación entero — ver comentario arriba
              // en NAV_GROUPS sobre por qué Caja no puede compartir ese gating).
              (i.to !== '/remitos' || remitosHabilitado)
            );
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
                        : (inicioPersonalizable && group.key !== 'favoritos' && item.to && navegacionRetail.esRutaNavegable(item.to))
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
            <CampanaAgenda />
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
        <main className="main-content"><Outlet /></main>
      </div>

      {drawerOpen && <AppearanceDrawer onClose={() => setDrawerOpen(false)} />}

      <CommandPalette disabled={locked} />

      {locked && <PantallaBloqueo onUnlock={unlock} />}

      {depResumen && (
        <DepuracionBackupsModal
          resumen={depResumen}
          onClose={() => { depuracionPospuestaEnSesion = true; setDepResumen(null); }}
          onDone={() => { setDepResumen(null); }}
        />
      )}

      {!depResumen && propuestaVersion && (
        <ActualizacionPropuestaModal
          version={propuestaVersion}
          onInstalar={() => { (globalThis as any).ferreteria.actualizacion.instalarYReiniciar(); }}
          onPosponer={() => { actualizacionPospuestaRef.current = true; setPropuestaVersion(null); }}
        />
      )}

      {!depResumen && !propuestaVersion && novedades && (
        <NovedadesVersionModal
          titulo={novedades.titulo}
          notas={novedades.notas}
          onContinuar={async () => {
            try { await (globalThis as any).ferreteria.actualizacion.marcarVersionVista(); } catch { /* noop */ }
            setNovedades(null);
          }}
        />
      )}
    </div>
  );
}
