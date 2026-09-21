# ADR-039 Reportes — Diseño: Detalle de Ventas

**Fecha:** 2026-07-15  
**Estado:** Aprobado  
**Scope:** Nueva sección "Reportes" en sidebar + pantalla Detalle de Ventas con filtros, paginación server-side y exportación CSV/XLSX.

---

## Contexto

El Dashboard (ADR-037/038) cubre métricas ejecutivas con gráficos y KPIs por período. Los Reportes son una sección separada, operativa, orientada a consultas analíticas sobre datos crudos. ADR-039 implementa la primera vista: **Reporte de Ventas — Detalle**, sin dependencia de facturación fiscal (R2).

---

## Decisiones de diseño (resultantes del brainstorming)

| Decisión | Opción elegida | Alternativas descartadas |
|----------|---------------|--------------------------|
| Granularidad de fila | 1 fila por venta (cabecera) | 1 fila por venta_detalle |
| Layout de filtros | Barra horizontal sobre la tabla | Panel lateral persistente |
| Detalle de productos | Reutilizar `VentaDetalleModal` existente | Acordeón inline, panel lateral nuevo |
| Export | CSV + XLSX vía `ExportarModal` existente (XLSX default) | Botón de descarga directa CSV |
| Ítems deshabilitados sidebar | Visibles con tooltip "Próximamente" | Ocultos |
| Filtro por producto | Text input (búsqueda LIKE server-side) | Select con todos los productos |

---

## 1. Sidebar — `AppShell.tsx`

El grupo `reportes` existente se amplía con cuatro ítems adicionales bajo "Dashboard":

```
Reportes  [permiso: dashboard.ver]
  ├─ Dashboard          → /dashboard        [NavLink, habilitado]
  ├─ Ventas             → /reportes/ventas  [NavLink, habilitado]
  ├─ Productos          → (disabled, title="Próximamente")
  ├─ Proveedores        → (disabled, title="Próximamente")
  └─ Clientes           → (disabled, title="Próximamente")
```

Los ítems deshabilitados se renderizan como `<span>` con las mismas clases CSS que `nav-item nav-item-child` pero con `opacity: 0.45` y `cursor: default`. No son clickeables. El grupo entero requiere `permiso: 'dashboard.ver'` (Supervisor).

Crumbs a agregar en el mapa `CRUMBS`:
- `/reportes/ventas` → `'Reporte de Ventas'`

---

## 2. Ruta

En `src/renderer/routes/index.tsx`:

```ts
{ path: 'reportes/ventas', element: <ReporteVentasView /> }
```

Protegida implícitamente por `ProtectedRoute` (wrapper raíz). El componente hace su propio guard interno (`can('dashboard.ver')`).

---

## 3. Vista — `ReporteVentasView`

### Archivo
`src/renderer/views/reportes/ReporteVentasView.tsx`

### Estados de la pantalla

1. **Vacío inicial:** prompt "Seleccioná filtros y presioná Buscar" con los filtros disponibles en la toolbar.
2. **Cargando:** spinner/skeleton sobre la tabla mientras llega la respuesta IPC.
3. **Con resultados:** barra de resumen + tabla paginada.
4. **Sin resultados:** mensaje "Sin ventas para los filtros seleccionados".

### Filtros (toolbar horizontal, encima de la tabla)

| Campo | Tipo UI | Fuente de datos |
|-------|---------|-----------------|
| Fecha desde | `<input type="date">` | libre |
| Fecha hasta | `<input type="date">` | libre |
| Cliente | `<select>` | IPC existente: lista de clientes activos |
| Categoría | `<select>` | IPC existente: `catalogo.categoria.list` |
| Producto | `<input type="text">` | búsqueda LIKE server-side (SKU o nombre) |
| Vendedor | `<select>` | IPC existente: lista de usuarios |
| Medio de pago | `<select>` | valores fijos del enum `venta_pago.medio_pago` |

- Todos los selects tienen opción vacía "Todos / Todas" que omite ese filtro.
- Botón **Buscar** ejecuta la búsqueda (página 1).
- Link **Limpiar** resetea todos los filtros y vuelve al estado vacío inicial.
- Los filtros no disparan búsqueda automática al cambiar (requieren click en Buscar).

### Barra de resumen

```
N ventas encontradas · Total: $X.XXX.XXX         [Exportar ▾]
```

