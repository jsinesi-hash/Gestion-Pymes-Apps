# ADR-081 — Fase 3 mejoras UX: búsqueda unificada, vistos recientemente e higiene

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-08

Segundo lote de la **Fase 3** de la auditoría de UX (personalización y pulido; continúa
ADR-080). Unifica el clúster coherente de **pulido + higiene** de la fase:

- **SRCH-2 / SRCH-3** (ítem 4) — `SearchBox` único para los listados + persistir
  búsqueda/filtros al volver de un detalle.
- **PERF-2** (ítem 5) — lista de "vistos recientemente" (productos/clientes).
- **BUG-2 / PRICE-4** (ítem 6) — baja de código muerto (`setPin`, `ConfigShell.tsx`,
  superficie IPC de `lista_precio_detalle`) + llevar el reporte de errores descargable al
  resto de las importaciones.

## Fuera de alcance (Fase 3, otras sesiones)

- **SEC-2** (ítem 3) — validación de payloads en **todos** los handlers de escritura del
  main. Es un esfuerzo cross-cutting sobre ~56 archivos IPC / ~192 handlers, con una
  decisión arquitectónica propia (zod como dependencia vs. validación a mano). ADR-080 ya
  lo marcó como "la pared de corte". **Va en su propio ADR/sesión**, no acá.
- **PERF-3** (ítem 5) — editor de permisos por rol desde la UI. Es una **decisión de
  producto abierta** (2 roles de sistema, invariante "no desactivar el último Supervisor",
  `es_sistema`). Se deja **propuesta con opciones, sin cerrar** (§5).

---

## 1. Contexto

- **Búsqueda (SRCH):** hoy solo `ProductosListado` persiste su estado de búsqueda/filtros
  al navegar, porque vive en `renderer/context/CatalogoContext.tsx` (context de sesión con
  `busqueda`, `busquedaUbicacion`, `filtros`, `sortBy/Dir`, `pagina`). Es el **único** de
  ~15 listados que lo hace: Clientes, Proveedores, OC, Presupuestos, Remitos,
  Transportistas, CtaCte, catálogos auxiliares, etc. usan `useState` local y **pierden el
  filtro al entrar a un detalle y volver**. Además cada uno reimplementa su input de
  búsqueda (ícono/placeholder/limpiar ad-hoc), sin resaltado del match.
- **Vistos recientemente (PERF-2):** no existe. La ruta índice es un redirect
  (`InicioRedirect`, ADR-080), no una landing. **Precedente:** `CommandPalette` ya guarda
  recientes por usuario en `localStorage` (`cmdk_recientes_u<id>`); se replica ese patrón
  local por terminal.
- **Código muerto (BUG-2):**
  - `setPin` en `preload/index.ts` (`usuario:setPin`) — **no tiene handler en el main**
    (verificado: `grep 'usuario:setPin' src/main` sin resultados). Bridge muerto desde que
    ADR-027/029 eliminaron el PIN.
  - `views/config/ConfigShell.tsx` — huérfano confirmado (nadie lo importa; solo se
    autorreferencia). Ya documentado como trampa en CLAUDE.md §Navegación.
  - `lista_precio_detalle` — residual pre-ADR-034 (hallazgo AUD-20260723-012). Sigue con
    3 handlers de escritura vivos (`listaPrecioDetalle:listByProducto/upsert/remove` en
    `src/main/ipc/lista-precio-detalle.ts`), namespace de preload (`precios.detalle.*`) y
    tests, pero **sin ningún consumidor de UI**. El precio hoy es absoluto y vive en
    `lista_precio_valor`.
- **Reporte de errores (PRICE-4):** los tres importadores ya bajan un CSV, pero **cada uno con
  su propia copia y convención inconsistente**: `ImportarCostosView.descargarCsvCostos` usa `,`
  y CRLF; el `SummaryStep` del wizard genérico (`/importar`) usa `,` y `\n` y sólo baja "el
  filtro actual" (no hay un botón directo de errores); `ImportarCatalogoProveedorView` usa el
  export de ADR-054. Ninguno de los dos primeros sigue la convención Excel-AR de ADR-EXP-03
  (BOM + `;`), así que abren con mojibake y con la coma decimal colisionando el separador.

