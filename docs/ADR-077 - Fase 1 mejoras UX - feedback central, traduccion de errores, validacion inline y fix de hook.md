# ADR-077 — Fase 1 de mejoras UX: feedback central (toasts), traducción de errores, validación inline y fix de hook en listado

> **Brief de diseño / spec.** Surge de la auditoría de UX/seguridad
> (`docs/prompts-fases-mejoras-ux.md`, Fase 1) y del brainstorming del 2026-09-06.
> Comportamiento aditivo, migraciones cero. Unifica **toda la Fase 1** (6 ítems): BUG-1,
> ERR-1, ERR-2, PROD-1 (feedback y carga de datos, sólo renderer) más **NAV-1**
> (breadcrumbs jerárquicos, renderer) y **SEC-1** (control de navegación + CSP en el
> proceso main). Se implementó en dos tandas: primero 1–4, luego 5–6.

---

## 1. Contexto / problema

La auditoría de UX detectó cuatro dolores concretos en la carga de datos y el manejo de
errores del renderer:

1. **BUG-1 (correctitud, crítico).** En
   [`ProductosListado.tsx:183`](../packages/client/src/renderer/views/productos/ProductosListado.tsx)
   el hook `useFilaNavegable()` se llama **dentro de `items.map()`**. Viola las reglas de
   los hooks de React: la cantidad de hooks por render depende de la cantidad de filas, y
   cambia al paginar o filtrar. Puede corromper el estado de hooks y crashear el listado.

2. **ERR-1 (fondo, crítico).** No existe un sistema central de feedback en el renderer.
   No hay toasts; cada vista maneja el éxito/el error a mano. Peor: en
   [`ProductoForm.tsx:109`](../packages/client/src/renderer/views/productos/ProductoForm.tsx)
   el `handleSubmit` tiene `try { … } finally { setSaving(false); }` **sin `catch`**: si
   `producto.create/update` falla, el error se traga en silencio, la pantalla no avisa
   nada y el usuario no sabe si guardó.

3. **ERR-2 (crítico).** Donde sí se muestran errores, se muestra el `e.message` crudo que
   viene del main (mensajes técnicos de SQLite tipo `UNIQUE constraint failed:
   producto.gtin_barcode`). Ininteligible para el usuario de mostrador.

4. **PROD-1 (crítico).** La validación de `ProductoForm` corre **sólo al enviar** y todos
   los mensajes dicen `"Requerido"`. No hay validación al salir del campo, el foco no va
   al primer campo inválido, y los mensajes no dicen qué se espera.

## 2. Objetivo

Establecer una **capa de feedback única** en el renderer (toasts + helper de llamada IPC
+ traductor de errores) y usarla para cerrar los cuatro dolores, dejando `ProductoForm`
como el primer consumidor de referencia. Sin dependencias nuevas (política de CLAUDE.md:
"no introducir dependencias pesadas sin justificar"), sin tocar el main ni el esquema.

## 3. Decisiones

### 3.1 BUG-1 — extraer la fila a un componente propio

Se extrae una fila del listado a un componente `ProductoFila` (mismo archivo
`ProductosListado.tsx`) que llama `useFilaNavegable()` en su cuerpo. El `.map()` pasa a
renderizar `<ProductoFila key={p.id} producto={p} onOpen={…} />`. Queda **cero hooks en
loops o condiciones**. La tabla del modo "similares" ya esparce los props de navegación a
mano (no usa el hook), así que no se toca.

### 3.2 ERR-1 — feedback central

- **`ToastProvider` + `useToast()`** (nuevo, en `renderer/components/toast/`). El hook
  expone `{ success(msg), error(msg), info(msg) }`. Implementación propia, **sin librería**:
  un contenedor `position: fixed` abajo-derecha, toasts apilados, auto-cierre ~4 s, botón
  de cerrar, `role="status"` / `aria-live="polite"` para accesibilidad.
- **Punto de montaje: `App.tsx`, envolviendo `RouterProvider`** — **no** `AppShell`. Así
  los toasts están disponibles en **todas** las rutas (incluido Login) y sobreviven la
  navegación del `createMemoryRouter`. Es una desviación consciente del texto de la
  auditoría ("montado en AppShell"): mejor cobertura, misma intención.
