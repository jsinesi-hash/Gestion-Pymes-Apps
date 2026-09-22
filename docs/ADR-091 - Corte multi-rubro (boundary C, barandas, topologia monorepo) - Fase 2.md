# ADR-091 — Corte multi-rubro: boundary Opción C, 4 barandas y topología del monorepo

**Estado:** Aceptado (Fase 2 ejecutada y mergeada a `main`, PR #1)
**Fecha:** 2026-09-22
**Spec:** `docs/superpowers/specs/2026-09-21-esqueleto-multi-rubro-design.md`
**Planes:** `docs/superpowers/plans/2026-09-21-corte-fase0-1-monorepo.md` (Fase 0-1),
`docs/superpowers/plans/2026-09-21-fase2-extraccion-core.md` (Fase 2),
`docs/superpowers/plans/2026-09-21-fase2-slice3-core-ui.md`,
`docs/superpowers/plans/2026-09-22-fase2-slice5-core-main.md`

## Contexto

Se hace un **corte** con lo desarrollado en la app de ferretería (v1.1.1, congelada) para
dejar una **base reutilizable** que dispare nuevas apps para negocios chicos. Meta: **arreglar
una vez** los bugs de arquitectura/plomería en vez de N veces por app. Tres familias previstas:
Retail (kiosco/librería/limpieza), Elaborados (heladería/gastronomía — hay **cliente real**,
es el próximo proyecto) y Servicios (peluquería/veterinaria/gimnasio). Este corte construye
**solo la base + Retail** (ferretería = primer perfil); Elaborados y Servicios solo dejan
*seams* y *barandas*.

## Decisión

**D1 — Monorepo** con núcleo compartido + una app por familia; releases/instaladores
independientes. **D2 —** ferretería v1.1.1 se congela; el monorepo nace en repo nuevo
(`Gestion-Pymes-Apps`). **D3 —** ferretería = primer perfil de la familia Retail
(`apps/retail`, package `ferreteria-client`). **D4 — Boundary Opción C:** el core = plomería +
dominio *comprobadamente universal*; lo que varía de forma entre familias (catálogo/stock/
semántica de línea) queda en la app. **D5 — 4 barandas** de compatibilidad futura (ver abajo).

### Invariante (regla que decide la ubicación de casi todo)

Una tabla/módulo de **app** puede depender del **core**; el **core NUNCA** depende de app.
Se protege con **barandas automáticas**:
- `packages/shared/src/__boundary__/no-electron.test.ts` — prohíbe importar Electron/Node
  builtins desde el dominio puro (baranda B4).
- `packages/core-db/src/__boundary__/no-fk-to-app.test.ts` — ningún schema de core importa
  dominios de app.

### Topología (5 paquetes; separación por entorno innegociable)

```
packages/shared      # dominio puro (browser-safe): precios, SKU, tipos, export/sync helpers
packages/core-db     # @core/db  — esquema Drizzle universal + factory createDb/runMigrations
packages/core-ui     # @core/ui  — design system + primitivos de framework (renderer)
packages/core-main   # @core/main — plomería-hoja del main (auth/RBAC, validación, seguridad)
apps/retail          # compone core + shared; aporta el dominio Retail + ferretería (1er perfil)
```
`@core/preload` **NO se creó** (ver "Diferido"). Resolución de cada paquete: triple (TS `paths`
en `tsconfig.base.json` + alias en los `vite.*`/`vitest.*` del **entorno correspondiente** +
`exports` del `package.json`). `@core/ui` es renderer-only (alias jamás en main/preload);
`@core/main` es main-only (alias jamás en renderer/preload).

### Qué se extrajo en Fase 2 (alcance real, acotado por regla de tres)

- **`@core/db`:** seguridad, personas, geo, credito, config, y venta/venta_pago/comprobante/
  caja/movimiento_caja (se **partió `ventas.ts`**: `venta_detalle` queda en la app). Factory
  `createDb`/`runMigrations` agnóstica; **las migraciones las posee la app** (secuencia sobre
  el esquema compuesto core+app; `__drizzle_migrations` sigue siendo fuente de verdad por-DB).
- **`@core/ui`:** design system (tokens/temas/skins/fonts) + primitivos sin dominio (toast,
  useCallIpc, useFormErrors, usePersistentListState, useIdleLock, useBloqueoInactividad,
  PasswordInput, SearchBox, errores). React como peerDependency.
- **`@core/main`:** plomería-hoja universal — auth machinery (hash/session/guard/
  verificarSupervisor), context, validation/core, security/webSecurity.

### Sub-decisión: `cliente.lista_precio_id` → soft FK

Única FK dura core→app detectada (`cliente`[core] → `lista_precio`[app]). Se resuelve
quitando `.references(...)` en Drizzle → `text('lista_precio_id')` (soft FK), eliminando el
import core→app. La FK SQL real se conserva en la migración. Es el mismo patrón ya usado para
`venta.presupuesto_id`/`comprobante.venta_id`. **No se promueve `lista_precio`** (regla de tres:
sin 2º consumidor real todavía).

## Las 4 barandas (restricciones al trazar el límite hoy)

- **B1 — Fiscal (R2):** el motor fiscal es de core y consume una interfaz canónica
  "venta→comprobante". La app arma la venta y expone ese payload; la implementación ARCA es R2.
  ADR-013 sigue abierto (ubicación cliente vs nube). **No implementado aún** (skeleton diferido).
- **B2 — Sync (R4):** el motor de sync es de core y va **dirigido por registro** de tablas por
  app (el core no conoce `receta`/`turno`). Todas las tablas mantienen campos de sync + UUID
  cliente. **No implementado aún.**
- **B3 — Nube multi-terminal (R4/R5):** esquema agnóstico de dialecto Drizzle (compila a SQLite
  y Postgres); prohibido usar trucos solo-SQLite.
- **B4 — E-commerce eventual:** `shared` puro, sin Electron (baranda automática). Un storefront
  web reusa `shared` + esquema ignorando el core Electron.

## Diferido (regla de tres — se promueve con el 2º consumidor real, Elaborados)

- **`@core/preload`:** el preload es 100% catálogo de canales Retail + una sola llamada
  `contextBridge.exposeInMainWorld`; no hay framework universal extraíble sin inventar un seam
  (`createBridge`) con un solo consumidor. Podría no ser ni un paquete (el diseño §4 lo anticipó).
- **`@core/ui`:** AppShell/CommandPalette/breadcrumbs y vistas "universales" (clientes/caja)
  siguen en la app — están muy acoplados a Retail (NAV/CRUMBS/comandos/12+ hooks de dominio);
  extraerlos exige inventar los seams de inyección con un solo consumidor.
- **`@core/main`:** siguen en la app los handlers dominio-coupled (cliente→lista_precio,
  caja→agenda, proveedor→precios, backup→registry de tablas, export→query-alls de dominio) y
  `auth/seed` (la lista `PERMISOS` es catálogo Retail → seam de inyección). Sync y fiscal no
  existen aún.

## Consecuencias

- Base lista: el 2º consumidor (Heladería/Elaborados) dictará qué de lo diferido se promueve y
  qué forma tienen los seams (AppShell, preload, handlers, sync/fiscal).
- **Aprendizajes de plomería** (para futuros paquetes):
  1. El barrel de un paquete de esquema **no** debe exportar un namespace (`export * as x`): el
     objeto namespace se filtra al `schema` que se pasa a `drizzle()` y lo rompe. Solo flat export.
  2. Alias de vite para un paquete con **subpaths** (ej. CSS) debe ser **regex exacta**
     (`/^@core\/ui$/`, forma array), no string greedy.
  3. Build `tsc` cross-package que **emite** (rootDir/outDir) necesita `paths: {}` en su tsconfig
     para resolver deps `@core/*` por su `dist` (symlink pnpm) en vez de arrastrarlas a su
     compilación (TS6059). Orden de build: `@core/db` antes que `@core/main`.
  4. El runner de tests del main (`scripts/test-node.cjs`, Electron NMV 128) es **flaky en
     paralelo** en Windows con carga alta; para gates confiables correrlo en **serie**
     (single-fork). Esperado: 136 archivos / 1578 tests.
- **Estado:** Fase 2 completa para el alcance acordado, mergeada a `main`. Suite verde:
  **shared 158 · renderer 927 · main 1578 = 2663**. Pendiente: verificación visual del CSS.
- **Fase 3** (perfiles de rubro: ferretería + kiosco mínimo) y **Fase 4** (guía "cómo nace una
  app de familia" + reframe de docs del monorepo) quedan por delante.

## Numeración

091 era el número libre reservado por el diseño para este corte. Al madurar el monorepo (Fase 4)
se decidirá si el log de ADR del repo nuevo continúa esta numeración o arranca la propia.
