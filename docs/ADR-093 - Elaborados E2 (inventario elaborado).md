# ADR-093 — Elaborados E2: inventario elaborado (stock, producción, catálogo de venta)

**Estado:** Aceptado — implementado (E2 ejecutado en la rama `elaborados-e1`, mergeada a `main`)
**Fecha:** 2026-09-28
**Spec:** `docs/superpowers/specs/2026-09-24-elaborados-e2-inventario-design.md`
**Plan:** `docs/superpowers/plans/2026-09-24-elaborados-e2-inventario.md`
**Precedente:** ADR-092 (Elaborados E1 — esqueleto + plataforma al core)

## Contexto

ADR-092 dejó `apps/elaborados` arrancando sobre `@core/*` con login, caja y clientes/cta-cte, pero
sin ningún dominio propio de heladería: sin stock de artículos, sin producción, sin catálogo de
venta. E2 construye ese inventario elaborado — el corazón del negocio (produce helado propio,
revende palitos/tortas, arma licuados al vender) — y promueve al core lo único que ese dominio
comparte de verdad con Retail: la tabla `impuesto`.

## Decisión

Siete slices secuenciales, cada uno commiteable y con su suite en verde (TDD por task,
`superpowers:subagent-driven-development`: implementador + spec reviewer + code reviewer por
task, más una revisión holística final del diff completo).

### 1. `impuesto` → `@core/db`

Copia exacta de la tabla que vivía en `apps/retail/src/main/db/schema/catalog.ts`, movida a
`packages/core-db/src/schema/fiscal.ts`. Retail se re-apunta importándola en vez de definirla
localmente — sin cambio de comportamiento (verificado con la suite completa de Retail y
comparación de DDL, no con `drizzle-kit generate` porque el `meta/` snapshot chain de Retail está
desactualizado desde antes — gotcha preexistente, no relacionado). El core no siembra datos de
dominio: cada app sigue sembrando sus propias filas de `impuesto`.

### 2. Stock: `articulo` / `existencia_articulo` / `movimiento_articulo`

Patrón saldo + libro de movimientos inmutable (ADR-006), igual que `producto`/`existencias`/
`movimiento_stock` de Retail, pero con **`bloquea_sin_stock` configurable por artículo** en vez de
la regla fija de Retail: `true` bloquea (reventa, cucuruchos), `false` permite negativo con
advertencia (sabores/insumos a granel). Costo promedio ponderado en cada entrada
(`costoPromedioEntrada`, función pura); con stock previo ≤ 0 el costo nuevo pasa a ser directamente
el costo que entra (no se pondera sobre una base negativa/nula).

### 3. Producción: `receta_produccion`(+item) / `produccion`

Lote de producción transaccional: consume insumos escalados de la receta (`escalarReceta`, con
posibilidad de editar los consumos antes de confirmar), acredita el artículo elaborado al costo
del lote (`costoDeLote`) y actualiza su costo promedio. Anular exige credenciales de Supervisor vía
`verificarSupervisor` de `@core/main` — mismo mecanismo que el cierre de caja con diferencia — y
revierte el stock (no el costo promedio: reabrirlo hacia atrás exigiría el historial completo de
entradas, y el resto de la app tampoco lo hace).

### 4. Conteo/merma

Sin handler nuevo — reusa `movimiento-articulo:create` (motivo `conteo`/`merma`). Atajo "Tacho
vacío" en la UI.

### 5. Catálogo de venta: `categoria_venta` / `producto_venta`(+componente) / `grupo_modificador`(+opción) / `producto_venta_grupo`

`producto_venta.impuesto_id` **sí** declara FK contra `impuesto` (`@core/db`) — se probó, contra
una hipótesis inicial del plan, que Drizzle arma la FK cross-package sin problema (Retail ya lo
hacía con `producto.impuesto_id`); la migración se regeneró para incluirla antes de mergear, dado
que la rama no estaba publicada. Función pura `calcularConsumo` (componentes fijos + consumo por
grupo de modificadores en modo `reparto`/`por_opcion`/`sin_descuento`) y `validarStock`: E2 las
construye aunque recién las consuma E3 (venta) — Producción y Conteo ya ejercitan la validación de
stock con datos reales.

### 6. Seed demo de heladería

