# ADR-084 — Alta masiva de productos en el proveedor: pantalla completa en vez de modal

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-10 · **Revisa:** ADR-083 §B ·
**Versión objetivo:** 1.0.x (sólo UI, sin migraciones ni handlers nuevos)

## Contexto

ADR-083 §B entregó el alta masiva de productos en el proveedor como un **modal**
(`ProveedorAgregarProductosModal`). En uso real el PO detectó dos problemas:

1. **Pérdida accidental de la carga.** Un click fuera del modal o la tecla Escape lo cerraban;
   si estabas cargando varios productos, se perdía toda la selección (costos/códigos incluidos).
2. **Espacio de trabajo reducido.** El modal (ancho acotado) desaprovecha la pantalla justo
   cuando la tarea —revisar y tildar muchos productos— pide el máximo de espacio.

## Decisión

Convertir el alta masiva en una **pantalla a ancho completo** que reemplaza in situ la lista del
tab Productos, en lugar de un overlay modal.

- Componente renombrado `ProveedorAgregarProductosModal` → **`ProveedorAgregarProductosPanel`**:
  se quita el chrome de modal (`modal-overlay`/`modal`/`role="dialog"`) y el
  `useEscapeToClose`. Encabezado con un botón **"← Volver"** (única salida además de confirmar).
  Barra de acción **sticky** al pie con "Agregar seleccionados (N)".
- `ProveedorProductosTab` hace **early-return** de la pantalla cuando `showAdd` está activo:
  la lista de asociados se reemplaza por la pantalla de carga y **"Volver"** la restaura. Como
  el tab activo del proveedor es estado local (no ruta), este swap in-place garantiza volver
  exactamente al tab Productos —una ruta aparte habría vuelto al tab "Datos"—.
- **Sin cierre por Escape ni por click afuera**: la carga sólo se abandona con la acción
  explícita "Volver", o se confirma con "Agregar seleccionados".
- **Estilo alineado al resto de la app** (corrección post-revisión visual): filtros + tabla +
  acción viven dentro de un `.panel` (fondo blanco, borde, radio y sombra) con la barra de
  filtros como `.toolbar` y la acción en `.table-footer` —antes la tabla quedaba sobre el fondo
  gris de la página, sin el look de tarjeta—. Las filas **ya asociadas** se distinguen con tinte
  ámbar suave + texto atenuado + chip `badge-warn` "ya cargado" (antes sólo `opacity`, que sobre
  el fondo gris no se distinguía).

La lógica de negocio no cambia: mismos filtros (Marca/Categoría), toggle "Mostrar ya asociados",
selección múltiple con Costo/Código inline, y el handler `proveedorProductosAsociarLoteHandler`
(ADR-083) intacto.

## Consecuencias

- Se elimina la clase de bug "perdí la carga por un click/Escape".
- Aprovecha todo el ancho del área de contenido.
- No hay ruta nueva ni breadcrumb que mantener; el precio es que la pantalla vive "dentro" del
  tab (no es deep-linkable), aceptable para un flujo de carga puntual.

## Testing

Renderer verde: la pantalla (lista + "ya cargado", multi-select con costos distintos, filtro de
marca, toggle asociados, empty-state, **Volver → onClose(false)**, ausencia de `.modal-overlay`)
y el swap del tab ("+ Agregar productos" reemplaza la lista y "Volver" la restaura). Sin cambios
en main.
