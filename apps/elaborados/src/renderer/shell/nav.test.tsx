import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { buildBreadcrumb } from '@core/ui';
import { NAV_ELABORADOS } from './nav';
import { CRUMBS_ELABORADOS } from './crumbs';
import { routes } from '../routes';

describe('árbol de rutas de Elaborados', () => {
  // Revisión 2026-10-20 (P1): sin errorElement un error del shell muestra la pantalla por defecto
  // de react-router; los errores de una pantalla los contiene el ErrorBoundary de AppShell.
  it('la ruta raíz declara un errorElement', () => {
    const raiz = routes.find((r) => r.path === '/');
    expect(raiz?.errorElement).toBeDefined();
  });
});

describe('NAV de Elaborados', () => {
  const items = NAV_ELABORADOS.flatMap((g) => g.items).filter((i) => i.to);

  it.each(items.map((i) => [i.label, i.to!]))('%s (%s) tiene ruta', (_l, to) => {
    // Cast: react-router-dom's public `RouteObject` marca `caseSensitive` opcional, pero su
    // tipo interno (AgnosticRouteObject) lo exige no-opcional bajo `exactOptionalPropertyTypes`
    // (tsconfig.base.json) — desajuste de las propias definiciones de la librería, no del
    // contenido de `routes`. Mismo patrón sería necesario en cualquier uso de `matchRoutes`
    // en este monorepo.
    // Se mira la ruta HOJA (la última de la cadena): la raíz `/` siempre cumple `path !== '*'`, así que
    // con `.some(...)` cualquier ítem pasaba aunque solo existiera la ruta comodín (ADR-143).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cadena = matchRoutes(routes as any, to);
    expect(cadena && cadena[cadena.length - 1]!.route.path !== '*').toBe(true);
  });

  it.each(items.map((i) => [i.label, i.to!]))('%s (%s) tiene breadcrumb', (_l, to) => {
    expect(buildBreadcrumb(to, CRUMBS_ELABORADOS)[0]?.label).not.toBe('Inicio');
  });
});
