# Pack — A5 + A6 (atajos de teclado y cantidad `N*` en el POS) · A18 descartado · A8 cubierto

> Origen: `mejoras-acumulativas.md` (análisis SICOVESTO). Destino: **Retail** (`apps/retail`, solo renderer), 2 PRs.
> Sin número de ADR a propósito: lo asigna el usuario a mano.
> Contenido: (1) texto de ADR, (2) bloque de `Estado.md`, (3) prompt de implementación para Superpowers.

---

## 1. Texto de ADR (para `docs/ADR-Log-ferreteria.md`)

## ADR-XXX — Retail POS: atajos de teclado centralizados y cantidad `N*` en el escaneo (A18 descartado, A8 cubierto)

**Estado:** Aceptado — pendiente de implementación (2 PRs) · **Fecha:** 2026-10-19

**Contexto.** Del análisis comparativo con SICOVESTO salieron cuatro candidatos de mostrador: A5 (atajos F1–F10), A6 (escaneo con cantidad `3*`), A18 (edición de precio inline en la grilla) y A8 (remito con/sin precios). El discovery mostró:

- **Los atajos ya existen, con otro mapa.** Menú nativo (`appMenuTemplate.ts`): Ctrl+N nueva venta, Ctrl+F buscar producto (navega a `/productos`), Ctrl+E ventas en espera, Ctrl+F4 cerrar caja, **F1 = ayuda de atajos** (diálogo con texto fijo `ATAJOS` en `appMenu.ts`). POS (`PosBottomBar.tsx`): **F8** abre las ventas en espera y **F9** pone la venta en espera, con listeners de `window` propios. Paleta: Ctrl+K. Copiar el F1–F10 de SICOVESTO chocaría con F1 (ayuda), F8/F9 (otro significado) y F10 (en Windows activa la barra de menú).
- **Defecto previo:** los listeners F8/F9 siguen activos con un modal abierto (p. ej. Confirmar venta), por lo que F9 podría disparar una pausa por detrás.
- `addLinea` (`usePosSession.ts`) suma siempre 1 por escaneo (`nuevaCantidad = existing + 1`).
- El precio unitario del POS no es editable; sí hay descuento por línea y descuento global, visibles con `precio.override`. **El main no controla `precio.override` en ningún handler** (solo seed y renderer); el servidor sí re-resuelve el precio de lista y exige credenciales de Supervisor si no coincide (`PRECIO_DESACTUALIZADO`, ADR-049 §9).
- **El remito ya sale sin precios por diseño** (ADR-045: `remito_linea` "sin importes, a propósito"; el printable no incluye importes).

**Decisión.**

*A. Atajos del POS (A5) — mapa propio de Retail, centralizado.* Un hook `usePosHotkeys` con una **tabla declarativa acción→tecla** reemplaza los listeners sueltos de `PosBottomBar`. La misma tabla alimenta (i) el diálogo de ayuda F1, (ii) los rótulos visibles en los botones y (iii) los tooltips (UX8). El hook se **desactiva mientras haya un modal o drawer abierto** (corrige el defecto previo). Mapa (evita F5, F10, F11 y F12 por ser del sistema o de desarrollo):

| Tecla | Acción | Condición |
|---|---|---|
| F2 | Enfocar el buscador/escáner | siempre (sin modal) |
| F4 | Cobrar (abre Confirmar venta) | hay líneas y no está cargando |
| F6 | Foco en el campo "Desc. %" de la última línea agregada | solo con `precio.override`; hay líneas |
| F8 | Ventas en espera (se mantiene) | hay ventas en espera |
| F9 | Poner en espera (se mantiene) | hay líneas y no está cargando |
| Esc | Cancela el multiplicador `N*` pendiente | hay multiplicador pendiente |

F6 actúa sobre la **última línea agregada** (no hay modelo de selección del carrito; la navegación por flechas queda como espacio reservado, existe `useFilaNavegable`). Ctrl+F del menú sigue yendo a `/productos`; no se cambia. La tabla vive en un módulo puro que el renderer y el diálogo de ayuda del main leen de la misma fuente (ubicación a confirmar en el discovery; no se crea un módulo en `packages/*` sin aprobación).

