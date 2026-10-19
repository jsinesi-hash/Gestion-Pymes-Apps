# Pack — A16 (visibilidad de costos y márgenes: permiso `costo.ver`)

> Origen: `mejoras-acumulativas.md` (análisis SICOVESTO, sub-caso "ocultar costos/márgenes a empleados"). Destino: **Retail** (`apps/retail`) + una etiqueta en `packages/shared`. 1 PR.
> Sin número de ADR a propósito: lo asigna el usuario a mano.
> Contenido: (1) texto de ADR, (2) bloque de `Estado.md`, (3) prompt de implementación para Superpowers.

---

## 1. Texto de ADR (para `docs/ADR-Log-ferreteria.md`)

## ADR-XXX — Retail: permiso `costo.ver` (el Operador no ve costos ni márgenes)

**Estado:** Aceptado — pendiente de implementación (1 PR) · **Fecha:** 2026-10-19

**Contexto.** SICOVESTO permite ocultar costo de mercadería y ganancia bruta a los empleados mediante un árbol de permisos muy fino. Para la ferretería interesa solo el sub-caso "que el empleado venda sin ver costo ni margen", sin abandonar el modelo simple Operador/Supervisor (ADR-008). El discovery mostró que la visibilidad de costos hoy se controla **de forma indirecta**, por permisos de módulo: `dashboard.ver` (márgenes, valorización), `proveedor.gestionar` (órdenes de compra y costos por proveedor, también en el main), `config.fiscal` e `import.masiva` (listas, lotes e importación de costos). El Operador no accede a esas pantallas y `exportar.ts` no tiene columnas de costo ni margen. Las fugas verificadas son:

- **Kardex** (`stock/:id/kardex`): la columna "Costo u." se muestra con solo permisos de stock.
- **Handlers `producto:*`**: no tienen `requirePermission` y devuelven datos de costo a cualquier sesión: `productoListHandler` (`precio_costo_promedio`, `margen_ganancia`) y `productoGetHandler` (todas las columnas de `producto`, incluidas esas dos). La pantalla no las muestra, pero cualquier cliente del IPC las lee.
- **`movimiento-stock:list`** devuelve `costo_unitario` de cada movimiento.
- **Detalle de producto**: calcula el aviso "falta costo" en el renderer a partir de `precio_costo_promedio`.
- Además `stock.ts` selecciona `precio_costo_promedio` en otro listado (línea ~269): se audita en el discovery de la implementación.

**Decisión.**

*A. Permiso nuevo `costo.ver`.* Se agrega a `PERMISOS` de Retail (`apps/retail/src/main/auth/seed.ts`, módulo `catalogo`) **sin** sumarlo a `OPERADOR_PERMISOS`: lo tiene el Supervisor (que recibe todos los permisos con `runSeed`, aditivo) y no el Operador. Etiqueta amigable en `ETIQUETA_PERMISO` de `@ferreteria/shared` (`packages/shared/src/permisos.ts`), exigida por el test de cobertura contra `PERMISOS`. Un único permiso cubre costo y margen (no se separa "ver margen": YAGNI). Vive en Retail por ahora; se promueve a `PERMISOS_CORE` cuando Elaborados adopte los mismos controles (regla de tres). El código actual de Elaborados no consulta este permiso, así que no cambia nada ahí.

*B. Control en el main y en la UI (defensa en profundidad).*
- Un helper `puedeVerCosto()` (sesión con `costo.ver`) en el main de Retail.
- `productoListHandler` y `productoGetHandler`: sin `costo.ver`, **omiten** `precio_costo_promedio` y `margen_ganancia` (la clave no aparece en el objeto; no se devuelve 0 ni `null`). Con o sin permiso devuelven el booleano `falta_costo` (`precio_costo_promedio <= 0`, misma regla que hoy usa el renderer), calculado en el main.
- `movimiento-stock:list`: sin `costo.ver`, omite `costo_unitario`.
- Cualquier otro handler de lectura que devuelva esos campos al Operador (p. ej. el listado de `stock.ts`) se cierra igual; el discovery de la implementación lista los casos y se confirman antes de editar.
- UI: el Kardex oculta la columna "Costo u." sin `can('costo.ver')`; el detalle de producto usa `falta_costo` en vez de `precio_costo_promedio`.
- Los handlers **de escritura** no cambian de comportamiento, y el POS no depende del costo (usa `precio_venta_lista` y el impuesto).

