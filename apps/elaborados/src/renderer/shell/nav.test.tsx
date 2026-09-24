import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { buildBreadcrumb } from '@core/ui';
import { NAV_ELABORADOS } from './nav';
import { CRUMBS_ELABORADOS } from './crumbs';
import { routes } from '../routes';

describe('NAV de Elaborados', () => {
  const items = NAV_ELABORADOS.flatMap((g) => g.items).filter((i) => i.to);

  it.each(items.map((i) => [i.label, i.to!]))('%s (%s) tiene ruta', (_l, to) => {
    // Cast: react-router-dom's public `RouteObject` marca `caseSensitive` opcional, pero su
    // tipo interno (AgnosticRouteObject) lo exige no-opcional bajo `exactOptionalPropertyTypes`
    // (tsconfig.base.json) — desajuste de las propias definiciones de la librería, no del
    // contenido de `routes`. Mismo patrón sería necesario en cualquier uso de `matchRoutes`
    // en este monorepo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(matchRoutes(routes as any, to)?.some((m) => m.route.path !== '*')).toBe(true);
  });

  it.each(items.map((i) => [i.label, i.to!]))('%s (%s) tiene breadcrumb', (_l, to) => {
    expect(buildBreadcrumb(to, CRUMBS_ELABORADOS)[0]?.label).not.toBe('Inicio');
  });
});
