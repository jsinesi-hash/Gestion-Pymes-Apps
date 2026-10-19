# Pack — A24 (notas de crédito internas contra una venta, sin ARCA)

> Origen: `mejoras-acumulativas.md` (análisis SICOVESTO, foco pedido). Destino: **Retail** (`apps/retail`) + una etiqueta en `packages/shared`. 3 PRs.
> Sin número de ADR a propósito: lo asigna el usuario a mano. **No cierra ADR-013** (integración fiscal): la NC fiscal queda para R2.
> Contenido: (1) texto de ADR, (2) bloque de `Estado.md`, (3) prompt de implementación para Superpowers.

---

## 1. Texto de ADR (para `docs/ADR-Log-ferreteria.md`)

## ADR-XXX — Retail: notas de crédito internas contra una venta (devolución parcial o total)

**Estado:** Aceptado — pendiente de implementación (3 PRs) · **Fecha:** 2026-10-19

**Contexto.** SICOVESTO emite notas de crédito/débito contra un comprobante con un asistente de 3 pasos (datos, ajuste de productos, resumen) y tres formas de resolver la NC. En este repo hoy solo existe la anulación completa de una venta (`anularVenta`, `@core/main`: Supervisor, motivo, caja de origen abierta), no hay devoluciones parciales ni documento de nota. El discovery mostró:

- **Dos resoluciones reales, no tres.** El saldo a favor ya es la cuenta corriente (el libro admite saldo negativo por sobrepago y existe el motivo `nota_credito`): "dejar saldo a favor" y "aplicar a cuenta corriente" son el mismo asiento (movimiento `pago` sobre la cuenta). Quedan **devolver dinero** (egreso de caja) y **acreditar en cuenta corriente**.
- **La cuenta corriente solo existe para clientes con `habilita_cuenta_corriente`.** Consumidor Final no puede quedar con saldo a favor.
- **`anularVenta` exige la caja de origen abierta** (`CAJA_ORIGEN_CERRADA`): no sirve de molde para devoluciones de días posteriores. El egreso de una NC va a la **caja abierta de quien la emite**.
- El comprobante `ticket_interno` se inserta **sin `numero`** (la identidad es `venta.numero_interno`, contador en `parametros_sistema`); la NC necesita correlativo propio.
- `movimiento_stock.motivo` ya tiene `devolucion`; `movimiento_caja.motivo` no (la anulación usa `ajuste` + `referencia_tipo`). `comprobante` ya admite `tipo = 'nota_credito'` y `comprobante_referencia_id` (importes en pesos REAL, deuda legacy). `ComprobantePayload.tipo` (B1, `@ferreteria/shared`) hoy es solo `'ticket_interno'`.
- "Ventas netas = ventas − NC + ND" implica tocar unas 15 consultas (`dashboard-rango`, `dashboard`, `dashboard-caja-rango`, `dashboard-clientes`, `reportes`); el arqueo de caja se corrige solo porque suma movimientos.
- `verificarSupervisor` devuelve el id del Supervisor que autoriza (sirve para `supervisor_autorizacion_id`).

**Decisión.**

*A. Dónde vive.* **Retail primero**, sin tocar `@core/*`: tablas, handler y UI en `apps/retail`. Se promueve al core con el patrón de ADR-095 (template method con hooks) cuando Elaborados lo necesite (hoy no: los elaborados no se reingresan a stock). Las funciones de importes quedan puras y separadas del handler para facilitar esa promoción.