El total es la suma de `venta.total` de todas las páginas (no solo la visible). El botón Exportar abre `ExportarModal`.

### Tabla

Columnas (en orden):

| Columna | Fuente | Notas |
|---------|--------|-------|
| Nro. venta | `venta.numero_interno` | Link clickeable → `VentaDetalleModal` |
| Fecha | `venta.fecha` | Formato `dd/mm/yyyy HH:MM` |
| Cliente | `cliente.razon_social` | |
| Vendedor | `usuario.nombre_completo` | |
| Medios de pago | GROUP_CONCAT de `venta_pago.medio_pago` | ej. "Efectivo / Tarjeta" |
| Subtotal | `venta.subtotal` | formateado como $X.XXX |
| IVA | `venta.importe_iva` | formateado como $X.XXX |
| Total | `venta.total` | formateado como $X.XXX, negrita |

- Solo ventas con `estado = 'confirmada'`.
- Ordenadas por `venta.fecha DESC`, luego `venta.numero_interno DESC`.
- Click en Nro. venta → abre `VentaDetalleModal` (en `src/renderer/views/caja/VentaDetalleModal.tsx`).

### Paginación

Server-side, 100 filas por página.  
Controles: `← Anterior` · `Página N de M` · `Siguiente →`  
Los controles se muestran solo cuando `totalPages > 1`.

---

## 4. IPC Handler — `src/main/ipc/reportes.ts`

### Tipos

```ts
export interface ReporteVentasFiltros {
  fechaDesde?: Date;
  fechaHasta?: Date;
  clienteId?: string;
  categoriaId?: string;
  productoTexto?: string;  // búsqueda LIKE en sku + nombre_corto + venta_detalle.descripcion
  usuarioId?: string;
  medioPago?: 'efectivo' | 'tarjeta' | 'cuenta_corriente' | 'transferencia' | 'cheque';
}

export interface ReporteVentasRow {
  id: string;
  numero_interno: string;
  fecha: Date;
  cliente_razon_social: string;
  vendedor_nombre: string;
  medios_pago: string;       // "Efectivo / Tarjeta"
  subtotal: number;
  importe_iva: number;
  total: number;
}

export interface ReporteVentasResult {
  rows: ReporteVentasRow[];
  total: number;       // cantidad de ventas (todas las páginas)
  totalImporte: number; // suma de venta.total (todas las páginas)
  page: number;
  totalPages: number;
}
```

### Canales IPC

```
reportes:detalleVentas(filtros, page, pageSize) → ReporteVentasResult
reportes:detalleVentasExport(filtros, perfil)   → ReporteVentasRow[] | VentaDetalleExportRow[]
```

### Estrategia de query

**Query principal (paginada):**
```sql
SELECT
  v.id, v.numero_interno, v.fecha,
  c.razon_social AS cliente_razon_social,
  u.nombre_completo AS vendedor_nombre,
  GROUP_CONCAT(DISTINCT vp.medio_pago, ' / ') AS medios_pago,
  v.subtotal, v.importe_iva, v.total
FROM venta v
JOIN cliente c ON c.id = v.cliente_id
JOIN usuario u ON u.id = v.usuario_id
LEFT JOIN venta_pago vp ON vp.venta_id = v.id
WHERE v.estado = 'confirmada'
  [-- filtros dinámicos --]
GROUP BY v.id
ORDER BY v.fecha DESC, v.numero_interno DESC
LIMIT :pageSize OFFSET :offset
```

**Filtro por producto/categoría** — usa EXISTS subquery para no multiplicar filas:
```sql
AND EXISTS (
  SELECT 1 FROM venta_detalle vd
  JOIN producto p ON p.id = vd.producto_id
  [JOIN categoria cat ON cat.id = p.categoria_id]  -- si filtra categoría
  WHERE vd.venta_id = v.id
    [AND p.categoria_id = :categoriaId]
    [AND (p.sku LIKE :texto OR p.nombre_corto LIKE :texto OR vd.descripcion LIKE :texto)]
)
```

**Query de conteo y total importe** (mismos filtros, sin LIMIT/OFFSET):
```sql
SELECT COUNT(*) AS total, SUM(v.total) AS totalImporte FROM (... subquery sin LIMIT ...)
```

### Registro

En `src/main/index.ts`: `registerReportesHandlers(ipcMain, db)`  
En `src/preload/index.ts`: namespace `reportes` bajo `window.ferreteria.reportes.*`

