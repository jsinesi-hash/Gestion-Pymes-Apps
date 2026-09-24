# ADR-092 — Elaborados E1: la plataforma va al core por el 2º consumidor real

**Estado:** Aceptado (E1 ejecutado en la rama `elaborados-e1`)
**Fecha:** 2026-09-23
**Spec:** `docs/superpowers/specs/2026-09-22-elaborados-heladeria-design.md` (§3 fila E1, §5, §8)
**Plan:** `docs/superpowers/plans/2026-09-22-elaborados-e1-esqueleto-plataforma.md`
**Precedente:** ADR-091 (Fase 2 — corte multi-rubro, dejó `@core/preload`, `@core/ui` AppShell/vistas
universales y buena parte de `@core/main` como *diferido — regla de tres*)

## Contexto

ADR-091 congeló Retail como primer perfil y extrajo al core la plomería que **no** necesitaba un
segundo consumidor para tener forma clara (`@core/db`, design system de `@core/ui`, auth machinery
de `@core/main`). Dejó tres familias de diferido explícitamente atadas a "cuando aparezca el 2º
consumidor real": `@core/preload` (no había framework extraíble con un solo catálogo de canales),
`@core/ui` AppShell/vistas universales (demasiado acopladas a Retail: NAV/CRUMBS/comandos/12+ hooks
de dominio) y varios handlers de `@core/main` (`auth/seed` con `PERMISOS` como catálogo Retail,
caja→agenda, cliente→lista_precio, export→query-alls de dominio).

Elaborados (heladería, cliente real) es ese 2º consumidor. E1 es el "esqueleto caminante": arrancar
login, usuarios/roles, mi cuenta, parámetros, backup/restore, caja y clientes/cta-cte en
`apps/elaborados` componiendo `@core/*`, sin cambiar el comportamiento de Retail. Para lograrlo hubo
que decidir, con el código real de dos apps delante (no solo el diseño), la forma exacta de cada seam
que ADR-091 había diferido.

## Decisión

Se promueve al core toda la plataforma que ambas apps comparten de forma comprobada, con **seams de
inyección** en cada punto donde Retail y Elaborados difieren (permisos, navegación, hook de cierre de
caja, registro de exportadores, ubicación de las migraciones). Retail se re-apunta a esa plataforma
**sin cambio de comportamiento** — mismo `window.ferreteria`, mismos handlers, misma UI.

### Los seams, con su forma exacta

- **`runSeed(db, opts: { permisos, operador })`** (`@core/main`). El core define `PERMISOS_CORE` (12
  permisos universales: ventas, caja, cta-cte, dashboard, admin, export) y `OPERADOR_PERMISOS_CORE`.
  `runSeed` hace `[...PERMISOS_CORE, ...opts.permisos]` deduplicando por `codigo`, y
  `new Set([...OPERADOR_PERMISOS_CORE, ...opts.operador])`. Retail delega:
  `runSeed(db) { runSeedCore(db, { permisos: PERMISOS, operador: [...OPERADOR_PERMISOS] }) }`,
  conservando `PERMISOS`/`OPERADOR_PERMISOS` propios (los usan tests y la cobertura de etiquetas).
  Elaborados llama a `runSeedCore` con sus propios permisos de dominio (o `{ permisos: [], operador:
  [] }` si todavía no tiene ninguno propio en E1).
- **`registerCoreHandlers(ipcMain, db, opts)`** (`@core/main`), con
  `opts: { migrationsFolder: string; navegacion: Navegacion; exportadores?: readonly Exportador[];
  caja?: CajaHooks }`. Registra en un solo llamado auth, preferencias, parámetros, geo, cliente,
  cta-cte, caja, backup, restore, dialog y exportar. Cada app lo llama una vez desde su
  `main/index.ts` y agrega sus propios `register*Handlers` para lo que no es universal.
- **`OnCajaCerrada` con post-commit.** `cajaCerrarHandler(db, payload, hooks: CajaHooks = {})` corre
  el hook **dentro** de la transacción de cierre (`onCajaCerrada: (ctx: CajaCierreCtx) => (() =>
  void) | void`, con `ctx = { db, tx, cajaRow, resumen, diferencia, monto_contado, usuarioCierreId,
  now }`) y ejecuta el valor de retorno (best-effort: envío de avisos) **después** del commit. Si el
  hook lanza, la caja no queda cerrada. Sin hook, cierra igual — es el caso de Elaborados en E1.
  Retail conecta su aviso de cierre (ADR-047) como ese hook (`avisoCierreCaja`), preservando que el
  aviso se inserte en la misma transacción y se despache después.