*B. Cantidad `N*` (A6) — de un solo uso.* Al escribir en el buscador un valor que cumpla `^\s*(\d+(?:[.,]\d+)?)\s*\*\s*$` (p. ej. `3*`, `2,5*`) el campo se limpia y se muestra un chip "×N" junto al input; el siguiente producto agregado (escaneo, GTIN de presentación, Enter por código exacto o elección del dropdown) entra con cantidad N y **el multiplicador se consume siempre** (éxito o error). Esc lo cancela (F2/otro uso no). Se maneja como estado aparte y no dentro del valor del input, para que el debounce de 300 ms no busque `3*779…` como texto. Reglas: N > 0; decimal solo si el producto `permite_fraccion` (si no: error `CANTIDAD_FRACCION_NO_PERMITIDA`, con traducción en el catálogo de errores del renderer); el stock se valida con `existente + N` (× `factor_a_stock`); la cantidad queda en unidades de **presentación**, como el resto del carrito. `addLinea` suma un parámetro opcional de cantidad (default 1) sin romper a los demás llamadores. Sin persistencia entre ventas ni estado persistente (descartada la variante "hasta Esc" de SICOVESTO por el riesgo de vender ×N de todo lo siguiente).

*C. A18 (edición de precio por línea) — descartado por decisión de producto.* En el POS **no se cambia el precio de una línea; solo se otorga descuento** (campo "Desc. %" por línea y descuento global, ambos bajo `precio.override`). El precio unitario es siempre el de la lista vigente. No se implementa precio manual ni su traducción a descuento. Cierra la pregunta: no reabrir sin nueva decisión.

*D. A8 (remito con/sin precios) — cubierto, sin cambios.* El remito ya se emite sin importes por decisión de ADR-045. No se agrega versión valorizada: las entregas parciales obligarían a prorratear descuento global y redondeo a $1 y podrían mostrar importes que difieren de la factura. Si hay demanda, la vía más barata sería una opción de impresión (sin esquema nuevo) que lea `precio_unitario` desde `venta_detalle_id` y muestre solo importes por línea, sin total. A9 (logística) y A10 (leyenda) siguen en menores.

*Entrega:* PR1 `usePosHotkeys` + tabla de atajos + ayuda F1 + rótulos visibles; PR2 `N*` (`PosScanBar` + `addLinea` + chip + error traducido). Sin migraciones, sin parámetros nuevos, sin flags (solo renderer y el texto de ayuda del main).

**Espacio reservado (documentado, no implementado).** Navegación del carrito con flechas y atajos por línea seleccionada; atajos configurables por usuario; hook genérico en `@core/ui` cuando el POS de Elaborados tenga su propio mapa (regla de tres); remito valorizado como opción de impresión.

**Fuera de alcance (ADR chico de seguridad aparte).** (1) El main no exige `precio.override` cuando `descuento_linea` o `descuento_global` son > 0: hoy la restricción de la matriz RBAC se aplica solo en la pantalla. (2) `PRECIO_DESACTUALIZADO` no tiene camino en la UI (`mensajeErrorVenta` no lo traduce y no hay modal de credenciales): si una lista cambia entre agregar y confirmar, la venta queda bloqueada con el código crudo. (3) `dias_hasta_agotar` del dashboard ignora `factor_a_stock_aplicado` (ya registrado en el ADR de Inventario).

**Consecuencias.** Un solo punto de definición de teclas, visible en pantalla y en F1. F8/F9 dejan de dispararse con un modal abierto (cambio de comportamiento intencional). El mostrador gana cobro y foco de buscador por teclado y carga de cantidades sin tocar el mouse. El precio de venta sigue siendo siempre el de lista.

---

## 2. Bloque para `Estado.md`

**Cabecera** — anteponer a "Última actualización" (lo previo pasa a "Previo"):

```
2026-10-19 (**Retail POS — atajos de teclado centralizados y cantidad `N*` — ADR-XXX** — decisión aceptada, **pendiente de implementación en 2 PRs**: PR1 hook `usePosHotkeys` con tabla acción→tecla (F2 buscador, F4 cobrar, F6 desc. % de la última línea, F8/F9 esperas, Esc cancela multiplicador), ayuda F1 y rótulos visibles, desactivado con modales abiertos; PR2 multiplicador `N*` de un solo uso en el escaneo. **Decisiones de producto:** no se permite cambiar el precio por línea en el POS (A18 descartado; solo descuento) y el remito sigue sin precios (A8 cubierto por ADR-045). **Fuera de alcance, ADR chico de seguridad aparte:** `precio.override` sin control en el main y `PRECIO_DESACTUALIZADO` sin camino en la UI. Solo renderer, sin migraciones. **Previo:** …
```

**Bitácora de decisiones** — agregar:

