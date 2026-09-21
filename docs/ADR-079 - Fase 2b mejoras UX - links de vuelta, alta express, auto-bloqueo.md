# ADR-079 — Fase 2b mejoras UX: links de vuelta al producto, alta express y auto-bloqueo por inactividad

**Estado:** Aceptado — implementado
**Fecha:** 2026-09-07
**Supersede/relaciona:** cierra la **Fase 2** de la auditoría de UX iniciada en **ADR-077**
(Fase 1) y continuada en **ADR-078** (Fase 2, ítems 1–3). Implementa los **ítems 4–6**. Se
apoya en el feedback central de ADR-077 (`useCallIpc`/toasts, traductor de errores) y en la
pantalla de Funcionalidades de **ADR-061** (que se integró a `main` durante esta tanda).

## Contexto

La Fase 2 (ADR-078) quedó con tres ítems diferidos a una "Fase 2b":

1. **NAV-2** — desde el listado de Stock, el Kardex, los lotes de precios y la cola de
   revisión se llegaba al producto, pero no había link de vuelta al detalle del producto.
2. **PROD-3** — no había forma de crear un producto sin salir del flujo (POS / compras); el
   alta completa vive en `ProductoForm`, con muchos campos.
3. **SEC-3** — la terminal de mostrador no se bloqueaba por inactividad; el RBAC no protege
   contra alguien que se sienta frente a una sesión abierta.

Durante la sesión, `main` avanzó: se mergearon **ADR-061 (pantalla de Funcionalidades)** y
la migración 0043 (hub encendido de fábrica). Eso cambió dos supuestos del plan original de
SEC-3 y se ajustó la decisión (ver más abajo).

## Decisión

### NAV-2 — Links de vuelta al producto

- **Kardex** (`views/stock/Kardex.tsx`): el título del producto es un `<Link>` a
  `/productos/:id`.
- **LoteDetalle** (`views/precios/LoteDetalleView.tsx`): la celda "Producto" (nombre) es un
  `<Link>` a `/productos/:producto_id`.
- **StockListado**: ya navegaba a `/productos/:id` (fila clicable, `useFilaNavegable`) → no
  se tocó.
- **Cola de revisión de costos** (`ColaRevisionCostosView`): **fuera de alcance a
  propósito**. Es un flujo de asignación de filas de importación que todavía **no** tienen
  producto vinculado; sus "candidatos" son sugerencias por similitud, no el producto, y
  linkearlos competiría con el click de "elegir candidato".
- Aditivo, sin IPC nuevo. Reusa la clase `crumb-link`.

### PROD-3 — Alta express de producto

- **Backend:** nuevo `productoQuickCreateHandler` (IPC `producto:quickCreate`, preload
  `catalogo.producto.quickCreate`). Payload mínimo
  `{ nombre_corto, precio_venta_lista, gtin_barcode? }`. Resuelve server-side los
  obligatorios y **delega en `productoCreateHandler`** (DRY, sin duplicar la lógica de
  SKU/existencias/presentación/valor de lista):
  - **categoría:** helper `getOrCreateCategoriaSinClasificar` — crea idempotente una
    categoría raíz `"Sin clasificar"` (categoría normal, editable/renombrable después).
  - **unidad_venta:** `'unidad'` (sembrada por el seed base; fallback defensivo a la primera
    unidad activa, porque `crearPresentacionDefault` exige que la abreviatura exista).
  - **impuesto_id:** el `impuesto` con `predeterminado = true`.
  - Permiso: hereda el guard de `productoCreateHandler` (sesión). El alta desde la UI la
    gatea `producto.crear` (que el Operador ya tiene).
- **Frontend:** componente reutilizable `AltaExpressModal` (nombre + precio + EAN opcional,
  validación inline al `onBlur` + foco al primer inválido, `useCallIpc`). Puntos de
  invocación:
  1. **PosScanBar**: cuando la búsqueda no arroja resultados, aparece "Crear producto «X»";
     al crear, se agrega el producto a la venta.
  2. **OrdenCompraDetalle** ("Agregar ítem"): botón "Nuevo producto"; al crear, queda en la
     lista y seleccionado en el formulario del ítem.
- **Desvío verificado respecto del pedido original:** el prompt de la Fase 2 decía "desde la
  Recepción de compra", pero `RecepcionView` recibe contra líneas de una OC ya definida y no
  tiene búsqueda ni alta de productos. El punto real de selección/alta de producto en compras
  es **OrdenCompraDetalle → "Agregar ítem"**, y ahí se integró (confirmado con el usuario).

