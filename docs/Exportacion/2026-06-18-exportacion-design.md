# Diseño: Módulo de Exportación CSV/XLSX

**Fecha:** 2026-06-18  
**Estado:** Aprobado  
**Release:** R1

---

## Contexto

Módulo de exportación genérico para el sistema de gestión de ferretería. Permite exportar datos de 7 entidades en formato CSV o XLSX desde las vistas de listado existentes. Opera offline-first: todo corre en el proceso main de Electron, sin dependencia de red.

---

## Decisiones clave (ADRs incorporados)

### ADR-EXP-01 — Motor genérico único + excepción a convención IPC

Un único handler `exportar:ejecutar` despacha por campo `entidad` (string). Excepción consciente a la convención de canales namespaced (`exportar.productos.csv`): se acepta porque el dispatch es sobre un descriptor declarativo, no un switch de lógica. Las queries devuelven filas crudas (centavos enteros, fechas ISO, booleanos); el formateo vive en el descriptor, no en la query. Preserva la regla "centavos hasta el borde".

### ADR-EXP-02 — Auto-detección de separador CSV en el importer (extensión de P1.9)

`csvToRows` de P1.9 hardcodeaba `,` como separador. El módulo de export emite `;` (convención es-AR). Se extiende el importer para auto-detectar `;` vs `,` sobre la línea de header. Todos los CSV del módulo (incluido el perfil `reimportable`) salen con `;`. Cambio acotado al parser, sin tocar la lógica de validación de filas. Se documenta en DECISIONES.md como extensión motivada por el export.

### ADR-EXP-03 — Punto de entrada: botón contextual por listado

El botón "Exportar" vive en la barra de acciones de cada listado. `alcance:'filtrado'` (funcionalidad central) requiere acceso a los filtros activos de la vista; un hub central `/exportar` los tendría que replicar. El botón es aditivo y uniforme, gateado por permiso. Cambio acotado a la barra de acciones de 7 vistas.

### ADR-EXP-04 — Perfil `reimportable` de Productos (CSV-only)

Cuarto perfil en el descriptor de Productos. Propósito: round-trip export→import sin edición manual. Headers = nombres de campo del import de P1.9 (excepción a la convención de labels en español). Decimales con punto `.`, `activo` como `true`/`false`. Disponible solo en CSV, gateado a `export.supervisor`.

---

## Permisos

Dos nuevos permisos en seed:

| Código | Módulo | Otorgado a |
|---|---|---|
| `export.basico` | `export` | OPERADOR + SUPERVISOR |
| `export.supervisor` | `export` | SUPERVISOR only |

Mapeo desde descriptores:
- `rolesPermitidos` incluye `'deposito'` → permiso `export.basico`
- `rolesPermitidos` solo `'supervisor'` → permiso `export.supervisor`

El gate se aplica en **dos niveles**: entidad (¿ve la entidad?) y perfil (¿ve este perfil?).

---

## Estructura de archivos

### Nuevos en `@ferreteria/shared`

```
packages/shared/src/export/
├── types.ts              ← interfaces: ColumnaExport, PerfilExport, DefinicionExport, ExportRequest
├── helpers.ts            ← ars(), fecha(), estadoStock() (funciones puras)
├── descriptores/
│   ├── productos.ts      ← exportProductos (4 perfiles: control-stock, lista-precios, completo, reimportable)
│   ├── stock.ts          ← exportStock (2 perfiles: existencias, valorizado)
│   ├── ubicaciones.ts    ← exportUbicaciones (1 perfil: completo)
│   ├── proveedores.ts    ← exportProveedores (1 perfil: completo)
│   ├── clientes.ts       ← exportClientes (1 perfil: completo)
│   ├── ventas.ts         ← exportVentas (2 perfiles: resumen, detallado)
│   └── caja.ts           ← exportCaja (1 perfil: arqueos)
└── index.ts
```

### Nuevos en `packages/client`

```
packages/client/src/main/ipc/
└── exportar.ts           ← exportarEjecutarHandler, fetchFilas, DEFINICIONES map

packages/client/src/main/export/
├── csv-writer.ts         ← writeCsv() con fs.createWriteStream, BOM, separador ';', quoting
└── xlsx-writer.ts        ← writeXlsx() con exceljs streaming WorkbookWriter

packages/client/src/renderer/components/export/
├── ExportarButton.tsx    ← botón con gate de permiso de entidad
└── ExportarModal.tsx     ← selector perfil + formato + alcance
```

