# ADR-098 — Elaborados E3c-2: POS de Elaborados

**Estado:** Aceptado — implementado en la rama `e3c2-pos-elaborados` (pendiente de click-through y merge)
**Fecha:** 2026-10-13
**Spec:** `docs/superpowers/specs/2026-10-13-elaborados-e3c-pos-design.md` (§3)
**Plan:** `docs/superpowers/plans/2026-10-13-elaborados-e3c2-pos.md`
**Precedentes:** ADR-095 (core de venta), ADR-096 (backend de venta de Elaborados), ADR-097 (cobro, ticket e
impresión al core).

## Contexto

Con el backend de venta (ADR-096) y los componentes de cobro, ticket e impresión en el core (ADR-097),
faltaba la pantalla: Elaborados podía valorizar, confirmar y anular ventas pero no vender. Este es el
segundo y último slice de E3c.

## Decisión

1. **Layout elegido por el usuario:** barra de categorías arriba, grilla de productos con botones grandes
   a la izquierda y carrito a la derecha (cliente, líneas, descuento global, total, COBRAR). Sin botón
   "En espera" (E3d).
2. **`venta:catalogo`** (main, solo lectura, exige sesión): categorías y productos activos con sus grupos y
   opciones en una sola llamada, para no hacer N+1 desde el renderer.
3. **El renderer no calcula precios.** Todo importe sale de `venta:cotizar`. El carrito es un reducer puro
   (`carritoReducer`) que fusiona líneas idénticas (mismo producto, mismos sabores y sin descuento de
   línea); `usePosCotizacion` cotiza con debounce de 150 ms, descarta respuestas obsoletas y depende del
   **contenido** del payload (no de su identidad, para no re-cotizar en cada render). La única suma local
   es la ayuda visual del botón "Agregar" del selector de sabores.
4. **Selector de sabores** (modal con chips): respeta `min`/`max` (con `max = 1` elegir otro reemplaza),
   muestra el recargo premium y no permite agregar hasta cumplir el mínimo. Para cambiar los sabores de una
   línea ya cargada se la quita y se vuelve a cargar.
5. **Stock:** los bloqueos de la cotización deshabilitan COBRAR; las advertencias de granel que quedaría en
   negativo se muestran sin bloquear (política R2 del backend).
6. **Clientes:** Consumidor Final por defecto + selector con búsqueda local (sin tildes ni mayúsculas) sobre
   `cliente.list` del core. Con cuenta corriente habilitada aparece ese medio de pago y, al exceder el
   límite (`LIMITE_CREDITO_EXCEDIDO`), se pide Supervisor con el `SupervisorAuthModal` del core y se
   reintenta con las credenciales (mismo patrón que Retail).
7. **Cobro, ticket e impresión** con los componentes del core (`ConfirmarVentaModal`, `TicketModal` con
   `onImprimir` → `bridge().print.html`). `ticketDesdeVentaElaborados` arma el `ComprobantePayload` (B1) desde
   el resultado de `venta:confirmar` con las descripciones de sabores, el descuento global derivado del
   porcentaje y **los pagos reales** (a diferencia de Retail, el ticket de Elaborados sí muestra medios mixtos).
   Sin slot de anulación (llega con E3d).
8. **Caja obligatoria:** sin caja abierta el POS muestra un acceso a `/caja`. La vista de caja del core ya
   tiene su canal `venta.listByCaja` y ahora `renderVentaDetalle` abre `VentaDetalleModal` (solo lectura,
   líneas con sabores).
9. **Navegación:** ruta `/pos`, grupo "Venta" primero en el NAV (ícono de carrito completo, no un path
   truncado), crumb y `common/navegacion.ts` con `/pos` como pantalla de inicio de ambos roles.
   `venta.crear` lo tienen Operador y Supervisor.

## Consecuencias
- **Deuda anotada por la revisión final:** `ventaCatalogoHandler` hace consultas en cascada
  (1 + P×(1 + 2G)); es SQLite síncrono y el catálogo es chico, se puede reducir a 4 consultas con `inArray`.
  Los productos de una categoría inactiva quedan inalcanzables (se muestra el estado vacío si ninguno lo
  es).
- El `role="alert"` del error de cobro es un overlay propio porque `ConfirmarVentaModal` no tiene slot de error.

## Diferido
Pedidos en espera/para llevar y anulación en pantalla (E3d); listas de precio (E4); edición de sabores de una
línea cargada; balanza; ARCA (R2).

## Verificación
Gates en serie: **Retail renderer 145/933 · Retail main 141/1598 (sin cambios) · core-ui 4/28 · Elaborados renderer 16/131 · Elaborados main 24/131**; typecheck limpio. Revisión final
independiente del diff completo (31 archivos): sin hallazgos críticos ni importantes; los menores baratos
(subtotales por línea sin desfase, estado vacío de la grilla, tests del flujo de crédito) se corrigieron.
Falta el click-through con el usuario (CLAUDE.md §12): abrir caja, pote de 3 sabores, palito sin stock
(bloquea), sabor en negativo (avisa), descuentos, cobro mixto, cuenta corriente con Supervisor, ticket e
impresión, y el detalle de la venta en Caja.
