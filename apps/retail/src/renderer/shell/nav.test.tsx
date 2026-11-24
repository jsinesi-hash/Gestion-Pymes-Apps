import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { buildBreadcrumb } from '@core/ui';
import { buildNavRetail } from './navRetail';
import { CRUMBS_RETAIL, LEAF_KEYWORDS_RETAIL } from './crumbsRetail';
import { routes } from '../routes';

// F3 PR2: la misma baranda que Elaborados (CLAUDE.md §Navegación). Cada ítem del NAV con destino tiene
// ruta real y breadcrumb: una ruta sin NAV es inalcanzable y un NAV sin ruta cae en la pantalla de error.
// Se arma el NAV con todas las combinaciones de flags que cambian sus ítems.
const combinaciones = [true, false].flatMap((motorV2) => [true, false].map((hub) =>
  buildNavRetail({ remitos: true, presupuestos: true, agenda: true, motorV2, hub })));
const items = [...new Map(combinaciones.flat().flatMap((g) => g.items).filter((i) => i.to).map((i) => [i.to!, i])).values()];

describe('NAV de Retail', () => {
  it.each(items.map((i) => [i.label, i.to!]))('%s (%s) tiene ruta', (_l, to) => {
    // Cast: mismo desajuste de tipos de react-router-dom que en el test de Elaborados. Se mira la ruta
    // HOJA: la raíz `/` siempre existe y la comodín `*` no cuenta.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cadena = matchRoutes(routes as any, to);
    expect(cadena && cadena[cadena.length - 1]!.route.path !== '*').toBe(true);
  });

  it.each(items.map((i) => [i.label, i.to!]))('%s (%s) tiene breadcrumb', (_l, to) => {
    expect(buildBreadcrumb(to, CRUMBS_RETAIL, LEAF_KEYWORDS_RETAIL)[0]?.label).not.toBe('Inicio');
  });

  it('Conflictos (F3 PR2) está en Sistema y pide sync.conflictos', () => {
    const sistema = combinaciones[0]!.find((g) => g.key === 'sistema')!;
    expect(sistema.items.find((i) => i.to === '/config/conflictos')).toMatchObject({ permiso: 'sync.conflictos' });
  });
});