---

## Tipos (`shared/export/types.ts`)

```typescript
type ExportPermiso = 'export.basico' | 'export.supervisor';
type ExportFormato = 'csv' | 'xlsx';

interface ColumnaExport<T> {
  campo: string;
  label: string;
  formato?: (v: any, fila: T) => string | number;
}

interface PerfilExport<T> {
  id: string;
  label: string;
  columnas: ColumnaExport<T>[];
  permiso: ExportPermiso;
  soloFormatos?: ExportFormato[];   // undefined = ambos; ['csv'] = solo CSV
}

interface DefinicionExport<T> {
  entidad: string;
  label: string;
  permiso: ExportPermiso;
  perfiles: PerfilExport<T>[];
}

interface ExportRequest {
  entidad: string;
  perfilId: string;
  formato: ExportFormato;
  alcance: 'filtrado' | 'todo';
  filtros?: Record<string, unknown>;
}
```

---

## Descriptores

### Productos (4 perfiles)

| Perfil | id | Permiso | Formatos | Columnas |
|---|---|---|---|---|
| Control de stock | `control-stock` | `export.basico` | CSV + XLSX | sku, descripción, rubro, stock, ubicación, estado |
| Lista de precios | `lista-precios` | `export.supervisor` | CSV + XLSX | sku, descripción, precio venta, precio costo, margen% |
| Completo | `completo` | `export.supervisor` | CSV + XLSX | sku, cód.barras, descripción, rubro, stock, ubicación, precio venta, precio costo, activo |
| Para reimportar | `reimportable` | `export.supervisor` | **Solo CSV** | sku, nombre, unidad_medida, precio_venta, iva_alicuota, rubro, codigo_barras, costo, stock_minimo, activo |

**Regla del perfil `reimportable`:** headers = nombres de campo del import P1.9. Decimales con punto `.`. Excepción explícita a la convención de labels en español.

### Stock (2 perfiles)

| Perfil | id | Permiso | Columnas |
|---|---|---|---|
| Existencias | `existencias` | `export.basico` | sku, descripción, ubicación, stock actual, umbral, estado |
| Valorizado | `valorizado` | `export.supervisor` | sku, descripción, stock actual, costo unit., valor total |

### Otras entidades

| Entidad | Perfiles | Permiso entidad |
|---|---|---|
| Ubicaciones | `completo`: código, descripción, QR, cant. productos | `export.basico` |
| Proveedores | `completo`: razón social, CUIT, cond. IVA, teléfono, email, activo | `export.supervisor` |
| Clientes | `completo`: razón social, CUIT/DNI, cond. IVA, teléfono, email, saldo cta. cte. | `export.supervisor` |
| Ventas | `resumen`: comprobante, fecha, cliente, cajero, medio pago, total, estado | `export.supervisor` |
| Ventas | `detallado`: comprobante, fecha, SKU, descripción, cantidad, precio unit., subtotal | `export.supervisor` |
| Caja | `arqueos`: turno, cajero, apertura, cierre, monto inicial, esperado, contado, diferencia | `export.supervisor` |

---

## Motor de export (`ipc/exportar.ts`)

```
ExportRequest
  → verificar permiso entidad + permiso perfil
  → dialog.showSaveDialog (proceso main)
  → fetchFilas(db, request)  ← dispatch por entidad a queries puras
  → writeCsv() o writeXlsx()
```

El handler IPC es `exportar:ejecutar`. Retorna `void`; el diálogo "guardar como" lo maneja el proceso main. Si el usuario cancela el diálogo, retorna sin error.

---

## Queries puras

Se extraen de los handlers de lista paginada existentes. Devuelven **filas crudas** (sin formateo). El handler paginado sigue usando `COUNT(*) + LIMIT/OFFSET` para eficiencia; la función `*QueryAll` se usa exclusivamente en el path de export.

| Función nueva | Archivo | Handler existente que coexiste |
|---|---|---|
| `productoQueryAll(db, filtros)` | `ipc/producto.ts` | `productoListHandler` |
| `stockQueryAll(db, filtros)` | `ipc/stock.ts` | `reabastecimientoListHandler` |
| `ubicacionQueryAll(db, filtros)` | `ipc/ubicacion.ts` | `ubicacionListHandler` |
| `proveedorQueryAll(db)` | `ipc/proveedor.ts` | `proveedorListHandler` |
| `clienteQueryAll(db)` | `ipc/cliente.ts` | `clienteListHandler` |
| `ventaQueryAll(db, filtros)` | `ipc/venta.ts` | `ventaListHandler` |
| `ventaDetalladoQueryAll(db, filtros)` | `ipc/venta.ts` | — (nueva: join `venta` + `venta_detalle`; devuelve **una fila por línea**, repitiendo campos de cabecera de la venta en cada fila) |
| `cajaArqueosQueryAll(db, filtros)` | `ipc/caja.ts` | `cajaListHandler` (query contra tabla `caja`, **no** `movimiento_caja`; join `usuario` para campo `cajero`) |

