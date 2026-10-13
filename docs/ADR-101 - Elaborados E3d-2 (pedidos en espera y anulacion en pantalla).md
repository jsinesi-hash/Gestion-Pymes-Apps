# ADR-101 — Elaborados E3d-2: pedidos en espera/para llevar y anulación en pantalla

**Estado:** Aceptado — implementado en la rama `e3d2-pedidos-elaborados` (pendiente de click-through y merge)
**Fecha:** 2026-10-13
**Spec:** `docs/superpowers/specs/2026-10-13-elaborados-e3d-espera-anulacion-design.md` (§3)
**Plan:** `docs/superpowers/plans/2026-10-13-elaborados-e3d2-pedidos-anulacion.md`
**Precedentes:** ADR-095 (`confirmarVenta` ya retoma vía `venta_en_espera_id`), ADR-098 (POS), ADR-100
(venta en espera y `AnulacionModal` al core).

## Contexto

El POS de Elaborados (ADR-098) vendía y mostraba el ticket, pero no podía guardar un pedido para llevar/delivery
propio ni anular una venta desde pantalla. Con el core ya preparado (ADR-100), este slice cierra E3.

## Decisión

1. **Backend `venta.espera:pausar/listar/retomar/descartar`** (`main/ipc/venta-espera.ts`), todos con `venta.crear`,
   sobre `pausarVentaEspera`/`listarVentasEspera`/`descartarVentaEspera` del core.
   - `pausar` valoriza el carrito con `valorizarCarrito` (el renderer no manda precios) y guarda encabezado
     (totales, `alias`, `observaciones`, `descuento_global` como **porcentaje**) y líneas con sabores
     **sin tocar stock, caja ni pagos**; **no valida stock** (se valida al cobrar). Con `venta_id` actualiza el
     pedido en el lugar.
   - `retomar` devuelve las líneas (`producto_venta_id`, cantidad, descuento de línea, sabores agrupados por grupo
     derivado de `grupo_modificador_opcion`), alias, observaciones, descuento global y cliente; el POS vuelve a
     cotizar, así que un pedido retomado nunca arrastra precios viejos.
2. **`aplicarLineasElaborados` se parte** en `guardarLineasElaborados` (líneas y sabores; con `esRetoma` reemplaza las
   previas, modificadores antes que líneas por las FK) y `descontarStockElaborados`. Un pedido usa solo la primera;
   confirmar usa ambas, así el stock se descuenta **una sola vez**, al confirmar.
3. **`venta:confirmar` acepta `venta_en_espera_id`:** la venta del pedido se confirma con su mismo `id`, toma el
   número `V-…` (deja de ser `HOLD:…`) y se valoriza de nuevo con los precios y recetas del momento.
4. **POS:** "Guardar pedido" (modal con alias obligatorio y observaciones: dirección, hora, aclaraciones),
   "Pedidos (N)" con un panel de pendientes (alias, observaciones, ítems, total, antigüedad y badge "Vencido"; retomar
   o descartar con confirmación en dos pasos). Al retomar el carrito queda **vinculado** al pedido (chip
   "Pedido: …" con **Soltar**): "Guardar" lo actualiza en el lugar y COBRAR lo confirma. Retomar solo con el carrito
   vacío; los productos que ya no están en el catálogo se omiten con aviso. El vínculo se limpia al confirmar, al
   guardar, en "Nueva venta" y cuando el carrito queda vacío (para no cobrar un pedido con contenido ajeno).
5. **Anulación en pantalla** con el `AnulacionModal` del core, solo con `venta.anular`: en el ticket recién emitido
   (slot `anulacion` de `TicketModal`) y en `VentaDetalleModal` de Caja (que vuelve a pedir la venta y muestra
   ANULADA; Caja se refresca al cerrar vía `onClose`). El `selector de cliente` ahora muestra el cliente de un pedido
   retomado.
6. **`SupervisorAuthModal` traduce los errores envueltos de Electron** (hallazgo de la revisión final): Electron
   rechaza `invoke` con `"Error invoking remote method '…': Error: SUPERVISOR_INVALIDO"`, así que la comparación
   exacta nunca coincidía y el usuario veía la cadena técnica. Ahora usa `includes` para el mensaje unificado y
   `traducirError` para el resto. Aplica también a Retail y a la anulación de producción.

## Consecuencias
- **Lecturas de `en_espera`:** una venta en espera no impacta caja ni stock y no debe aparecer en reportes.
  `ventaListByCaja` filtra `confirmada`/`anulada` y el cierre de caja se calcula con `movimiento_caja`; todo punto de
  lectura nuevo (E4) debe filtrar el estado explícitamente.
- **Soltar un pedido y cobrar** confirma una venta nueva y deja el pedido original pendiente: es el diseño (el
  operador decide) pero permite duplicarlo; se lo descarta desde el panel.
- Un error de dominio fuera de `errores.ts` ahora se muestra con el mensaje genérico de `traducirError` en
  `SupervisorAuthModal` (antes, crudo): se incorporarán al catálogo a medida que aparezcan (p. ej. los de
  `ProduccionView`).

## Deuda anotada por la revisión final
- `grupoModificadorOpcionSetHandler` (E2) borra y reinserta las opciones: con las FK activas fallará en cuanto una
  venta o un pedido referencie una opción, es decir, **editar sabores después de la primera venta probablemente
  rompe**. Requiere su propio arreglo (upsert por id / baja lógica) antes de uso real.
- Mientras se vuelve a pedir `venta.get` tras anular desde Caja, el botón "Anular" sigue visible un instante (un
  segundo intento da `VENTA_YA_ANULADA`, sin daño).

## Diferido
Campos estructurados de delivery, integraciones con apps de delivery, reserva de stock, listas de precio (E4).

## Verificación
Gates en serie: **core-ui 6 archivos/40 · Retail renderer 144/925 · Retail main 141/1598 (sin cambios) · Elaborados renderer 19/174 · Elaborados main 26/160**; typecheck limpio. Las suites de Retail pasan sin editar aserciones (el único cambio de `core-ui` que lo toca es el `SupervisorAuthModal`, con 4 tests nuevos propios). Revisión final independiente del diff completo (23 archivos): sin hallazgos críticos; el importante (errores envueltos de Electron en el `SupervisorAuthModal`) y los menores baratos (desvincular el pedido con el carrito vacío, `listar` con `venta.crear`, retomar con el catálogo sin cargar, tests de ramas de error) se corrigieron antes del PR. Falta el click-through con el usuario (CLAUDE.md §12).
