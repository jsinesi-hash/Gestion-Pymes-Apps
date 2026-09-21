# ADR-083 — Ajustes varios: relación producto-proveedor, alta masiva, nav de Importar, lista de precios por cliente

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-10 · **Versión objetivo:** 1.0.x
(features aditivas, sin flag nuevo, sin migraciones de esquema)

Batch de cuatro ajustes de UX independientes pedidos por el PO. Ninguno introduce dependencias
nuevas ni cambios de esquema (todos usan tablas, columnas e IPC existentes). Un único handler
nuevo (`asociarLote`) y la persistencia de una columna que ya existía pero el handler ignoraba.

Spec de brainstorming: `docs/superpowers/specs/2026-09-10-ajustes-varios-proveedor-cliente-nav-design.md`.
Plan de implementación: `docs/superpowers/plans/2026-09-10-ajustes-varios-proveedor-cliente-nav.md`.

---

## A — Agregar proveedor desde el detalle del producto

**Problema.** `ProveedoresPanel.tsx` (panel Proveedores de `ProductoDetalle`) sólo mostraba el
aviso *"Sin proveedores asociados. Para agregar uno, ir al detalle del proveedor en Compras →
Proveedores."* con un link. Dar de alta la relación obligaba a un rodeo por Proveedores →
seleccionar proveedor → tab Productos → buscar el producto.

**Solución.** Botón **"+ Agregar proveedor"** siempre visible en el panel (ambas ramas del
componente: flag motor v2 on/off), con un mini-form inline: selector de proveedor buscable,
Costo (opcional → 0) y Código proveedor (opcional).

- **Preferido = Auto + checkbox** (decisión de producto): si el producto no tenía ningún
  proveedor, el nuevo queda **preferido automáticamente**; si ya había otros, aparece un
  checkbox opcional *"Marcar como preferido"*.
- Reusa IPC existente: `compras.pp.upsert({ producto_id, proveedor_id, costo_centavos,
  codigo_proveedor })` → `{ id }` (idempotente, inserta con `preferido:false`), seguido de
  `compras.pp.setPreferido(id)` cuando corresponde.
- **RBAC:** el botón se muestra sólo con permiso `proveedor.gestionar` (Supervisor). Es
  **consistente con lo previo**: el panel ya invocaba `setPreferido`/`setOverrides`, que exigen
  ese permiso. La matriz RBAC no cambia. Habilitarlo para el Operador queda **fuera de alcance**
  (implicaría tocar los permisos de `compras.pp:*`; decisión de producto separada).

## B — Alta masiva de productos en el proveedor

**Problema.** El tab Productos del proveedor (`ProveedorProductosTab.tsx`) tenía una búsqueda en
el toolbar que filtraba los productos **ya asociados** (confusa, parecía buscar en todo el
catálogo) y un "+ Agregar producto" que buscaba de a uno, tedioso para cargar muchos.

**Solución.**

- Se **retira** la búsqueda del toolbar (sobre asociados). La tabla de asociados conserva el
  ordenamiento por columnas.
- Nuevo componente `ProveedorAgregarProductosModal.tsx` (**modal grande**): búsqueda de texto
  sobre todos los productos activos, filtros por **Marca** y **Categoría** (no existe campo
  "tipo" en `producto`; los agrupadores reales son `marca_id`/`categoria_id`), toggle **"Mostrar
  ya asociados"**, lista con **checkbox por fila** e inputs inline **Costo/Código opcionales**
  por fila seleccionada. Los ya asociados aparecen deshabilitados y marcados **"ya cargado"**.
  Botón **"Agregar seleccionados (N)"**. `role="dialog"` + `aria-modal`, Escape-to-close, y las
  acciones de cierre quedan bloqueadas mientras se guarda (evita que Cancelar durante el guardado
  igual asocie).
- Nuevo handler **`proveedorProductosAsociarLoteHandler`** (canal `compras.pp:asociarLote`, bridge
  `compras.proveedor.productos.asociarLote`), bajo el mismo guard `proveedor.gestionar`. Aplica
  todas las altas en **una transacción**, reusando la semántica idempotente de `asociar` por
  ítem (revive soft-deleted, no toca `preferido`). Devuelve `{ asociados }`.

## C — "Importar datos" al tope de Configuración

**Problema.** El PO esperaba "Importar datos" en Configuración; ADR-080 lo había movido al grupo
**Sistema**.

**Solución.** En `AppShell.tsx`, el ítem `{ label:'Importar datos', to:'/importar', permiso:
'import.masiva' }` pasa a ser el **primer** ítem del grupo `configuracion` (arriba de
"Etiquetas") y se retira de `sistema`. Ruta y permiso intactos. (Revierte parcialmente la
ubicación que fijó ADR-080.)

## D — Lista de precios por cliente (gap real cerrado)

**Problema.** `cliente.lista_precio_id` existe en el esquema y **el motor de precios ya lo
consume** (`venta.ts` vía `resolverListaEfectiva`, y el POS), pero `ClienteForm` no tenía
selector **y** `clienteUpsertHandler` **ni leía ni escribía** el campo → la relación era inerte
en la práctica.

**Solución.**

- `clienteUpsertHandler`: valida `lista_precio_id` con `optId` y lo **persiste** en insert y
  update (`?? null`). `clienteGet` ya devolvía la fila completa.
- `ClienteForm.tsx`: selector **"Lista de precios"** (listas activas, opción "(Predeterminada)"
  = null). En edición, vacío envía `null` explícito para poder **desasignar**; en alta, vacío
  envía `undefined`.
- `ClienteDetalle.tsx`: fila **"Lista de precios"** en la card de datos, resolviendo el nombre
  (o "Predeterminada" si no tiene).

---

## Testing y verificación

TDD por tarea (RED→GREEN→commit) con revisión de spec + calidad por subagente en cada una.
Suite completa en verde tras el batch: **renderer 866** (0 fallos) · **main 1326**. Nuevos tests:
`asociarLote` (batch multi-ítem, idempotencia, mezcla nuevo+existente, vacío), agregar-proveedor
(visibilidad por permiso, auto-preferido), modal de alta masiva (lista+badge "ya cargado",
multi-select con costos distintos, filtro de marca, toggle asociados, empty-state),
`cliente.lista_precio_id` (persistencia insert/update-a-null), selector en el form y badge en el
detalle, y el orden de nav.

## Fuera de alcance

- Alta de la relación producto-proveedor para el Operador (requiere tocar permisos de
  `compras.pp:*`; decisión de producto).
- Edición masiva de costos/códigos ya existentes (el alta masiva es sólo para **altas**; la
  edición sigue fila por fila).
- Cambios al motor de precios / `resolverListaEfectiva` (ya funcionaba; sólo faltaba la UI de
  asignación).
