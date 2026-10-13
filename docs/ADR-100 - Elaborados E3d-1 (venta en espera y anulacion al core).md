# ADR-100 — Elaborados E3d-1: venta en espera y anulación al core

**Estado:** Aceptado — implementado en la rama `e3d1-core-espera-anulacion` (pendiente de click-through y merge)
**Fecha:** 2026-10-13
**Spec:** `docs/superpowers/specs/2026-10-13-elaborados-e3d-espera-anulacion-design.md` (§2)
**Plan:** `docs/superpowers/plans/2026-10-13-elaborados-e3d1-core-espera-anulacion.md`
**Precedentes:** ADR-095 (el core de venta ya soporta retomar vía `venta_en_espera_id`), ADR-097 (cobro, ticket
e impresión al core), ADR-098 (POS de Elaborados).

## Contexto

E3d agrega a Elaborados los pedidos en espera/para llevar y la anulación en pantalla. Ambas cosas ya existían en
Retail (`venta-espera.ts`, `AnulacionModal`) y son en buena parte universales; con Elaborados como 2º consumidor
la regla de tres manda promoverlas. E3d se partió con el usuario en **Slice 1** (esta promoción, Retail
re-apuntado sin cambios visibles) y **Slice 2** (los pedidos y la anulación en Elaborados). El spec de la familia
ya había decidido que el encabezado de la venta en espera va al core y las líneas las persiste cada app.

## Decisión

1. **`AnulacionModal` → `@core/ui`** (`views/venta/`): mismo flujo de 2 pasos (motivo → `SupervisorAuthModal`),
   ahora sobre `bridge().venta.anular` en vez de `globalThis.ferreteria` (la firma ya es idéntica en ambas apps).
   Los 8 tests del modal se movieron con él, solo con el mock del bridge adaptado.
2. **Encabezado de la venta en espera → `@core/main`** (`venta/espera.ts`), con la lógica movida de Retail:
   - `pausarVentaEspera(db, input, { aplicarLineas })`: sesión + `venta.crear`, caja abierta, tope
     `pos.ventas_en_espera.max`, encabezado `en_espera` con número `HOLD:xxxxxxxx`, `alias` y `observaciones`; las
     líneas las persiste el hook de la app. **Novedad (Retail no la usa):** con `venta_id` actualiza **en el lugar**
     esa venta `en_espera` (conserva `numero_interno`, `en_espera_desde`, turno y usuario de origen; cambia la
     caja, porque se cobra en la caja del momento; no aplica el tope; llama al hook con `esRetoma: true` para que
     la app reemplace sus líneas). El chequeo de estado y el UPDATE corren dentro de la transacción y el UPDATE
     filtra por `estado = 'en_espera'`.
   - `descartarVentaEspera(db, ventaId)` y `listarVentasEspera(db, contarItems)` (pendientes por antigüedad, con
     `vencida` según `pos.ventas_en_espera.ttl_horas` y `observaciones`).
3. **Retail** queda con wrappers finos (validación SEC-2 + hooks); `retomar` sigue en Retail porque lee sus líneas.
   Canales IPC, firmas y códigos de error sin cambios; el listado ahora trae además `observaciones` (siempre
   `null` en Retail).

## Consecuencias
- **Lecturas de `en_espera`:** una venta en espera no impacta caja ni stock y no debe aparecer en reportes. Hoy
  Elaborados no tiene reportes, pero todo punto de lectura nuevo (E4) debe filtrar el estado explícitamente.
- El número `HOLD:xxxxxxxx` (8 hex del UUID) ocupa el índice único de `numero_interno`; el riesgo de colisión es
  despreciable y es el mismo esquema que ya usaba Retail.

## Diferido
Slice 2: pedidos en espera/para llevar en el POS de Elaborados (backend `venta.espera:*`, `venta:confirmar` con
`venta_en_espera_id`, guardar/retomar/descartar con alias y observaciones) y anulación en pantalla en el ticket y
en el detalle de la venta en Caja.

## Verificación
Gates en serie: **core-ui 5 archivos/36 · Retail renderer 144/925 · Retail main 141/1598 (sin cambios) ·
Elaborados renderer 16/131 · Elaborados main 25/141**; typecheck limpio. Retail renderer baja de 933 a 925 porque
los 8 tests del modal de anulación se movieron a core-ui. Las suites de espera de Retail (`venta-espera.handlers` y
`validation`) y `venta.handlers` pasan sin editarse. Revisión final independiente del diff: sin hallazgos críticos
ni importantes; los menores (validar el estado dentro de la transacción, tests de rollback y de caja en la rama de
actualización, turno/usuario de origen) se corrigieron. Falta el click-through en Retail (CLAUDE.md §12).