*B. Modelo (centavos, tablas nuevas de Retail, sync y auditoría estándar; las notas son inmutables: sin baja ni edición ni anulación).*
- `nota`: `id`, `numero_secuencial` y `numero` único (`NC-<terminal>-NNNNNN`, correlativo en `parametros_sistema` como `venta_correlativo_<terminal>`, asignado al emitir), `tipo` (`credito`; `debito` **reservado**, sin UI), `venta_id`, `comprobante_id`, `cliente_id`, `resolucion` (`devolucion_dinero` | `cuenta_corriente`), `medio_devolucion` (`efectivo` | `transferencia` | `tarjeta`, solo con devolución de dinero), `caja_id` (caja donde se registró el egreso), `total_centavos`, `motivo` (obligatorio), `observaciones`, `supervisor_autorizacion_id`, `usuario_id`, `fecha`.
- `nota_linea`: `nota_id`, `venta_detalle_id`, `producto_id`, `descripcion` (snapshot), `cantidad` (en unidades de **presentación**, como `venta_detalle`), `factor_a_stock_aplicado` (snapshot), `alicuota_iva` (snapshot), `importe_centavos`, `reingresa_stock` (boolean).
- Una fila en `comprobante` (`tipo = 'nota_credito'`, `estado = 'autorizado'` como el ticket interno, `comprobante_referencia_id` = comprobante de la venta, importes = centavos/100 en el formato legacy) para que el circuito fiscal de R2 encuentre el vínculo ya hecho.
- Flag `notas_credito_habilitado` en `parametros_sistema`, default `false` (ADR-042). Permiso nuevo `nota.emitir` en `PERMISOS` de Retail y en `OPERADOR_PERMISOS` (ambos roles), con etiqueta en `ETIQUETA_PERMISO` de `@ferreteria/shared`.

*C. Reglas de emisión (`notaCreditoEmitirHandler`, una sola transacción).*
- Requiere sesión, flag activo, permiso `nota.emitir`, **credenciales de Supervisor en cada emisión** (`verificarSupervisor`; el id queda en `supervisor_autorizacion_id`; patrón de `LimiteCreditoAuthModal`) y motivo.
- Solo contra una venta `confirmada`. Una venta `anulada` no admite NC; una venta con NC emitidas **no se puede anular** (se corrige con notas).
- Por línea: `cantidad ≤ vendida − ya devuelta` en notas previas; al menos una línea con cantidad > 0.
- **Importes:** proporcionales al subtotal de la línea y al descuento global de la venta, en centavos, sin redondeo a $1. **La última devolución absorbe el residuo:** cuando se agotan todas las cantidades de una línea, esa línea se acredita por lo que falta hasta su total; y al completarse la venta, el residuo de redondeo (`ajuste_redondeo`) se asigna a la última nota, de modo que **Σ de las notas de una venta = `venta.total` exacto**, y nunca lo supera. La fórmula se fija con tests de propiedad (una NC total, o N notas parciales que sumen todo, dan `venta.total`).
- Neto e IVA por línea desde la alícuota snapshot; el comprobante guarda neto, IVA y total.
- **Resolución `devolucion_dinero`:** exige caja abierta del usuario que emite (`CAJA_REQUERIDA`); registra un egreso en esa caja (`motivo = 'ajuste'`, `referencia_tipo = 'nota_credito'`, `referencia_id = nota.id`, `forma_pago = medio_devolucion`; solo el efectivo afecta el arqueo, igual que hoy). Tope: lo efectivamente cobrado en medios que **no** son cuenta corriente, menos lo ya devuelto con dinero en notas previas.
- **Resolución `cuenta_corriente`:** exige que el cliente tenga cuenta; registra un movimiento tipo `pago`, motivo `nota_credito`, con `referencia_tipo = 'nota_credito'` y actualiza el saldo (puede quedar negativo = saldo a favor). La parte de la venta cobrada en cuenta corriente solo puede acreditarse por esta vía.
- **Stock:** por cada línea con `reingresa_stock`, un `movimiento_stock` de entrada, motivo `devolucion`, `cantidad × factor_a_stock_aplicado`, **sin costo** (el CPP no se recalcula), `referencia_tipo = 'nota_credito'`. Sin la casilla (mercadería rota) no hay movimiento de stock.
- No mueve remitos ni presupuestos.