---

## 5. Export — `packages/shared/src/`

Nueva `DefinicionExport` para la entidad `reporte_ventas`:

### Perfil 1: Cabecera de ventas
- **Grano:** 1 fila por venta
- **Columnas:** Nro., Fecha, Cliente, Vendedor, Medios de pago, Subtotal, IVA, Total
- **Formatos:** CSV + XLSX — **XLSX por defecto**
- **Permiso:** `export.supervisor`

### Perfil 2: Detalle de líneas
- **Grano:** 1 fila por `venta_detalle`
- **Columnas:** Nro. venta, Fecha, Cliente, Vendedor, SKU, Descripción (snapshot), Categoría, Cantidad, Precio unitario, Descuento línea %, Alícuota IVA, Subtotal línea, Total venta
- **Formatos:** CSV + XLSX — **XLSX por defecto**
- **Permiso:** `export.supervisor`
- **Nota:** ideal para pivot tables; el Nro. venta y datos de cabecera se repiten en cada línea

El handler `reportes:detalleVentasExport(filtros, perfil)` retorna los datos según el perfil. El export no está paginado: devuelve todas las filas que cumplan los filtros.

### XLSX por defecto — extensión requerida

`ExportarModal` inicializa siempre con `useState<ExportFormato>('csv')`. Para soportar XLSX como default por perfil se requiere:

1. Agregar `defaultFormato?: ExportFormato` a `PerfilExport` en `packages/shared/src/export/types.ts`
2. En `ExportarModal.tsx`: inicializar `formato` con `perfilesVisibles[0]?.defaultFormato ?? 'csv'` y actualizar al cambiar de perfil

Esta extensión es retrocompatible: perfiles sin `defaultFormato` siguen usando CSV.

---

## 6. Tests

### Renderer — `src/renderer/views/reportes/__tests__/ReporteVentasView.test.tsx`

- Renderiza estado vacío inicial sin lanzar búsqueda
- Al hacer click en Buscar con fechas → llama al IPC y muestra resultados
- Paginación: Siguiente/Anterior llaman al IPC con page correcto
- Click en Nro. de venta → abre VentaDetalleModal
- Sin resultados → muestra mensaje vacío
- Guard: sin permiso `dashboard.ver` → muestra mensaje de acceso denegado
- Limpiar → resetea filtros y vuelve al estado vacío

### Main — `src/main/ipc/__tests__/reportes.handlers.test.ts`

- Devuelve solo ventas `confirmadas`
- Filtro por fecha desde/hasta
- Filtro por cliente
- Filtro por categoría (EXISTS subquery)
- Filtro por texto de producto (LIKE)
- Filtro por vendedor
- Filtro por medio de pago
- Combinación de múltiples filtros
- Paginación: page 1 vs page 2, totalPages correcto
- Export perfil cabecera: columnas correctas, todas las páginas
- Export perfil detalle: una fila por venta_detalle

---

## 7. Gates (no cruzar sin avisar)

- No migración de schema — toda la información está en tablas existentes
- No tocar `comprobante_fiscal` ni lógica AFIP/ARCA
- No modificar pantallas ni módulos fuera de `reportes/`

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/renderer/views/shell/AppShell.tsx` | Modificar: ampliar grupo `reportes` con 4 nuevos ítems |
| `src/renderer/routes/index.tsx` | Modificar: agregar ruta `/reportes/ventas` |
| `src/renderer/views/reportes/ReporteVentasView.tsx` | Crear |
| `src/renderer/views/reportes/__tests__/ReporteVentasView.test.tsx` | Crear |
| `src/main/ipc/reportes.ts` | Crear |
| `src/main/ipc/__tests__/reportes.handlers.test.ts` | Crear |
| `src/main/index.ts` | Modificar: registrar `registerReportesHandlers` |
| `src/preload/index.ts` | Modificar: agregar namespace `reportes` |
| `packages/shared/src/export/types.ts` | Modificar: agregar `defaultFormato?` a `PerfilExport` |
| `src/renderer/components/export/ExportarModal.tsx` | Modificar: leer `defaultFormato` del perfil activo |
| `packages/shared/src/export/descriptores/reporte-ventas.ts` | Crear: `DefinicionExport` entidad `reporte_ventas` |
| `packages/shared/src/export/index.ts` | Modificar: exportar el nuevo descriptor |
| `Estado.md` | Actualizar al completar |