- **`Exportador` / `crearExportarEjecutar`.** `Exportador = { definicion: DefinicionExport<any>; fetch:
  (db, req) => Record<string, unknown>[] }`. `crearExportarEjecutar(exportadores)` construye un mapa
  por `entidad`, lanzando `EXPORTADOR_DUPLICADO` si dos comparten clave, y devuelve la función que
  valida permisos/perfil/formato y escribe el archivo. El core registra `EXPORTADORES_CORE` (clientes,
  caja, cta-cte — las tres vistas universales ya montan `ExportarButton`); cada app arma
  `crearExportarEjecutar([...EXPORTADORES_CORE, ...EXPORTADORES_DE_LA_APP])`. Dos consumidores desde
  E1: el core registra los suyos, Retail los otros 13.
- **`crearNavegacion(cfg)`** (`@ferreteria/shared`). Fábrica pura: recibe `{ rutas, inicioPorRol,
  inicioFallback }` y devuelve `esRutaNavegable`, `permisoDeRuta`, `resolverPantallaInicio`,
  `normalizarFavoritos`, `normalizarPantallaInicio`. Las rutas navegables (`RUTAS_NAVEGABLES`,
  `INICIO_POR_ROL`, `INICIO_FALLBACK`) dejan de ser constantes de `shared` y pasan a ser configuración
  de cada app (`apps/<app>/src/common/navegacion.ts`), consumida por el handler de preferencias
  (main) y el shell (renderer). `shared` conserva solo la mecánica pura.
- **`createBridge({ exposeAs, app }, deps)`** (`@core/preload`). Única llamada a
  `contextBridge.exposeInMainWorld`: mezcla `coreCanales(invoke)` con el namespace que arma la app
  (`app?.(invoke, deps)`) vía `mergeNamespaces`, que permite **extender** un namespace del core con
  métodos nuevos pero lanza `BRIDGE_COLISION: <ns>` o `BRIDGE_COLISION: <ns>.<metodo>` si la app
  pisa una clave que el core ya define. Retail expone `window.ferreteria`, Elaborados
  `window.elaborados` — mismo core, distinta clave.
- **`bridge()` / `configurarBridge(exposeAs)`** (`@core/ui`). El renderer del core nunca escribe
  `globalThis.ferreteria` a mano: llama `configurarBridge('ferreteria' | 'elaborados')` una vez al
  arrancar (y en el test-setup) y después siempre `bridge()` para llegar a la API expuesta. Sin
  configurar, `bridge()` lanza `BRIDGE_NO_CONFIGURADO`.
- **`AppProfileProvider` / `useAppProfile()`** (`@core/ui`). Contexto React con
  `{ nombreApp: string; navegacion: Navegacion }`; lo consumen las vistas del core que necesitan el
  nombre de la app o su navegación sin que se les inyecte por props en cada nivel.
- **`AppShell` 100% por props.** `AppShellProps = { nombreApp, nav: NavGroup[], crumbs, leafKeywords?,
  comandos: { accion, nav }, buscadores, headerExtras?, overlays?: ReactNode | ((ctx: OverlaysCtx) =>
  ReactNode), onMount? }`. El shell filtra `nav`/`comandos` por permiso y arma breadcrumb/paleta de
  comandos con lo que le pasan; no conoce NAV ni CRUMBS de ninguna app. `RetailShell`/
  `ElaboradosShell` (en `apps/<app>/src/renderer/shell/`) componen `AppShell` con su propio
  `NAV_<APP>`/`CRUMBS_<APP>`/comandos/buscadores/overlays.
- **Slots en las vistas universales.** `ClienteForm`/`ClienteDetalle` reciben
  `cargarListasPrecio?: () => Promise<{ id; nombre }[]>` (Retail lo pasa porque tiene `lista_precio`;
  Elaborados no, y el selector simplemente no aparece). `CajaView`/`CajaDashboard` reciben
  `renderVentaDetalle?: (ventaId, onClose) => ReactNode` para que cada app inyecte su propio modal de
  detalle de venta sin que el core conozca la forma de una venta de dominio.