## 2. Decisión — SRCH-2 / SRCH-3 (búsqueda)

### 2.1 `SearchBox` único (SRCH-2)

Componente controlado `renderer/components/SearchBox.tsx`:

- ícono de lupa, placeholder configurable, botón **limpiar** (✕) visible solo con valor,
  `aria-label`, soporte de `Escape` para limpiar.
- **Debounce interno configurable** (default 250 ms): el componente mantiene el valor
  tipeado (feedback inmediato) y emite `onDebouncedChange` al padre; expone también
  `onChange` inmediato para quien lo necesite.
- Helper de **resaltado del match**: `resaltarCoincidencia(texto, query)` →
  `ReactNode` (envuelve las coincidencias en `<mark>`), en `renderer/lib/resaltar.tsx`.
  Case/acento-insensitive, reutilizando la normalización existente del repo
  (`normalizarTexto`/`nombre_norm`) para no divergir del matching de búsqueda.

Adopción **incremental y no destructiva**: se reemplazan los inputs ad-hoc de los listados
de mayor tráfico por `SearchBox` (Clientes, Proveedores, Presupuestos, Remitos,
Transportistas, CtaCte); los que ya funcionan bien no se rompen. No cambia ninguna ruta ni
permiso. **`OrdenesCompraListado` queda fuera de esta tanda**: usa dos `<input className="input">`
custom (proveedor + número), sin el bloque `.search`; su migración es de mayor riesgo y se
difiere a otra iteración (coherente con la adopción incremental).

### 2.2 Persistencia de búsqueda/filtros (SRCH-3)

Hook genérico `usePersistentListState<T>(clave, inicial)` en
`renderer/hooks/usePersistentListState.ts`, respaldado por un **store en memoria a nivel de
módulo** keyed por `clave` de listado (ej. `'clientes'`, `'proveedores'`).

- Semántica **de sesión** (sobrevive a navegar a un detalle y volver; se resetea al
  reiniciar la app) — **idéntica a la que ya da `CatalogoContext`** hoy para Productos, sin
  agregar N providers ni tocar la BD.
- Productos sigue usando `CatalogoContext` (no se migra: ya funciona y tiene más estado);
  el hook cubre el **resto** de los listados.
- **No** usa `localStorage`: los filtros son estado efímero de trabajo, no preferencia
  durable (a diferencia de PERF-2, que sí es localStorage).

## 3. Decisión — PERF-2 (vistos recientemente)

### 3.1 Feature flag

`vistos_recientes_habilitado` (bool, **default `false`**), sembrado por **migración 0047**
(`parametros:set` es UPDATE-only). Por terminar en `_habilitado` aparece como toggle en la
pantalla de Funcionalidades (ADR-061). Con el flag apagado no se registra ni se muestra
nada — cero cambio de comportamiento.

### 3.2 Store local por usuario/terminal

`renderer/hooks/useVistosRecientes.ts` sobre `localStorage`, clave
`vistos_recientes_u<userId>` (espejo del patrón `cmdk_recientes`):

- Entradas `{ tipo: 'producto' | 'cliente', id, etiqueta, ts }`, **tope 8**, LRU
  (el más reciente arriba, dedupe por `tipo+id`).
- **Estado operativo local por terminal: no sincroniza, no va a la BD, no entra al backup**
  — coherente con la doctrina de estado local de ADR-047 §10 y con `cmdk_recientes`.
- Envuelto en `try/catch` para tolerar `localStorage` no disponible/lleno.

### 3.3 Registro y render

- **Registro:** se agrega una entrada al abrir `ProductoDetalle` y al abrir el
  detalle/edición de Cliente (`useEffect` con el id).
- **Render:** widget compartido `renderer/components/VistosRecientemente.tsx` (chips
  clickeables que navegan al detalle). Ubicación — dado que **no hay una landing única**
  (la raíz es un redirect):
  - **Dashboard** (inicio del Supervisor): una tarjeta más del bento.
  - **`ProductosListado` y `ClientesListado`** (superficies de mostrador del Operador): una
    tira compacta en el encabezado.
  - Respeta permisos: solo muestra ítems cuyo detalle el rol puede abrir.