*D. Interfaz.* Asistente en modal de 3 pasos (stepper, UX6): (1) ítems y cantidades con casilla "reingresa al stock"; (2) resolución, medio, motivo y observaciones; (3) resumen (neto, IVA, total) + credenciales de Supervisor. Se abre desde el detalle de venta (Caja y Reporte de Ventas) con el permiso y el flag. Nueva pantalla "Notas de crédito" (listado con filtros desde/hasta/estado/cliente, detalle y reimpresión), con las tres piezas de navegación (ruta, NAV, crumb) y su test de nav. Impresión: ticket propio de Retail por `print.html` (sin tocar el tipo B1 de `@ferreteria/shared`; extenderlo a `nota_credito` queda como espacio reservado hasta tener segundo consumidor).

*E. Reportes (PR3).* "Ventas netas = ventas − NC" (fecha de emisión de la nota) en el Dashboard y el Reporte de Ventas, consulta por consulta con tests; el margen resta el costo de las líneas que reingresaron. Hasta el PR3 Caja ya refleja las devoluciones (egreso) pero el Dashboard y el Reporte de Ventas no: por eso el flag no se activa en producción antes del PR3.

*Entrega:* **PR1** esquema + migración + handler + permiso + flag + numeración + comprobante (stock, caja y cuenta corriente) con tests; **PR2** interfaz (modal, listado, ticket, navegación); **PR3** reportes.

**Espacio reservado (documentado, no implementado).** Nota de débito (`tipo = 'debito'`, mismo circuito; cargo a cuenta corriente con motivo `nota_debito`); NC fiscal (ARCA, tipo A/B/C coherente con la factura de origen, CAE asíncrono) sobre el mismo `comprobante`; vale/saldo a favor para clientes sin cuenta corriente; motivo `devolucion` en `movimiento_caja`; ampliar B1 a `nota_credito` y promover el módulo al core con hooks cuando Elaborados lo pida; anulación o corrección de notas.

**Fuera de alcance.** ARCA (ADR-013 sigue abierto), nota de débito, vales, devoluciones de compras a proveedores, el control de `precio.override` en el main y `PRECIO_DESACTUALIZADO` (ADR de seguridad de ventas, sesión aparte).

**Consecuencias.** Nuevo documento inmutable y correlativo, con su rastro en caja, cuenta corriente y kardex. Un permiso más (tests de conteo y etiquetas). Mientras el flag esté apagado no cambia nada para nadie. Un Consumidor Final solo puede recibir devolución en dinero.

---

## 2. Bloque para `Estado.md`

**Cabecera** — anteponer a "Última actualización" (lo previo pasa a "Previo"):

```
2026-10-19 (**Retail — notas de crédito internas — ADR-XXX** — decisión aceptada, **pendiente de implementación en 3 PRs**: PR1 backend (tablas `nota`/`nota_linea` en centavos, correlativo `NC-<terminal>-NNNNNN`, comprobante `nota_credito`, devolución de dinero a la caja abierta del emisor o acreditación en cuenta corriente, reingreso de stock sin recalcular CPP, permiso `nota.emitir` para ambos roles con credenciales de Supervisor, flag `notas_credito_habilitado` en `false`); PR2 interfaz (asistente de 3 pasos desde el detalle de venta, listado, ticket); PR3 reportes ("ventas netas"). Nota de débito, NC fiscal (ARCA, ADR-013 abierto) y vales sin cuenta quedan reservados. Origen: A24 del análisis SICOVESTO. **Previo:** …
```

**Bitácora de decisiones** — agregar:

```
- `2026-10-19` — Retail: aprobado A24 (ADR-XXX). Discovery: solo hay dos resoluciones reales (el saldo a favor es la cuenta corriente); `anularVenta` exige caja de origen abierta, por eso el egreso de la NC va a la caja abierta del emisor; el ticket interno no tiene `numero`. Decisiones: Retail primero; `nota.emitir` en ambos roles con credenciales de Supervisor; importes proporcionales con residuo absorbido (Σ notas = `venta.total`); ND diferida; flag en `false` hasta el PR3 de reportes.
```

**Tabla "ADRs de arquitectura"** — fila: `ADR-XXX | Retail: notas de crédito internas | Aceptado (pendiente de implementación) | 2026-10-19 | docs/ADR-Log-ferreteria.md`.

