# Pack — A2 + A3 + A23 (Inventario inmovilizado, valorización y digest de bajo mínimo)

> Origen: `mejoras-acumulativas.md` (análisis SICOVESTO). Destino: **Retail** (`apps/retail`), 3 PRs.
> Sin número de ADR a propósito: lo asigna el usuario a mano (el último en `docs/ADR-Log-ferreteria.md` es ADR-113).
> Contenido: (1) texto de ADR, (2) bloque de `Estado.md`, (3) prompt de implementación para Superpowers.

---

## 1. Texto de ADR (para `docs/ADR-Log-ferreteria.md`)

## ADR-XXX — Retail: panel Inventario (rotación y valorización) y digest de bajo mínimo en Agenda

**Estado:** Aceptado — pendiente de implementación (3 PRs) · **Fecha:** 2026-10-19

**Contexto.** Del análisis comparativo con SICOVESTO salieron tres candidatos de bajo costo (A2 rotación accionable + capital inmovilizado, A3 valorización de inventario, A23 aviso proactivo de bajo mínimo). El discovery mostró que **no parten de cero**: el panel Stock del Resumen ya calcula `valor_inventario` (solo a costo), `sin_stock`, `bajo_minimo` y `sin_movimiento`; el origen `bajo_minimo` de `agenda_evento`, el flag `notif_bajo_minimo_email` y el formateo del digest en el adapter de email ya existen, pero **ningún productor emite el evento** (hoy el bajo mínimo solo viaja adjunto al aviso de cierre de caja). Hallazgos que condicionan el diseño:

- `existencias.ultima_fecha_movimiento` la escriben venta, recepción, ajustes, mermas e importación: una recepción "rejuvenece" un producto parado, por lo que **no sirve** para "días sin vender".
- Existen **tres definiciones** de "bajo mínimo" (dashboard: `stock > 0 && stock <= mínimo`; cierre de caja: `stock <= mínimo` sin filtrar `activo`; órdenes de compra, no auditada).
- El costo (`producto.precio_costo_promedio`, pesos REAL, deuda legacy) es **neto de IVA** por convención (los márgenes del dashboard calculan `precio / (1 + alícuota) − costo`).
- El precio vigente vive en `lista_precio_valor` (ADR-034); `producto.precio_venta_lista` puede quedar desactualizado tras ediciones. La presentación `es_default` tiene `factor_a_stock = 1`, por lo que su precio es por unidad de stock.

**Decisión.**

