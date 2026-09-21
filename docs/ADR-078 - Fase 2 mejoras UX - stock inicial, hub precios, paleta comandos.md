# ADR-078 — Fase 2 mejoras UX: stock inicial en el alta, hub de Precios/Costos y paleta de comandos

**Estado:** Aceptado — implementado
**Fecha:** 2026-09-07
**Supersede/relaciona:** continúa la auditoría de UX iniciada en **ADR-077** (Fase 1). Se
apoya en su sistema central de feedback (`useCallIpc`/toasts), el traductor de errores y el
breadcrumb jerárquico (`buildBreadcrumb`).

## Contexto

La auditoría de UX/seguridad definió tres fases. La Fase 1 (ADR-077) resolvió los "quick
wins de dolor". La **Fase 2** ataca el fondo de usabilidad. Esta sesión implementa los
**ítems 1–3** de la Fase 2; los ítems 4–6 (NAV-2 links de vuelta, PROD-3 alta express,
SEC-3 auto-bloqueo) quedan diferidos a una **Fase 2b**.

Los tres problemas atacados:

1. **PROD-2** — el alta de producto solo fija precio de venta. El costo vive en el panel
   de proveedores y el stock en modales del detalle, así que un producto recién creado no
   se puede vender (falta costo y stock) y nada lo señala.
2. **PRICE-1** — el circuito de precios/costos está partido en varios ítems de menú. Ya
   existía `PRECIOS_GROUP` + `buildNavGroups(motorV2)` que los reagrupa en el sidebar con
   el flag `motor_precios_v2_habilitado` (encendido de fábrica por la migración 0035,
   ADR-060), pero no había una **pantalla hub** con pestañas.
3. **SRCH-1** — no hay búsqueda global ni acceso rápido a acciones/pantallas.

## Decisión

### PROD-2 — Stock inicial atómico en el alta

- Se extiende `productoCreateHandler` (no una llamada IPC separada) para aceptar un bloque
  opcional `stock_inicial?: { cantidad: number; costo?: number }`. Cuando `cantidad > 0`,
  dentro de la **misma transacción** que ya crea el producto: el movimiento `motivo:'inicial'`
  arranca con esa cantidad (`cantidad`, `stock_resultante`, `costo_unitario`),
  `existencias.stock_fisico = cantidad`, y si hay costo válido `>0`,
  `producto.precio_costo_promedio = costo` (CPP con stock previo 0 = el costo). Sin el
  bloque, comportamiento **idéntico** al anterior (movimiento inicial en 0).
- **Decisión de dinero:** el costo inicial va a `producto.precio_costo_promedio`
  (**REAL/pesos**, el mismo campo que toca `stock:entrada`), **no** a
  `producto_proveedor.costo` (centavos, que exigiría elegir proveedor). El costo por
  proveedor sigue viviendo en `ProveedoresPanel`. Se respeta "el stock siempre se mueve vía
  `MovimientoStock`" + CPP, sin arrastrar la convención de centavos al alta.
- **UI:** sección colapsable opcional "Stock inicial (opcional)" en `ProductoForm`, solo en
  alta. Si se omite, `ProductoDetalle` muestra una card "Para vender falta:" (visible solo
  cuando `precio_costo_promedio === 0` o `stock_fisico === 0`) con acciones directas al
  modal de Entrada de stock (que captura costo → CPP).

### PRICE-1 — Hub "Precios y Costos" con pestañas

- Nueva pantalla `PreciosHub` con pestañas **Listas · Lotes · Importar · Revisión**
  mediante **rutas anidadas + `<Outlet/>`**, montada en el namespace **aditivo**
  `/precios/hub` (`/precios/hub/listas|lotes|importar|importar/catalogo-proveedor|revision`).
  Las pestañas son `NavLink` (route-driven), por lo que preservan deep-links y breadcrumbs.
- **Enfoque aditivo (cero regresión):** **no se modifica ni redirige ninguna ruta
  existente**. Las rutas planas viejas (`/config/listas-de-precios`,
  `/precios/importar-costos`, `/precios/importar-catalogo-proveedor`,
  `/precios/revision-historial`, `/precios/lotes`, `/precios/lotes/:id`) siguen intactas y
  renderizan las mismas vistas. El hub reutiliza esas vistas bajo un namespace nuevo, sin
  colisiones. Se descartó el enfoque de "aliases/redirects" del plan original porque, con
  el flag apagado, habría cambiado el comportamiento del sidebar viejo.
- **Detalle de lote como página plana:** el hub no duplica `lotes/:id`; el detalle de un
  lote abre la ruta plana `/precios/lotes/:id` (con su propio back-link). Patrón "lista en
  pestaña, detalle como página completa".
- **Flag nuevo `hub_precios_habilitado`** (default `false`), leído con
  `parametros.get`/`=== 'true'`, missing → false — **sin migración** (mismo patrón que
  `motor_precios_v2_habilitado`). Con el flag apagado, todo queda **exactamente como hoy**.
  Con el flag encendido, un único ítem de sidebar **"Precios y Costos" → `/precios/hub`**
  reemplaza a los ítems de precios dispersos (se quitan de Configuración vía
  `buildNavGroups`). El hub **gana** sobre el reagrupamiento del motor v2: si
  `hub_precios_habilitado` está on, su ítem único manda sin importar
  `motor_precios_v2_habilitado`.