- **Compatibilidad con los tests existentes.** El valor por defecto del contexto son
  funciones **no-op**, de modo que `useToast()` **nunca lanza** aunque el componente se
  renderice sin `ToastProvider` (como hacen hoy los tests de vistas, que montan la vista
  suelta con `MemoryRouter` y `window.ferreteria` mockeado). El provider real reemplaza
  esas no-op en la app.
- **Helper `useCallIpc()`** (hook, para poder acceder al toast). Expone
  `callIpc(fn, opts?)` que:
  - ejecuta `await fn()`;
  - en éxito, si `opts.success` está seteado, muestra toast verde con ese texto;
  - en error, traduce con `traducirError` (§3.3) y muestra toast rojo;
  - **devuelve un resultado discriminado** `{ ok: true, data } | { ok: false, error }`
    para que el llamador decida el flujo (p. ej. navegar sólo si `ok`). No re-lanza: el
    contrato es "el toast ya avisó, vos ramificás por `ok`".
- **Fix del silencio en `ProductoForm`.** `handleSubmit` pasa a usar `callIpc`: navega al
  detalle **sólo** si `ok`; si falla, el toast rojo traducido ya avisó y la pantalla se
  queda en el formulario con los datos cargados. El `finally`/`saving` se mantiene.

### 3.3 ERR-2 — traductor de errores conocidos

- Función pura `traducirError(e: unknown): { mensaje: string; accion?: AccionError }` en
  `renderer/lib/errores.ts` (testeable con vitest/jsdom, sin Electron).
