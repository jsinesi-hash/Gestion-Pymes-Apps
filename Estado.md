# Estado del Proyecto — Sistema de Gestión Ferretería

> Fuente de verdad sobre qué está hecho, qué está en curso y qué viene después.
> Actualizar al completar cada fase o tomar una decisión de diseño significativa.

**Última actualización:** 2026-10-13 (**Elaborados E3c-1 — cobro, ticket (B1) e impresión HTML al core — ADR-097** — rama `e3c1-core-venta-ui` (pendiente de click-through y merge). Promovidos al core por 2º consumidor, con Retail re-apuntado: B1 (`ComprobantePayload`/`ivaPorAlicuota` en `shared`), `TicketModal` genérico + `buildTicketHtml` en `@core/ui` (slot de anulación, `onImprimir` inyectado), `ConfirmarVentaModal` y tipos de medios de pago en `@core/ui`, y `print:html` universal (`crearImpresorHtml` en `@core/main` + `print.html` en `@core/preload`). Convención aclarada: `venta.descuento_global` es un porcentaje (Elaborados lo guardaba como importe; corregido). Gates: **shared 165 · core-ui 26 · Retail renderer 933 · Retail main 1598 · Elaborados renderer 68 · Elaborados main 113**. Próximo: E3c-2 (POS de Elaborados: botonera, selector de sabores, cobro, ticket, clientes/cta cte), luego E3d. Ver ADR-097. **Previo:** 2026-10-12 (**Elaborados E3b — backend de venta de Elaborados — ADR-096** — mergeado a `main` (PR #8). Elaborados ya valoriza, confirma y anula ventas desde el main (sin UI): dominio puro `valorizarCarrito` (precio = base + recargos de sabor, descuento de línea y global con el motor de `shared`, IVA incluido prorrateado, redondeo a $1, consumo con `calcularConsumo`), handlers `venta:cotizar/confirmar/anular/get/listByCaja` sobre `confirmarVenta`/`anularVenta` del core, política de stock R2 (la reventa bloquea; el granel avisa y puede quedar en negativo) y anulación que invierte los movimientos originales. Esquema `venta_linea`/`venta_linea_modificador` (migración 0005) y cliente Consumidor Final asegurado en cada arranque. `ventaListByCajaHandler` promovido a `@core/main`. Gates: **Retail main 141 archivos/1598 · Retail renderer 948 · Elaborados main 20 archivos/113 · Elaborados renderer 68**, typecheck limpio. Brainstorm → spec → plan → TDD con `superpowers:subagent-driven-development` + revisión final independiente. Próximo: E3c (POS UI: botonera, selector de sabores, cobro, ticket con B1/`TicketModal`), luego E3d (pedidos en espera + anulación en pantalla). Ver ADR-096. **Previo:** 2026-10-05 (**Elaborados E3a — `confirmarVenta`/`anularVenta` al core — ADR-095** — en rama `e3a-confirmar-venta-core` (pendiente de merge). Extracción por regla-de-tres de la parte universal de la venta de Retail a `@core/main` (template method con hooks `validarPrevio`/`aplicarLineas`/`revertirLineas`; el core recibe totales ya calculados y crea el correlativo si falta); Retail queda con wrappers finos sin cambio de comportamiento. Brainstorm → spec → plan → TDD con `superpowers:subagent-driven-development`. Gates: **Retail main 141 archivos/1598 · Retail renderer 947 · Elaborados main 79 · Elaborados renderer 68**, typecheck limpio. **Pendiente:** click-through en Retail (venta mixta + anulación, retomar espera, presupuesto→venta). Próximo: E3b (POS de Elaborados, selector de sabores, B1/TicketModal, pedidos en espera). Ver ADR-095. **Previo:** 2026-09-28 (**AnulacionModal/AnularProduccionModal reusan
SupervisorAuthModal en 2 pasos — ADR-094** — cierra uno de los 5 follow-ups de bajo riesgo
detectados en la revisión holística de ADR-093 (duplicación de `SupervisorAuthModal`): Retail
(`AnulacionModal`, venta) y Elaborados (`AnularProduccionModal`, producción) reimplementaban cada
uno el formulario de motivo+credenciales de Supervisor que ya existe en `@core/ui`
(`SupervisorAuthModal`, consumido por `CajaCierreView`), con mensajes de `SUPERVISOR_INVALIDO`
divergentes (comparación exacta vs `.includes(...)`). Ambos pasan a una máquina de 2 estados
(`motivo`→`auth`) que reusa `SupervisorAuthModal` sin modificarlo, replicando el patrón ya usado
por `CajaCierreView`; cancelar/Escape en el paso de credenciales **vuelve** al paso de motivo
preservando lo tipeado (no cierra todo), y el botón del primer paso pasa a decir "Continuar" porque
ese click todavía no ejecuta la acción destructiva. Efecto colateral: mensaje de
`SUPERVISOR_INVALIDO` unificado en ambas apps. Brainstorm → spec → plan → TDD vía
`superpowers:subagent-driven-development` (implementador + spec reviewer + code reviewer por task,
2 tasks). Spec: `docs/specs/2026-09-28-anulacion-two-step-supervisor-auth-design.md`, plan:
`docs/plans/2026-09-28-anulacion-two-step-supervisor-auth.md`. Verificado: typecheck del monorepo
limpio; **Retail 140 archivos/1591 tests · Elaborados renderer 68/68 + main 65/65**; navegación
manual confirmada por el usuario en ambas apps. Ver ADR-094. **Previo:** 2026-09-28 (**Elaborados
E2 — inventario elaborado (stock/producción/catálogo de venta) — ADR-093** — implementado con `superpowers:subagent-driven-development` (26 tasks, implementador + spec reviewer + code reviewer por task + revisión holística final del diff completo) en la rama `elaborados-e1`, **mergeada a `main`** (PR #2 auto-cerrado por GitHub al detectar que `main` ya contenía sus commits — fast-forward, sin conflictos). Stock: `articulo`/`existencia_articulo`/`movimiento_articulo` (saldo + libro inmutable, `bloquea_sin_stock` configurable por artículo, costo promedio ponderado). Producción: `receta_produccion`+`produccion` transaccional (consume insumos escalados, acredita el elaborado al costo del lote, anular exige `verificarSupervisor`). Catálogo de venta: `categoria_venta`/`producto_venta`(+componente)/`grupo_modificador`(+opción)/`producto_venta_grupo`, con `calcularConsumo`/`validarStock` puras (las consume E3). `impuesto` promovido a `@core/db` (Retail re-apuntado sin cambio de comportamiento) — `producto_venta.impuesto_id` sí lleva FK cross-package (se probó que Drizzle lo permite, contrario a una hipótesis inicial del plan). Seed demo de heladería bajo demanda. Permisos nuevos: `articulo.gestionar`/`stock.ajustar`/`produccion.registrar` (Operador+Supervisor), `receta.gestionar`/`producto_venta.gestionar` (Supervisor-only). **Dos bugs de datos corregidos antes de mergear** (visibles solo en la revisión holística final, no por task individual): `movimiento_articulo.tipo` se derivaba del signo de `cantidad` en vez de `motivo` (mermas quedaban `ajuste` en vez de `salida`); FK faltante de `impuesto_id`. Gates finales: **Elaborados renderer 67/67 · Elaborados main 65/65 · Retail 140 archivos/1591 tests + renderer sin cambios · core-db/core-main typecheck limpio**. Quedaron 5 tareas de fondo de bajo riesgo sin ejecutar (duplicación de `SupervisorAuthModal`/`requireAdmin()`, atomicidad del seed demo, auditoría de catch faltante, gating del grupo NAV Stock). Ver ADR-093. **Pendiente:** verificación manual navegando ambas apps (§12). Próximo: E3 (venta/POS). **Previo:** 2026-09-24 (**Elaborados E1 — 2ª app de familia (heladería) + promociones de plataforma al core — ADR-092** — en rama `elaborados-e1`, mergeada junto con E2. App nueva `apps/elaborados` (package `elaborados-client`) que arranca sobre el core: login, caja, clientes/cuenta corriente, usuarios/roles, mi cuenta, backup; BD propia `elaborados.db` con migración base de **solo las 18 tablas del core**; NAV/rutas/shell propios. **Promovido al core por regla-de-tres (2º consumidor real)**, todo re-apuntando a Retail sin cambio de comportamiento: `runSeed(db,{permisos,operador})` con `PERMISOS_CORE` (12); handlers universales + geo-seed/geo-cache en `@core/main`; caja con hook `onCajaCerrada` (el aviso de cierre de Retail pasa a ser ese hook); registro de exportadores (`crearExportarEjecutar`); `registerCoreHandlers`; paquete nuevo **`@core/preload`** (`createBridge`, clave configurable — Retail sigue `window.ferreteria`); en **`@core/ui`**: `bridge()`/`configurarBridge`, `AppProfileProvider`, AppShell/CommandPalette/breadcrumb parametrizados por props (Retail compone vía `RetailShell`), y vistas universales (clientes, cta cte, caja, usuarios, backup) con slots `cargarListasPrecio` y `renderVentaDetalle`. **`crearNavegacion`** en `@ferreteria/shared` (rutas de inicio/favoritos = config por app). **Barandas** B2 (campos de sync por app; sin registro de tablas, diferido a R4) e invariante core↛app como tests. `impuesto`/`lista_precio` **NO** promovidos aún (van en E2/E4). Suite verde: **shared 160 · Retail renderer 929 · Retail main 1591 · Elaborados renderer 14 · Elaborados main 5**; builds `@core/*` + typecheck OK; arranque fresco de Elaborados verificado (crea BD, migra, seed admin, geo-seed). Gotcha: `pnpm rebuild` (electron-rebuild de better-sqlite3) antes de `pnpm dev`. **Pendiente:** verificación manual navegando ambas apps (§12) y merge del PR #2. Ver `docs/ADR-092`. Próximo: E2 (inventario elaborado). **Previo:** 2026-09-22 (**Corte multi-rubro: monorepo `Gestion-Pymes-Apps` + Fase 2 (extracción incremental al core) — ADR-091** — ferretería congelada v1.1.1; el monorepo tiene `packages/shared` + `@core/db` + `@core/ui` + `@core/main` + `apps/retail` (package `ferreteria-client`, 1er perfil Retail). Boundary **Opción C**, invariante **app→core (el core nunca→app)** con **barandas automáticas** (`no-electron` en shared, `no-fk-to-app` en core-db). **`@core/db`:** esquema universal + factory `createDb`/`runMigrations`, se partió `ventas.ts` (venta_detalle queda en app), `cliente.lista_precio_id`→soft FK. **`@core/ui`:** design system + primitivos (renderer-only). **`@core/main`:** plomería-hoja (auth/validation/context/webSecurity, main-only). **Diferido por regla-de-tres** hasta Elaborados (2º consumidor real): `@core/preload`, AppShell/vistas UI, handlers de dominio, `auth/seed`, sync y fiscal. **Mergeado a `main`** (PR #1); suite verde **shared 158 / renderer 927 / main 1578 = 2663**. Pendiente: verificación visual del CSS. Nota de tooling: el runner del main es flaky en paralelo → correr **en serie**. Ver `docs/ADR-091` y `docs/superpowers/`. Fases 3 (perfiles de rubro) y 4 (docs/guía) por delante). **Previo:** 2026-09-18 (**Importar Costos/Catálogo, Exportación y Precios — ADR-090** — **implementado** (TDD en las tres capas, `tsc` limpio, **shared 157 / main 1578 / renderer 927** verdes). **Matcheo** de Importar Costos contra **todo el catálogo** por EAN/COD_INTERNO (revierte el scope estricto de ADR-051; el vínculo se crea al Confirmar); fix de la columna **`DESCRIPCION`** (el parser leía `NOMBRE` → la similitud nunca recibía texto); matcher por similitud que normaliza **en vivo** y puntúa contra `nombre_corto` **y** `nombre_largo` (best-field); **sugerencias inline "Asignar"** (nombre+SKU+score) en Previsualizar con paridad a Importar Catálogo, filtro "Con sugerencia", toolbar en una línea, anchos de columna y nota de ayuda colapsable. **Exportar** (CSV/XLSX, `export.supervisor`) en 8 listados nuevos: Proveedores, Remitos, Presupuestos, Categorías, Marcas, Unidades, Sinónimos, Transportistas (`ExportarButton` pasa a `useAuth()`). **Lote detalle dentro del hub** (ruta `lotes/:id` + navegación contextual `lotesBase`, conserva las pestañas). Falta verificación manual §12). **Previo:** 2026-09-18 (**Apariencia — ADR-086 Modos (skin), ADR-088 contraste modo Oscuro, ADR-089 tipografías bundleadas** — **implementado y mergeado a `main`** (PRs #46/#49/#50 + follow-up #51; TDD, `tsc` limpio, ambos runners verdes). **ADR-086:** eje **Modo** (`skin` `actual`/`maximizar`/`confortable`) que reemplaza al control de Densidad (panel Tema·Modo·Acento·Tipografía; `densidad` se deriva del modo al DOM, `maximizar`→`compact`), migración `0048`, bloques `[data-skin]` en `global.css`; + fix del botón del drawer de Apariencia (reenviaba la fila completa con `favoritos` string → `normalizarFavoritos` lanzaba y `setPreferencias` no corría). **ADR-088:** tokens `--color-success/warning/danger/info` + `*-bg`/`*-text` con **valores literales por tema** en `global.css` (el fallback claro de `var(--color-*, …)` dejaba texto ilegible en Oscuro; un alias `--a: var(--b)` en `:root` no toma el override oscuro), `.alert-*`, `<mark>`/`::selection`, `--accent-soft` en Oscuro; **follow-up #51:** POS dropdown (`PosScanBar`: `<button>` sin `color`) y KPIs del dashboard (`VentasPanel`: `accent-soft`→`surface-2`). **ADR-089:** nuevo set de 6 tipografías (fuera Figtree/Onest), `.woff2` subset latin bundleados en `src/renderer/styles/fonts/` + `fonts.css`, sin Google Fonts en runtime, CSP endurecido, migración `0049` remapea `ui_font`. Falta verificación manual §12. **Previo:** 2026-09-16 (**ADR-087 PERF-3 opción A — pantalla Roles y permisos (matriz RBAC de solo lectura)** — **implementado** (TDD, ambos runners verdes: main 1560, renderer 922, `tsc` limpio; sin migración ni flags). Pantalla nueva en Configuración → Sistema (gate `usuario.administrar`): handler de lectura `permiso:matriz` + preload `permisos.matriz` + `RolesPermisosView` (matriz roles×permisos con nombres amigables via `etiquetaPermiso`, solo lectura) + ruta + NAV + breadcrumb. Primer consumidor del mapa `ETIQUETA_PERMISO` de ADR-085. Cierra PERF-3 en su opción A; la opción B (edición con guardas) sigue abierta con su propio ADR. Falta verificación manual §12. **Previo:** 2026-09-13 (**ADR-085 Fase 3 — SEC-2 en dominios no prioritarios + ruteo por-campo en CajaCierreView + mapa de nombres de permisos** — **implementado** (TDD con subagentes en worktree aislado, sin migraciones; ambos runners verdes: main 1549, renderer 912, `tsc` limpio, build de `shared` OK). Cierra los puntos 1 y 2 del "Fuera de alcance" de ADR-082: (A) validación de payloads en el borde de los 12 dominios restantes —transportista, sinónimos, equivalencias, presentaciones, recepción, OC, presupuestos, remitos, producto-proveedor, reglas de precio, cambios programados, ctacte— con el patrón de ADR-082 (`payload: unknown` → primitivas de `main/validation/core.ts` en locales `v_` + capa C/D `useCallIpc`/`rutearCampoError`/toasts + tests de validación y de ruteo por dominio; sin requeridos nuevos); (B) `CajaCierreView` con validación de monto previa al modal, doble superficie de error (`errorMonto` inline + `errorCierre` banner) y discriminador credencial-vs-dominio (`SUPERVISOR_INVALIDO` queda en el modal, el resto cierra el modal y se rutea a la vista); (C) `ETIQUETA_PERMISO`/`etiquetaPermiso` en `@ferreteria/shared` (29 etiquetas amigables) + test de cobertura contra `PERMISOS` —groundwork para el futuro ADR de permisos, sin consumidor de UI aún—. **PERF-3** (editor de permisos por rol) diferido a un ADR dedicado con insumos listos: `docs/perf3-permisos-analisis.md` (opciones A/B/C + trampa del `runSeed` aditivo) y `docs/perf3-permisos-mockup-opcion-B.html`. Higiene: renombre de locales que ensombrecían primitivas, baja de tipos de payload muertos, alta de códigos de dominio en `errores.ts`. Se planificó como "ADR-084" pero 083/084 los tomaron sesiones concurrentes → renumerado a 085. Falta verificación manual en la app (§12). **Previo:** 2026-09-10 (**ADR-084** — alta de productos en proveedor como pantalla completa (modal→`Panel`, revisa ADR-083 §B, solo UI). Previo: ADR-083 ajustes varios — **implementado** (TDD subagentes, main 1326 + renderer 866 verdes; sin migraciones ni flags): (A) agregar proveedor desde el detalle del producto con auto-preferido/checkbox — Supervisor-only; (B) alta masiva de productos en el proveedor (`ProveedorAgregarProductosModal` + handler `asociarLote`, filtros Marca/Categoría + toggle "mostrar ya asociados"), se retira la búsqueda del toolbar; (C) "Importar datos" al tope de Configuración; (D) `cliente.lista_precio_id` con UI — selector en `ClienteForm`, badge en `ClienteDetalle`, persistencia en `clienteUpsertHandler` (cierra un gap: el motor ya lo consumía). Falta verificación manual en la app. Previo: Fase 3 mejoras UX ADR-082 — **implementado** (TDD, ambos runners verdes: renderer 852, main 1320, `tsc` limpio): **SEC-2** validación de payloads a mano en el borde de los handlers de escritura del tranche (catálogos, producto, cliente, proveedor, stock/caja, venta, precios) vía `main/validation/core.ts` + contrato `CÓDIGO:arg`; **catálogo de errores completo** en `lib/errores.ts` (~64 códigos de dominio traducidos, cubre toda la app); **validación inline** (`useFormErrors`, `useCallIpc` expone `traducido.campo`, helper `rutearCampoError`, ruteo backend→campo en los forms del tranche); **confirmaciones de éxito** estandarizadas. Fuera: dominios no prioritarios (el catálogo ya los cubre), `CajaCierreView` por-campo, **PERF-3** (editor de permisos — decisión abierta), deep-link "abrir el existente". Falta verificación manual en la app. Previo: ADR-081 (SRCH-2/3, PERF-2, BUG-2, PRICE-4), ADR-080 (PERF-1 + NAV-3)).
**Tests actuales:** suite del cliente en verde (renderer + node + shared) tras la integración —
ver corrida de integración. Se integró la cadena **ADR-063→073** (menú nativo Base+Operación;
sinónimos y matching por similitud; ubicaciones canónicas; robustez del importador; fixes de UX;
reuso de GTIN; lote de UI/UX de listados; edición de Costo bruto + botón Re-validar en lotes;
mejoras a listados de precios; redondeo del delta en Ajuste de Stock; búsqueda por similitud en
Catálogo) **más ADR-074 Fase 1** (sustitutos curados: `producto_equivalencia` + `discontinuado`
+ panel en el detalle, flag `sustitutos_habilitado`, default `false`). Las migraciones de
menu-nativo se **renumeraron a `0037`-`0041`** para convivir con `0036_sustitutos_equivalencia`.
**ADR-049 Fases 0-6 completas** (Motor de Precios v2, flag `motor_precios_v2_habilitado`, default
`false`). **Pendiente:** verificación manual en la app (§12) de las features con UI.

---

## Release actual: R3 — Compras y Crédito (en curso)

---

## Corte multi-rubro — base reutilizable (core + apps por familia) · ADR-091

Track paralelo a los releases R1-R5: reestructurar lo hecho como **base reutilizable** para
disparar apps por familia (Retail, Elaborados, Servicios). Ferretería = primer perfil de Retail.

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Congelar ferretería v1.1.1 (repo `Ferreteria-app`, tag `v1.1.1`) | ✅ |
| 1 | Monorepo en frío: `apps/retail` + `packages/shared`, verde (tag `fase1-monorepo-frio`) | ✅ |
| 2 | Extracción incremental al core: `shared` (baranda B4) → `@core/db` → `@core/ui` → `@core/main`. `@core/preload` **diferido**. Tags `fase2-slice2-core-db`/`-slice3-core-ui`/`-slice5-core-main`. Mergeado a `main` (PR #1). | ✅ |
| 3 | Capa de perfiles de rubro (ferretería + kiosco mínimo, data-driven) | ⏳ pendiente |
| 4 | Docs: guía "cómo nace una app de familia" + reframe de docs del monorepo + numeración ADR | ⏳ pendiente |

**2º consumidor real — Elaborados (heladería), ADR-092/093:** la app `apps/elaborados` disparó la
promoción al core de lo diferido en Fase 2. **E1 (esqueleto + plataforma)** y **E2 (inventario
elaborado: stock/producción/catálogo de venta + `impuesto`→core)** completos, rama `elaborados-e1`
**mergeada a `main`** (PR #2, auto-cerrado por GitHub al detectar que `main` ya contenía sus
commits). Releases de Elaborados: **E1** ✅ · **E2** ✅ · E3a core de venta ✅ (ADR-095, pendiente de merge) · E3b backend de venta ✅ (ADR-096) · E3c-1 core de cobro/ticket/impresión ✅ (ADR-097, pendiente de merge) · E3c-2 POS UI ⏳ · E3d en espera/anulación UI ⏳ · E4
compras/listas/reportes (+ `lista_precio`→core) ⏳. Ver ADR-093. Spec y planes en `docs/superpowers/`.
**Pendiente:** verificación manual navegando ambas apps como Operador y Supervisor (§12).

**Alcance de core (Fase 2):** `@core/db` (esquema universal + migrator), `@core/ui` (design
system + primitivos), `@core/main` (auth/RBAC/validación/seguridad web). **Diferido por
regla-de-tres hasta el 2º consumidor real (Heladería/Elaborados):** AppShell/vistas UI, framework
de preload, handlers de dominio (cliente/caja/proveedor/backup/export), `auth/seed`, y las
barandas B1 (fiscal) y B2 (sync) como implementación. Detalle en `docs/ADR-091` y
`docs/superpowers/plans/2026-09-2*-fase2-*.md`.

---

## Fases completadas

### R1 — Núcleo local ✅

| Fase | Descripción | Tests | Estado |
|------|-------------|-------|--------|
| P1.0 | Bootstrap monorepo: Electron + React + SQLite + Drizzle + vitest, login/sesión, RBAC seed | — | ✅ |
| P1.1 | Esquema completo (migración 0000_init.sql): todas las tablas de R1 | — | ✅ |
| P1.2 | ABM Ubicaciones (UbicacionesDeposito, handler CRUD) | — | ✅ |
| P1.3 | ABM Catálogo: Categorías, Marcas, Productos (lista + detalle + precio) | — | ✅ |
| P1.4 | Stock: MovimientoStock, Existencias, StockListado, modal entrada | 128 | ✅ |
| P1.5 | Localización por QR: escaneo en input, ruta `/localizar`, handler | 157 | ✅ |
| P1.6 | Listas de precios: ABM + motor precio + PrecioPanel en ProductoDetalle | 219 | ✅ |
| P1.7 | Caja: apertura, movimientos, cierre con autorización Supervisor | 244 | ✅ |
| P1.8 | POS/Venta: venta atómica, anulación, hook usePosSession, selector de cliente | 284 | ✅ |
| P1.9 | Importación masiva CSV: wizard 3 pasos, 6 entidades, guard Supervisor | 328 | ✅ |
| P1.10 | Reposición sugerida: vista `/stock/reabastecimiento`, guard doble | 350 | ✅ |
| P1.11 | Dashboard local: bento layout Supervisor, 3 handlers IPC paralelos | 375 | ✅ |
| P1.12 | Exportación CSV/XLSX: 3 capas, 7 entidades, ExportarButton en 4 vistas | 308* | ✅ |

*308 al momento de implementar P1.12; luego subió a 669+ por fixes de calidad.

### Iteraciones de mantenimiento

| Iteración | Descripción | Estado |
|-----------|-------------|--------|
| Iter-01 | 13 bug fixes: POS cursor, Kardex signo, Stock redesign, Config passwords | ✅ |
| Iter-02 | Importación enriquecida: 16 columnas CSV, UPDATE con stock condicional y CPP | ✅ |
| Sonar-01 | Correcciones masivas SonarCloud: 6 BLOCKERs + CC + quality issues (93 archivos) | ✅ |

### R3 — Compras y Crédito 🔄 En curso

| Fase | Descripción | Estado |
|------|-------------|--------|
| P3.0 | Migración 0009: campos domicilio extendido cliente/proveedor | ✅ |
| P3.1 | Utils validación/formato documentos (formatDocumento, validarDocumento, etc.) | ✅ |
| P3.2 | Fix DireccionGeo: dropdown localidad via React portal | ✅ |
| P3.3 | ProveedorForm mejorado: calle/numero/aclaracion, tel adicional, máscara CUIT | ✅ |
| P3.4 | ClienteForm mejorado: ídem Proveedor | ✅ |
| P3.5 | POS: selector de cliente, CCC como forma de pago | ✅ |
| P3.6 | Catálogo geográfico (provincias/departamentos/localidades) — ADR-024 | ✅ |
| P3.7 | SKU interno con check digit Luhn — ADR-025 | ✅ |
| P3.8 | Impresión de etiquetas por lote: perfiles hoja/rollo, code128/QR — ADR-026/ADR-027 | ✅ |
| P3.9 | Realineamiento: auth contraseña, sidebar agrupado, ABM Cat/Marcas, baja clientes — ADR-029..033 | ✅ |
| P3.10 | POS venta en espera: pausar/retomar/descartar, audit fix, F8/F9, banner avisos — ADR-033 | ✅ |
| P3.11 | Módulo Compras completo: Proveedores CRUD, Producto-Proveedor, OC ABM + estados + sugerencias (ADR-017), migración 0005 | ✅ |
| P3.12 | Recepción de mercadería: parcial/total, MovimientoStock automático, CPP actualizado (ADR-018) | ✅ |
| P3.13 | Cuenta corriente de clientes: saldo, límite, cobros, integración POS (forma de pago CCC, validación límite) | ✅ |
| ADR-037 | Dashboard Fase 1: tabs Ventas y Productos con Recharts, selector de período, 7 handlers IPC rango | ✅ |
| ADR-038 | Dashboard Fase 2: tabs Caja, Clientes y Proveedores habilitados con handlers, vistas y migración 0020 | ✅ |
| ADR-039 | Reportes: sección sidebar + Detalle de Ventas (filtros, paginación, VentaDetalleModal, export XLSX) | ✅ |
| ADR-040 | Multi-presentación de venta: tabla `producto_presentacion`, factor en stock/anulación, scan GTIN por presentación, UI POS + ProductoDetalle, setDefault | ✅ |
| ADR-041 | ABM de Unidades: tabla `unidad`, IPC `unidad.*`, vista `/config/unidades`, baja bloqueada con productos | ✅ |
| ADR-042 | Corte de versión v1.0.0 y estrategia de branching pre-R2 | Aceptado |
| ADR-043 | Empaquetado NSIS + seed:base + backup pre-migración + auto-update | ✅ |

### 1.1.0 — Remitos + Presupuestos 🔄 En curso

| Fase | Descripción | Estado |
|------|-------------|--------|
| ADR-045 | Remitos fase interna: schema, numeración RE, IPC `remito:*`, UI `/remitos`, impresión PDF sin importes | ✅ |
| ADR-046 | Presupuestos: schema `presupuesto`/`presupuesto_detalle` (migr. 0025), IPC `presupuesto:*`, emisión con snapshot, job de vencimiento, conversión a Venta, PDF, UI `/presupuestos` | ✅ |
| ADR-047 | Agenda operativa + outbox de avisos, Lote 1: schema (migr. 0026), motor de frecuencia, `aviso.emitir`, adapter `in_app`, scheduler/catch-up, IPC `rutina/agenda/aviso`, UI base | ✅ |
| ADR-048 | Agenda Lote 2: productor "Cierre de caja" + adapter email real (nodemailer), migr. 0027, config SMTP (password en safeStorage), IPC `smtp:*`, pantalla `/config/smtp` | ✅ |
| ADR-049 | Motor de Precios v2: costo neto + reglas de margen + publicación por lote (aprobación/rollback) | ✅ Fases 1-6 completas (costo neto, reglas/redondeo, nav `precios`, batch + `precio.aprobar`, UI de lotes, cierre del circuito de costo, POS). Detrás del flag `motor_precios_v2_habilitado` (default `false`). Falta verificación manual en la app real |
| ADR-078 | Fase 2 mejoras UX (ítems 1-3): stock inicial atómico en el alta (PROD-2), hub "Precios y Costos" con pestañas (PRICE-1), paleta de comandos Ctrl+K (SRCH-1) | ✅ Mergeado a `main` (PR #35). Ítems 4-6 diferidos a Fase 2b. Hub **encendido de fábrica** vía migración 0043 (`hub_precios_habilitado='true'`). Falta verificación manual en la app |
| ADR-061 | Pantalla de Funcionalidades: `/config/funcionalidades` (grupo Sistema, `config.fiscal`) para prender/apagar feature flags con auto-descubrimiento (`parametros:listFlags`); migración 0044 enciende los 3 flags restantes | ✅ Implementado en rama `feat/pantalla-funcionalidades`. **Todos los feature flags encendidos de fábrica** tras esta tanda. Falta verificación manual en la app |
| ADR-079 | Fase 2b mejoras UX (ítems 4-6): links de vuelta al producto en Kardex/LoteDetalle (NAV-2), alta express `productoQuickCreateHandler` + `AltaExpressModal` desde POS y OC (PROD-3), auto-bloqueo por inactividad (SEC-3: migr. 0045, `auth:verifyPassword`, `useIdleLock`/`PantallaBloqueo` en AppShell, flag `bloqueo_inactividad_habilitado` en Funcionalidades) | ✅ Implementado en rama `feat/fase2b-mejoras-ux`. Cierra la Fase 2. Auto-bloqueo **apagado de fábrica**. Falta verificación manual en la app |
| ADR-080 | Fase 3 mejoras UX (PERF-1 + NAV-3): inicio personalizable por usuario (`pantalla_inicio`) + favoritos de navegación (`favoritos` JSON) sobre `usuario_preferencias`, flag `inicio_personalizable_habilitado` (default `false`), `InicioRedirect` en la ruta índice, estrella inline + grupo "Favoritos" en el sidebar; NAV-3: aligerar sidebar en dos grupos separados (Configuración operatoria / Sistema) e imports al hub de Precios (o "Sistema" como fallback) | ✅ Implementado en rama `feat/adr080-inicio-favoritos-nav3` (TDD, renderer 793 + main 1232 tests verdes). Flag `inicio_personalizable_habilitado` **apagado de fábrica**. Falta verificación manual en la app. Ítems SEC-2/SRCH-2-3/PERF-2/PERF-3/BUG-2/PRICE-4 de Fase 3 quedan para otras sesiones |
| ADR-083 | Ajustes varios (4): (A) botón "+ Agregar proveedor" en `ProveedoresPanel` con auto-preferido/checkbox; (B) alta masiva de productos en el proveedor vía `ProveedorAgregarProductosModal` + handler `asociarLote`, se quita la búsqueda del toolbar; (C) "Importar datos" al tope de Configuración; (D) `cliente.lista_precio_id` con UI (selector en `ClienteForm`, badge en `ClienteDetalle`, persistencia en `clienteUpsertHandler`) | ✅ Implementado en rama `feat/adr083-ajustes-varios` (TDD subagentes, main 1326 + renderer 866 verdes). Sin migraciones ni flags. Falta verificación manual en la app. A queda Supervisor-only (guard `proveedor.gestionar`) |
| ADR-084 | Revisa ADR-083 §B: el alta masiva de productos en el proveedor pasa de **modal** a **pantalla completa** que reemplaza la lista del tab (early-return en `ProveedorProductosTab`; componente `ProveedorAgregarProductosModal`→`Panel`). Sin cierre por Escape/click-afuera (perdía la carga); única salida "← Volver" o confirmar | ✅ Implementado en rama `feat/adr084-alta-productos-pantalla-completa` (TDD, renderer verde incl. swap del tab). Solo UI, sin migraciones ni handlers. `asociarLote` intacto. Falta verificación manual en la app |

---

## Próximas fases (backlog confirmado)

- **1.1.0 — Remitos + Presupuestos** (ADR-044): features nuevas, sin ARCA ni nube, en
  `main` detrás de flags independientes. Orden de trabajo: **Remitos primero**
  (fase interna, sin CAE; fase 2 de integración ARCA queda atada al avance real de R2),
  luego Presupuestos (cotización → conversión a Venta). Cada una con su propio ADR/diseño.
  → **Remitos ✅ implementado** (rama `feat/adr-045-remitos`, flag `remitos_habilitado`
  en `false`). Siguiente: diseño de Presupuestos.
- **1.2.0 — R2 fiscal**: facturación AFIP/ARCA (ADR-013 pendiente), CAE, comprobantes A/B/C
- **R3** restante: CCteProv diferida (ADR-019), comprobantes de compra (tabla existe, sin UI)
- **2.0.0 — R4** nube + sync: backend Node + PostgreSQL, outbox, conflictos (ADR-012)
- **R5** reportes consolidados, preparación multi-sucursal

---

## Stack

- **Cliente**: Electron 32 + React + TypeScript
- **DB local**: SQLite vía Drizzle ORM
- **Monorepo**: pnpm workspaces (`packages/client`, `packages/shared`)
- **Tests**: Vitest

---

## ADRs de arquitectura

| ADR | Título | Estado |
|-----|--------|--------|
| 001 | Arquitectura offline-first con SQLite como fuente de verdad local | Aceptado |
| 002 | Stack TypeScript de punta a punta | Aceptado |
| 003 | Sincronización por outbox e idempotencia | Aceptado |
| 004 | Lector 1D/2D inalámbrico en lugar de captura móvil | Aceptado |
| 005 | QR único por producto; ubicación como atributo | Aceptado |
| 006 | Patrón saldo + libro de movimientos inmutable | Aceptado |
| 007 | Categoría autorreferenciada (N niveles) | Aceptado |
| 008 | Modelo RBAC con dos roles (Operador / Supervisor) | Aceptado |
| 009 | Listas de precios por porcentaje con signo | Aceptado |
| 010 | Redondeo a $1 sobre el total con ajuste de redondeo | Aceptado |
| 011 | Entrega incremental en cinco releases | Aceptado |
| 012 | Política de resolución de conflictos de sincronización | Aceptado |
| 013 | Ubicación de la integración fiscal (cliente vs nube) | Propuesto (pendiente R2) |
| 014 | Unidad de compra vs. unidad de venta (factor de conversión) | Aceptado |
| 015 | Formato de impresión de etiquetas y comprobantes | Aceptado |
| 016 | ORM y herramienta de monorepo | Aceptado |
| 017 | Reabastecimiento desacoplado de OC; modo manual y sugerido | Aceptado |
| 018 | Actualización de costo de referencia en recepción de mercadería | Aceptado |
| 019 | Cuenta corriente de proveedores fuera de scope de R3 | Aceptado (diferida) |
| 020 | Sección "Proveedores" en Detalle de Producto (excepción phase-gate R1) | Aceptado |
| 021 | Política de Backup — motor, cifrado y redundancia 3-2-1 | Aceptado |
| 022 | Restore atómico con validación de esquema | Aceptado |
| 023 | Integración nativa con Google Drive (diferida a R4) | Diferida |
| 024 | Catálogo geográfico normalizado para validación offline de direcciones | Aceptado |
| 025 | Formato de SKU interno y modelo de códigos del producto | Aceptado |
| 026 | Módulo aislado de impresión de etiquetas por lote (excepción phase-gate R3) | Aceptado |
| 027 | Implementación etiquetas: perfiles, IPC `etiquetas:*`, pantalla `/etiquetas` | Aceptado |
| 034 | Motor de Precios con Vigencia y Auditoría Histórica | Cerrado |
| 035 | Importación de listas de costo de proveedor | Cerrado |
| 036 | Panel de proveedores en ProductoDetalle — tabla densa + toggle preferido | Cerrado |
| 037 | Dashboard tabbed: Ventas y Productos con selector de período y Recharts | Aceptado |
| 038 | Dashboard Fase 2: Caja, Clientes y Proveedores | Aceptado |
| 039 | Reportes: sección sidebar + Detalle de Ventas con filtros, paginación y exportación XLSX | Aceptado |
| 040 | Multi-presentación de venta (producto_presentacion, factor_a_stock, scan resolution) | Aceptado |
| 041 | ABM de Unidades (tabla unidad, IPC unidad.*, vista /config/unidades) | Aceptado |
| 042 | Corte de versión v1.0.0 y estrategia de branching pre-R2 | Aceptado |
| 043 | Empaquetado NSIS (electron-builder), seed:base idempotente, backup pre-migración, auto-update electron-updater | Aceptado |
| 044 | Corrección del mapa de versiones: Remitos + Presupuestos toman 1.1.0, fiscal ARCA pasa a 1.2.0 | Aceptado |
| 045 | Módulo de Remitos (documento de entrega interno, opt-in, no mueve stock, numeración RE) | Aceptado — implementado |
| 046 | Módulo de Presupuesto (cotización previa a la venta, opt-in, snapshot al emitir, conversión a Venta) | Aceptado — implementado |
| 047 | Agenda operativa y outbox de avisos | Aceptado — Lote 1 implementado |
| 048 | Agenda operativa y outbox de avisos Lote 2 (cierre de caja + adapter email) | Aceptado — implementado |
| 049 | Motor de Precios v2: costo neto, reglas de margen y publicación por lote | Aceptado |
| 051 | Mejoras a la carga masiva (importación de costos y catálogo de proveedor) | Aceptado — implementado |
| 064 | Ubicaciones: identidad canónica (normalización) + ABM completo en Configuración con exportación | Aceptado — implementado |
| 065 | Robustez del importador de productos: booleano canónico, idempotencia sin EAN, cobertura total de campos e informe de carga parcial | Aceptado — implementado |
| 066 | Correcciones de UX y regresiones: presentaciones (eliminar/reactivar), recepción parcial de OC y búsqueda por EAN (scroll descopeado por no reproducible) | Aceptado — implementado |
| 069 | Lote UI/UX: "clic en toda la fila abre detalle" en listados restantes, restyle de Sinónimos y POS, ajustes de Etiquetas/Ventas/Transportistas y reubicación de Sinónimos en el menú | Aceptado — implementado |
| 077 | Fase 1 mejoras UX (6 ítems): feedback central (`ToastProvider`/`useToast`/`callIpc`), traductor de errores, validación inline en `ProductoForm`, fix del hook `useFilaNavegable`, breadcrumb jerárquico clicable (`buildBreadcrumb`) y endurecimiento del main (nav guard + CSP en prod, `main/security/webSecurity.ts`) | Aceptado — implementado |
| 074 | Sustitutos curados entre productos (equivalentes + reemplazos) y flag `discontinuado` | Aceptado — Fase 1 implementada |
| 075 | Match canónico de ubicación en el import de productos (ceros a la izquierda + case-insensitive) | Aceptado — implementado |
| 078 | Fase 2 mejoras UX (ítems 1-3): stock inicial en el alta, hub Precios/Costos, paleta Ctrl+K | Aceptado — implementado |
| 061 | Pantalla de Funcionalidades para administrar feature flags (auto-descubrimiento) | Aceptado — implementado |
| 079 | Fase 2b mejoras UX (ítems 4-6): links de vuelta al producto, alta express, auto-bloqueo por inactividad | Aceptado — implementado |
| 080 | Fase 3 mejoras UX (PERF-1 + NAV-3): inicio personalizable + favoritos y reorganización del sidebar | Aceptado — implementado |
| 081 | Fase 3 mejoras UX (SRCH-2/3 + PERF-2 + BUG-2/PRICE-4): `SearchBox` unificado + persistencia de filtros, vistos recientemente (flag), higiene de código muerto y reporte de errores descargable en importaciones | Aceptado — implementado (TDD). SEC-2 y PERF-3 fuera de alcance |

> Detalle completo en `docs/ADR-Log-ferreteria.md`. **Nota:** esta tabla saltea 052–063 (el
> ADR-Log está más adelantado que este Estado; pendiente de reconciliar).

---

## Convenciones técnicas vigentes

- **NMV:** Electron 32 = NMV 128; Node 24 sistema = NMV 137. `pnpm rebuild:electron` antes de dev, `pnpm rebuild:node` antes de tests.
- **Tests renderer:** `vitest run` bajo jsdom (rápidos, sin módulos nativos).
- **Tests main:** `node scripts/test-node.cjs` bajo Electron (`ELECTRON_RUN_AS_NODE=1`).
- **IPC:** todo bajo `window.ferreteria.<namespace>.*`. Namespaces activos: `catalogo`, `stock`, `caja`, `pos`, `precios`, `config`, `backup`, `restore`, `geo`, `export`, `importar`, `etiquetas`, `reportes`, `unidad`, `presentacion`, `remito`, `presupuesto`.
- **Precios:** centavos en toda la lógica; formateo solo en render.
- **Migraciones:** `packages/client/src/main/db/migrations/`. Última: `0025_adr046_presupuesto.sql`.
  El `meta/_journal.json` se mantiene **a mano**: la entrada nueva necesita un `when`
  mayor al de la última, o Drizzle saltea la migración.
- **Permisos nuevos:** `runSeed` corre en **cada** arranque (`startup.ts` §3). Agregar un
  permiso a `PERMISOS` en `auth/seed.ts` alcanza para que llegue también a instalaciones
  ya inicializadas. Antes vivía dentro del guard de primer arranque y no llegaba nunca.
- **Permisos:** guard doble (renderer + IPC handler). Permiso `import.masiva` solo Supervisor.
- `seed:dev` tiene workaround NMV; solución limpia pendiente (correr vía electron main process).

---

## Decisiones abiertas

- ADR-013: ubicación integración fiscal (cliente vs nube) — decidir en R2.
- Comportamiento de venta POS que excede límite de crédito (bloquear vs. override de supervisor).
- Cobro en efectivo sin caja abierta (recomendado: bloquear).
- Pantalla de Parámetros del sistema: no existe todavía. Falta definir qué parámetros de `parametros_sistema` son editables desde UI (vs. solo seed/valor fijo) antes de agregarla al sidebar. Sacada del grupo Configuración en ADR-030 hasta que se especifique con su propio ADR.
- Unidades: conversión y multi-presentación diferidas → cerrado en ADR-040/ADR-041.
- **Revocación de permisos vs. `runSeed` en cada arranque.** `runSeed` es aditivo: si
  algún día se agrega una UI para quitarle un permiso a un rol, el siguiente arranque se
  lo volvería a otorgar. Hoy no hay conflicto (roles `es_sistema`, matriz RBAC fija). Al
  construir esa UI, el seed va a necesitar distinguir "nunca se otorgó" de "se revocó a
  propósito" — p. ej. una tabla de revocaciones explícitas.
- **Remitos: alcance del feature flag.** `remitos_habilitado` gatea solo la UI; el
  namespace IPC `remito:*` responde igual con el flag apagado. Definir si los flags de
  feature deben gatear también el registro de handlers en el main.

- ADR-047:
- Read/unread para avisos `in_app` (`leido_at`) — arranca sin unread.
- Retención del log de avisos (`aviso_retencion_dias`).
- Bajo mínimo: digest diario vs event-driven en el cruce (arranca digest).
- Grilla mensual de agenda (diferida; requiere proyección de fantasmas).

- ADR-048
- Plantilla del email de avisos (texto plano v1; HTML diferido).
- Valor default de `arqueo_diferencia_alerta_centavos` (a confirmar con el comercio).

---

## Bitácora de decisiones

- `2026-09-28` — **ADR-093 — Elaborados E2 (inventario elaborado) implementado y mergeado a `main`.**
  Spec propio (`docs/superpowers/specs/2026-09-24-elaborados-e2-inventario-design.md`) → plan de
  7 slices/26 tasks → ejecución con `superpowers:subagent-driven-development` (implementador +
  spec reviewer + code reviewer por task, todo en una sesión, sin worktree por el costo de rebuild
  nativo de `better-sqlite3`) → revisión holística final del diff completo antes de mergear. Stock
  (`articulo`/`existencia_articulo`/`movimiento_articulo`, costo promedio ponderado,
  `bloquea_sin_stock` configurable por artículo), Producción (`receta_produccion`/`produccion`
  transaccional, anular vía `verificarSupervisor`), Conteo/merma (sin handler nuevo), Catálogo de
  venta (`categoria_venta`/`producto_venta`/componentes/`grupo_modificador`/opciones, con
  `calcularConsumo`/`validarStock` puras para que las use E3), `impuesto`→`@core/db` (Retail
  re-apuntado sin cambio de comportamiento). Seed demo de heladería bajo demanda. La revisión
  holística final (que un proceso task-por-task no puede ver por construcción) encontró y corrigió
  dos bugs de datos antes de mergear: `movimiento_articulo.tipo` derivado del signo en vez del
  motivo, y una FK faltante en `producto_venta.impuesto_id` por una hipótesis incorrecta sobre
  límites de Drizzle. Un bug de UX (modales con `try/finally` sin `catch` → fallo silencioso)
  apareció 4 veces durante la ejecución y se corrigió cada vez — guardado como lección propia en
  memoria para no repetirlo en E3/E4. **Gates: Elaborados renderer 67/67 · Elaborados main 65/65 ·
  Retail sin cambios (140 archivos/1591 tests + renderer) · core-db/core-main typecheck limpio.**
  Merge: push de `elaborados-e1` → PR #2 actualizado → merge local fast-forward a `main` → push de
  `main` → GitHub auto-cerró el PR #2 al detectar que ya estaba contenido. Quedaron 5 tareas de
  fondo de bajo riesgo sin ejecutar (ver ADR-093 §Consecuencias). **Pendiente:** verificación
  manual navegando ambas apps (§12) — no se pudo hacer desde la sesión (sin herramientas de
  interacción con la GUI de Electron). → siguiente: click-through manual, luego E3 (venta/POS).

- `2026-08-26` — **ADR-075 — Match canónico de ubicación en el import de productos.** El import
  masivo de productos resolvía la columna `ubicacion` por igualdad exacta de string contra el
  `codigo` guardado, así que `A-1-3` no matcheaba una ubicación legacy guardada como `A-01-03`
  (creada antes de la canonicalización de ADR-064) ni toleraba mayúsculas/minúsculas. Fix TDD:
  nueva pura `canonicalizarCodigoUbicacion` en `@ferreteria/shared` (misma regla que ADR-064
  sobre un código ya formado) y, en `importar.ts`, `buildUbicacionMap` keyea el mapa por forma
  canónica (prefiriendo la fila canónica ante duplicados legacy) mientras el lookup canonicaliza
  el valor del CSV. El producto se **asigna** a la ubicación existente; no reescribe el código
  legacy (eso lo cubre "Detectar duplicados"). Sin migración/permisos/schema. Suite:
  **`ubicacion.test.ts` 9/9 + renderer 687 + main 1162 verdes**, typecheck limpio. → pendiente
  verificación manual (`pnpm dev`).

- `2026-08-26` — **Integración a `main` + limpieza de ramas + rescate de features ui-pos.**
  Sesión de consolidación. (1) **Merge** de `feat/menu-nativo` (subsume la cadena ADR-063→073:
  menú nativo, sinónimos/matching, ubicaciones canónicas, importador robusto, fixes UX, reuso
  GTIN, UI/UX de listados, Costo bruto + Re-validar, listados de precios, redondeo Ajuste de
  Stock, búsqueda por similitud) sobre `main` (ADR-074 sustitutos): 4 conflictos resueltos
  —migraciones de menu-nativo renumeradas `0036-0040`→`0037-0041` manteniendo `0036_sustitutos`;
  `producto.ts` conserva ambos handlers; docs combinados—. (2) **Merge** del manual de usuario
  (11 guías HTML). (3) **Limpieza:** 22 ramas mergeadas/subsumidas borradas; worktrees obsoletos
  des-registrados (quedan `main` + 4 ramas de julio reservadas). (4) **Rescate de
  `feat/ui-pos-export-login-escape`** (98 commits detrás, ~90% ya superado por la cadena ADR):
  se portó lo genuinamente faltante — **ver contraseña** (`PasswordInput`), **Escape** unificado
  (`useEscapeAction` con pila LIFO; `useEscapeToClose` pasa a ser su wrapper; +Escape en 5
  pantallas de detalle y 2 modales que faltaban), regla **`MEDIO_PAGO_DUPLICADO`** al confirmar
  venta (+ guard en el modal), y 3 campos (Marca, Descripción larga, Stock máx.) en el export
  Completo de Productos. POS multi-pago y diseño ya estaban en main (ADR-032/056/069). Suite:
  **shared 132 + renderer 687 + node 1160 verdes**, typecheck limpio. **`main` local = 81 commits
  ahead de `origin/main`, sin push.** → siguiente: verificación manual en la app (`pnpm dev`) y
  push; luego decidir sobre las 4 ramas de julio restantes (Fase 5).

- `2026-08-25` — **ADR-074 Fase 1 (fundación) implementada — Sustitutos curados.** Rama
  `feat/sustitutos-curados` (sobre `main`), TDD, detrás del flag `sustitutos_habilitado`
  (default `false`). Relaciones **curadas** producto↔producto, complementarias al matcher de
  similitud automático (ADR-063/067/073): dos tipos, `equivalente` (simétrico) y `reemplazo`
  (direccional A→B), en tabla nueva `producto_equivalencia` (una fila dirigida por relación,
  soft-delete por `deleted_at` como `producto_proveedor`); más columna `producto.discontinuado`
  (marca al producto viejo sin impedir la venta hasta agotar stock). Servicio
  `catalogo.producto.equivalencia.{list,add,remove}` + `setDiscontinuado`, session-gated
  (permiso `producto.editar` gateado en el renderer, sin permisos nuevos); `list` devuelve tres
  grupos enriquecidos con precio final (via `getPrecioEnListaHandler` × factor de presentación
  default), stock, marca y `discontinuado`, excluyendo relacionados inactivos; integridad en el
  handler (sin auto-relación / duplicado / inversa duplicada de equivalente). UI: `EquivalenciasPanel`
  en `ProductoDetalle` (ABM por buscador + toggle discontinuado). Migración **`0036_sustitutos_equivalencia.sql`**
  (originalmente `0036`; al integrar `feat/menu-nativo` se **mantuvo `0036_sustitutos` y se renumeró
  la cadena de menu-nativo a `0037`-`0041`**). **574 renderer + 1030 node verdes** (pre-merge), typecheck limpio. **Pendiente:**
  verificación manual en la app real y **Fase 2** (consumidores: POS ofrece alternativa al elegir un
  producto discontinuado/sin stock, badge en el listado de Catálogo, sugerencia en Presupuesto).
  → siguiente: verificación manual + plan de Fase 2.

- `2026-08-24` — **Documentación de usuario: 11 guías HTML + índice + manual completo.**
  No es una decisión de arquitectura ni toca código de producción — se registra acá (no en
  el ADR Log, que es estrictamente para decisiones de arquitectura, §0) para dejar rastro
  del trabajo. Generado en `docs/Documentacion/Usuario/guias/`: una guía por módulo (POS,
  Caja, Presupuestos y Remitos, Clientes/Cuenta Corriente, Catálogo de Productos, Stock,
  Abastecimiento, Precios/Costos, Reportes y Dashboard, Agenda, Configuración/Sistema),
  cada una con **capturas reales** tomadas vía Chrome DevTools Protocol contra la app
  corriendo (`pnpm dev`), **diagramas de flujo en SVG** y **FAQs** — contenido verificado
  contra el código fuente (schema, handlers IPC, componentes), no inventado. `index.html`
  (vista de tarjetas por módulo) y `manual-completo.html` (las 11 guías concatenadas en un
  documento navegable, con IDs prefijados por módulo para evitar colisiones) enlazan todo.
  Sidebar de navegación fijo con scroll-spy (`IntersectionObserver` + auto-scroll del ítem
  activo) en las 12 páginas, patrón provisto por el usuario. Ronda de correcciones por
  feedback del usuario: superposición/mala dirección de flechas en 5 diagramas SVG
  (POS, Caja, Abastecimiento, Precios/Costos ×2, Agenda), recorte de capturas
  sobredimensionadas, zoom con lightbox (delegación de eventos, sin colisión de IDs al
  concatenar) en capturas chicas de Catálogo/Abastecimiento, y FAQs faltantes agregadas en
  Precios/Costos. **Sin cambios de código de producción, sin migraciones.**
  → siguiente: nada pendiente de esta sesión.
- `2026-08-18` — **ADR-066 implementado (paraguas de fixes de UX/regresiones, lote 064-066).**
  Brainstorm → ADR en `docs/ADR-Log-ferreteria.md` → plan
  (`docs/superpowers/plans/2026-08-18-adr-066-fixes-ux-regresiones.md`) → TDD por ítem (subagent-driven,
  review de spec + calidad por tarea). **Sin migraciones.** Rama `feat/adr-066-fixes-ux-regresiones`.
  **Tres ítems** (el 4º del lote —scroll en previews— se **descopeó por no reproducible**: el chain de
  scroll del preview es correcto y sin cambios desde antes del reporte; systematic-debugging, no se
  arregla lo que no se reproduce):
  **(2) Recepción parcial** (`9e53585`,`292e8dc`): `RecepcionView` deja de clampear en `onChange`
  (guarda crudo) y clampa en `onBlur`, normalizando vacío/inválido → `'0'` (evita descarte silencioso del
  ítem en el submit). Test 10→4→(6 pend.) + edición sin revertir (8/8).
  **(1) Presentaciones** (backend `837bd3a`,`26ff900`; UI `69953a9`,`b5756ed`): `presentacion:eliminar`
  (físico si sin historial en las 4 FK / baja lógica si tiene; bloquea la default) + `presentacion:reactivar`
  (excluye el propio id en la colisión GTIN); panel con reactivar/eliminar por fila + `confirm()` + ícono
  papelera; la default sólo Editar. 21/21 backend + 4/4 UI.
  **(3) Búsqueda por EAN** (`0d8ec31`,`65939c8`): `like(gtin_barcode)` en `buildProductoWhereClause` **y**
  `productoQueryAll` (listado + exportación consistentes); placeholder actualizado; test previo invertido.
  59/59. Los reviews cerraron 3 huecos que el research no vio (pérdida silenciosa de datos en recepción,
  self-collision GTIN, EAN faltante en exportación). `tsc` limpio. **Hallazgo abierto (requiere schema,
  fuera de ADR-066):** `ux_pp_gtin` no condiciona por `activo` → dar de baja no libera el GTIN para reuso.
  → siguiente: **verificación manual en la app** (`pnpm dev`) y decidir merge/PR de la rama.

- `2026-08-18` — **ADR-065 implementado (robustez del importador de productos).** Brainstorm →
  gate de clave de matching cerrado **sin migración** → plan escrito
  (`docs/superpowers/plans/2026-08-18-adr-065-importador-productos-robustez.md`) → TDD por lotes
  (subagent-driven) → review final APROBADA. Rama
  `feat/adr-065-importador-productos-robustez` (sobre `feat/adr-064-ubicaciones-canonicas`).
  **L1:** parser booleano canónico `parseBooleanoImport` en `@ferreteria/shared`
  (`si/sí/s/true/verdadero/v/1/x` = true; `no/n/false/falso/f/0` = false; vacío = default por
  campo; token desconocido = error de fila) — cierra el bug `activo="si"` → invisible; reemplaza
  las tres formas divergentes (`activo`/`permite_fraccion`/`habilita_cuenta_corriente`).
  **L2:** cascada de identidad en `validarFilaProducto` — `sku` (columna opcional de plantilla) →
  `gtin_barcode` → detección blanda por `nombre_corto_norm`(+`marca_id`); SKU inexistente =
  `SKU_INEXISTENTE`, match por nombre sin SKU/EAN = `POSIBLE_DUPLICADO` (intra-archivo + BD, nunca
  alta/fusión silenciosa); cierra el triplicado sin EAN. **L3:** informe de carga parcial
  (`useImportar` fusiona rechazadas; Total = Importados + Rechazados). **L4:** test golden
  ida-y-vuelta de las 20 columnas (atrapa el falso "no tomó stock máx/mín"). **Fix de review:**
  `nombre_corto_norm` sincronizado en el UPDATE. **Sin migraciones.** **589 renderer + 1109 node +
  126 shared verdes**, `tsc` limpio. → siguiente: **verificación manual en la app real**
  (`pnpm dev`, §Cierre del plan) antes de mergear; luego ADR-066 del mismo lote.

- `2026-08-18` — **ADR-064 implementado (Ubicaciones: identidad canónica + ABM completo +
  exportación).** Brainstorm → gate de datos aprobado → plan escrito
  (`docs/superpowers/plans/2026-08-18-adr-064-ubicaciones-canonicas.md`) → TDD por lotes
  (subagent-driven). **Sin migraciones de schema** (al persistir la forma canónica, las
  unicidades existentes `codigo` y `(sector,estante,posicion)` pasan a ser efectivas).
  **L1:** función pura `canonicalizarUbicacion` en `@ferreteria/shared` (`trim → upper → sacar
  ceros a izquierda en segmentos all-dígitos`, sin padding); alta manual canonicaliza, pisa lo
  tipeado y rechaza colisión con `YA_EXISTE`; importación matchea por `codigo` canónico y
  colapsa duplicados. **L2:** `ubicacion:delete` (baja lógica; con productos reasigna
  `producto.ubicacion_id` a otra ubicación o `null` y recién da de baja) + `ubicacion:list-all`;
  pantalla nueva `UbicacionesView` en Configuración (ruta + NAV sin permiso = ambos roles +
  CRUMB) con ABM + `ExportarButton` (reusa el descriptor `exportUbicaciones` ya cableado).
  **L3:** `ubicacion:dedup:preview`/`:aplicar` gateados por `usuario.administrar` (Supervisor):
  agrupa por canónica, elige sobreviviente, reasigna productos y da de baja las duplicadas; UI
  "Detectar duplicados" con preview. **2 bugs latentes corregidos con cobertura:** (1)
  `confirmarUbicaciones` hacía `UPDATE ... WHERE id = undefined` (0 filas, silencioso) para
  duplicados intra-archivo → ahora resuelve por `codigo` (last-write-wins) con guard `NO_MATCH`;
  (2) el subquery `cantidad_productos` interpolaba `${ubicacion.id}` como `"id"` pelado, que
  SQLite ligaba a `producto.id` → conteo siempre 0 (afectaba exportación y aviso de baja), ahora
  califica `ubicacion.id`. **588 renderer + 1099 node verdes**, `tsc` limpio. Rama
  `feat/adr-064-ubicaciones-canonicas`, **PR #16** a `feat/adr063-067-sinonimos-matching`.
  → siguiente: **verificación manual en la app real** (`pnpm dev`, recorrido §7 del plan) antes
  de mergear; luego ADR-065/066 del mismo lote.

- `2026-08-17` — **Lote de mejoras y correcciones organizado en 3 ADR (064–066), Propuestos —
  sin implementar.** Surge de probar la app con datos reales.
  (064) Ubicaciones no normaliza ceros a izquierda → `A-0-1` y `A-0-01` quedan como filas
  distintas (`ubicacion.ts`/`importar.ts` insertan crudo); se decide identidad canónica de
  sector/estante/posición + ABM completo (listar/editar/agregar/**eliminar** — hoy no hay
  `ubicacion:delete`) con exportación. **Gate de datos** para deduplicar lo ya cargado.
  (065) Importador de productos: `activo="si"` crea el producto **inactivo** (bug en
  `importar.ts:207`) y las filas sin EAN se re-insertan en cada corrida (duplicados) →
  booleano canónico, idempotencia sin EAN, cobertura total de campos y política "todo-o-nada".
  **Gate** por la clave de matching.
  (066) ADR paraguas de correcciones sin cambio de arquitectura: presentaciones sin
  eliminar/reactivar (basura en el listado), **regresión** de recepción parcial de OC (no
  deja editar la cantidad recibida), scroll roto en previews de importación (Artículos) y
  búsqueda de productos por EAN.
  Numeración desde 064 porque el ADR-Log ya llega a 063 (Estado estaba desalineado, corte
  previo en 051).
  → siguiente: correr el brainstorming de Superpowers con el prompt del lote; redactar los
  3 ADR como Propuesto; frenar en los gates de 064 y 065.

- `2026-07-30` — **ADR-051 implementado (mejoras a la carga masiva).** Surgió de probar
  Importar Costos sobre datos reales. Cambios principales: (1) **formato fijo por nombre de
  columna** (`EAN · COD_PRODUCTO_PROV · COD_INTERNO · DESCRIPCION · COSTO`), se elimina el
  mapeo configurable de ADR-035 (`proveedor_importacion_config` queda muerta); (2) **matching
  estricto al proveedor** (solo productos ya vinculados) con cascada EAN → código del producto
  del proveedor → código interno, y re-matching real al editar; (3) **persistencia diferida**:
  nada se graba hasta Confirmar, preview persistente vía Context, cancelar instantáneo — así no
  se ensucia Histórico/Cola de Revisión antes de tiempo; (4) **validación cruzada** por código
  del producto del proveedor (advertencia) + **detección de duplicados**; (5) **Histórico** con
  desglose en vivo consistente (Total = Identificados + Rechazados + Pendientes) y detalle que
  incluye resuelto_manual/descartado; (6) **Importar catálogo de proveedor** (pantalla nueva,
  `/precios/importar-catalogo-proveedor`): establece la relación producto↔proveedor con matching
  global y **preferido no destructivo** (solo si el producto no tenía ninguno); (7) UX: ventana
  maximizada al inicio, reorden del sidebar, "Importar datos" a Configuración, drag&drop retirado.
  **504 renderer + 970 node verdes.** Rama `feat/adr-051-mejoras-carga-masiva`, PR a `main`
  (jsinesi-hash/ferreteria-app#4). Pendiente: checkbox de "preferido en bloque" (diferido por el
  PO) y verificación manual del catálogo con datos reales.
  → siguiente: revisar/mergear el PR; retomar el borrador ADR-050 (costos reales de compra en OC).

- `2026-07-25` — **Bug pre-existente corregido: scheduler de `cambio_programado` en
  crash-loop.** Al abrir la app con una fila `cambio_programado` pendiente con
  `base_calculo='lista'` y `base_lista_id=null`, `applyPendingCambiosProgramados` fallaba
  cada arranque y cada hora (log de error, sin romper la app). Causa raíz: `RecalcularModal`
  deja elegir «Otra lista de precios» como base de cálculo pero nunca ofrece (ni envía)
  `base_lista_id` — cualquier fila programada con esa combinación queda inválida para
  siempre. Fix en `scheduler/precios.ts`: detecta el caso inválido y **cancela** la fila
  (`estado='cancelado'`) en vez de reintentar por siempre. No es parte del ADR-049 (bug del
  scheduler legado), pero se corrigió en el mismo lote porque bloqueaba la verificación
  manual. Test nuevo en `scheduler-precios.test.ts`.

- `2026-07-25` — **ADR-049 Fases 5 y 6 implementadas — Motor de Precios v2 completo.**
  TDD, detrás del flag `motor_precios_v2_habilitado`; con el flag off (y toda lista en
  `pct_sobre_lista`, su default) el comportamiento es idéntico al actual.

  **Fase 5 — cierre del circuito de costo** (`main/precios/motor.ts`:
  `crearBatchesPorEventoDeCosto`, núcleo compartido `crearBatchInterno` refactorizado de
  `crearBatch`): genera un batch en **borrador** por cada lista en modo `margen_costo`
  (nunca publica), disparado desde:
  - `importacionCostoConfirmarHandler` (`referencia_tipo='importacion_costo_proveedor'`),
    ahora devuelve `{ batches: [...] }`.
  - `productoProveedorSetPreferidoHandler` / `proveedorProductosActualizarHandler` (cambio
    de preferido), acotado a ese producto (`SUPPLIER_CHANGE`).
  - `recepcionCrearHandler`, cuando el operador carga un costo real distinto.
  - `proveedorUpsertHandler`, al editar un default comercial (bonificación/costo
    financiero/flete), acotado a los productos donde ese proveedor es preferido.
  UI: `ImportarCostosView` gana el bloque **«Se generó el lote #N»** + botón **Revisar
  lote →** por cada batch, y **«Importar faltantes»** (reabre el flujo con el proveedor
  precargado). Todos los disparadores están en `try/catch` — un fallo al generar el batch
  nunca revierte la operación de costo que lo originó.

  **Fase 6 — POS** (la más sensible, va detrás del flag):
  - `getPrecioEnListaHandler` acepta `clienteId` opcional; nuevo
    `resolverListaEfectiva()` resuelve `cliente.lista_precio_id → listaId` (fallback,
    la predeterminada que ya resolvía el caller).
  - `usePosSession.addLinea` pasa el `clienteId` actual; nuevo efecto **repregunta el
    precio de todas las líneas al cambiar de cliente** con el carrito armado.
  - `ventaConfirmarHandler` **re-resuelve el precio en el servidor** contra la lista
    efectiva del cliente y rechaza con `PRECIO_DESACTUALIZADO` si difiere del recibido,
    salvo autorización de Supervisor (mismo patrón que el override de límite de crédito,
    `verificarSupervisor`). Sin lista predeterminada configurada, no valida (no rompe
    instalaciones sin `lista_precio` aún).
  - El movimiento de stock de la venta pasa a guardar `costo_unitario` = costo neto del
    momento del proveedor preferido (antes `null`), vía `resolverCostoNetoProducto`
    (nuevo, exportado de `motor.ts`) — habilita margen real por venta para el Dashboard.

  **1368 verdes** (449 renderer + 919 node) + 102 shared. Typecheck limpio. Sin migraciones
  nuevas (Fases 5-6 son wiring, no tocan schema).
  **Motor de Precios v2 queda completo de punta a punta** (costo → margen → validación →
  aprobación → publicación → cierre automático del circuito → POS). **Falta verificación
  manual en la app real** — reiniciar `pnpm dev` (cambió proceso main) y activar el flag.
  → siguiente: verificación manual del circuito completo con datos reales.

- `2026-07-24` — **ADR-049 Fase 4 (UI de lotes) implementada**, TDD, detrás del flag. Vistas
  nuevas `precios/LotesPreciosView` (listado con filtro de estado, default «Activos»; columnas
  lista/origen/estado/OK-Adv-Err/impacto) y `precios/LoteDetalleView` (reporte de impacto en KPIs,
  tabla con costo neto / precio anterior / nuevo / margen / variación / regla / validación, buscador
  + filtro por estado de validación, acciones por estado y permiso). El botón **Aprobar** queda
  deshabilitado con ≥1 error **y muestra el motivo al lado** («excluilas para poder aprobar»);
  aprobar/publicar/revertir sólo con `precio.aprobar`; excluir errores/fila con `config.fiscal`.
  Rutas `/precios/lotes` (NAV «Lotes de precios» en el grupo `precios` + CRUMB) y `/precios/lotes/:id`
  (sin NAV/CRUMB — título propio + back, patrón `ProductoDetalle`). **`RecalcularModal` → «Crear
  lote»** con el flag on: pierde base/porcentaje/modo/fecha, genera un batch `MANUAL_RECALCULATION`
  y navega al detalle; con el flag off conserva «Aplicar ahora»/«Programar». **Primer recorrido
  manual del circuito completo** (crear → revisar → aprobar → publicar → revertir). **1352 verdes**
  (449 renderer + 903 node) + 102 shared. **Falta verificación manual en la app real.**
  → siguiente: Fase 5 (cierre del circuito de costo: disparos desde importación/preferido/recepción
  + salida al lote en `ImportarCostosView`; retiro del backend scheduler/cambioProgramado).

- `2026-07-24` — **ADR-049 Fase 3 (batch, validación y publicación) implementada**, TDD.
  Migración aditiva `0030_adr049_price_batch.sql`: tablas `price_batch` (estado
  `borrador→validado→aprobado→publicado` | `validacion_fallida|cancelado|revertido`, proveedor
  nullable, contadores, impacto) y `price_batch_detalle` (costo neto, precio anterior/propuesto,
  márgenes, regla, validación) + `recalculo_masivo.price_batch_id` + 3 umbrales en
  `parametros_sistema` (`precios.variacion_maxima_pct`=30, `margen_minimo_pct`=0,
  `excluir_manuales_dias_default`=0). Módulos `main/precios/`: `validacion.ts` (pura: precio<costo
  neto / margen fuera de rango / sin preferido / inactivo = error; variación>umbral = advertencia),
  `motor.ts` (`crearBatch` reutiliza `resolveProductosAfectados`; costo neto → `resolverRegla` →
  `precioConMargen` → `redondearComercial`; nada publica), `publicacion.ts` (`aprobarBatch`,
  `excluirFila`/`excluirErrores` para destrabar, `publicarBatch` atómico sobre `lista_precio_valor`,
  `revertirBatch` genera un lote nuevo `ROLLBACK` con los precios anteriores — historia intacta,
  ADR-006). IPC `priceBatch:crear|obtener|listar|excluirFila|excluirErrores|aprobar|publicar|revertir`
  + namespace `precios.batch`. **Permiso nuevo `precio.aprobar`** (solo Supervisor, gatea
  aprobar/publicar/revertir): 28→**29** permisos; conteos exactos actualizados en
  `auth/__tests__/seed.test.ts` e `ipc/__tests__/auth.ipc.test.ts`. La simulación sale gratis
  (crear + mirar + no aprobar). **1346 verdes** (443 renderer + 903 node) + 102 shared.
  **Sin UI todavía** (Fase 4: `LotesPreciosView`/`LoteDetalleView` + `RecalcularModal`→«Crear lote»).
  **Falta verificación manual en la app real.**
  → siguiente: Fase 4 (UI de lotes; primer recorrido manual del circuito completo).

- `2026-07-24` — **ADR-049 Fase 2 (reglas de margen + redondeo comercial + grupo de nav
  `precios`) implementada**, TDD, detrás del flag `motor_precios_v2_habilitado`. Migración
  aditiva `0029_adr049_reglas_margen.sql`: `lista_precio.modo_calculo`
  (`margen_costo | pct_sobre_lista | manual`, default `pct_sobre_lista` ⇒ sin cambio de
  runtime) + tabla `regla_precio` (una regla por producto/lista, resolución por especificidad).
  Shared: `redondearComercial` en `precio.ts` (ninguno/terminación 90/99/múltiplo) y
  `resolverRegla`/`precioConMargen`/`margenRealPct` en `regla.ts` nuevo (markup sobre costo;
  margen real derivado de solo lectura). IPC `reglaPrecio:listByLista/upsert/remove`
  (guard `config.fiscal`) + namespace `precios.reglas` + `modo_calculo` en lista create/update.
  UI (gateada por flag): **alta del grupo de nav `precios`** en `AppShell` (mueve Listas/Importar
  costos/Cola de revisión fuera de Configuración; rutas intactas); `ListasPreciosView` gana la
  columna y el selector «Modo de cálculo» y el **tab «Reglas»** (`ReglasTab`) que reemplaza a
  «Ajustes por producto», y se retira el tab «Cambios programados». Con el flag off, todo queda
  como hoy. **1331 verdes** (443 renderer + 888 node) + 102 shared.
  **Decisión de fase (registrada):** el retiro del **backend** del scheduler + `cambioProgramado`
  (job en `main/index.ts`, IPC `cambioProgramado:*`, `scheduler/precios.ts`) se **difiere a Fase 4**,
  cuando `RecalcularModal` se rehace a «Crear lote» y pierde el campo de fecha — el plan ata el
  retiro a «quitar la fecha», que es Fase 4. En Fase 2 solo se saca el tab de la UI; `cambio_programado`
  queda deprecada sin migración destructiva. **Falta verificación manual en la app real.**
  → siguiente: Fase 3 (batch `price_batch`/`price_batch_detalle` + validación + permiso `precio.aprobar`).

- `2026-07-24` — **ADR-049 Fase 1 (costo neto) implementada** en `feat/adr-049-motor-precios-v2`,
  TDD RED-GREEN, detrás del flag `motor_precios_v2_habilitado` (default `false`). Migración
  aditiva `0028_adr049_costo_neto.sql`: defaults comerciales en `proveedor`
  (`bonificacion_pct_default`/`costo_financiero_pct_default`/`flete_pct_default`, REAL default 0)
  + overrides nullable en `producto_proveedor` (`bonificacion_pct`/`costo_financiero_pct`/
  `flete_pct`/`flete_centavos`/`otros_costos_centavos`) + el flag. Función pura
  `packages/shared/src/costo.ts` (`resolverComponentesComerciales`/`calcularCostoNeto`/`costoNeto`):
  resolución `override ?? default ?? 0`, flete absoluto pisa al %, desglose aditivo exacto
  (bruto − bonif + flete + otros + costFin = neto), 15 tests. Backend: `proveedorUpsert` persiste
  los defaults; `productoProveedorListHandler`/`proveedorProductosListarHandler` devuelven overrides
  + defaults del proveedor; nuevo `productoProveedorSetOverridesHandler` + canal `compras.pp:setOverrides`.
  UI (gateada por flag, con flag off = comportamiento actual): `ProveedorForm` gana la tarjeta
  "Condiciones comerciales"; el panel Proveedores de `ProductoDetalle` pasa a tabla con costo neto
  desglosado y **edición de overrides por producto** (excepción acotada a ADR-036, documentada en el
  ADR-049 y decidida con el PO); `ProveedorProductosTab` muestra el costo neto efectivo en solo-lectura.
  **1320 verdes** (438 renderer + 882 node) + 85 shared. Sin impacto en precios (Fase 1 no toca el
  motor de precios). **Falta verificación manual en la app real** (navegar con el flag encendido).
  → siguiente checkpoint: aprobar Fase 1 y arrancar Fase 2 (reglas de margen + redondeo comercial +
  alta del grupo de nav `precios`).

- `2026-07-24` — **ADR-049 (Motor de Precios v2) — Fase 0 (gate) completada.** Redactado el
  ADR-049 en `docs/ADR-Log-ferreteria.md` (índice + cuerpo) como documento standalone, sin
  migraciones. Cierra la cadena que ADR-034/035/036 dejaron abierta: **costo neto**
  (bonificación/costo financiero/flete como default por proveedor + override nullable por
  producto, función pura `shared/costo.ts`), **reglas de margen** (`regla_precio`, markup
  sobre costo neto, una regla por producto/lista con prioridad) con **modo de cálculo por
  lista** (`margen_costo | pct_sobre_lista | manual`, default sin cambio de runtime),
  **redondeo comercial**, **lote de publicación** (`price_batch`/`price_batch_detalle`) con
  validación, aprobación de 1 nivel (**permiso nuevo `precio.aprobar`, solo Supervisor**),
  publicación atómica y **rollback**, cierre del circuito de costo (importación / preferido /
  recepción / defaults del proveedor generan batch en **borrador**, nunca publican solos) y
  endurecimiento del POS (re-resolución de precio en `ventaConfirmarHandler`,
  `PRECIO_DESACTUALIZADO`, lista por cliente, `costo_unitario` en el movimiento de stock).
  **Se retira** el recálculo programado (`cambio_programado` + `scheduler/precios.ts` + tab
  «Cambios programados» deprecados, sin migración destructiva). **Autorizada el alta del grupo
  de navegación `precios`** (4 ítems: Listas de precios · Lotes · Importar costos · Cola de
  revisión; permiso `config.fiscal`) — precedente de los grupos «Facturación» (ADR-045) y
  «Agenda» (ADR-047). Todo detrás del flag `motor_precios_v2_habilitado` (default `false`),
  en `1.1.x`, antes del fiscal ARCA. Fuentes de verdad: plan aprobado
  `motor-de-precios-quiero-quiet-dove.md` + mockup `docs/Mockups/mock-adr049-motor-precios-circuito.html`.
  **Gate:** esperando aprobación antes de tocar schema (Fase 1 = costo neto). Rama de trabajo:
  `feat/adr-049-motor-precios-v2`.
  → siguiente: confirmar el orden de fases y arrancar Fase 1 (migración aditiva de costo neto).

- `2026-06-24` — Diseño de Backup & Restore cerrado. ADR-021 (política backup), ADR-022 (restore atómico + validación de esquema vía `__drizzle_migrations`), ADR-023 (Drive nativo diferido a R4). `schema_version` resuelto: se lee de `__drizzle_migrations`, `user_version` queda en 0. Certs AFIP opt-in cifrados AES.

- `2026-06-30` — ADR-025: formato de SKU interno (P-0000000-C, opaco + Luhn), secuencial en columna propia vía contador en `parametros_sistema`, `gtin_barcode` nullable, eliminada columna `codigo_qr` (QR/code128 derivados del SKU al imprimir). 636 tests verdes.

- `2026-07-03` — ADR-026/ADR-027: módulo aislado de impresión de etiquetas por lote (excepción phase-gate R3). Selección/filtrado múltiple, perfiles configurables hoja/rollo en `parametros_sistema`, salida imprimir + exportar PDF, code128/QR sobre código interno. Implementado completo: perfiles, IPC `etiquetas:*`, pantalla `/etiquetas`. 725 tests verdes.

- `2026-07-03` — Revisión de menú y funcionalidades pendientes: eliminación de PIN
  (auth usuario/contraseña, ADR-029), sidebar agrupado (ADR-030), ABM Categorías
  (ADR-031), ABM Marcas (ADR-032), baja lógica de Clientes (ADR-033) → todos
  implementados y commiteados. 744 tests verdes (231 renderer + 513 node).

- `2026-07-16` — Eliminadas las opciones grisadas "Productos", "Proveedores" y "Clientes" del menú Reportes. Existían como placeholders (`disabled: true`) sin implementación. Los listados con filtros correspondientes se agregarán en el futuro directamente en las secciones Productos, Abastecimiento y Clientes, respectivamente.

- `2026-07-08` — Diseño cerrado de Lista de Precios (ADR-034): motor de recálculo masivo por alcance (rubro/proveedor/marca/lista), vigencia dual (promoción + cambio programado), costo multi-proveedor con flag preferido, auditoría histórica vía vigencia por rango. Prompt de Superpowers enviado para implementación (schema pendiente de confirmación en gate inicial).
  → siguiente: revisar resultado del gate de schema con Superpowers; retomar diseño del próximo ítem de mayor alcance (Dashboard o módulo Presupuesto).
  
## ADR abiertos

| ADR | Título | Estado |
|-----|--------|--------|
| ADR-013 | Ubicación integración fiscal (cliente vs nube) | Propuesto — decidir en R2 |

## ADR cerrados (no reabrir sin nuevo ADR)

- ADR-001 a ADR-012, ADR-014 a ADR-016, ADR-017 a ADR-027, ADR-029, ADR-030, ADR-031, ADR-032, ADR-033, ADR-034, ADR-035, ADR-039
- [x] ADR-036 — Vistas cruzadas producto↔proveedor definidas (Proveedor = dueño de la relación, Producto = solo lectura)


## En curso / próximo

- [x] **ADR-069 — implementado** (rama `feat/adr-069-ui-ux-listados`, 13 commits, TDD por listado, hook
  `useFilaNavegable`, 627/627 renderer verde). Las 4 decisiones confirmadas: Transportistas→form de edición;
  SKU negro solo en Etiquetas; POS→`.panel` en el área de ítems; Etiquetas→tildes+filtros persistidos
  (`sessionStorage`). **Pendiente:** verificación manual en la app (§12) y merge de la rama.
- [ ] Motor de promociones automáticas (Lote C, NxM/%/$) — diferido, sin ADR.
- [x] ADR-041 — ABM de Unidades (/config/unidades). ✅
- [x] ADR-040 — Multi-presentación de venta — **completo**: backend (`producto_presentacion`, `crearPresentacionDefault`, factor en stock/anulación, `presentacion_id` en LPV) + UI POS (scan GTIN por presentación, badge unidad×factor, select en tabla) + ProductoDetalle (`PresentacionesPanel` CRUD). ✅

## Bitácora de iteraciones

- `2026-08-19` — **ADR-069 implementado** (rama `feat/adr-069-ui-ux-listados`, 13 commits, subagent-driven
  TDD): hook `useFilaNavegable` + clic-en-fila en Productos/Stock/OC/Caja/tab-Proveedor/Ventas/Transportistas/
  Sinónimos/Etiquetas; Ventas HH:MM 24h + nro en una línea; Sinónimos restyle + movido a Configuración;
  Etiquetas SKU negro + columna EAN + selección/filtros persistentes; POS área de ítems en `.panel`.
  Renderer 627/627 verde; sin migraciones. → siguiente: verificación manual en la app y merge.

- `2026-08-19` — **ADR-069 redactado y aceptado**: relevamiento del renderer + lote de UI/UX.
  Generaliza el patrón de ADR-055 ("clic en toda la fila abre detalle") a los listados que aún no
  lo tienen (Caja, Producto, Stock, tab Productos del proveedor, OC, Ventas, Etiquetas) y agrega:
  restyle de Sinónimos (hoy con estilos inline) y del POS (barras fuera de ADR-056) al CSS estándar;
  Ventas con fecha HH:MM 24h (`hour12:false`) y nro de factura en una línea (`nowrap`); SKU negro y
  columna EAN en Etiquetas con selección persistente al volver; densidad de Transportistas igualada;
  Sinónimos movido a Configuración bajo Ubicaciones. Hallazgos que acotan: el "volver" ya es genérico
  (`ProductoDetalle` usa `navigate(-1)`), y el SKU gris viene de la clase compartida `.p-code`.
  Las 4 decisiones abiertas quedaron confirmadas por el PO el mismo día (Transportistas→form de edición;
  SKU negro solo en Etiquetas; POS→`.panel` en el área de ítems; Etiquetas→preservar tildes + filtros).
  Puramente renderer, sin migraciones. → siguiente: plan Superpowers + TDD por listado.

- `2026-07-06` — ADR-032 (rediseño layout POS + pago combinado: venta_pago, vuelto
  persistido, recargo % opcional por tarjeta) cerrado e implementado. Motor de
  promociones (Lote C) queda diferido explícitamente.

- `2026-07-07` — ADR-033 (venta en espera: pausar/retomar/descartar) cerrado e
  implementado. Migration 0013, handlers `venta.espera.*`, audit fix `ne(borrador)→
  inArray`, UI completa (PausarEsperaModal, VentaEsperaDrawer, F8/F9, banner avisos).
  805 tests verdes (272 renderer + 533 node).

- `2026-07-08` — Diseño cerrado de Importación de listas de costo de proveedor (ADR-035, sigue a ADR-034 Lista de Precios): matching por cadena código de proveedor → GTIN, mapeo de columnas persistente por proveedor, cola de revisión manual para filas sin matchear (sin alta automática de productos), preview obligatorio antes de aplicar.

- `2026-07-11` — ADR-035 implementado completo: migración 0016 (tabla `proveedor_importacion_config`, recrea `importacion_costo_proveedor_detalle` con `producto_id` nullable y campos de auditoría), parser CSV/XLSX puro (`importacion-costo.parser.ts`), 6 handlers IPC (`importacionCosto:*`), UI wizard 4 pasos (`ImportarCostosView`) + cola de revisión (`ColaRevisionCostosView`), rutas `/precios/importar-costos` y `/precios/cola-revision-costos`, sidebar Supervisor. 869 tests verdes (280 renderer + 589 node).

- `2026-07-11` — **Hotfix post-ADR-035**: (1) `0014_adr034_precios.sql`: agregado `IF NOT EXISTS` a los 5 `CREATE TABLE` y 2 `CREATE INDEX`, para que la migración sea idempotente cuando las tablas ya existen en la BD de producción pero no estaban registradas en `__drizzle_migrations`; (2) `importacion-costo.ts`: `fila_original` almacenaba índices de columna en lugar de valores de celda — corregido con array paralelo `rawDataPerFila` que captura los valores reales antes de la transacción. 869 tests verdes (sin cambio).

- `2026-07-13` — Auditoría de estado: confirmadas como completadas las fases P3.11 (Módulo Compras: Proveedores, OC ABM + estados + sugerencias, migración 0005), P3.12 (Recepción de mercadería: parcial/total, MovimientoStock, CPP) y P3.13 (Cuenta corriente de clientes: saldo, límite, cobros, integración POS). CCteProv sigue diferida (ADR-019). Próximo: R2 fiscal o items pendientes de R3.

- `2026-07-13` — ADR-036 cerrado (vistas producto↔proveedor) → siguiente: prompt Superpowers para implementación

- `2026-07-13` — ADR-036 implementado completo: migración 0019 (columna `deleted_at` + índice único parcial `ux_producto_proveedor_preferido`), 4 nuevos handlers IPC (`compras.pp:listByProveedor/asociar/desasociar/actualizar`), handlers existentes actualizados a soft-delete y filtrado de registros eliminados, preload extendido (`compras.proveedor.productos.*`), `ProveedoresPanel` convertido a solo lectura con link al detalle del proveedor, `ProveedorDetalle` con tabs Datos/Productos, nuevo `ProveedorProductosTab` con CRUD completo. 624 tests verdes (54 archivos).

- `2026-07-13` — ADR-037 aceptada: arquitectura de Dashboard/Reportes, separación vista ejecutiva vs. reportes analíticos, fase 1 acotada a Ventas + Productos (Recharts, trimestre calendario, tabs en pantalla única). Reporte de Compras/IVA diferido a fase posterior (depende de R2).  → siguiente: implementar fase 1 con Superpowers; confirmar si tabs
  Caja/Clientes/Proveedores van deshabilitados o no visibles.

- `2026-07-14` — Bug fix UX en `RecalcularModal`: reemplazado el input libre de UUID por selectores (`<select>`) poblados desde los endpoints existentes (`catalogo.categoria.list`, `catalogo.marca.list`, `compras.proveedor.list`) al elegir alcance Rubro, Marca o Proveedor. Se agregan 6 tests nuevos en `RecalcularModal.test.tsx`. 296 tests renderer verdes (42 archivos).
  Hotfix: namespaces corregidos (`ferreteria.catalogo.categoria/marca` en lugar
  de `ferreteria.categoria/marca`); mocks del test también corregidos.

- `2026-07-14` — ADR-038 implementado: Dashboard Fase 2 completo. Tabs Caja (tendencia de turnos en BarChart, breakdown medios de pago, KPI recargo tarjeta), Clientes (ranking facturación, deuda total/vencida con Opción A `fecha_ultimo_movimiento`, clientes nuevos/inactivos) y Proveedores (ranking gasto por OCs recibidas, OCs pendientes y sugeridas sin resolver). Migración 0020 con parámetros `cc_dias_vencimiento=30` y `cliente_dias_inactividad=60`. Deuda vencida y clientes inactivos como KPIs de estado fijos ("hoy") independientes del selector de período. 315 tests renderer + 657 node = 972 verdes.

- `2026-07-13` — ADR-039 aceptada: nueva sección de menú "Reportes", separada del Dashboard. Reportes → Ventas con dos vistas: Detalle de ventas (operativo, sin dependencia fiscal, implementable ya) y Detalle de comprobantes/facturas (diferido, depende de que R2 tenga comprobante_fiscal en uso — hoy no existe). Productos/Proveedores/Clientes quedan reservados en el menú, sin especificar. → siguiente: implementar Detalle de ventas con Superpowers; especificar Reportes → Productos/Proveedores/Clientes en un ADR posterior; retomar detalle de comprobantes cuando R2 tenga comprobante_fiscal poblado.

- `2026-07-16` — ADR-041 implementado completo: migración `0021_adr041_unidad.sql` (tabla `unidad` con `nombre`, `abreviatura` único, `activo`, sync completo), 6 handlers IPC (`unidad:list/list-all/create/update/desactivar/reactivar`), baja bloqueada si hay productos con `unidad_venta` o `unidad_compra` coincidente (`TIENE_PRODUCTOS:N`), vista `UnidadesView` en `/config/unidades` (toolbar con buscador + filtro estado, tabla, modal create/edit), sidebar + ConfigShell actualizados, namespace `ferreteria.unidad.*` en preload. 10 nuevos tests node. 338 renderer + 683 node = 1021 tests verdes.

- `2026-07-15` — ADR-039 implementado completo: sección "Reportes" en sidebar (Ventas habilitada, Productos/Proveedores/Clientes deshabilitados con tooltip "Próximamente"), `ReporteVentasView` con 6 filtros (fechas, cliente, categoría, producto texto, vendedor, medio de pago), paginación server-side (100/página), click en número de venta abre `VentaDetalleModal` reutilizado, `ExportarButton` con perfil cabecera y detalle (default XLSX). Handler `reportes:detalleVentas` con SQL dinámico, EXISTS subqueries, GROUP_CONCAT de medios de pago. `defaultFormato` agregado a `PerfilExport` (backward-compatible). Descriptor `exportReporteVentas` en shared con 2 perfiles y conversión de timestamps Unix. 338 renderer + 673 node = 1011 tests verdes.

- `2026-07-16` — ADR-040 backend completo: migración `0022_adr040_presentaciones.sql` (tabla `producto_presentacion`, columnas `presentacion_id`/`factor_a_stock_aplicado` en `venta_detalle`, `presentacion_id` en `lista_precio_valor`), `presentacion.ts` con `crearPresentacionDefault()` compartida + CRUD handlers + scan resolution `buscarPorGtin`, `productoCreateHandler` y `importar.ts` auto-crean presentación default, `lista-precio-valor.ts` (`setManual`/`recalcularMasivo`) incluye `presentacion_id`, `venta.ts` stock check y deducción usan `cantidad × factor_a_stock_aplicado`, anulación restaura stock con factor, namespace `ferreteria.presentacion.*`, `catalog/seed.ts` siembra unidades comunes (u/unidad/und/kg/lt). 13 tests nuevos. 338 renderer + 694 node = 1032 tests verdes.

- `2026-07-16` — Cerrados ADR-040 (multi-presentación sobre unidad de stock; precio por presentación dentro del motor de ADR-034) y ADR-041 (ABM de Unidades). → siguiente: implementar ADR-041, luego ADR-040 en dos lotes.

- `2026-07-16` — Bug fixes ADR-040/ADR-041: (1) `_journal.json`: timestamps de migraciones 0021/0022 corregidos (estaban en jul-2025, Drizzle las saltaba al comparar contra el `created_at` del último migration aplicado); (2) `useUnidades` hook + `ProductoForm` pasan `unidad_venta`/`unidad_compra` a `<select>` poblado desde la tabla `unidad` (evita valores de texto libre inválidos); (3) `usePosSession` — tres bugs de multi-presentación corregidos: `addLinea` nuevas líneas multiplica `precioListaCentavos × resolvedFactor`, check de stock en línea existente usa `factor_a_stock` de la línea (no el factor entrante), incremento de cantidad no pisa presentacion/factor de la línea; `updatePresentacion` recalcula precio al cambiar factor (`basePrecio / factorAnterior × factorNuevo`). 5 nuevos tests multi-presentación en `usePosSession`. 343 renderer + 694 node = 1037 tests verdes.

- `2026-07-16` — feat(presentaciones) `setDefault`: nuevo handler `presentacionSetDefaultHandler` — transacción atómica que transfiere `es_default` a la presentación seleccionada (limpia todas, activa la elegida); lanza `NOT_FOUND`/`INACTIVO`. Canal `presentacion:setDefault` en IPC y preload. `PresentacionesPanel`: botón ★ en filas no-default activas, botón ✎ habilitado también en la default, mensaje de error de desactivación mejorado. 4 nuevos tests node. 343 renderer + 698 node = 1041 verdes.

- `2026-07-15` — ADR-042: corte v1.0.0 + estrategia de branching pre-R2 (mapa de versiones con 2.0.0=R4 online) → siguiente: redactar ADR-037 (módulo fiscal) y arrancar módulo Fiscal R2 en `main` (ADR fiscal pendiente de redacción)+

- `2026-07-19` — Brainstorming: se decide construir **Remitos** (interno, sin CAE por
  ahora — la integración ARCA queda como fase 2 futura) y **Presupuestos** (interno, sin
  ARCA ni nube) como features nuevas, cada una con su propio diseño. Al ubicarlas en el
  mapa de versiones de ADR-042 se detectó que la fila `1.2.0 = R3` estaba obsoleta (R3
  ya integrado a `v1.0.0`) y que asignarles ese slot generaría un orden de versiones
  cronológicamente inconsistente (Remitos/Presupuestos van a estar listos antes que el
  fiscal, que todavía no arrancó). **ADR-044** corrige el mapa: `1.1.0` = Remitos +
  Presupuestos, `1.2.0` = fiscal ARCA (R2), `2.0.0` = R4 sin cambios. Orden de trabajo
  confirmado: Remitos primero, Presupuestos después, cada uno en sesión separada.
  → siguiente: diseño (brainstorm + spec) de Remitos.

## Estado actual
- **Release estable congelado:** v1.0.0 (tag sobre `main`, rama `release/1.0.x`)
- **Rama activa de desarrollo:** `main` → objetivo **1.1.0 (Remitos + Presupuestos,
  ADR-044)**; el fiscal AFIP/ARCA pasa a **1.2.0** (antes se apuntaba a 1.1.0 — ver
  ADR-044)
- **1.1.0 integrado en `origin/main` (2026-07-21):** **Remitos (ADR-045)** y
  **Presupuestos (ADR-046)** ya están mergeados a `main` y pusheados, ambos detrás de sus
  flags (`remitos_habilitado` / `presupuestos_habilitado`, default `false`). `main` sigue
  liberable. Ramas de referencia en el remoto: `feat/adr-045-remitos`,
  `feat/adr-046-presupuesto`.
- **Regla de branch:** cherry-pick unidireccional `release/1.0.x → main`
- **Trunk único:** `main` (rama `master` retirada; ver §Reconciliación de ramas)
- **Features:** en `main` detrás de feature flags (`parametros_sistema`, default `false`); migraciones aditivas → `main` siempre liberable (ver §Regla de ruteo)

- **Empaquetado/distribución:** definido en ADR-043; en implementación por SP (ver `docs/RUNBOOK-release-e-instalacion.md`)

- `2026-07-18` — ADR-045 aceptado: módulo Remitos (documento de entrega interno,
  opt-in, no mueve stock, numeración RE interna, sin valorizar). Aislado, solo lee
  de venta/comprobante_fiscal. → siguiente: implementar lote 1 (schema remito/remito_linea).

- `2026-07-19` — **ADR-045 implementado completo** en `feat/adr-045-remitos`, 5 lotes con
  TDD. Migración `0023_adr045_remitos.sql` (tablas `remito`/`remito_linea`, 4 índices,
  parámetros `remito_proximo_secuencial`/`remitos_habilitado`/`remito_valorizado`);
  numeración `RE-NNNNNNN` con contador atómico consumido **después** de validar (un
  remito rechazado no deja huecos); emisión atómica con control entregado-vs-pendiente
  que consolida líneas repetidas del mismo `venta_detalle`; 7 handlers `remito:*`;
  UI `/remitos` + modal desde el detalle de venta + grupo Facturación, todo tras el flag;
  impresión PDF sin importes vía `printToPDF`. 3 permisos nuevos a ambos roles.
  53 tests de remito. 1125 verdes. Correcciones al texto del ADR anotadas en el ADR-Log.

- `2026-07-21` — **ADR-046 implementado completo** en `feat/adr-046-presupuesto` (rama
  desde `main`, que primero absorbió por fast-forward la de Remitos ADR-045). Migración
  `0025_adr046_presupuesto.sql` (tablas `presupuesto`/`presupuesto_detalle`, `ALTER venta
  ADD presupuesto_id`, 4 índices incl. parcial por vencimiento, 2 CHECK estado↔nulabilidad,
  parámetros `presupuesto_proximo_secuencial`/`presupuesto_validez_dias_default`/
  `presupuestos_habilitado`). **GATE 0**: dinero en centavos INTEGER, descuentos como
  `_pct REAL` (coincide con el runtime del POS), snapshots `descripcion`/`alicuota_iva`/
  `presentacion_id` en el detalle. Backend `ipc/presupuesto.ts`: ABM borrador con recálculo
  en vivo (motor compartido `resolverPrecio`), emisión atómica con numeración `PR-NNNNNNN`
  y snapshot congelado, job diario de vencimiento (compare-and-swap), `prepararConversion`
  (snapshot si vigente, reprecio + aviso si vencido), conversión enganchada en
  `ventaConfirmarHandler` (marca `convertido` en la misma transacción, rollback si no es
  convertible), export PDF sin plantilla fiscal. Permisos `presupuesto.crear/emitir/anular`
  a ambos roles (25→28; Operador 14→17). UI: grupo **Punto de venta** del sidebar contiene
  ahora `Presupuestos` (decisión de producto), detrás del flag; `PresupuestosView`,
  `PresupuestoFormModal`, y `usePosSession.precargarDesdePresupuesto`. 25 tests de
  presupuesto + 2 de conversión + 5 renderer. **1206 verdes** (817 node + 389 renderer).

- `2026-07-21` — **Ajustes de UI de Presupuesto + fix POS, verificados en la app real:**
  (1) formulario: cliente por combobox con búsqueda por nombre/documento, producto por
  nombre/SKU (se corrigió un bug: `producto.list` es paginado `{items,total}` y el form lo
  trataba como array → no traía resultados), y **stock por línea** (dropdown + columna con
  ⚠ si stock < cantidad); (2) listado: default **Borrador + Emitido**, buscador por
  cliente/número, encabezados ordenables asc/desc, y **detalle al seleccionar la fila**
  (cualquier estado; en convertidos muestra la venta asociada y avisa si el total difiere);
  (3) **el POS ya no traga el error al confirmar**: muestra mensaje claro
  (`STOCK_INSUFICIENTE`, etc.) y avisa proactivamente al convertir si algún producto
  cotizado no tiene stock. Debate cerrado: presupuesto (cotización histórica, total
  congelado) vs venta (lo realmente vendido) pueden diferir legítimamente — es correcto,
  se hizo visible en el detalle. `obtenerInterno` suma `leftJoin` a `venta`.
  **1216 verdes** (817 node + 399 renderer).

- `2026-07-21` — **1.1.0 integrado a `origin/main`:** merge fast-forward de
  `feat/adr-046-presupuesto` → `main` y push. `origin/main` avanzó 30 commits (29 de
  Remitos ADR-045 + Presupuesto ADR-046). Ambas features detrás de flag (default `false`);
  `main` liberable. Ramas `feat/adr-045-remitos` y `feat/adr-046-presupuesto` quedan en el
  remoto como referencia.

- `2026-07-19` — **Bug de fondo detectado al verificar en la app real** (no lo agarraron
  los tests): `runSeed` corría solo dentro del guard de primer arranque, así que **todo
  permiso nuevo nunca llegaba a una instalación ya inicializada** — el módulo asociado
  quedaba invisible por RBAC aunque su flag estuviera encendido. Afectaba a Remitos y
  hubiera afectado a toda feature futura con permisos propios. Arreglado moviendo
  `runSeed(db)` fuera del guard (`startup.ts` §3): es idempotente y estrictamente
  aditivo. Verificado contra la BD de desarrollo real (instalación existente, 0 → 3
  permisos sin intervención manual). 4 tests nuevos en `startup.test.ts`.

  - `2026-07-21` — ADR-047 aceptado: agenda operativa (rutina/agenda_evento/aviso) + outbox de avisos con regla transaccional; grupo "Agenda" en sidebar. → siguiente: Lote 1 (schema + `aviso.emitir` + adapter `in_app` + scheduler/catch-up + UI base). Productores (caja/recepción/OC/bajo-mínimo) y adapter email, en lotes posteriores con su ADR de excepción.
  - `2026-07-21` — **ADR-047 Lote 1 implementado** (rama `feat/adr047-agenda-lote1`, encuadrado en **1.1.0** detrás de flag `agenda_habilitado`, default `false`). Migración `0026` (3 tablas + 9 params), motor de frecuencia propio, servicio `aviso.emitir` (INSERT en tx / envío fuera, best-effort), adapters `in_app` (impl) + `email`/`whatsapp` (stub), motor de rutinas lazy + catch-up, worker de reintentos con backoff, IPC `rutina/agenda/aviso`, y UI (eventos con zonas, bandeja de avisos, rutinas, campana). Verificado: app arranca y migra en BD real; suites completas en verde (**851 node + 415 renderer**). Fuera de Lote 1: productores de dominio, adapter email real, `.ics`, grilla mensual, read/unread.

- `2026-07-22` — **ADR-048 Agenga Operativa y Outbox de avisos Lote 2 aceptado**: productor "Cierre de caja" + adapter email fundido (excepción phase-gate R1). Agrega `usuario.email`, `aviso.severidad`, config SMTP (password en safeStorage). → siguiente: Lote 2 (adapter email + productor cierre). Productores restantes (recepción, OC, bajo-mínimo) en lotes posteriores.

- `2026-07-22` — **ADR-048 Lote 2 implementado** (rama `feat/adr048-agenda-lote2`, sale de
  `feat/adr047-agenda-lote1`). Migración `0027` (**solo** `aviso.severidad` + 7 parámetros:
  `arqueo_diferencia_alerta_centavos`=200000 ($2.000, configurable), `notif_cierre_destinatario`,
  y los 5 `smtp_*`). **`usuario.email` ya existía** desde la migración `0001` y ya era editable
  en Configuración → Usuarios: el ADR lo daba por faltante, no hizo falta migración ni UI.
  **Adapter email real** con `nodemailer` (dep nueva): `crearEmailAdapter(deps)` inyectable +
  instancia default que resuelve `db` con `import()` perezoso (no abre la BD real al importarse
  en tests); cuerpo texto plano, sin `.ics`; errores `SMTP_NO_CONFIGURADO`/`SMTP_SIN_CREDENCIAL`/
  `SMTP_SIN_DESTINATARIO` que el worker de reintentos de Lote 1 maneja. Contraseña SMTP en
  **safeStorage** (`seguridad/smtp-secret.ts`, archivo `userData/smtp-secret.bin`, fuera de la BD
  y del `.fbk` — el backup solo empaqueta `ferreteria.db`). **Productor cierre de caja**:
  `ipc/caja-cierre-aviso.ts` arma el `ComandoAviso` (payload snapshot congelado: fecha, turno,
  quién cerró, total vendido, N ventas, desglose por medio de pago, fondo inicial, esperado vs
  contado, diferencia) y `cajaCerrarHandler` lo emite **dentro de la transacción del cierre**
  (ADR-047 §6), despachando el envío best-effort afuera. Severidad `alerta` si
  `|diferencia|·100 > arqueo_diferencia_alerta_centavos` (Caja trabaja en pesos, el umbral en
  centavos: se convierte en el borde). **Extensión acordada con el PO:** el payload suma un
  bloque `bajo_minimo` (conteo + top 10 por faltante, **incluye stock 0** con mínimo definido);
  es solo informativo, **no** eleva la severidad. IPC `smtp:*` (getConfig sin exponer la
  contraseña, setConfig, setPassword, probar) + pantalla `/config/smtp` solo Supervisor.
  **1290 verdes** (872 node + 418 renderer).

- `2026-07-22` — **Bug latente encontrado al integrar el primer productor** (lo destapó el
  Lote 2, no lo agarraban los tests de Lote 1): `resolverDestinatarios` en `aviso-servicio.ts`
  comparaba el nombre de rol con `eq()` **case-sensitive**, pero el seed crea `'SUPERVISOR'`/
  `'OPERADOR'` en mayúsculas mientras los destinatarios configurados vienen en minúsculas
  (`notif_cierre_destinatario` = `{"tipo":"rol","rol":"supervisor"}`). Resultado: no resolvía
  el rol, devolvía cero destinatarios y **no se insertaba ningún aviso** — en producción el
  aviso de cierre nunca se hubiera generado. Arreglado con match `lower(nombre) = lower(?)`
  en un único punto, que cubre a todos los productores y rutinas. Los tests del productor de
  cierre son ahora la cobertura end-to-end de ese camino.

- `2026-07-22` — **Fix de infraestructura de tests**: `scripts/test-node.cjs` resolvía Electron
  con la ruta absoluta `packages/client/node_modules/electron`, inexistente bajo el
  `node-linker=hoisted` que declara el repo (Electron vive en el `node_modules` de la raíz), así
  que el runner del main rompía con `MODULE_NOT_FOUND`. Ahora usa
  `require.resolve('electron', { paths: [clientDir] })`, que camina hacia arriba — igual que ya
  hacía la resolución de `vitest` en la línea siguiente. Compatible con ambos layouts.