- **Navegación (las 3 cosas):** ruta en `routes/index.tsx`, ítem en `AppShell` (grupo
  standalone `PRECIOS_HUB_ITEM`), y entradas de breadcrumb (`buildBreadcrumb`, grupo
  "Precios y Costos"). Se corrigió el render de ítem único del sidebar para usar
  `end={item.end ?? false}` (prefix-active), alineándolo con los otros dos sitios de render,
  para que el ítem del hub se resalte en las sub-rutas.
- **Activación:** no existe todavía una pantalla central de "Funcionalidades" para togglear
  flags (ADR-061 quedó `Propuesto`). Por ahora el hub se enciende con
  `parametros.set({ clave: 'hub_precios_habilitado', valor: 'true' })` o con un futuro seed;
  se mantiene `default false` por decisión de producto (feature nueva detrás de flag).

### SRCH-1 — Paleta de comandos (Ctrl/Cmd+K)

- `CommandPalette` autónomo, montado una vez en `AppShell`. Listener global de teclado abre
  con Ctrl/Cmd+K; **Escape se integra a la pila LIFO `useEscapeAction`** (layer `overlay`,
  solo cuando está abierta) para cerrar únicamente la paleta y no disparar el `navigate(-1)`
  de la pantalla/modal de abajo.
- **Fuentes:** productos vía `catalogo.producto.list({ busqueda, activo:true })` (server-side,
  ya normaliza acentos + sinónimos), **debounced ~200ms con guarda de request** (una
  respuesta lenta anterior no pisa una más reciente); clientes (`cliente.list`) y proveedores
  (`compras.proveedor.list`) cargados una vez y filtrados en cliente, **gateados por permiso**
  (`ctacte.cobrar` / `proveedor.gestionar`) para no disparar llamadas que el rol no puede
  hacer; **acciones** y **navegación** estáticas (`lib/comandos.ts`) filtradas por
  `can(permiso)`.
- **Recientes por usuario** en `localStorage` (clave `cmdk_recientes_<userId>`, tope 6,
  dedupe por `to`), mostrados al abrir con la búsqueda vacía. Toda lectura/escritura en
  `try/catch` y con **guarda `Array.isArray`** sobre el JSON parseado (un valor corrupto
  pero parseable como `"null"`/`"{}"` no debe spreadearse y tirar la app entera, que no
  tiene ErrorBoundary).

## Consecuencias

- **Positivas:** el alta de producto puede dejarlo listo para vender en una sola operación
  atómica; el circuito de precios/costos tiene una pantalla unificada opcional sin regresión;
  hay búsqueda/acción global rápida. Todo detrás de flags o aditivo: riesgo bajo.
- **Deuda/pendientes:**
  - No hay UI para togglear `hub_precios_habilitado` (depende de ADR-061 o un seed). Hasta
    entonces el hub no es visible para el usuario final sin intervención.
  - Ítems 4–6 de la Fase 2 (NAV-2, PROD-3, SEC-3) diferidos a Fase 2b.
  - La paleta no deduplica un "reciente" contra su comando estático equivalente (menor).

## Alcance de esta sesión

Ítems 1–3 de la Fase 2. Cada uno se implementó con TDD (RED-GREEN-REFACTOR) y dos etapas de
review (spec + calidad) por tarea.

## Implementación (2026-09-07)

Rama `feat/fase2-mejoras-ux`. Commits principales:

- **PROD-2:** `productoCreateHandler` + `stock_inicial` (tests main); sección "Stock inicial"
  en `ProductoForm`; checklist "Para vender falta:" en `ProductoDetalle` (token `--warn`,
  layout horizontal).
- **PRICE-1:** `PreciosHub.tsx` (pestañas por ruta, indicador de acento); rutas anidadas
  aditivas en `routes/index.tsx`; hook `useHubPreciosHabilitado`; `buildNavGroups(motorV2,
  hubPrecios)` con precedencia del hub; entradas de breadcrumb; fix de `end` en el render de
  ítem único.
- **SRCH-1:** `lib/comandos.ts` (registro + `filtrarPorTexto` acento-insensible);
  `CommandPalette.tsx` (Ctrl+K, teclado, permisos, Escape LIFO, guarda de request);
  recientes en `localStorage` con guarda de forma.

**Tests:** cada tarea dejó su archivo en verde (renderer jsdom / main bajo Electron). El
gate completo (`pnpm test` + typecheck) se corre en la verificación final. **Pendiente:**
verificación manual en la app (`pnpm dev`) navegando como Operador y Supervisor.

### Addendum (2026-09-07) — hub encendido de fábrica

Decisión de producto posterior: el hub pasa a venir **encendido de fábrica**. La migración
**0043** (`0043_adr078_hub_precios_on.sql`) hace un upsert de `hub_precios_habilitado` a
`'true'` (el flag no tenía fila; se leía con default false). Aditiva y retrocompatible:
sólo toca datos de `parametros_sistema`, aplica a instalaciones nuevas y existentes. Con
esto queda superada la consecuencia "el hub no es visible sin intervención": ahora el ítem
"Precios y Costos" aparece por defecto. El flag sigue existiendo para poder apagarlo si hace
falta (vía `parametros.set` o la futura pantalla de Funcionalidades, ADR-061).