*A. Panel Inventario (A2 + A3) — solo lectura, sin datos nuevos.* Nuevo handler `dashboard:inventario` (guard `dashboard.ver`, solo Supervisor) y nuevo tab "Inventario" en `DashboardView`, sin selector de período (foto de hoy). Se calcula al leer, con consultas por conjunto (sin N+1). Universo: productos activos con `stock_fisico > 0`. Todo el dinero se calcula y devuelve en **centavos enteros** (`Math.round(x*100)` en el borde de la lectura legacy y suma en enteros).
- *Valorización:* `valor_costo = Σ stock × CPP`; `valor_venta_neto = Σ stock × precio_vigente / (1 + alícuota del impuesto del producto)`, con `precio_vigente` = fila vigente de `lista_precio_valor` de la lista predeterminada y presentación default, y el mismo fallback que `getPrecioEnListaHandler` (`precio_venta_lista × (1 + ajuste_porcentual)`). **Las promociones se ignoran** (valorización estructural, no coyuntural). `ganancia_potencial = valor_venta_neto − valor_costo`; `margen_pct = ganancia / valor_venta_neto`. Productos sin precio valen 0 y se cuentan en `productos_sin_precio` para no subestimar el KPI en silencio. Un test oráculo exige que la consulta por conjunto coincida con `getPrecioEnListaHandler` sin promoción.
- *Rotación:* referencia = `MAX(venta.fecha)` de ventas **confirmadas** del producto `?? producto.fecha_creacion` (un producto recién cargado sin ventas no cae en "Liquidar ya"; la UI distingue "última venta" de "sin ventas desde el alta"). `dias = floor((ahora − referencia)/día)`. Semáforo por días sin vender: `≥ rotacion_dias_liquidar` → Liquidar ya, `≥ rotacion_dias_revisar` → Revisar, `≥ rotacion_dias_vigilar` → Vigilar; se muestra con color **y** texto. Capital inmovilizado = valor (a costo y a venta neto) de los productos con semáforo. Payload: KPIs de valorización, rotación (capital/margen inmovilizado, cantidad y capital por nivel), top 12 por capital inmovilizado, resumen por categoría y lista completa de lentos (filtro/orden en el cliente).
- *Descartado:* "unidades paradas" de SICOVESTO (sumar metros, litros y unidades no tiene sentido); se informa la cantidad de productos lentos. La cobertura (stock ÷ velocidad) queda como espacio reservado, fuera del semáforo.
- *Sin feature flag*: es lectura pura, sin migración de datos, y los tabs del dashboard nunca llevaron flag. El panel Stock del Resumen no se toca.
- *Parámetros nuevos* (`parametros_sistema`, migración aditiva): `rotacion_dias_vigilar=60`, `rotacion_dias_revisar=120`, `rotacion_dias_liquidar=180`. Si no cumplen `vigilar < revisar < liquidar` (o no son enteros positivos) se usan los defaults. Sin UI de edición en esta iteración (queda como espacio reservado si Configuración no expone parámetros).

*B. Definición única de bajo mínimo.* Nueva función `productosBajoMinimo(db)`: productos **activos** con `stock_minimo > 0` y `stock_fisico <= stock_minimo`, con el campo `agotado` (`stock_fisico <= 0`). Consumidores con delta mínimo: el dashboard conserva su semántica (`bajo_minimo` = los no agotados) y su enriquecimiento de `dias_hasta_agotar`; el **cierre de caja** conserva la lista completa y su formato, con **una única diferencia de comportamiento: deja de incluir productos inactivos** (hoy los incluye, lo cual es un defecto). Modifica dos módulos aprobados (dashboard, aviso de cierre); este ADR es la autorización formal (phase-gate).

*C. Digest de bajo mínimo en Agenda (A23).* Nuevo productor `emitirDigestBajoMinimo(db, now)` en `apps/retail/src/main/agenda/bajo-minimo.ts`, detrás del flag `agenda_bajo_minimo_habilitado` (default `false`, ADR-042). Corre al arrancar (después del catch-up) y cada hora junto a `drenarReintentos`; es idempotente y barato. Si el flag está apagado o la lista está vacía, no hace nada. Mantiene **un único** `agenda_evento` pendiente/pospuesto con `origen = 'bajo_minimo'` (título "N productos bajo mínimo", descripción con el top 10): si existe lo actualiza, si no lo crea. Emite aviso (`insertarAvisos` dentro de la misma transacción que el evento; despacho best-effort después del commit, igual que `avisoCierreCaja`) **solo si** no había evento pendiente, o hay productos nuevos respecto del último aviso de este origen, o pasaron `agenda_bajo_minimo_recordatorio_dias` (7) desde el último aviso. `datos` respeta la forma `bajo_minimo.{total, top}` que ya formatea el adapter de email e incluye los ids de producto para comparar contra el aviso anterior (sin esquema nuevo). `dedupe_clave` por día. Canal in-app siempre; email si `notif_bajo_minimo_email` está activo. Destinatario: `notif_bajo_minimo_destinatario` (default rol supervisor). **No muta stock ni toca el camino de venta/recepción/ajuste.** Sin pantalla nueva: Agenda ya lista el origen `bajo_minimo`. Si la lista se vacía, el evento pendiente se deja para que lo cierre una persona (el sistema no completa eventos por su cuenta).