### SEC-3 — Auto-bloqueo por inactividad

- **Configuración (ajustada a la infra nueva de ADR-061):** en vez de un único número
  seteado a mano, dos parámetros sembrados por **migración 0045**:
  - `bloqueo_inactividad_habilitado` (**bool**, default `'false'`): termina en `_habilitado`,
    así que la **pantalla de Funcionalidades (ADR-061) lo muestra como toggle** y el
    Supervisor lo prende/apaga desde la UI, sin tocar código.
  - `bloqueo_inactividad_minutos` (**number**, default `'15'`): el umbral.
  - Se siembran por migración (no por seed) porque `parametros:set` es **UPDATE-only** (la
    fila debe existir para poder togglearse) y porque las migraciones alcanzan también a
    instalaciones existentes. **Apagado de fábrica → cero cambio de comportamiento** hasta
    que un Supervisor lo prenda.
  - Hook `useBloqueoInactividad(): number` → minutos efectivos (0 si el flag está apagado).
- **Backend:** IPC `auth:verifyPassword` (preload `auth.verifyPassword`) →
  `verifyPasswordHandler` verifica la contraseña del usuario de la **sesión actual** contra
  su hash y devuelve `boolean`. **No** recrea sesión, no toca `ultimo_acceso`, no cambia
  permisos. Sin sesión → `false`.
- **Frontend:**
  - `useIdleLock(minutos)`: escucha actividad (`mousemove/mousedown/keydown/wheel/touchstart`),
    resetea un timer; con `minutos > 0`, a los N minutos sin actividad marca `locked`. Con
    `minutos <= 0` queda inerte.
  - `PantallaBloqueo`: overlay full-screen (z-index alto, foco en el input) con el nombre del
    usuario + contraseña; ok → desbloquea; error inline si falla; botón "Salir" (logout). No
    cierra con Escape ni con click afuera.
  - **Montaje en `AppShell`** (que vive dentro de `PosSessionProvider`): el overlay tapa la
    UI **sin desmontar nada**, así la **venta en curso del cart se conserva** intacta.
    Mientras `locked`, `CommandPalette` recibe `disabled` (Ctrl+K no abre por detrás).

## Consecuencias

- **Positivas:** navegación de vuelta al producto cerrada; alta de producto sin salir del POS
  ni de la carga de una OC; seguridad física por auto-bloqueo sin perder la venta. Todo
  aditivo o detrás de un flag apagado por default → riesgo bajo.
- **Deuda/pendientes:**
  - La cola de revisión de costos no linkea al producto (a propósito).
  - El umbral `bloqueo_inactividad_minutos` no tiene editor numérico en Funcionalidades (esa
    pantalla sólo togglea booleanos); se ajusta por `parametros.set` si se quiere otro valor.
  - Un producto de alta express queda "incompleto" (categoría "Sin clasificar", sin costo por
    proveedor); se completa después. El checklist "Para vender falta:" de ADR-078 ya lo señala
    en el detalle si falta costo/stock.

## Alcance de esta sesión

Ítems 4–6 de la Fase 2. Cada uno con TDD (RED-GREEN-REFACTOR).

## Implementación (2026-09-07)

Rama `feat/fase2b-mejoras-ux` (rebasada sobre `main` con ADR-061/078 ya integrados).

- **NAV-2:** links en `Kardex.tsx` y `LoteDetalleView.tsx` (+ tests).
- **PROD-3:** `productoQuickCreateHandler` + helpers `getOrCreateCategoriaSinClasificar`/
  `getUnidadDefaultAbreviatura` + preload; `AltaExpressModal`; integración en `PosScanBar` y
  `OrdenCompraDetalle` (+ tests main y renderer).
- **SEC-3:** migración `0045_adr079_bloqueo_inactividad`; `verifyPasswordHandler` + preload;
  hooks `useBloqueoInactividad` y `useIdleLock`; `PantallaBloqueo`; montaje en `AppShell` +
  prop `disabled` en `CommandPalette` (+ tests).

**Tests:** cada tarea dejó su archivo en verde (renderer jsdom / main bajo Electron). Gate
completo (`pnpm test` + typecheck) en la verificación final. **Pendiente:** verificación
manual en la app (`pnpm dev`) como Operador y Supervisor; encender el auto-bloqueo desde
Funcionalidades para recorrerlo.