> El punto del backlog dice "en el inicio". Como el inicio es un redirect a una pantalla
> existente (ADR-080), la lectura fiel es **mostrarlo donde el usuario aterriza según su
> rol**, no inventar una landing nueva (alternativa descartada en §6).

## 4. Decisión — BUG-2 / PRICE-4 (higiene)

### 4.1 BUG-2 — código muerto

- **`setPin`:** se elimina el bridge `usuario:setPin` de `preload/index.ts` (no hay handler
  que lo atienda). La **columna `pin_rapido` se conserva**: dropearla es una migración
  destructiva y ya está neutralizada (ADR-029 la setea a NULL); no se reescriben migraciones
  históricas (ver gotcha del journal de Drizzle).
- **`ConfigShell.tsx`:** se **borra** el archivo (huérfano, sin importadores ni test). Se
  actualiza la nota de la trampa en CLAUDE.md §Navegación para reflejar que ya no existe.
- **`lista_precio_detalle`:** se elimina la **superficie IPC de escritura** — el archivo
  `src/main/ipc/lista-precio-detalle.ts`, su registro en `src/main/index.ts`, el namespace
  `precios.detalle.*` de `preload/index.ts` y sus tests. **La tabla y sus migraciones se
  conservan** (dropear es destructivo; las migraciones históricas son inmutables): queda
  inerte, sin ruta de escritura. Se actualiza la ficha de CLAUDE.md §7 (Precios) que hoy
  dice "sigue con handlers de escritura y namespace de preload activos".

### 4.2 PRICE-4 — reporte de errores descargable unificado

- Se extrae un helper compartido en `renderer/lib/reporteImportacion.ts`:
  `construirCsvReporte(filas, columnas)` (puro, testeable) + `descargarReporteImportacion(...)`
  (dispara la descarga). Columnas declarativas `ColumnaReporte<T> = { header, valor }`.
- **Convención CSV unificada a ADR-EXP-03**: BOM UTF-8, separador `;`, CRLF, escape RFC 4180
  — para que Excel-AR lo abra con doble clic sin mojibake. Se migran `SummaryStep` (usaba `,`
  + `\n`) e `ImportarCostosView.descargarCsvCostos` (usaba `,`) al helper.
- El `SummaryStep` del wizard genérico `/importar` suma un **botón dedicado "↓ Descargar
  errores (.csv)"** que aparece sólo cuando hay filas con error (antes había que filtrar a
  "Errores" y usar "Descargar filtro actual"). `ImportarCatalogoProveedorView` conserva su
  export ADR-054 (ya tiene su propia máquina de export por perfiles).

## 5. PERF-3 — decisión de producto abierta (no se cierra acá)

Editar permisos por rol desde la UI toca invariantes sensibles. Se dejan **opciones para
confirmar** antes de implementar (posible ADR aparte):

- **(A) Solo lectura:** una pantalla que **muestra** la matriz RBAC (permisos por rol) sin
  edición. Cero riesgo; ya cubre el 80 % del valor (transparencia).
- **(B) Edición acotada:** permitir togglear permisos **no estructurales** por rol, con
  guardas duras: nunca quitar `usuario.administrar` al último rol que lo tenga, roles
  `es_sistema` con un subconjunto bloqueado, y todo cambio auditado. Requiere migración
  (persistir overrides) + repensar el seed aditivo de `runSeed`.
- **(C) No hacerlo:** los permisos siguen como datos en `seed.ts`; se documenta el
  procedimiento. 

Recomendación a discutir: **(A)** ahora (barato, seguro), **(B)** como ADR futuro si se
confirma la necesidad real.

## 6. Consecuencias

- **Aditivo y de bajo riesgo.** Única migración: 0047 (seed del flag `vistos_recientes_habilitado`).
  Sin cambios de esquema de tablas, sin cambios de permisos ni de su conteo por rol
  (los tests de conteo de `auth/__tests__/seed.test.ts` no se tocan).