Bajo demanda (botón en Carta → Productos de venta, gateado por `usuario.administrar` a nivel de
handler igual que el seed demo de Retail — no solo por `requirePermission` en el registro de IPC),
no en cada arranque como el catálogo fiscal. Datos genéricos (8 sabores, insumos, envases, 8
productos de venta), no el catálogo real del cliente.

### Permisos nuevos

`articulo.gestionar`, `stock.ajustar`, `produccion.registrar` (Operador y Supervisor);
`receta.gestionar`, `producto_venta.gestionar` (solo Supervisor) — agregados a
`PERMISOS_ELABORADOS`/`OPERADOR_PERMISOS_ELABORADOS` en `apps/elaborados/src/main/auth/seed.ts`.

### Barandas

`b2-sync-fields.test.ts` de Elaborados valida automáticamente que las 12 tablas nuevas cumplen el
patrón transversal (id texto + `version`/`origin_id`/`sync_state`/`updated_at`) sin necesitar
tocar el test — es genérico sobre el schema compuesto.

## Dos bugs de datos corregidos antes de mergear (encontrados en la revisión final del diff completo, no por task individual)

1. **`movimiento_articulo.tipo` se derivaba del signo de `cantidad`**, no de `motivo` — una
   merma (siempre negativa) quedaba etiquetada `ajuste` en vez de `salida`, y un conteo que
   encontraba más stock quedaba `entrada` en vez de `ajuste`. Corregido con una tabla
   `motivo → tipo` fija, igual que hace `apps/retail/src/main/ipc/stock.ts` para el concepto
   idéntico. Sin impacto en producción (la tabla estaba vacía en todo ambiente al momento del fix).
2. **`producto_venta.impuesto_id` sin FK** por la hipótesis incorrecta de que Drizzle no puede
   declarar una FK cross-package — corregido (ver slice 5 arriba).

Ambos son el tipo de hallazgo que una revisión task-por-task no ve por construcción (cada subagente
solo tenía a la vista su propia tarea) — justifica la revisión holística final antes de mergear en
cualquier feature ejecutada por partes.

## Consecuencias

- `apps/elaborados` tiene inventario completo: stock de artículos con costo promedio, producción
  transaccional con reversión autorizada, y un catálogo de venta armado (categorías, productos,
  modificadores) — listo para que E3 construya el POS sobre él.
- Gates finales: Elaborados renderer 67/67 (7 archivos) · Elaborados main 65/65 (16 archivos) ·
  Retail 140 archivos/1591 tests + renderer, sin cambios de comportamiento · core-db/core-main
  typecheck limpio · `drizzle-kit generate` en Elaborados sin diff pendiente.
- **Bug recurrente durante la ejecución, corregido cada vez y documentado como lección aparte**
  (memoria `feedback-modal-error-handling`): varios `handleSubmit` de modales quedaron con
  `try/finally` sin `catch` (fallo silencioso si el backend rechaza) — apareció 4 veces
  (`ConteoView`, `ArticulosView`'s `RecetaModal`, `ModificadoresView`), corregido cada vez con
  `catch (e) { setError(traducirError(e).mensaje) }` siguiendo el patrón ya existente en
  `ArticuloModal`.
- **Follow-ups de bajo riesgo, no bloqueantes, quedaron marcados como tareas de fondo** (no
  ejecutados en E2): extraer `SupervisorAuthModal` compartido (Retail y Elaborados duplican el
  form de motivo+credenciales de Supervisor), auditar el resto del renderer por el mismo bug de
  catch faltante, hacer atómico el seed demo (hoy cada handler abre su propia transacción, sin una
  transacción externa que envuelva las ~40 llamadas — riesgo bajo porque es data demo, no
  producción), extraer `requireAdmin()` compartido a `@core/main` (ya duplicado 3 veces: dos en
  Retail, una nueva en Elaborados), y revisar el gating de permiso del grupo NAV "Stock" (exige
  `articulo.gestionar` a nivel de grupo pero uno de sus items necesita `stock.ajustar` —
  inofensivo hoy porque Operador siempre tiene ambos permisos juntos).
- Pendiente explícito: verificación manual navegando la app real como Operador y Supervisor
  (CLAUDE.md §12) — la suite en verde no prueba que las pantallas sean alcanzables/usables; falta
  el click-through humano.
- Próximo: E3 (venta/POS) — selector de sabores en el momento de vender, `confirmarVenta` template
  method + interfaz fiscal B1, pedidos en espera.

## Numeración

093 es el próximo libre después de ADR-092.
