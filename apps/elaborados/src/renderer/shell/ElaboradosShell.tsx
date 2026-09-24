import { AppShell, buscadorClientes } from '@core/ui';
import { NAV_ELABORADOS } from './nav';
import { CRUMBS_ELABORADOS } from './crumbs';
import { COMANDOS_ACCION, COMANDOS_NAV } from './comandos';

export function ElaboradosShell() {
  return (
    <AppShell
      nombreApp="Heladería"
      nav={NAV_ELABORADOS}
      crumbs={CRUMBS_ELABORADOS}
      comandos={{ accion: COMANDOS_ACCION, nav: COMANDOS_NAV }}
      buscadores={[buscadorClientes]}
    />
  );
}