*Entrega:* PR1 `productosBajoMinimo` + refactor de dashboard y cierre (tests de no-regresión); PR2 panel Inventario (A2 + A3) + migración de umbrales; PR3 digest A23 + migración de parámetros y flag. PR2 es independiente de PR1; PR3 depende de PR1.

**Espacio reservado (documentado, no implementado).** Cobertura en días (stock ÷ velocidad) como columna informativa; edición de umbrales en Configuración; enlace directo del evento a la orden de compra sugerida; visibilidad por rol de costos/márgenes (A16, que ocultaría este panel al Operador sin cambios de diseño porque ya está bajo `dashboard.ver`); aviso por producto en el momento de cruzar el mínimo (descartado hoy por tocar el camino caliente del stock).

**Fuera de alcance (ADR chico aparte).** `dias_hasta_agotar` del dashboard divide `venta_detalle.cantidad` (unidades de presentación) contra `stock_fisico` (unidades de stock) sin multiplicar por `factor_a_stock_aplicado` (`null` ⇒ 1): error latente cuando hay cajas o rollos. No se corrige aquí. El panel Inventario, en cambio, sí calcula con unidades de stock correctas si necesitara ventas (no las usa: solo `MAX(fecha)`).

**Consecuencias.** Tres definiciones de bajo mínimo pasan a una. Los consumidores de ventas con presentación siguen con el error de unidades hasta el ADR aparte. El digest queda apagado por defecto: activarlo es una decisión de la instalación.

---

## 2. Bloque para `Estado.md`

**Cabecera** — anteponer a "Última actualización" (sin tocar lo previo, que pasa a "Previo"):

```
2026-10-19 (**Retail — panel Inventario (A2+A3) y digest de bajo mínimo en Agenda (A23) — ADR-XXX** — decisión aceptada, **pendiente de implementación en 3 PRs**: PR1 función única `productosBajoMinimo` (dashboard y cierre de caja; el cierre deja de listar inactivos); PR2 tab "Inventario" en el Dashboard (valorización a costo/venta neto/ganancia/margen + rotación por días sin vender con semáforo Vigilar/Revisar/Liquidar 60/120/180 y capital inmovilizado; solo lectura, centavos, sin flag); PR3 productor `emitirDigestBajoMinimo` detrás del flag `agenda_bajo_minimo_habilitado` (default `false`). Origen: análisis comparativo SICOVESTO (`mejoras-acumulativas.md`). **Fuera de alcance, ADR chico aparte:** `dias_hasta_agotar` ignora `factor_a_stock_aplicado`. **Previo:** …
```

**Bitácora de decisiones** — agregar:

```
- `2026-10-19` — Retail: aprobado el diseño de A2+A3+A23 (ADR-XXX). Discovery: costo neto de IVA por convención; precio de venta desde `lista_precio_valor` (lista predeterminada, presentación default, sin promociones) con el fallback del motor; "días sin vender" = última venta confirmada (no `ultima_fecha_movimiento`); tres definiciones de bajo mínimo unificadas. Umbrales 60/120/180; flag solo en A23; cierre sin inactivos; error de unidades en `dias_hasta_agotar` como ADR aparte.
```

**Tabla "ADRs de arquitectura"** — agregar fila: `ADR-XXX | Retail: panel Inventario y digest de bajo mínimo | Aceptado (pendiente de implementación) | 2026-10-19 | docs/ADR-Log-ferreteria.md`.

**Releases / próximas fases** — en la lista de 1.1.x de Retail, sumar: "Panel Inventario (A2+A3) y digest de bajo mínimo (A23) — ADR-XXX — pendiente".

**Backlog** (`mejoras-acumulativas.md` → marcar): A2 ✔ decidido, A3 ✔ decidido, A23 ✔ decidido; siguientes en el orden acordado: A5+A6+A18+A8, A16, A24 (tramo interno), A22.

---

