# Prompts por fase — Auditoría de mejoras UX / Seguridad

> Prompts autónomos para pegar en **sesiones limpias** (superpowers). Cada uno incluye el
> contexto del proyecto, la evidencia concreta en el código y las trampas del repo, y dispara
> el flujo brainstorm → plan revisado → TDD → verificación.
>
> - Informe completo (artefacto privado): https://claude.ai/code/artifact/ae84631e-3ccc-4f7e-aa00-ed231c83b119
> - Buenas prácticas y fuentes que respaldan estas mejoras: [research-ux-best-practices.md](research-ux-best-practices.md)
>
> **Cómo usarlos:** copiar el bloque de la fase, pegarlo en una sesión nueva. La sesión frena
> después del plan escrito para que lo revises antes de tocar código. Dentro de una fase, los
> ítems se atacan en orden, dejando cada uno desplegable y en verde. Si una fase es mucho para
> una sola sesión, cortá por el ítem que quieras y guardá el resto para otra.

---

## Fase 1 · Quick wins de dolor

```
Trabajo en Ferretería-app: un sistema de gestión para ferretería, OFFLINE-FIRST, monorepo
pnpm con Electron + React + SQLite (Drizzle), TypeScript de punta a punta. Antes de nada,
leé CLAUDE.md en la raíz: tiene el contexto de dominio, las convenciones y las trampas del repo.

Vengo de una auditoría de UX/seguridad. Quiero ejecutar la FASE 1 (quick wins de dolor), que
ataca las quejas de los usuarios sobre carga de datos y errores mal manejados. Son 6 ítems, en
este orden. Dejá cada uno desplegable y en verde antes de pasar al siguiente.

1) BUG-1 (correctitud, crítico) — En src/renderer/views/productos/ProductosListado.tsx el hook
   useFilaNavegable() se llama DENTRO de items.map(). Eso viola las reglas de hooks y puede
   crashear el listado cuando cambia la cantidad de filas (paginación/filtro). Solución: extraer
   la fila a un componente propio que llame el hook, o convertir useFilaNavegable en algo que no
   sea hook. No debe quedar ningún hook dentro de un loop/condición.

2) ERR-1 (FONDO, crítico) — No existe sistema central de feedback en el renderer (no hay toasts;
   el manejo es ad-hoc por vista). Crear un ToastProvider montado en AppShell + useToast
   (success/error). Además, src/renderer/views/productos/ProductoForm.tsx tiene handleSubmit con
   try/finally SIN catch: un fallo al guardar se pierde en silencio. Agregar el catch y mostrar
   el error por toast. Idealmente un helper callIpc() que envuelva llamadas al IPC (éxito -> toast
   verde, error -> toast rojo).

3) ERR-2 (crítico) — Donde se muestran errores se muestra e.message crudo del main (mensajes
   técnicos de SQLite tipo "UNIQUE constraint failed"). Crear un traductor de errores conocidos ->
   mensaje humano y accionable (ej.: GTIN/EAN duplicado -> "Ya existe un producto con ese código
   de barras" + acción para abrir el existente). Enchufarlo al sistema de ERR-1.

4) PROD-1 (crítico) — Validación pobre en formularios. En ProductoForm la validación corre solo al
   enviar y dice "Requerido". Cambiar a: validar al salir del campo (onBlur), llevar el foco al
   primer campo inválido al fallar el submit, y mensajes específicos ("Ingresá un precio mayor a 0").

5) NAV-1 — El breadcrumb del header es texto plano: en AppShell.tsx es <div className="crumb">
   {crumb}</div> con un mapa CRUMBS plano ruta->título. Hacerlo jerárquico y clicable
   (ej.: Catálogo › Productos › Nombre), derivado de la ruta, con <Link>.

6) SEC-1 (endurecimiento) — En src/main/index.ts falta control de navegación: no hay
   setWindowOpenHandler ni will-navigate, ni Content-Security-Policy. Agregar
   win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })), bloquear will-navigate fuera
   del origen propio, y una CSP restrictiva (default-src 'self') vía onHeadersReceived. No romper
   el dev server de Vite (MAIN_WINDOW_VITE_DEV_SERVER_URL).

Reglas del repo que NO se pueden violar (están en CLAUDE.md, resumen):
- Flujo obligatorio: brainstorm -> plan escrito y revisado -> TDD (RED-GREEN-REFACTOR) ->
  verificación. No escribir producción sin un test que falle primero.
- Dos runners de test por el módulo nativo (NMV): renderer con vitest/jsdom; main con
  scripts/test-node.cjs bajo Electron. Correr `pnpm test` desde packages/client.
- El renderer NUNCA importa 'electron'; todo pasa por window.ferreteria (preload).
- Todo cambio con UI se cierra abriendo la app (pnpm dev) y navegando como el usuario, no basta
  con tests verdes.

Arrancá con el brainstorming de la fase. Cuando tengas el plan escrito, PARÁ y mostrámelo para
revisarlo antes de tocar código.
```