---

## Writers

### CSV (`main/export/csv-writer.ts`)

- `fs.createWriteStream` — row a row, sin acumular en memoria
- BOM UTF-8 (`﻿`) al inicio
- Separador `;`
- Quoting: valores que contengan `;`, `"` o salto de línea van entre comillas dobles; comillas internas se duplican (`""`)
- Función `writeCsv(filePath, columnas, filas): Promise<void>`

### XLSX (`main/export/xlsx-writer.ts`)

- `exceljs` (nueva dependencia en `packages/client`)
- `ExcelJS.stream.xlsx.WorkbookWriter` — streaming, no carga todo en RAM
- Valores `number` → celda numérica (permite que Excel sume/filtre)
- Fila de encabezado en negrita
- Función `writeXlsx(filePath, columnas, sheetName, filas): Promise<void>`

---

## UI

### `ExportarButton.tsx`

- Recibe `definicion: DefinicionExport<any>` y `filtrosActivos?: Record<string, unknown>`
- Si `!permisos.has(definicion.permiso)` → no renderiza nada
- Al hacer clic abre `ExportarModal`

### `ExportarModal.tsx`

- Muestra solo los perfiles cuyo `permiso` el usuario tiene
- Si perfil tiene `soloFormatos: ['csv']` → opción XLSX deshabilitada
- Campos: perfil (select), formato (radio CSV/XLSX), alcance (radio todo/filtrado)
- Al confirmar: llama `window.api.exportarEjecutar(...)`, muestra spinner, toast de error si falla
- El diálogo "guardar como" lo maneja el proceso main — el renderer no necesita manejar la ruta

### Integración en vistas existentes

`<ExportarButton definicion={exportXxx} filtrosActivos={filtrosActivos} />` se agrega en la barra de acciones de:

1. `CatalogoProductos.tsx` → `exportProductos`
2. `StockView.tsx` → `exportStock`
3. `UbicacionesView.tsx` → `exportUbicaciones`
4. `ProveedoresView.tsx` → `exportProveedores`
5. `ClientesView.tsx` → `exportClientes`
6. `VentasView.tsx` → `exportVentas`
7. `CajaView.tsx` → `exportCaja`

---

## Cambios a archivos existentes

| Archivo | Cambio |
|---|---|
| `packages/client/src/main/auth/seed.ts` | Agregar `export.basico` y `export.supervisor` al seed |
| `packages/client/src/main/ipc/importar.ts` | Extender `csvToRows` con auto-detect separador `;`/`,` sobre línea de header |
| `packages/client/src/main/index.ts` | Registrar `exportar:ejecutar` handler |
| `packages/client/src/main/ipc/producto.ts` | Extraer `productoQueryAll` |
| `packages/client/src/main/ipc/stock.ts` | Extraer `stockQueryAll` |
| `packages/client/src/main/ipc/ubicacion.ts` | Extraer `ubicacionQueryAll` |
| `packages/client/src/main/ipc/proveedor.ts` | Extraer `proveedorQueryAll` |
| `packages/client/src/main/ipc/cliente.ts` | Extraer `clienteQueryAll` |
| `packages/client/src/main/ipc/venta.ts` | Extraer `ventaQueryAll` + nueva `ventaDetalladoQueryAll` |
| `packages/client/src/main/ipc/caja.ts` | Extraer `cajaArqueosQueryAll` |
| `DECISIONES.md` | Documentar ADR-EXP-01, ADR-EXP-02, ADR-EXP-03, ADR-EXP-04 |

---

## Fuera de alcance (diferido)

- Selección libre de columnas
- Exports programados
- PDF
- Export de MovimientosStock (esperar R3/Compras)
- `alcance: 'filtrado'` puede implementarse después sin reconstruir nada (mismo botón, mismo modal)

---

## Nueva dependencia

`exceljs` en `packages/client` — para escritura XLSX con streaming API.
