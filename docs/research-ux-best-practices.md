# Research — Buenas prácticas de UX (referencia para las mejoras)

> Material de **referencia**, no de instrucción. Consolida las mejores prácticas de la industria
> que respaldan la auditoría de mejoras (carga de productos/precios, manejo de errores, búsqueda,
> navegación, personalización). Sirve para que cualquier sesión que ejecute las fases tenga el
> "por qué" y las fuentes a mano, sin re-investigar.
>
> - Prompts de ejecución por fase: [prompts-fases-mejoras-ux.md](prompts-fases-mejoras-ux.md)
> - Informe priorizado (artefacto): https://claude.ai/code/artifact/ae84631e-3ccc-4f7e-aa00-ed231c83b119
>
> Fecha de research: 2026-09. Las fuentes se resumen; ante duda, ir al original.

---

## 1. Mensajes de error y validación de formularios

Aplica a: **ERR-1, ERR-2, PROD-1**.

- **Nunca fallar en silencio.** Todo error debe ser visible y explicar *qué pasó* y *cómo
  seguir*. Los "patrones hostiles" (mensajes vagos, técnicos, que culpan al usuario o piden
  disculpas sin ayudar) aumentan la ansiedad y las consultas.
- **El mensaje va junto al campo** que lo causó: reduce la carga de memoria de trabajo (el usuario
  ve el error mientras corrige, sin tener que recordarlo).
- **Validación inline al salir del campo (onBlur)**, no en cada tecla. Referencias citan que la
  validación inline reduce ~22% los errores y acelera ~42% el llenado; el feedback debe aparecer
  dentro de ~500ms de que la persona dejó de tipear.
- **Al fallar el submit, mover el foco automáticamente al primer campo inválido** — el usuario no
  tiene que buscar dónde está el problema.
- **Microcopy accionable y humano**: "Ingresá un precio mayor a 0", no "Requerido"; "Ya existe un
  producto con ese código de barras", no "UNIQUE constraint failed".
- **Combinar color + ícono** en los estados de error (accesibilidad: no depender solo del color).

Fuentes:
- NN/g — [10 Design Guidelines for Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- NN/g — [Hostile Patterns in Error Messages](https://www.nngroup.com/articles/hostile-error-messages/)
- Yukon Digital Service Delivery Guide — [How to help people recover from a form error](https://guide.yukon.ca/en/content-and-design/forms/user-experience-ux-standards-forms/how-help-people-recover-form-error)

---

## 2. Importación masiva / carga de datos por archivo (CSV/XLSX)

Aplica a: **PRICE-1, PRICE-2, PRICE-3, PRICE-4**.

- **Flujo lineal explícito: archivo → mapear columnas → validar → aplicar.** Reduce sorpresas y da
  control antes de que el dato entre al sistema. (El wizard de *Importar costos* de la app ya
  sigue este patrón — es el estándar interno a replicar.)
- **Mapeo de columnas con auto-sugerencia**: permitir emparejar encabezados del archivo a los
  campos canónicos (tolerando variantes como "cod", "código", "cod_prov") antes de validar.
- **Doble validación**: al parsear (cliente) y otra vez en el servidor; rechazar o normalizar
  filas inválidas.
- **Importación parcial**: persistir de una las filas válidas y poner en cuarentena las inválidas,
  en vez de un "Import Failed" opaco que tira todo. Mejora el time-to-value y baja el soporte.
- **Reporte de errores descargable + corrección inline**: que el usuario vea exactamente qué
  corregir y pueda hacerlo sin rehacer el archivo entero.
- **Plantilla de ejemplo y expectativas por adelantado** (formatos, tamaños, columnas
  obligatorias). La app ya ofrece plantilla `.csv` en costos; extender al resto.

Fuentes:
- Smart Interface Design Patterns — [How To Design Bulk Import UX](https://smart-interface-design-patterns.com/articles/bulk-ux/)
- CSVBox — [Best UX flow for spreadsheet imports](https://blog.csvbox.io/spreadsheet-import-ux/)
- CSVBox — [Support partial imports with valid rows only](https://blog.csvbox.io/partial-import-valid-rows/)
- CSVBox — [Validate CSV data before saving to DB](https://blog.csvbox.io/validate-csv-before-db/)

---

## 3. Búsqueda global / paleta de comandos (Ctrl+K)

Aplica a: **SRCH-1** (y de fondo, SRCH-2/3).

- **Estándar de apps de poder-usuario** (Linear, Vercel, GitHub, Slack, Raycast): `Cmd/Ctrl+K`
  abre un modal para buscar y saltar a funciones, páginas, registros o ejecutar acciones sin
  recorrer el menú.
- Especialmente valioso en **apps complejas o de uso poco frecuente**: reduce la navegación manual
  y la memorización.
- **Organizar por categorías** ("Navegación", "Acciones", "Configuración"), con **fuzzy match**
  sobre las etiquetas, **sección de recientes** arriba, y **navegación por flechas**.
- Piezas técnicas: hook de atajo de teclado, lista de comandos con fuzzy match, selección con
  flechas + foco atrapado (accesibilidad), y overlay renderizado en portal.

Fuentes:
- Mobbin — [Command Palette UI Design: best practices & variants](https://mobbin.com/glossary/command-palette)
- Chameleon — [CMD+K search patterns](https://www.chameleon.io/patterns/cmd-k-search)

---

## 4. POS / gestión de inventario (patrones de líderes del rubro)

Aplica a: **PROD-2, PROD-3** (y transversal a carga/stock).

- **Square** es el referente de simplicidad y facilidad de uso para comercios chicos/medianos.
- **Lightspeed Retail** es más fuerte para retail con inventario pesado: control de stock,
  órdenes de compra, gestión de proveedores y reportería — pertinente porque una ferretería es
  inventory-heavy.
- **Alta de ítem completa**: precio, costo y stock inicial se capturan en una sola ficha; el stock
  queda sincronizado con la venta desde ese momento (no hay un "posteo de inventario" aparte).
- **Flujos amigables con lector de código de barras** para recepción y alineación de inventario
  (la app ya discrimina EAN vs SKU por patrón).
- **El stock se decrementa automáticamente con la venta** — la exactitud sale del checkout, no de
  un proceso manual separado. (La app ya lo hace vía `MovimientoStock`.)

Fuentes:
- Shopify — [6 Best Small Business POS Systems, Reviewed (2026)](https://www.shopify.com/blog/pos-systems-small-business)
- TechnologyAdvice — [Square vs Shopify: POS comparison 2026](https://technologyadvice.com/blog/sales/square-vs-shopify/)

---

## 5. Cómo se mapea al backlog

| Tema de research | Ítems de la auditoría |
|---|---|
| Errores y validación de formularios | ERR-1, ERR-2, PROD-1 |
| Importación de datos por archivo | PRICE-1, PRICE-2, PRICE-3, PRICE-4 |
| Búsqueda global / Ctrl+K | SRCH-1, SRCH-2, SRCH-3 |
| Patrones POS / inventario | PROD-2, PROD-3 |
| Navegación / linking / personalización | NAV-1, NAV-2, NAV-3, PERF-1, PERF-2 |
| Endurecimiento de seguridad (Electron) | SEC-1, SEC-2, SEC-3, SEC-4, SEC-5 |

> Nota: las mejoras de navegación, personalización y seguridad se sustentan en convenciones ya
> presentes en el proyecto (RBAC por permiso, `usuario_preferencias`, invariantes de Electron) más
> que en fuentes externas; ver el informe para el detalle y la evidencia en código.