- **SRCH** no cambia rutas ni CRUMBS: solo reemplaza inputs y agrega persistencia de sesión.
- **PERF-2** apagado de fábrica → cero impacto hasta prenderlo en Funcionalidades.
- **BUG-2** reduce superficie: preload y main pierden IPC muerto. `tsc --noEmit` debe quedar
  limpio; se borran los tests de `lista_precio_detalle` y del bridge `setPin`. Se actualizan
  dos notas de CLAUDE.md (Navegación y §7 Precios) para que la doc no mienta.
- **PRICE-4** unifica la convención CSV de importaciones en ADR-EXP-03.

## 7. Alternativas evaluadas

- **SRCH-3 con `localStorage`.** Descartada: los filtros son estado efímero de trabajo; que
  "recuerden" entre reinicios sorprende al usuario. Semántica de sesión (in-memory) es la que
  ya da `CatalogoContext`.
- **Migrar Productos al hook genérico.** Descartada: `CatalogoContext` ya funciona y tiene
  más estado (similitud, ubicación); migrarlo es riesgo sin beneficio.
- **PERF-2 en una landing nueva.** Descartada: crear una pantalla de inicio dedicada excede
  el ítem y choca con ADR-080 (el inicio es configurable a una pantalla existente). Se
  muestra donde el usuario aterriza.
- **PERF-2 sin flag.** Descartada: la doctrina (ADR-042/044) manda feature nueva detrás de
  flag default `false`.
- **Dropear la tabla `lista_precio_detalle` y la columna `pin_rapido`.** Descartada:
  migración destructiva + reescritura de historia; se dejan inertes.
- **Traer SEC-2 o cerrar PERF-3 en esta tanda.** Descartadas por §Fuera de alcance / §5.

---

### Implementación (2026-09-08)

Implementada con flujo TDD en la rama `feat/adr081-busqueda-recientes-higiene`.

- **Datos:** migración `0047_adr081_vistos_recientes_flag.sql` — siembra el flag
  `vistos_recientes_habilitado = 'false'`. Journal actualizado (idx 47).
- **SRCH-2/3:** `components/SearchBox.tsx` (debounce, limpiar, `Escape`, aria-label) +
  `lib/resaltar.tsx` (`resaltarCoincidencia`, plegado 1:1 que preserva posiciones) +
  `hooks/usePersistentListState.ts` (store de sesión en memoria, updater funcional como
  `useState`). Adoptados en Clientes, Proveedores, Presupuestos, Remitos, Transportistas y
  CtaCte (Productos sigue con `CatalogoContext`; OC diferido).
- **PERF-2:** `hooks/useVistosRecientes.ts` (store localStorage por usuario, tope 8, LRU,
  dedupe, tolerante a fallo; `useRegistrarVisto` no-op con flag off; `useVistosRecientesHabilitado`),
  widget `components/VistosRecientemente.tsx` + contenedor `components/VistosRecientesPanel.tsx`.
  Registro en `ProductoDetalle` y `ClienteDetalle`; panel montado en `DashboardView` (tab
  resumen) y en el encabezado de `ProductosListado` / `ClientesListado`. Todo gated por el flag.
- **BUG-2:** eliminado el bridge `usuario:setPin` de preload; borrado `ConfigShell.tsx`;
  retirada la superficie IPC de `lista_precio_detalle` (handler + registro en `main/index.ts` +
  namespace `precios.detalle.*` + tests). Tabla y columna `pin_rapido` conservadas inertes.
  Actualizadas dos notas de CLAUDE.md (§Navegación y §7 Precios).
- **PRICE-4:** `lib/reporteImportacion.ts` (`construirCsvReporte` + `descargarReporteImportacion`,
  convención ADR-EXP-03). Migrados `SummaryStep` (+ botón dedicado "Descargar errores") e
  `ImportarCostosView`.
- **Tests:** verdes en ambos runners — renderer 833, main 106 archivos / 1223 (bajó de 1232 por
  los tests borrados de `lista_precio_detalle`). `tsc --noEmit` limpio. Plan detallado en
  [`docs/superpowers/plans/2026-09-08-adr081-busqueda-recientes-higiene.md`](superpowers/plans/2026-09-08-adr081-busqueda-recientes-higiene.md).

**Pendiente:** verificación manual en la app (`pnpm dev`) navegando como Operador y Supervisor,
con el flag `vistos_recientes_habilitado` on y off (regla §12 de CLAUDE.md).
