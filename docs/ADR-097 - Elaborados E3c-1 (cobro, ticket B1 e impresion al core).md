# ADR-097 — Elaborados E3c-1: cobro, ticket (B1) e impresión HTML al core

**Estado:** Aceptado — implementado y mergeado a `main` (PR #10, 2026-10-13)
**Fecha:** 2026-10-13
**Spec:** `docs/superpowers/specs/2026-10-13-elaborados-e3c-pos-design.md` (§2)
**Plan:** `docs/superpowers/plans/2026-10-13-elaborados-e3c1-core-venta-ui.md`
**Precedentes:** ADR-095 (core de venta), ADR-096 (backend de venta de Elaborados).

## Contexto

El POS de Elaborados (E3c Slice 2) necesita cobrar, mostrar e imprimir un ticket. Esas tres piezas
ya existían en Retail (`ConfirmarVentaModal`, `TicketModal`, impresión HTML) y son universales:
con Elaborados como 2º consumidor, la regla de tres manda promoverlas. E3c se partió con el usuario en
**Slice 1** (esta promoción, Retail re-apuntado sin cambios visibles) y **Slice 2** (el POS de Elaborados).

## Decisión

1. **B1 en `@ferreteria/shared`** (`comprobante.ts`, puro): `ItemComprobante`, `ReceptorComprobante`,
   `IvaAlicuota`, `PagoComprobante`, `ComprobantePayload` y `ivaPorAlicuota(items, descuentoGlobalCentavos)`
   (agrupa por alícuota con IVA incluido, prorratea el descuento global, redondea por grupo). Hoy lo
   consume el ticket interno; en R2 lo consumirá ARCA. **ADR-013 no se toca.**
2. **`TicketModal` genérico en `@core/ui`** (`views/venta/`), dibujado desde `ComprobantePayload` con
   `buildTicketHtml` (puro, con escape de HTML). Imprimir es un `onImprimir(html)` inyectado (sin el
   prop, no hay botón); la anulación es un **slot** (`anulacion({ onSuccess, onCancel })`): el flujo de
   anulación sigue siendo de cada app.
3. **`ConfirmarVentaModal` y los tipos `MedioPago`/`VentaPagoPayload` se mueven tal cual a `@core/ui`**
   (rename de git, solo cambian imports; sus 13 tests se mueven con él). Retail re-exporta los tipos
   desde `usePosSession`.
4. **Impresión HTML universal:** `crearImpresorHtml(createWindow)` en `@core/main` (lógica movida de
   `ElectronPrintService.printRawHtml`), opción `imprimirHtml?` en `registerCoreHandlers` que registra
   `print:html`, y `print.html` en `@core/preload`. Las etiquetas de producto/ubicación siguen en
   Retail, que deja de registrar `print:html` (evita el doble `ipcMain.handle`) y le pasa su impresor al
   core. Elaborados pasa el suyo.
5. **Retail re-apuntado** con un adaptador `ticketDesdeVentaRetail` (pesos → centavos) y el slot de
   anulación con su `AnulacionModal`.

## Convención aclarada: `venta.descuento_global` es un PORCENTAJE
La columna legado `venta.descuento_global` guarda el **porcentaje** de descuento global (el POS de
Retail envía `descuentoGlobalPct`). En E3b Elaborados la guardaba como importe en pesos; se corrigió en
este slice (fix + test) para unificar la semántica entre apps. El adaptador de Retail convierte el
porcentaje a importe con la misma fórmula que `resolverPrecio` (`bruto − round(bruto × (1 − pct/100))`)
para que el ticket cierre al centavo.

## Consecuencias
- **Cambios visibles en el ticket de Retail (intencionales):** el descuento global se muestra como importe
  y no como `-N%`; se muestra el ajuste de redondeo; el HTML impreso escapa las descripciones.
- **Deuda anotada:** el resultado de `venta:confirmar` de Retail no trae `venta_pago`, así que en una venta
  con medios mixtos el ticket muestra un único medio por el total (el original mostraba solo "Forma de
  pago"); `crearImpresorHtml` no cierra la ventana oculta si `loadURL` rechaza (igual que el código
  original); el desglose de IVA por alícuota es informativo y puede diferir ±1 centavo de
  `venta.importe_iva`.

## Diferido
POS de Elaborados (Slice 2); pedidos en espera y anulación en pantalla (E3d); listas de precio (E4).

## Verificación
Gates en serie: **shared 19 archivos/165 · core-ui 4/26 · core-main 2 · core-preload 6 · Retail renderer
145/933 · Retail main 141/1598 · Elaborados renderer 68 · Elaborados main 20/113**; typecheck limpio.
Retail renderer pasa de 948 a 933: −13 del modal movido a core-ui, −4 del ticket viejo, +2 del adaptador
(el `PosView.test.tsx`, sin editar, sigue cubriendo el botón Anular del ticket para Operador y
Supervisor). Revisión final independiente del diff completo: sin hallazgos críticos ni importantes; los
menores baratos se corrigieron. Click-through en Retail confirmado por el usuario (CLAUDE.md §12).