*C. El Operador sigue cargando costo.* Entradas de stock y alta con stock inicial conservan el campo "Costo unitario" y el CPP se sigue actualizando con lo tipeado: es entrada, no lectura, y sacarlo degradaría la calidad del costo promedio ponderado. El texto "Se actualizará el CPP con $X/u" muestra lo que el usuario escribió, no un dato guardado. Si se quiere restringir la carga, es otra decisión (ADR aparte).

*D. Sin flag ni parámetros.* El permiso es el interruptor. Cambio de comportamiento intencional: tras actualizar, el Operador de una instalación existente deja de ver costos en el Kardex y de leerlos por IPC. Conceder la visibilidad a un Operador hoy requeriría un cambio en la base o un ADR de edición de roles (PERF-3 opción B, abierta); la pantalla "Roles y permisos" (solo lectura) mostrará el permiso nuevo.

**Espacio reservado (documentado, no implementado).** Separar "ver costo" de "ver margen"; promover `costo.ver` a `PERMISOS_CORE`; ocultar el campo de costo al cargar stock; editar permisos por rol desde la UI (PERF-3 B).

**Fuera de alcance.** El control de `precio.override` en el main y la UI de `PRECIO_DESACTUALIZADO` (ADR de seguridad de ventas, sesión aparte); el posible `FORBIDDEN` en la recepción de compra del Operador (el menú usa `compra.recibir` pero `compras.oc.get` exige `proveedor.gestionar`; a verificar con un login de Operador); `dias_hasta_agotar` (ADR de Inventario).

**Consecuencias.** Un permiso granular más (tests de conteo del seed y etiquetas se actualizan). El Operador pierde la columna de costo del Kardex: avisar en las notas del release. `CLAUDE.md` §8 suma el permiso y la fila de la matriz.

---

## 2. Bloque para `Estado.md`

**Cabecera** — anteponer a "Última actualización" (lo previo pasa a "Previo"):

```
2026-10-19 (**Retail — permiso `costo.ver`: el Operador no ve costos ni márgenes — ADR-XXX** — decisión aceptada, **pendiente de implementación en 1 PR**: permiso nuevo solo para Supervisor (etiqueta en `@ferreteria/shared`); `producto:get`/`list` y `movimiento-stock:list` omiten `precio_costo_promedio`, `margen_ganancia` y `costo_unitario` sin el permiso, con `falta_costo` calculado en el main; Kardex sin columna de costo. El Operador sigue cargando costo en entradas y altas. Vive en Retail (promoción al core cuando Elaborados lo adopte). Origen: A16 del análisis SICOVESTO. **Fuera de alcance:** `precio.override` en el main (ADR de seguridad de ventas), posible `FORBIDDEN` en la recepción de compra del Operador. **Previo:** …
```

**Bitácora de decisiones** — agregar:

```
- `2026-10-19` — Retail: aprobado A16 (ADR-XXX). Discovery: los costos ya estaban cerrados por permisos de módulo; las fugas reales son el Kardex y los handlers `producto:*`/`movimiento-stock:list` (sin guard, devuelven costo a cualquier sesión). Decisión: permiso `costo.ver` (solo Supervisor), control en UI y en el main, `falta_costo` booleano, el Operador sigue cargando costo, permiso en Retail por ahora.
```

**Tabla "ADRs de arquitectura"** — fila: `ADR-XXX | Retail: permiso costo.ver | Aceptado (pendiente de implementación) | 2026-10-19 | docs/ADR-Log-ferreteria.md`.

