# ADR-095 — Elaborados E3a: `confirmarVenta` / `anularVenta` al core

**Estado:** Aceptado — implementado en la rama `e3a-confirmar-venta-core` (pendiente de merge a `main`)
**Fecha:** 2026-10-05
**Spec:** `docs/superpowers/specs/2026-10-05-elaborados-e3a-confirmar-venta-core-design.md`
**Plan:** `docs/superpowers/plans/2026-10-05-elaborados-e3a-confirmar-venta-core.md`
**Precedentes:** ADR-091/092/093 (Elaborados E1/E2). Nota de numeración: ADR-094 es el reuso de
`SupervisorAuthModal` en las anulaciones.

## Contexto

E3 (venta de Elaborados) necesita confirmar y anular ventas. `ventaConfirmarHandler` /
`ventaAnularHandler` de Retail (`apps/retail/src/main/ipc/venta.ts`) mezclaban lo **universal**
(sesión y permisos, caja, validación de pagos, límite de cuenta corriente, vuelto, numeración,
`venta`/`venta_pago`/`movimiento_caja`/cta cte/`comprobante`) con lo **propio de Retail** (stock por
producto, re-resolución de precio por lista, presupuesto→venta). Con Elaborados como 2º consumidor, la
regla de tres exige extraer lo universal. E3 se partió en **E3a** (esta extracción, sin UI, Retail
re-apuntado sin cambio de comportamiento) y **E3b** (POS de Elaborados).

## Decisión

Template method con hooks en `packages/core-main/src/venta/`, exportado desde `@core/main`:

- `confirmarVenta(db, input, { validarPrevio?, aplicarLineas })` → `{ venta, comprobante }`.
  `validarPrevio()` corre antes de la transacción (stock, precio…); `aplicarLineas(tx, ctx)` dentro
  de ella (líneas, inventario, efectos de la app), con `ctx = { ventaId, now, sync, userId, esRetoma }`.
- `anularVenta(db, input, { revertirLineas })` → `venta`. `revertirLineas(tx, ctx)` dentro de la
  transacción.
- **El core recibe los totales ya calculados** (`subtotal`, `importe_iva`, `total`,
  `ajuste_redondeo`, en pesos) y los persiste tal cual, como hacía Retail. Recalcular en servidor
  queda para R2/ARCA.
- **Correlativo:** `venta_correlativo_<terminal>` lo sembraba la migración SQL de Retail; el core lo
  **crea si falta, dentro de la misma transacción** (la 1ª venta de una app nueva es `V-C1-000001`).
- **Retomar una venta en espera** lo soporta el core (`venta_en_espera_id` → update del encabezado,
  `esRetoma` en el hook). Los handlers de en espera (`venta-espera.ts`) **siguen en Retail**.
- **Retail** queda con wrappers finos: permiso + validación SEC-2 + hooks (`validarLineasPrevio`,
  `aplicarLineasRetail`, `revertirLineasRetail`) con la lógica movida textual. Mismos canales IPC,
  firmas y códigos de error.

## Diferido a E3b
B1 (`ItemComprobante`/`ComprobantePayload`) y `TicketModal` desde `ComprobantePayload` (sin consumidor
en E3a porque el core no consume ítems), flujo en espera como seam compartido, POS de Elaborados.
**Gotcha para E3b:** el cliente "Consumidor Final" (`cf000000-0000-0000-0000-000000000001`) también lo
siembra una migración de Retail; Elaborados no lo tiene y deberá sembrar su cliente por defecto.

## Verificación
- Core probado desde Elaborados (BD con solo migraciones core): `venta-core.test.ts`, 14 tests.
- Retail: 7 tests de caracterización nuevos (códigos de error sin cobertura, escritos antes de mover)
  + la suite existente de venta/anulación/espera/presupuesto **sin modificar** (99 verdes en esos 6
  archivos).
- Gates finales: **Retail main 141 archivos/1598 · Retail renderer 947 · Elaborados main 79 ·
  Elaborados renderer 68**; typecheck de `core-main`, Retail y Elaborados limpio.
- Revisión de fidelidad línea a línea de `confirmarVenta` contra el original: sin diferencias de
  comportamiento no intencionales (el reordenamiento de `marcarPresupuestoConvertido` y del borrado
  de `venta_detalle` dentro de la misma transacción no tiene efecto observable).