```
- `2026-10-19` — Retail POS: aprobado el diseño de A5+A6 (ADR-XXX). Mapa de atajos propio (no se copia el F1–F10 de SICOVESTO por choques con F1/F8/F9/F10); `N*` de un solo uso; **decisión de producto: el precio por línea no se edita en el POS, solo descuento (A18 descartado)**; A8 queda cubierto (el remito ya es sin importes, ADR-045). Pendiente aparte: enforcement server de `precio.override` y UI para `PRECIO_DESACTUALIZADO`.
```

**Tabla "ADRs de arquitectura"** — fila: `ADR-XXX | Retail POS: atajos centralizados y cantidad N* | Aceptado (pendiente de implementación) | 2026-10-19 | docs/ADR-Log-ferreteria.md`.

**Releases / próximas fases** — en 1.1.x de Retail: "Atajos de teclado del POS y cantidad `N*` — ADR-XXX — pendiente".

**Backlog** (`mejoras-acumulativas.md`): A5 ✔ decidido · A6 ✔ decidido · A18 ✘ descartado por producto · A8 ◐ cubierto (ADR-045) · siguientes: A16, A24 (tramo interno), A22.

---

## 3. Prompt de implementación para Superpowers

```
# CONTEXTO
Monorepo pnpm `Gestion-Pymes-Apps` (Electron 32 + React + TypeScript). Trabajás en `apps/retail` (`ferreteria-client`), solo renderer + un texto de ayuda del main. Leé `CLAUDE.md` antes de empezar: rige.
Castellano rioplatense. Offline-first. Phase-gate: el ADR-XXX autoriza tocar PosBottomBar.tsx, PosView.tsx, PosScanBar.tsx, PosTopBar.tsx, usePosSession.ts y el texto ATAJOS de appMenu.ts SOLO en lo descripto abajo.
Fuente de verdad del diseño: `docs/Pack-A5-A6-atajos-y-cantidad-pos.md` §1 (ADR-XXX). Si algo no está ahí, NO lo inventes: frená y preguntá.
Flujo: TDD (RED-GREEN-REFACTOR), un PR por fase. Tests del renderer con vitest/jsdom (`cd apps/retail && pnpm exec vitest run --config vitest.config.ts <archivo>`); suites del main en SERIE si las tocás. Los comandos largos (suite completa, pnpm dev) los lanzás vos, no un subagente.

# DECISIONES CERRADAS (no reabrir)
- En el POS NO se edita el precio de una línea: solo descuento (Desc. % por línea y global, bajo `precio.override`). No implementes precio inline, precio manual ni nada que modifique el precio unitario.
- El remito no cambia (ya es sin importes, ADR-045).
- No copiar el mapa F1–F10 de SICOVESTO.

# GATE 0 — GIT LIMPIO
1. `git status` y `git branch --show-current`. Si el árbol no está limpio o no estás en `main` actualizado: STOP y avisá.
2. Rama de la fase: `feat/retail-pos-hotkeys`, luego `feat/retail-pos-cantidad-multiplicador` (parte de main con la Fase 1 mergeada).

# FASE 1 — PR1: usePosHotkeys + tabla de atajos
1. Discovery (solo lectura): releer `PosBottomBar.tsx` (listeners F8/F9), `PosView.tsx` (estados de modales: confirmarOpen, cancelarOpen, pausarOpen, esperaDrawerOpen, limiteAuth, ventaResult), `PosTopBar.tsx`/`PosScanBar.tsx` (cómo se obtiene el foco del input), `PosItemsTable.tsx` (input "Desc. %"), `main/menu/appMenu.ts` (constante ATAJOS) y `appMenuTemplate.ts`. Reportá: qué tests existentes cubren F8/F9, y cómo importaría `ATAJOS` la tabla.
2. STOP-AND-CONFIRM: proponé la ubicación del módulo puro de la tabla de atajos (debe poder importarlo el renderer y el main de Retail). Opciones a evaluar: carpeta compartida dentro de `apps/retail/src/` o `packages/shared`. NO crees ni modifiques nada en `packages/*` sin mi OK. Esperá mi respuesta.
3. RED: tests de `usePosHotkeys`: F2 enfoca el buscador; F4 abre Confirmar solo con líneas y sin loading; F6 enfoca el "Desc. %" de la última línea solo si hay `precio.override` y líneas (sin permiso: no hace nada); F8 solo si hay ventas en espera; F9 solo con líneas y sin loading; todas deshabilitadas con cualquier modal/drawer abierto; Esc cancela el multiplicador solo si está pendiente (dejá el contrato listo para la Fase 2: callback `onCancelarMultiplicador` opcional); preventDefault en las teclas manejadas; se limpia el listener al desmontar.
4. GREEN: implementar el hook con la tabla declarativa acción→{tecla, etiqueta, condición}. Reemplazar los listeners de `PosBottomBar` por el hook (sin duplicar). Exponer foco: ref del input del buscador (`PosScanBar`) y atributo/ref para el "Desc. %" de la última línea en `PosItemsTable`.
5. Rótulos y ayuda: mostrar la tecla en los botones (Cobrar/Confirmar → F4, Espera → F9, Ventas en espera → F8) y en tooltips, leyendo de la tabla. Actualizar el diálogo de ayuda F1 (`ATAJOS` en `appMenu.ts`) para que se genere desde la misma tabla (o, si la restricción de módulos lo impide, test que falle si divergen). Ctrl+F y demás atajos del menú NO se tocan.
6. Test de regresión del defecto previo: con el modal Confirmar abierto, F9 y F8 no hacen nada.
7. Cierre de fase: typecheck, tests del renderer afectados y suite completa del renderer; main solo si tocaste `appMenu.ts` (en serie). Con `pnpm dev` (rebuild para Electron antes): entrá al POS navegando como un usuario con caja abierta y verificá F2, F4, F6 (con Supervisor), F8, F9, y que F1 muestra el mapa nuevo. Si no podés verificarlo en la app, decilo explícitamente.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# FASE 2 — PR2: multiplicador `N*`
1. Discovery (solo lectura): `PosScanBar.tsx` (doSearch, handleSelect, onAdd en sus 5 usos), `PosTopBar.tsx` (cómo pasa onAdd), `usePosSession.ts` (`addLinea`, validación de stock, presentación/GTIN), `lib/errores.ts` (catálogo de errores y cómo se mapean los códigos del carrito) y `PosBottomBar.tsx` (`errorMsg`). Reportá los llamadores de `addLinea`.
2. RED: tests de `addLinea` con cantidad (default 1 intacto; existente + N; stock con `existente + N` × factor; decimal rechazado con `CANTIDAD_FRACCION_NO_PERMITIDA` si no `permite_fraccion`; N ≤ 0 rechazado) y de `PosScanBar` (escribir `3*` limpia el campo y muestra el chip ×3; el siguiente escaneo/Enter por código/GTIN de presentación/elección del dropdown entra con cantidad 3 y consume el chip; error también consume el chip; Esc lo cancela; `2,5*` y `2.5*` válidos; `*3`, `3**`, `a*` NO son multiplicador y se buscan como texto; el debounce no busca el texto `3*`).
3. GREEN: `addLinea(productoId, presentacionId?, factorAStock?, unidadAbreviatura?, cantidad = 1)` (parámetro opcional al final); estado `multiplicadorPendiente` en `PosScanBar`; chip visible y accesible (texto, no solo color); integración con `usePosHotkeys` (Esc). Traducción de `CANTIDAD_FRACCION_NO_PERMITIDA` en el catálogo de errores del renderer y en `errorMsg`.
4. Reglas: la cantidad queda en unidades de presentación; no persiste entre ventas; no tocar el cálculo de precios ni totales.
5. Cierre de fase: typecheck, renderer completo. En `pnpm dev`: POS → escribir `3*`, escanear/buscar un producto → línea con cantidad 3; probar un producto sin fracción con `2,5*` y uno con `permite_fraccion`; Esc. Si no podés verificarlo en la app, decilo.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# CONDICIONES DE STOP (todas las fases)
- Cualquier edición del precio unitario de una línea ⇒ STOP (decisión cerrada: solo descuento).
- Cambios en `packages/*`, `@core/*`, Elaborados, el servidor de ventas (`venta.ts`), esquema o migraciones ⇒ STOP y consultá.
- Corregir `PRECIO_DESACTUALIZADO` sin UI o el control de `precio.override` en el main ⇒ FUERA de alcance (ADR chico de seguridad aparte): no lo toques aunque lo veas.
- Una dependencia nueva ⇒ STOP.
- Tests rotos que no son tuyos ⇒ no los arregles en silencio: reportalos.

# CIERRE DOCUMENTAL (en el PR de la última fase)
Actualizá `Estado.md` (cabecera + Bitácora + tabla de ADRs + releases) y `docs/ADR-Log-ferreteria.md` (ADR → Implementado, fechas, gates de tests). Un paso no está cerrado hasta que ambos estén al día.

# ENTREGA DE CADA FASE
Resumen de qué cambió, diff completo, salida de typecheck y de los tests, qué verificaste en la app y qué NO pudiste verificar. No hagas merge: lo decido yo.
```