## 3. Prompt de implementación para Superpowers

```
# CONTEXTO
Monorepo pnpm `Gestion-Pymes-Apps` (Electron 32 + React + TypeScript + SQLite/better-sqlite3 + Drizzle). Trabajás en `apps/retail` (paquete `ferreteria-client`). Leé `CLAUDE.md` antes de empezar: rige.
Castellano rioplatense. Dinero en centavos enteros hasta el borde; soft-delete + auditoría; offline-first; phase-gate (el ADR-XXX autoriza tocar dashboard.ts y caja-cierre-aviso.ts SOLO en lo descripto abajo).
Fuente de verdad del diseño: `docs/Pack-A2-A3-A23-inventario-bajo-minimo.md` §1 (ADR-XXX). Si algo no está ahí, NO lo inventes: frená y preguntá.
Flujo: TDD (RED-GREEN-REFACTOR), un PR por fase, suites del main en SERIE (el runner es flaky en paralelo). Los comandos largos (suite completa, pnpm dev) los lanzás vos, no un subagente.

# GATE 0 — GIT LIMPIO
1. `git status` y `git branch --show-current`. Si el árbol no está limpio o no estás en `main` actualizado: STOP y avisá.
2. Creá la rama de la fase (`feat/retail-bajo-minimo-unico`, luego `feat/retail-panel-inventario`, luego `feat/retail-digest-bajo-minimo`). La Fase 3 parte de main con la Fase 1 mergeada.

# FASE 1 — PR1: función única `productosBajoMinimo`
1. Discovery (solo lectura): releer `dashboard.ts` (`dashboardStockHandler`), `caja-cierre-aviso.ts` (`bajoMinimo`) y `ordenes-compra.ts` (buscar su criterio de bajo mínimo). Reportá los tres criterios y sus tests existentes. Si OC usa un criterio distinto, NO lo cambies: anotalo en el reporte final.
2. RED: tests de `productosBajoMinimo(db)` en `apps/retail/src/main/agenda/__tests__/` o donde corresponda: solo activos; `stock_minimo > 0`; `stock_fisico <= stock_minimo`; campo `agotado` (`stock_fisico <= 0`); orden por faltante descendente.
3. GREEN: implementar la función (ubicación: módulo main de Retail, no al core: sin segundo consumidor aún).
4. Refactor del dashboard: `bajo_minimo` = resultado de la función filtrando `!agotado`; conservar `dias_hasta_agotar` y su orden tal cual. NO tocar la lógica de `dias_hasta_agotar` (el bug de unidades es otro ADR).
5. Refactor del cierre de caja: `bajoMinimo(db)` usa la función; formato del payload `{ total, top[10] }` idéntico. Único delta aceptado: deja de incluir inactivos. Agregá test de no-regresión + test del delta.
6. Correr en serie: tests de dashboard, de cierre de caja y typecheck. Todo verde.
STOP-AND-CONFIRM: mostrame el diff completo y la salida de tests antes de commitear/abrir PR.

# FASE 2 — PR2: panel Inventario (A2 + A3)
1. Discovery de schema (solo lectura, ANTES de cualquier migración): leer `schema/catalog.ts`, `schema/precios.ts`, `schema/ventas.ts`; confirmar columnas y tipos de `producto` (`fecha_creacion`, `impuesto_id`, `precio_costo_promedio`), `impuesto.alicuota`, `existencias`, `lista_precio` (`predeterminada`), `lista_precio_valor` (`presentacion_id`, `fecha_hasta`), `producto_presentacion` (`es_default`, `factor_a_stock`), índices existentes sobre `venta_detalle.producto_id` y `venta.fecha/estado`. Confirmar el número de la próxima migración (a la fecha la última es 0049) y cómo se numera en este repo (ojo con `drizzle-kit generate` roto en Retail: escribir la migración SQL a mano y el journal consistente con las existentes).
2. STOP-AND-CONFIRM: antes de escribir en `parametros_sistema`, mostrame las 3 filas exactas que insertará la migración (`rotacion_dias_vigilar=60`, `rotacion_dias_revisar=120`, `rotacion_dias_liquidar=180`, tipo `number`, descripción) y esperá mi OK. No sumes dependencias nuevas; si creés que hace falta una (p. ej. gráficos), STOP y preguntá.
3. Migración aditiva e idempotente (INSERT OR IGNORE) con los tres parámetros.
4. RED → GREEN, handler `dashboardInventarioHandler(db, now?)` en `apps/retail/src/main/ipc/dashboard-inventario.ts`:
   - Universo: `producto.activo` y `existencias.stock_fisico > 0`.
   - Costo: `round(stock × precio_costo_promedio × 100)` por producto, suma en enteros.
   - Precio: fila vigente (`fecha_hasta IS NULL`) de la lista predeterminada, presentación `es_default`; fallback `precio_venta_lista × 100 × (1 + lista.ajuste_porcentual/100)`; neto de IVA dividiendo por `(1 + alícuota/100)` del impuesto del producto. Ignorar promociones. Consulta por conjunto, sin N+1. Sin precio ⇒ valor 0 y `productos_sin_precio++`.
   - Rotación: referencia = `MAX(venta.fecha)` de ventas `confirmada` del producto `?? producto.fecha_creacion`; `dias = floor((now − ref)/86400000)`; semáforo con los umbrales leídos de `parametros_sistema` (validar enteros positivos y `vigilar < revisar < liquidar`; si no, defaults 60/120/180).
   - Payload según ADR: KPIs, rotación (capital y margen inmovilizado, cantidad y capital por nivel), `top` 12 por capital inmovilizado a costo, `por_categoria`, `lentos` (lista completa con semáforo).
   - Tests mínimos: semáforo en los bordes exactos de los umbrales; producto nuevo sin ventas NO cae en Liquidar ya; venta anulada no cuenta como venta; recepción posterior NO resetea los días; fallback de precio; promoción ignorada; producto sin precio; stock fraccionario; umbrales inválidos ⇒ defaults; **test oráculo** contra `getPrecioEnListaHandler` sin promoción; el handler exige `dashboard.ver`.
5. Registro: canal `dashboard:inventario` en `registerDashboardHandlers` (guard `dashboard.ver`) y `dashboard.inventario()` en `src/preload/index.ts` (tipado con el tipo exportado del handler).
6. Renderer: tab `inventario` en `DashboardView.tsx` (sin PeriodSelector), componente `InventarioTabView` en `views/dashboard/inventario/`: KPIs de valorización arriba, KPIs de capital inmovilizado, tabla de top 12, resumen por categoría, lista de lentos con filtro por nivel. Semáforo con color y texto. Formateo de dinero SOLO al render. Estados loading/error como los demás tabs. Tests de renderer.
7. No tocar `StockPanel`. No agregar feature flag. Sin UI de edición de umbrales.
8. Cierre de fase: typecheck, tests main (en serie) y renderer. Y abrí la app con `pnpm dev` (rebuild para Electron antes) y llegá al tab navegando como el usuario con un Supervisor: Dashboard → Inventario. Si no podés verificarlo en la app, decilo explícitamente.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# FASE 3 — PR3: digest de bajo mínimo (A23)
1. Discovery (solo lectura): `agenda/aviso-servicio.ts`, `motor-rutinas.ts`, `canales/email.ts`, `ipc/agenda.ts`, `schema/agenda.ts`, `main/index.ts` (zona de timers) y la migración `0026_adr047_agenda.sql`. Confirmar: forma exacta del `datos.bajo_minimo` que espera el adapter de email, columnas obligatorias de `agenda_evento`, cómo se obtiene el `usuario_creacion_id` para un evento generado por el sistema (ver cómo lo resuelve el cierre de caja / rutinas con `origen_sistema`), y el próximo número de migración.
2. STOP-AND-CONFIRM: antes de escribir en `parametros_sistema`, mostrame las filas exactas: `agenda_bajo_minimo_habilitado=false` (bool), `agenda_bajo_minimo_recordatorio_dias=7` (number), `notif_bajo_minimo_destinatario` (string/JSON con default `{"tipo":"rol","rol":"supervisor"}`, mismo formato que `notif_cierre_destinatario`). Esperá mi OK.
3. Migración aditiva (INSERT OR IGNORE).
4. RED → GREEN `emitirDigestBajoMinimo(db, now)` en `apps/retail/src/main/agenda/bajo-minimo.ts`:
   - Flag apagado o lista vacía ⇒ no hace nada.
   - Un único `agenda_evento` (`origen='bajo_minimo'`, estado pendiente/pospuesta, activo): actualizar si existe; crear si no. Título "N productos bajo mínimo"; descripción con top 10.
   - Aviso solo si: no había evento pendiente, o hay ids nuevos respecto del último aviso de `origen_tipo='bajo_minimo'` (comparar contra `datos.ids` del último payload), o pasaron ≥ `agenda_bajo_minimo_recordatorio_dias` días.
   - `insertarAvisos` dentro de la MISMA transacción que el evento; `despacharAviso` best-effort DESPUÉS del commit. `dedupe_clave` por día. Canales: in_app siempre; email respetando `notif_bajo_minimo_email` (ya lo gestiona `insertarAvisos`).
   - `datos`: `{ bajo_minimo: { total, top }, ids }` (forma que ya formatea el adapter de email).
   - NO mutar stock, NO tocar venta/recepción/ajuste. NO completar eventos automáticamente.
   - Tests: flag off; lista vacía; primera vez; segunda corrida el mismo día sin cambios (no duplica evento ni aviso); producto nuevo bajo mínimo ⇒ avisa; recordatorio a los 7 días; evento pospuesto se reutiliza; destinatario por rol; email solo con su flag; idempotencia; el productor nunca lanza hacia afuera.
5. Cableado en `main/index.ts`: ejecutar al arrancar (después de `ejecutarCatchUp`) y con `setInterval` de 60 min, capturando errores como los demás timers.
6. Cierre de fase: typecheck, main en serie, renderer. Con `pnpm dev`: activar el flag a mano en la BD de desarrollo, dejar un producto bajo mínimo y verificar que aparece en la campana de Agenda / Bandeja de avisos navegando como Supervisor. Si no podés verificarlo en la app, decilo.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# CONDICIONES DE STOP (aplican a todas las fases)
- Cualquier cambio fuera de los archivos descriptos (core `@core/*`, Elaborados, `packages/shared`, esquema de tablas existentes) ⇒ STOP y consultá.
- Corregir `dias_hasta_agotar` / factor de presentación ⇒ FUERA de alcance (ADR aparte): no lo toques aunque lo veas.
- Cambiar el criterio de bajo mínimo de órdenes de compra ⇒ fuera de alcance: solo reportalo.
- Una dependencia nueva, una migración distinta de las aprobadas, o un parámetro no listado ⇒ STOP.
- Tests rotos que no son tuyos ⇒ no los arregles en silencio: reportalos.
- Si el runner del main cuelga o crashea, corré en serie y reintentá una vez; si persiste, STOP.

# CIERRE DOCUMENTAL (en el PR de la última fase)
Actualizá `Estado.md` (cabecera + Bitácora + tabla de ADRs + releases) y `docs/ADR-Log-ferreteria.md` con el ADR (estado → Implementado, fechas, gates de tests). Un paso no está cerrado hasta que ambos estén al día.

# ENTREGA DE CADA FASE
Resumen de qué cambió, diff completo, salida de typecheck y de las suites (main en serie, renderer), qué verificaste en la app y qué NO pudiste verificar. No hagas merge: lo decido yo.
```