---

## Fase 2 · Fondo de usabilidad

```
Trabajo en Ferretería-app: sistema de gestión para ferretería, OFFLINE-FIRST, monorepo pnpm con
Electron + React + SQLite (Drizzle), TypeScript. Leé CLAUDE.md en la raíz antes de empezar:
contexto de dominio, convenciones y trampas del repo.

Asumo que la FASE 1 de la auditoría (toasts/errores, validación inline, breadcrumbs, CSP) ya está
hecha; si algo de eso no existe todavía, decímelo antes de depender de ello. Quiero ejecutar la
FASE 2 (mejoras de fondo de usabilidad). 6 ítems, en orden, cada uno desplegable y en verde.

1) PROD-2 (alto) — El alta de producto (src/renderer/views/productos/ProductoForm.tsx) solo fija
   precio de venta; NO captura costo ni stock inicial (el costo vive en ProveedoresPanel y el
   stock en los modales de ProductoDetalle). Agregar una sección opcional "Stock inicial"
   (cantidad + costo) que dispare, en la misma operación, la Entrada de stock y el costo.
   CUIDADO con dinero: en producto los precios/costo son REAL/pesos (deuda legacy), pero
   producto_proveedor.costo va en centavos (INTEGER). El stock SIEMPRE se mueve vía
   MovimientoStock (nunca stock sin movimiento) y se usa costo promedio ponderado. Si se omite la
   sección, mostrar en el detalle un checklist "para vender falta: costo/stock" con links directos.

2) PRICE-1 (FONDO, alto) — El circuito de precios está partido en hasta 5 ítems de menú (Listas de
   precios, Lotes, Importar costos, Importar Catálogo del Proveedor, Revisión de Costos). En
   AppShell.tsx ya existe PRECIOS_GROUP y buildNavGroups(motorV2) que los reagrupa según el flag
   motor_precios_v2_habilitado. Unificar en un hub "Precios y Costos" con pestañas
   (Listas · Lotes · Importar · Revisión). Es estructural: proponé el enfoque (y si hace falta un
   ADR o un feature flag) en el plan, no lo cierres unilateralmente.

3) SRCH-1 (FONDO, alto) — No hay búsqueda global. Crear una paleta de comandos con Ctrl/Cmd+K:
   busca productos, clientes y proveedores; ofrece acciones ("Nuevo producto", "Abrir caja") y
   navegación a pantallas. Fuzzy match, teclas de flecha, foco atrapado, sección de recientes.
   Reusá los servicios de búsqueda existentes vía window.ferreteria (hay normalización de acentos
   y sinónimos ya implementados).

4) NAV-2 — Enlaces cruzados de vuelta al producto. Hoy desde el producto se llega a stock/precios,
   pero desde el listado de Stock, el Kardex, los Lotes de precios y la Cola de revisión NO hay
   link de vuelta. Hacer clicable el nombre/SKU del producto en esas vistas -> /productos/:id.

5) PROD-3 (alto) — Alta rápida de producto sin salir del flujo. Modal "alta express"
   (nombre, precio, EAN opcional) invocable desde el escaneo del POS (PosScanBar) y desde la
   Recepción de compra. Crea el mínimo viable reutilizando el mismo servicio de creación; se
   completa después.

6) SEC-3 (alto) — Auto-bloqueo por inactividad en la terminal de mostrador. Tras N minutos
   configurables, bloquear y pedir la contraseña para retomar, SIN perder la venta en curso (el
   carrito ya persiste en un provider por encima de AppShell — ver PosSessionProvider en
   routes/index.tsx). Complementa el RBAC con seguridad física.

Trampa de navegación (CLAUDE.md): agregar o mover una pantalla requiere TRES cosas —la ruta en
src/renderer/routes/index.tsx, el ítem en el array NAV de AppShell.tsx (con su permiso), y la
entrada en el mapa CRUMBS de AppShell.tsx. views/config/ConfigShell.tsx es CÓDIGO MUERTO: no lo
edites creyendo que se ve.

Reglas del repo que NO se pueden violar:
- brainstorm -> plan escrito y revisado -> TDD (RED-GREEN-REFACTOR) -> verificación. Nada de
  producción sin test que falle primero.
- Dos runners de test (NMV): renderer vitest/jsdom; main vía scripts/test-node.cjs. `pnpm test`
  desde packages/client. Migraciones aditivas y retrocompatibles.
- Si tocás permisos, hay tests que afirman el conteo exacto por rol: actualizarlos.
- Todo cambio con UI se verifica abriendo la app (pnpm dev) y navegando como el usuario.

Arrancá con el brainstorming de la fase. Cuando tengas el plan escrito, PARÁ y mostrámelo antes de
tocar código.
```

