# ADR-096 — Elaborados E3b: backend de venta (valorizar, confirmar, anular)

**Estado:** Aceptado — implementado en la rama `e3b-venta-backend`
**Fecha:** 2026-10-12
**Spec:** `docs/superpowers/specs/2026-10-12-elaborados-e3b-venta-backend-design.md`
**Plan:** `docs/superpowers/plans/2026-10-12-elaborados-e3b-venta-backend.md`
**Precedentes:** ADR-095 (E3a: `confirmarVenta`/`anularVenta` en el core), ADR-093 (E2: catálogo de
venta, `calcularConsumo`/`validarStock`).

## Contexto

Con E3a el core sabe confirmar y anular ventas, y E2 dejó el catálogo de venta de la heladería
(productos, componentes fijos, grupos de modificadores/sabores). Faltaba que Elaborados *venda*. El
resto de E3 se partió con el usuario en tres planes: **E3b** backend de venta (este ADR), **E3c** POS
(botonera, selector de sabores, cobro, ticket con B1/`TicketModal`) y **E3d** pedidos en espera +
anulación en pantalla.

## Decisión

1. **Los precios y totales los calcula el main de Elaborados desde el catálogo**; el renderer manda
   producto + cantidad + opciones, nunca precios (difiere de Retail, que confía en el renderer). Una
   sola fuente de verdad, sin carritos con precio desactualizado.
2. **Descuento de línea + global** con el motor completo de `shared` (`resolverPrecio` con
   `ajustePct: 0`), como Retail, **sin gate de permiso** (`precio.override` queda sin uso en
   Elaborados). Total redondeado a $1 con `redondearPeso`; IVA incluido prorrateado sobre el total
   exacto antes del redondeo.
3. **Dominio puro `valorizarCarrito`** (`main/domain/venta.ts`): valida el carrito contra el
   catálogo (`min`/`max`, duplicados, opciones del grupo), precio = base + recargos de sabor, y
   consumo por línea con `calcularConsumo` de E2 (el consumo por opción sale de la misma función con
   `cantidadLinea = 1`, sin duplicar fórmulas).
4. **Handlers `venta:*`** sobre `confirmarVenta`/`anularVenta` del core: `cotizar` (valoriza sin
   persistir; E3c lo llamará en cada cambio del carrito), `confirmar`, `anular`, `get`, `listByCaja`.
   El paso centavos→pesos hacia `venta` (columnas legado REAL) ocurre en **un solo punto**.
5. **Política de stock R2:** el consumo se agrega por artículo entre líneas. Un artículo con
   `bloquea_sin_stock` que quedaría < 0 aborta con `STOCK_INSUFICIENTE:<nombre>`; si no bloquea, la
   venta pasa, el stock queda negativo y el resultado trae `advertencias`.
6. **Anulación sin recalcular:** invierte los `movimiento_articulo` originales de la venta
   (`referencia_tipo = 'venta'`), así restituye exactamente lo descontado aunque la receta o los
   modificadores hayan cambiado.
7. **Esquema:** `venta_linea` y `venta_linea_modificador` (migración `0005`, solo 2 `CREATE TABLE`).
   Los movimientos de artículo siguen la convención de E2: `cantidad` con signo y `tipo` derivado del
   motivo.
8. **Cliente "Consumidor Final"** (`cf000000-…-0001`, mismo id que Retail): `asegurarConsumidorFinal`
   idempotente que corre en **cada arranque** (en Retail lo siembra una migración SQL; en Elaborados
   el seed base solo corre en el primer arranque, y esto llega también a instalaciones ya sembradas).
9. **`ventaListByCajaHandler` se promueve a `@core/main`:** la vista de caja del core
   (`CajaDashboard`) ya lo invoca vía `bridge().venta.listByCaja` y lo necesitan ambas apps; Retail lo
   re-exporta. Elaborados no tenía el namespace `venta` en su bridge.
10. Mensajes de error de los códigos nuevos en `core-ui/lib/errores.ts`.

## Hardening surgido de la revisión final
`cantidad` con tope (`max: 100000`; `num()` aceptaba `Infinity`), redondeo a 1e-6 del stock
resultante (incluido `validarStock`, que bloqueaba por error de punto flotante: 0.3 − 0.1 − 0.2 ≠ 0),
validación de `id` en `venta:get` y de `motivo` en `venta:anular`, y tests de cuenta corriente y de
rollback total a nivel handler.

## Diferido
UI del POS, selector de sabores y `TicketModal`/B1 (E3c); pedidos en espera y anulación en pantalla
(E3d); listas de precio (E4). Deuda menor anotada por la revisión: `venta:listByCaja` no exige
sesión (heredado de Retail), faltan índices en `venta_linea.venta_id` y
`venta_linea_modificador.venta_linea_id`, y el mensaje de `STOCK_INSUFICIENTE` no muestra el nombre
del artículo (el backend ya lo manda).

## Verificación
Gates en serie: **Retail main 141 archivos/1598 · Retail renderer 948 · Elaborados main 20
archivos/113 · Elaborados renderer 68**; typecheck de `core-main`, Retail y Elaborados limpio.
Elaborados main sube de 79 a 113 (consumidor final 1, dominio 11, handlers 21, `consumo` +1). Revisión
final del diff completo (revisor independiente): sin hallazgos críticos en producción; los
importantes y los menores baratos se corrigieron antes de mergear.