**Releases / próximas fases** — en 1.1.x de Retail: "Notas de crédito internas — ADR-XXX — pendiente (3 PRs)". En 1.2.0 (fiscal): "NC/ND fiscales sobre el mismo `comprobante`".

**Backlog** (`mejoras-acumulativas.md`): A24 ✔ decidido (tramo interno); siguiente: A22.

---

## 3. Prompt de implementación para Superpowers

```
# CONTEXTO
Monorepo pnpm `Gestion-Pymes-Apps` (Electron 32 + React + TypeScript + SQLite/better-sqlite3 + Drizzle). Trabajás en `apps/retail` (`ferreteria-client`) y, solo para una etiqueta de permiso, en `packages/shared`. Leé `CLAUDE.md` antes de empezar (§3 principios, §7 modelo de datos, §8 permisos y "Al agregar un permiso", §Navegación, dos runners de test): rige.
Castellano rioplatense. Dinero en centavos enteros hasta el borde (tablas nuevas en centavos); soft-delete donde corresponda (las notas son inmutables); offline-first; phase-gate: el ADR-XXX autoriza lo descripto abajo y nada más.
Fuente de verdad del diseño: `docs/Pack-A24-notas-de-credito-internas.md` §1 (ADR-XXX). Si algo no está ahí, NO lo inventes: frená y preguntá. NO cierres ni toques ADR-013 (fiscal).
Flujo: TDD (RED-GREEN-REFACTOR), un PR por fase, tests del main bajo Electron (`node scripts/test-node.cjs`) en SERIE (el runner es flaky en paralelo), tests del renderer con vitest. Los comandos largos (suite completa, pnpm dev) los lanzás vos, no un subagente.

# DECISIONES CERRADAS (no reabrir)
- Solo nota de crédito. Nota de débito, NC fiscal, vales para clientes sin cuenta y anulación de notas: NO se implementan.
- Dos resoluciones: `devolucion_dinero` (egreso en la caja ABIERTA del usuario que emite, `motivo='ajuste'`, `referencia_tipo='nota_credito'`) y `cuenta_corriente`.
- `nota.emitir` para Operador y Supervisor + credenciales de Supervisor en cada emisión (`verificarSupervisor` devuelve el id).
- Σ de notas de una venta = `venta.total` exacto (residuo absorbido por la última); nunca lo supera.
- Reingreso de stock sin costo (el CPP no cambia). Todo en Retail; NO tocar `@core/*`, `PERMISOS_CORE`, Elaborados ni el tipo B1.
- Flag `notas_credito_habilitado` en `false`: nada cambia con el flag apagado.

# GATE 0 — GIT LIMPIO
1. `git status` y `git branch --show-current`. Si el árbol no está limpio o no estás en `main` actualizado: STOP y avisá.
2. Ramas: `feat/retail-notas-credito-backend`, luego `feat/retail-notas-credito-ui`, luego `feat/retail-notas-credito-reportes` (cada una parte de `main` con la anterior mergeada).

# FASE 1 — PR1: backend
1. Discovery de schema (solo lectura, ANTES de cualquier migración): leer `packages/core-db/src/schema/{ventas,credito}.ts`, `apps/retail/src/main/db/schema/*` (dónde viven `venta_detalle` y los esquemas de Retail), `packages/core-main/src/venta/{anular-venta,confirmar-venta}.ts`, `apps/retail/src/main/ipc/venta.ts` (`aplicarLineasRetail`/`revertirLineasRetail`, cómo se mueve stock en venta y anulación), `ipc/movimiento-stock.ts`, `ipc/stock.ts`, el helper del correlativo (`siguienteNumeroInterno`, `venta_correlativo_<terminal>`), `main/auth/seed.ts`, `packages/shared/src/permisos.ts` y los tests que afirman conteos de permisos. Confirmá: columnas de `venta_detalle` (precio_unitario, descuento_linea, subtotal, alicuota_iva, presentacion_id, factor_a_stock_aplicado), cómo se calcula `venta.total`/`ajuste_redondeo`/`descuento_global`, forma de `venta_pago`, cómo se obtiene la caja abierta del usuario, y el próximo número de migración (la última conocida es 0049 y hay trabajo pendiente en otras ramas; verificá el journal). Recordá que `drizzle-kit generate` está roto en Retail: migración SQL a mano consistente con el journal y los snapshots existentes.
2. STOP-AND-CONFIRM: mostrame (a) el DDL exacto de `nota` y `nota_linea` (con índices: único en `numero`, `venta_id`, `venta_detalle_id`), (b) las filas de `parametros_sistema` que insertará la migración (`notas_credito_habilitado=false` tipo bool; el contador se crea perezosamente como el de ventas, confirmá), (c) el permiso `nota.emitir` y su etiqueta. No escribas migración, permiso ni parámetros hasta mi OK. No sumes dependencias.
3. Migración aditiva e idempotente + esquema Drizzle de Retail. Permiso `nota.emitir` en `PERMISOS` y en `OPERADOR_PERMISOS`; etiqueta en `ETIQUETA_PERMISO` (única edición autorizada en `packages/*`; recompilar shared con `cd packages/shared && pnpm build`); actualizar los tests de conteo.
4. RED → GREEN, funciones puras en `apps/retail/src/main/notas/` (sin Electron ni BD): cálculo de importes por línea (proporcional al subtotal y al descuento global, en centavos), absorción del residuo, neto/IVA por línea y tope de devolución de dinero. Tests de PROPIEDAD: para ventas con descuento de línea, descuento global, IVA mixto y redondeo a $1, devolver todo en una nota o en N notas parciales (en cualquier orden y partición de cantidades) suma exactamente `venta.total`, nunca lo supera, y ningún importe es negativo.
5. RED → GREEN, `notaCreditoEmitirHandler(db, payload)` en una sola transacción, validación de payload en el borde con las primitivas de `@core/main` (patrón ADR-082): flag activo; sesión; permiso; credenciales de Supervisor; motivo obligatorio; venta `confirmada`; sin notas incompatibles; cantidades válidas; resolución; tope de devolución de dinero (cobrado en medios no-cuenta-corriente menos lo ya devuelto); caja abierta del emisor para devolución de dinero (`CAJA_REQUERIDA`); cuenta corriente existente para la otra resolución. Efectos: `nota` + `nota_linea`, correlativo, `comprobante` tipo `nota_credito` con `comprobante_referencia_id`, egreso de caja o movimiento de cuenta corriente (`pago`/`nota_credito`) con saldo resultante, y `movimiento_stock` de entrada motivo `devolucion` (sin costo, `cantidad × factor_a_stock_aplicado`) por línea con `reingresa_stock`. Tests: cada resolución, parcial y total, residuo, doble devolución de la misma línea, venta anulada, caja cerrada/inexistente, cliente sin cuenta, tope, credenciales inválidas, atomicidad (si algo falla no queda nada), Consumidor Final solo con dinero, el arqueo de caja considera el egreso en efectivo.
6. Regla inversa: `anularVenta` de Retail rechaza (código nuevo, p. ej. `VENTA_CON_NOTAS`, traducido en el catálogo de errores) una venta con notas emitidas. Esto es un cambio mínimo en el wrapper de Retail; si exige tocar `@core/main`, STOP y consultá.
7. Handlers de lectura (`nota:listar`, `nota:obtener`, `nota:pendientePorVenta` con lo ya devuelto por línea) y registro IPC + preload (`notas` en el bridge, tipado). Errores nuevos traducidos en `lib/errores.ts`.
8. Cierre de fase: typecheck, main en serie, tests de `packages/shared`. Con el flag apagado, verificá por test que ningún comportamiento existente cambia.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# FASE 2 — PR2: interfaz
1. Discovery (solo lectura): `VentaDetalleModal`/`renderVentaDetalle` (Caja), `ReporteVentas`, `ticketRetail.ts`, `PosView.tsx` (TicketModal e impresión por `print.html`), `LimiteCreditoAuthModal`/`SupervisorAuthModal`, `routes/index.tsx`, `shell/navRetail.tsx`, `shell/crumbsRetail.ts` y el test de nav de Elaborados (para replicarlo en Retail si no existe).
2. Asistente modal de 3 pasos (stepper) como en el ADR; botón "Emitir nota de crédito" en el detalle de venta de Caja y del Reporte de Ventas, visible solo con `can('nota.emitir')` y flag activo; venta anulada o ya devuelta por completo: botón deshabilitado con explicación. Errores de formulario con el patrón existente (`useCallIpc`, `rutearCampoError`, catálogo de errores): TODO submit de modal necesita catch + traducción de errores.
3. Pantalla "Notas de crédito": listado con filtros, detalle, reimpresión. Las TRES piezas de navegación: ruta en `routes/index.tsx`, ítem en `NAV` con su `permiso`, entrada en `CRUMBS`; agregá el test de nav de Retail (ruta real + breadcrumb distinto del fallback). Confirmá con `grep` que cada componente nuevo está efectivamente montado.
4. Ticket de nota de crédito propio de Retail por `print.html` (sin tocar B1/`@ferreteria/shared`/`@core/ui`). Si creés necesario extender B1, STOP y consultá.
5. Cierre de fase: typecheck, tests del renderer completos, main si tocaste algo. Con `pnpm dev` (rebuild para Electron antes), navegando como Operador y como Supervisor, con el flag activado en la BD de desarrollo: emití una NC parcial con devolución de dinero y otra total a cuenta corriente, verificá caja, saldo de cuenta, kardex y que se puede reimprimir. Si no podés verificarlo en la app, decilo explícitamente.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# FASE 3 — PR3: reportes
1. Discovery (solo lectura): listá TODAS las consultas que suman `venta.total`/`subtotal`/`importe_iva` o miden margen (`dashboard.ts`, `dashboard-rango.ts`, `dashboard-caja-rango.ts`, `dashboard-clientes.ts`, `reportes.ts`, el panel Inventario si ya existe) y proponé, consulta por consulta, cómo restan las notas (por fecha de emisión de la nota) y cómo se muestra "ventas netas" con su fórmula visible (UX4/UX9).
2. STOP-AND-CONFIRM: aprobame la lista de consultas y la semántica antes de editarlas (son módulos aprobados; este ADR autoriza solo restar notas).
3. RED → GREEN por consulta, con tests que comparan contra el resultado sin notas (sin notas, nada cambia). Margen: restar costo de las líneas que reingresaron.
4. Cierre de fase: typecheck, main en serie, renderer. Verificación en la app con datos de seed. Recién con el PR3 mergeado se recomienda activar el flag en una instalación real.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# CONDICIONES DE STOP (todas las fases)
- Cualquier cambio en `@core/*`, `PERMISOS_CORE`, Elaborados, el tipo B1 o una dependencia nueva ⇒ STOP.
- Cualquier mención a ARCA/CAE/ADR-013, nota de débito, vales o anulación de notas ⇒ fuera de alcance: no implementar, solo reservar.
- Tocar `precio.override` o `PRECIO_DESACTUALIZADO` ⇒ fuera de alcance (ADR de seguridad de ventas).
- Una migración distinta de las aprobadas o un parámetro no listado ⇒ STOP.
- Tests rotos que no son tuyos ⇒ no los arregles en silencio: reportalos.

# CIERRE DOCUMENTAL (en el PR de la última fase)
Actualizá `Estado.md` (cabecera + Bitácora + tabla de ADRs + releases), `docs/ADR-Log-ferreteria.md` (ADR → Implementado, fechas, gates de tests) y `CLAUDE.md` (§7 tablas nuevas `nota`/`nota_linea`, §8 permiso `nota.emitir` y conteos). Un paso no está cerrado hasta que todo esté al día.

# ENTREGA DE CADA FASE
Resumen de qué cambió, diff completo, salida de typecheck y de las suites (main en serie, renderer), qué verificaste en la app y qué NO pudiste verificar. No hagas merge: lo decido yo.
```