### Enmiendas al spec (decididas al relevar el código, no al diseñarlo)

1. **El registro de exportadores se adelanta de E4 a E1.** Las vistas universales de clientes, cta
   cte y caja ya montaban `ExportarButton` en Retail, y los tres exportadores correspondientes son
   universales — no tenía sentido dejarlos en la app hasta E4 cuando el seam de registro (`Exportador`
   / `crearExportarEjecutar`) ya hacía falta para que el core los sirviera sin duplicar código.
2. **La navegación se parametriza (`crearNavegacion`)** en vez de quedar como constantes globales en
   `shared`. `RUTAS_NAVEGABLES`/`INICIO_POR_ROL`/`INICIO_FALLBACK` eran datos de Retail disfrazados de
   mecánica universal; pasan a ser configuración por app y `shared` se queda con la fábrica pura.
3. **El geo-seed y el `geo-cache` pasan al core** (`@core/main`). Elaborados necesita provincias y
   localidades para el domicilio del cliente igual que Retail — no había razón de dominio para que
   quedaran atados a Retail.
4. **`test-node.cjs` acepta `--serial`** en ambas apps. El runner del main process ya era flaky en
   paralelo (ver ADR-091 aprendizaje 4); con dos apps corriéndolo, dejar el flag fijo en el script
   `test` de cada `package.json` en vez de exigir que quien corra los tests lo recuerde a mano.

### B2 — sync (no se implementa; se verifica con un test)

ADR-091 dejó B2 (sync dirigido por registro de tablas por app, R4) como *no implementado*. E1 no
construye el motor de sync, pero agrega un **test de baranda por app**
(no un registro de tablas central — eso se sigue diferiendo a R4): cada app verifica que sus propias
tablas de dominio llevan los campos de sync transversales (`version`, `origin_id`, `sync_state`,
`updated_at`) y que el core no importa nada de la app. Es la misma clase de baranda automática que B4
(`no-electron.test.ts`), aplicada al límite core↛app en vez de al límite dominio↛Electron.

### Lo que sigue en la app (no se promovió, y por qué)

- **Retail conserva**: el aviso de cierre de caja (conectado como hook `onCajaCerrada`, no movido —
  es lógica de agenda/ADR-047, dominio-específica), el actualizador (`electron-updater`, no lo usa
  Elaborados todavía), el menú nativo de la app y `VentaDetalleModal` (inyectado a `CajaDashboard` vía
  el slot `renderVentaDetalle` — la forma de una venta de Retail no es universal).
- **Candidato anotado, no promovido:** `config.ts`/`loadTerminalConfig` — solo 2 consumidores hoy,
  trivial; no justifica el seam todavía (regla de tres).
- **No se tocan** (siguen diferidas de ADR-091): el motor fiscal (B1/ADR-013), el motor de sync real
  (B2/R4) más allá del test de baranda, y `lista_precio`/`impuesto` (regla de tres — Elaborados no los
  necesita en E1; quedan para E2/E4 si Elaborados los necesita).

## Consecuencias

- `apps/elaborados` arranca componiendo `@core/*` sin duplicar plomería, y Retail no cambió de
  comportamiento (mismo `window.ferreteria`, mismos handlers, misma UI — verificado navegando la app,
  no solo con tests en verde).
- Los seams diferidos por ADR-091 quedaron con forma concreta y un solo patrón repetible: **opts
  inyectadas en el registrador del core, la app decide el contenido**. El próximo perfil de Retail
  (kiosco, Fase 3) y el próximo consumidor de Elaborados (otro rubro gastronómico) reutilizan la
  plataforma sin más extracción.
- `test-node.cjs --serial` es ahora el script `test` por defecto de ambas apps: el gotcha de
  concurrencia del runner deja de depender de que quien ejecute los tests lo recuerde.
- Pendiente explícito: los handlers dominio-coupled que ADR-091 ya había dejado en la app (cliente→
  lista_precio, backup→registry de tablas) siguen sin promoverse — Elaborados en E1 no los ejercita
  todavía; se revisan cuando aparezca la necesidad real, no antes.

## Numeración

092 es el próximo libre después de ADR-091.