- Catálogo de patrones conocidos como **tabla de datos** (patrón → mensaje humano),
  evaluado en orden. Casos de arranque:
  - `UNIQUE constraint failed: producto.gtin_barcode` → "Ya existe un producto con ese
    código de barras (EAN)."
  - `UNIQUE constraint failed` genérico → "Ya existe un registro con ese valor único."
  - `NOT NULL constraint failed: <tabla>.<col>` → "Falta completar un dato obligatorio."
  - `FOREIGN KEY constraint failed` → "El dato referenciado no existe o está en uso."
  - Fallback: si no matchea nada conocido, un mensaje legible genérico ("No se pudo
    completar la operación.") con el detalle técnico disponible sólo para depuración, no
    en el texto principal del toast.
- `accion?` es **opcional** y sólo se arma cuando el error trae información suficiente
  para ofrecer algo accionable (p. ej. abrir el producto existente). No se inventa un
  lookup frágil: si el error no trae el dato, se muestra sólo el mensaje. En esta primera
  iteración el catálogo puede no poblar `accion` en ningún caso; el tipo queda listo para
  crecer.
- Se enchufa dentro de `callIpc`/toast, de modo que **todo** error que pase por la capa
  central queda traducido sin trabajo extra del llamador.

### 3.4 PROD-1 — validación inline en `ProductoForm`

- **Validación onBlur por campo.** Estado `touched` por campo; al perder el foco un campo
  se valida ese campo y se muestra/oculta su mensaje. Se mantiene la validación total al
  submit.
- **Foco al primer campo inválido** al fallar el submit, recorriendo los campos en el
  orden visual del formulario (`nombre_corto` → `categoria_id` → `impuesto_id` →
  `precio_venta_lista` → `unidad_venta`).
- **Mensajes específicos** en lugar de `"Requerido"`:
  - `nombre_corto` vacío → "Ingresá un nombre."
  - `categoria_id` sin elegir → "Seleccioná una categoría."
  - `impuesto_id` sin elegir → "Seleccioná un impuesto."
  - `unidad_venta` sin elegir → "Seleccioná una unidad de venta."
  - `precio_venta_lista` vacío/NaN/≤ 0 → "Ingresá un precio mayor a 0." (además del
    numérico, ahora exige `> 0`).

### 3.5 NAV-1 — breadcrumb jerárquico y clicable

- Función pura `buildBreadcrumb(pathname): Crumb[]` en `renderer/lib/breadcrumb.ts`
  (`Crumb = { label; to? }`), testeable sin React. Deriva el rastro de la ruta a partir de
  una tabla de **secciones** (`{ grupo, base, baseLabel }`), evaluadas de base más larga a
  más corta para que la ruta específica gane sobre su prefijo (p. ej.
  `/remitos/transportistas` vs `/remitos`).
- Estructura del rastro: un crumb de **grupo** (contexto, sin link) + la **página de
  sección** (link `to` sólo cuando estás en una sub-ruta) + el **leaf** de la sub-ruta
  (nunca navegable). El leaf sale del último segmento (`nuevo`→"Nuevo", `editar`→"Editar",
  `kardex`→"Kardex", `sugerida`→"OC Sugerida", `recibir`→"Recepción", `cerrar`→"Cierre de
  caja"; un id de entidad → "Detalle"). Ruta desconocida → un único crumb neutro.
- `AppShell` reemplaza el `<div className="crumb">{crumb}</div>` plano por un `<nav>` que
  mapea el rastro a `<Link>` (ancestros con `to`) y `<span aria-current="page">` (actual),
  con separador "›". Se elimina el mapa plano `CRUMBS` (código muerto tras el cambio).
- **Nombres de entidad en el leaf** (p. ej. el nombre del producto en `/productos/:id`)
  **no** entran acá: requieren que la entidad esté cargada en `AppShell`, lo que obligaría
  a cablear cada vista de detalle. Queda como follow-up opcional; el leaf muestra "Detalle".

### 3.6 SEC-1 — endurecimiento de navegación + CSP

- Módulo `main/security/webSecurity.ts` con funciones **puras** (testeables bajo el runner
  de main, sin levantar Electron):
  - `esNavegacionPermitida(url, devServerUrl?)`: en dev sólo el origen del dev server de
    Vite; en prod sólo `file:`; el resto (http/https externos) se bloquea.
  - `contentSecurityPolicy()`: CSP de producción. `default-src 'self'`; permite las
    fuentes de Google que carga el `index.html` (`style-src … https://fonts.googleapis.com`,
    `font-src … https://fonts.gstatic.com`), `img-src 'self' data:`, estilos inline
    (`'unsafe-inline'` en `style-src`, porque la UI usa `style={{…}}` y CSS inyectado);
    `object-src 'none'`, `frame-src 'none'`. **No** habilita `unsafe-eval`.
- `aplicarSeguridadVentana(win, { isDev, devServerUrl })` cablea las tres protecciones:
  `setWindowOpenHandler(() => ({ action: 'deny' }))`, `will-navigate` que hace
  `preventDefault` cuando la nav no está permitida, y la CSP vía `onHeadersReceived`
  **sólo en producción** (en dev rompería el HMR/eval de Vite). Se invoca en `createWindow`
  de `main/index.ts` con `devServerUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? null`.

## 4. Alcance / no-alcance

- **En alcance:** los 6 ítems de la Fase 1 (BUG-1, ERR-1, ERR-2, PROD-1, NAV-1, SEC-1).
  `ProductoForm` es el primer consumidor de la capa de feedback; otras vistas se migran a
  `callIpc` de forma incremental en trabajo posterior, no acá.
- **Sin migraciones, sin cambios de esquema, sin permisos nuevos.** No aplica la trampa de
  navegación (no se agregan pantallas ni ítems de NAV; NAV-1 sólo cambia el breadcrumb).
- **Follow-ups conocidos (fuera de alcance):** nombres de entidad en el breadcrumb de
  detalle; migración del resto de las vistas a `callIpc`; ampliar el catálogo de
  `traducirError`.

## 5. Consecuencias

- (+) Feedback consistente y accesible en toda la app; base reusable (`useToast`,
  `callIpc`, `traducirError`) para el resto de las vistas.
- (+) Se elimina un bug de hooks latente y un guardado silencioso.
- (+) Errores de SQLite dejan de filtrarse crudos al usuario.
- (−) Deuda menor: sólo `ProductoForm` queda migrado a `callIpc` en esta iteración; el
  resto de las vistas sigue con su manejo ad-hoc hasta migrarse.
- (−) El catálogo de `traducirError` es finito; los errores no catalogados caen al
  fallback genérico (aceptable y ampliable).

## 6. Plan de pruebas (TDD, RED → GREEN → REFACTOR por ítem)

- **BUG-1:** test de `ProductosListado` que cambia la cantidad de filas (filtro/página) y
  verifica que no crashea y que las filas siguen navegando.
- **ERR-1:** tests de `ToastProvider`/`useToast` (mostrar, apilar, autocierre, cerrar);
  test de `callIpc` (éxito → toast verde + `ok:true`; error → toast rojo + `ok:false`);
  test de `ProductoForm` que fuerza el fallo del IPC y verifica que **muestra el error** y
  **no navega**.
- **ERR-2:** tests unitarios de `traducirError` para cada patrón conocido y el fallback.
- **PROD-1:** tests de `ProductoForm` para onBlur, foco al primer inválido y los mensajes
  específicos (incl. precio ≤ 0).
- **NAV-1:** tests unitarios de `buildBreadcrumb` (lista, detalle, nuevo/editar, kardex,
  precedencia de prefijos, config, fallback); `AppShell.test` acota sus aserciones de
  estructura del menú al sidebar (el breadcrumb ahora comparte etiquetas de grupo).
- **SEC-1:** tests unitarios de `contentSecurityPolicy` (self, fuentes de Google,
  object/frame none, sin unsafe-eval) y `esNavegacionPermitida` (dev vs prod, URL inválida).
- Suite completa en verde (renderer + node) con `pnpm test` desde `packages/client`.
- **Verificación manual** en `pnpm dev`: alta de producto con EAN duplicado (toast rojo
  legible), guardado OK (toast verde), submit con campos vacíos (foco + mensajes), blur de
  un campo requerido, breadcrumb clicable en una pantalla de detalle, y que el dev server
  de Vite (HMR) siga funcionando con las protecciones de SEC-1 activas.

## 7. Estado

`Aceptado — implementado`.

### Implementación (2026-09-06)

Ítems 1–4 implementados con TDD (RED → GREEN → REFACTOR por ítem). Sólo renderer; sin
migraciones, sin cambios en `main/`, sin permisos ni dependencias nuevas.

**Archivos nuevos**
- `renderer/components/toast/ToastProvider.tsx` — contexto + provider + contenedor visual;
  default no-op. `renderer/components/toast/useToast.ts` — hook `{ success, error, info }`.
- `renderer/hooks/useCallIpc.ts` — `callIpc(fn, { success? }) → { ok, data } | { ok, error }`.
- `renderer/lib/errores.ts` — `traducirError(e) → { mensaje, accion? }` (tabla de patrones).
- `renderer/lib/breadcrumb.ts` — `buildBreadcrumb(pathname) → Crumb[]` (NAV-1).
- `main/security/webSecurity.ts` — `contentSecurityPolicy()`, `esNavegacionPermitida()`,
  `aplicarSeguridadVentana()` (SEC-1).
- Tests: `ToastProvider.test.tsx` (6), `useCallIpc.test.tsx` (3), `errores.test.ts` (7),
  `ProductoForm.test.tsx` (6, nuevo), `breadcrumb.test.ts` (8),
  `main/security/__tests__/webSecurity.test.ts` (7) + caso de regresión BUG-1 en
  `ProductosListado.test.tsx`.

**Archivos modificados**
- `renderer/App.tsx` — `<ToastProvider>` envolviendo `<RouterProvider>`.
- `renderer/views/productos/ProductosListado.tsx` — fila extraída a `<ProductoFila>`
  (BUG-1): `useFilaNavegable()` sale de `items.map()`.
- `renderer/views/productos/ProductoForm.tsx` — `handleSubmit` vía `callIpc` (avisa el
  error traducido por toast y no navega si falla); validación onBlur por campo, foco al
  primer inválido y mensajes específicos (precio exige `> 0`).
- `renderer/views/shell/AppShell.tsx` — breadcrumb jerárquico con `<Link>` (NAV-1); se
  eliminó el mapa plano `CRUMBS`.
- `renderer/views/shell/AppShell.test.tsx` — aserciones de estructura del menú acotadas al
  sidebar (el breadcrumb comparte etiquetas de grupo).
- `main/index.ts` — invoca `aplicarSeguridadVentana` en `createWindow` (SEC-1).
- `renderer/styles/global.css` — estilos de toast y de breadcrumb.

**Nota sobre BUG-1.** El proyecto no tiene ESLint y `useFilaNavegable` no llamaba ningún
hook de React (sólo devuelve props), así que el "crash" descrito por la auditoría **no se
reproducía en runtime hoy** — era una violación de rules-of-hooks y una trampa latente
(crashea recién si alguien mete un hook real adentro). La refactor la elimina igual; queda
cubierta por un test de regresión que cambia la cantidad de filas y verifica navegación.

**Verificación.** `tsc --noEmit` limpio; suites del renderer y de main en verde (ver corrida
final). Pendiente: verificación manual en `pnpm dev` (§6), incluida la confirmación de que
las protecciones de SEC-1 no rompen el HMR de Vite en desarrollo.