**Releases / próximas fases** — en 1.1.x de Retail: "Permiso `costo.ver` (visibilidad de costos) — ADR-XXX — pendiente".

**Backlog** (`mejoras-acumulativas.md`): A16 ✔ decidido (acotado a `costo.ver`); siguientes: A24 (tramo interno de NC/ND), A22.

---

## 3. Prompt de implementación para Superpowers

```
# CONTEXTO
Monorepo pnpm `Gestion-Pymes-Apps` (Electron 32 + React + TypeScript + SQLite). Trabajás en `apps/retail` (`ferreteria-client`) y, solo para una etiqueta, en `packages/shared`. Leé `CLAUDE.md` antes de empezar (§8 permisos, "Al agregar un permiso", dos runners de test): rige.
Castellano rioplatense. Offline-first. Phase-gate: el ADR-XXX autoriza lo descripto abajo y nada más.
Fuente de verdad del diseño: `docs/Pack-A16-visibilidad-de-costos.md` §1 (ADR-XXX). Si algo no está ahí, NO lo inventes: frená y preguntá.
Flujo: TDD (RED-GREEN-REFACTOR). Un PR. Tests del main bajo Electron (`node scripts/test-node.cjs`) y del renderer con vitest, los del main en SERIE (el runner es flaky en paralelo). Los comandos largos (suite completa, pnpm dev) los lanzás vos, no un subagente.

# DECISIONES CERRADAS (no reabrir)
- Permiso `costo.ver`, solo Supervisor. Un único permiso para costo y margen.
- Control en UI y en el main. La clave se OMITE del objeto (no se devuelve 0 ni null).
- El Operador sigue pudiendo cargar costo en entradas de stock y altas con stock inicial: NO tocar esos formularios.
- El permiso vive en Retail; NO tocar `PERMISOS_CORE` ni Elaborados.
- Sin flag, sin parámetros, sin migraciones.

# GATE 0 — GIT LIMPIO
1. `git status` y `git branch --show-current`. Si el árbol no está limpio o no estás en `main` actualizado: STOP y avisá.
2. Creá la rama `feat/retail-permiso-costo-ver`.

# PASOS
1. Discovery (solo lectura): releer `apps/retail/src/main/auth/seed.ts` (PERMISOS, OPERADOR_PERMISOS), `packages/shared/src/permisos.ts` (ETIQUETA_PERMISO y su test de cobertura), los tests que afirman el conteo exacto de permisos (`auth/__tests__/seed.test.ts`, `ipc/__tests__/auth.ipc.test.ts` y los que encuentres con grep), `ipc/producto.ts` (`productoListHandler`, `productoGetHandler`, y qué devuelven `productoCreateHandler`/`productoUpdateHandler`/`productoQuickCreateHandler`), `ipc/movimiento-stock.ts` (`movimientoStockListHandler`), `ipc/stock.ts` (~línea 269, listado que selecciona `precio_costo_promedio`), `renderer/views/stock/Kardex.tsx`, `renderer/views/productos/ProductoDetalle.tsx`, `renderer/hooks/useMovimientos.ts` y los helpers de test (`setupDb`, `loginAsAdmin`, cómo loguear un Operador).
   Reportá una tabla de TODOS los handlers/IPC que devuelven `precio_costo_promedio`, `margen_ganancia` o `costo_unitario` a sesiones sin `proveedor.gestionar`/`dashboard.ver`, y qué consumidores del renderer los usan.
2. STOP-AND-CONFIRM: mostrame la tabla del discovery y la lista exacta de handlers que vas a recortar. Si aparece uno fuera de `producto:get`, `producto:list`, `movimiento-stock:list` y el listado de `stock.ts`, esperá mi OK antes de tocarlo. Confirmame también cómo se obtiene la sesión en el main (`getSession().permisos`) para el helper.
3. RED → GREEN, permiso:
   - Agregar `{ codigo: 'costo.ver', modulo: 'catalogo' }` a `PERMISOS` (NO a `OPERADOR_PERMISOS`).
   - Agregar su etiqueta amigable en `ETIQUETA_PERMISO` (`packages/shared`; única edición autorizada en `packages/*`). Recompilar shared (`cd packages/shared && pnpm build`).
   - Actualizar los tests de conteo de permisos (Supervisor +1, Operador sin cambios) y verificar que el Supervisor recibe `costo.ver` y el Operador no, incluso en una BD ya inicializada (runSeed aditivo).
4. RED → GREEN, main:
   - Helper `puedeVerCosto()` (sesión con `costo.ver`).
   - `productoListHandler` y `productoGetHandler`: sin el permiso omiten `precio_costo_promedio` y `margen_ganancia`; siempre devuelven `falta_costo: boolean` (`precio_costo_promedio <= 0`, antes `(x ?? 0) <= 0`).
   - `movimientoStockListHandler`: sin el permiso omite `costo_unitario`.
   - El listado de `stock.ts` y cualquier otro de la lista aprobada en el paso 2.
   - Si create/update devuelven la fila completa, recortá igual.
   - Tests: Operador no recibe las claves (verificar con `toHaveProperty(..., false)`/`in`), Supervisor sí; `falta_costo` correcto en ambos; sin sesión sigue fallando como hoy. Los tests existentes con admin siguen verdes.
5. RED → GREEN, renderer:
   - `Kardex.tsx`: ocultar la columna "Costo u." (encabezado y celdas) sin `can('costo.ver')`. Ajustar colSpan si hay filas vacías/totales.
   - `ProductoDetalle.tsx`: usar `producto.falta_costo` en lugar de `precio_costo_promedio`.
   - Cualquier otro consumidor que la tabla del paso 1 haya detectado.
   - `useMovimientos.ts`: tolerar `costo_unitario` ausente.
   - Tests de renderer: el Kardex con y sin el permiso; el detalle con `falta_costo`.
6. NO modificar: `StockEntradaModal`, `ProductoForm` (alta con stock inicial) ni los handlers de escritura; el dashboard, órdenes de compra, precios ni importación (ya están cerrados por permisos de módulo); Elaborados; `@core/*`.
7. Cierre de código: typecheck, tests del main (en serie), tests del renderer completos y tests de `packages/shared`.
8. Verificación en la app (`pnpm dev`, rebuild para Electron antes): entrar como Operador → Productos → Stock → Kardex de un producto con movimientos con costo: la columna "Costo u." no aparece; el detalle muestra "falta costo" cuando corresponde; la entrada de stock sigue aceptando costo. Entrar como Supervisor: todo igual que antes. Si no podés verificarlo en la app, decilo explícitamente. Aprovechá la sesión de Operador para anotar (sin arreglarlo) si la pantalla de recepción de compra devuelve FORBIDDEN, y reportalo.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# CONDICIONES DE STOP
- Cualquier cambio en `PERMISOS_CORE`, Elaborados, `@core/*`, migraciones o parámetros ⇒ STOP.
- Cualquier edición de los formularios de carga de costo ⇒ STOP (decisión cerrada).
- Tocar `precio.override`, `PRECIO_DESACTUALIZADO` o la recepción de compra ⇒ FUERA de alcance: solo reportá.
- Una dependencia nueva ⇒ STOP.
- Tests rotos que no son tuyos ⇒ no los arregles en silencio: reportalos.

# CIERRE DOCUMENTAL (en el mismo PR)
Actualizá `Estado.md` (cabecera + Bitácora + tabla de ADRs + releases), `docs/ADR-Log-ferreteria.md` (ADR → Implementado, fechas, gates de tests) y `CLAUDE.md` (§8: fila nueva "Ver costos y márgenes — Operador — / Supervisor ✔" en la matriz, `costo.ver` en la tabla de permisos reales, y los conteos de permisos). Un paso no está cerrado hasta que todo esté al día.

# ENTREGA
Resumen de qué cambió, tabla de handlers recortados, diff completo, salida de typecheck y de las suites, qué verificaste en la app y qué NO pudiste verificar. No hagas merge: lo decido yo.
```