---

## Fase 3 · Personalización y pulido

```
Trabajo en Ferretería-app: sistema de gestión para ferretería, OFFLINE-FIRST, monorepo pnpm con
Electron + React + SQLite (Drizzle), TypeScript. Leé CLAUDE.md en la raíz antes de empezar:
contexto de dominio, convenciones y trampas del repo.

Asumo hechas las Fases 1 y 2 de la auditoría (toasts/errores, validación, hub de precios, paleta
Ctrl+K, etc.). Quiero ejecutar la FASE 3 (personalización y pulido). Ítems en orden, cada uno
desplegable y en verde.

1) PERF-1 (FONDO, alto) — Accesos directos/favoritos y pantalla de inicio por usuario. Hoy la ruta
   raíz redirige fijo a /productos para todos (index: <Navigate to="/productos"> en
   routes/index.tsx). La personalización existente vive en la tabla usuario_preferencias
   (tema/acento/fuente/densidad). Extenderla (migración aditiva) para guardar favoritos y una
   pantalla de inicio configurable (ej.: POS para operador, Dashboard para supervisor).

2) NAV-3 — Aligerar el sidebar. En AppShell.tsx el grupo "configuracion" acumula ~12 ítems
   mezclando catálogos auxiliares (categorías, marcas, unidades, ubicaciones, sinónimos,
   transportistas) con importaciones y precios. Separar "Operación" de "Administración" y mover
   las importaciones al hub de Precios (de la Fase 2). Combinar con los favoritos de PERF-1.

3) SEC-2 (FONDO) — Validación de payloads en el borde de los handlers del main. Hoy los handlers
   reciben (p: unknown) y lo castean al tipo esperado sin validar en runtime (no hay zod en el
   proyecto). Agregar validación en los handlers de escritura; doble beneficio: defensa en
   profundidad + errores tempranos y claros (se enchufa con el traductor de errores de Fase 1).
   Proponé en el plan si conviene sumar zod como dependencia o validar a mano.

4) SRCH-2 / SRCH-3 — Unificar la búsqueda de los listados en un componente SearchBox único
   (debounce, ícono, botón limpiar, resaltado del match) y persistir búsqueda/filtros al volver de
   un detalle (Productos ya usa un context; extender el patrón al resto).

5) PERF-2 / PERF-3 — PERF-2: lista de "vistos recientemente" (productos/clientes) en el inicio
   (barato, muy usado en mostrador). PERF-3: pantalla para editar permisos por rol desde la UI —
   los permisos ya son datos (PERMISOS/OPERADOR_PERMISOS en src/main/auth/seed.ts) pero hoy solo
   se cambian en código. Ojo: son 2 roles de sistema; esto es una decisión de producto, proponé
   opciones y esperá confirmación (posible ADR), no lo cierres solo.

6) BUG-2 / PRICE-4 (higiene) — BUG-2: dar de baja código muerto: setPin en preload/index.ts
   (ADR-027 eliminó el PIN), views/config/ConfigShell.tsx (huérfano), y evaluar
   lista_precio_detalle (sin consumidor de UI). PRICE-4: llevar el reporte de errores descargable
   (que ya existe en la importación de costos) al resto de las importaciones.

Reglas del repo que NO se pueden violar:
- brainstorm -> plan escrito y revisado -> TDD (RED-GREEN-REFACTOR) -> verificación. Nada de
  producción sin test que falle primero.
- Dos runners de test (NMV): renderer vitest/jsdom; main vía scripts/test-node.cjs. `pnpm test`
  desde packages/client. Migraciones aditivas y retrocompatibles.
- Si tocás permisos, hay tests que afirman el conteo exacto por rol (auth/__tests__/seed.test.ts,
  ipc/__tests__/auth.ipc.test.ts): actualizarlos.
- Agregar/mover una pantalla requiere ruta + ítem en NAV + entrada en CRUMBS (AppShell.tsx).
  ConfigShell.tsx es código muerto.
- Todo cambio con UI se verifica abriendo la app (pnpm dev) y navegando como el usuario.

Arrancá con el brainstorming de la fase. Cuando tengas el plan escrito, PARÁ y mostrámelo antes de
tocar código.
```
