# Spec: Iteración 03 — Formularios Proveedores/Clientes y POS Cliente

**Fecha:** 2026-06-29  
**Estado:** Aprobado

---

## Contexto

Correcciones y mejoras a los formularios de Proveedores, Clientes y la vista de Punto de Venta.  
No hay cambios de modelo conceptual; los nuevos campos son extensiones naturales del domicilio y contacto ya modelados en CLAUDE.md.

---

## Sección 1: Base de datos — Migración 0009

Archivo: `packages/client/src/main/db/migrations/0009_personas_v2.sql`

### Columnas nuevas en `cliente` y `proveedor`

| Columna | Tipo SQLite | Nullable |
|---|---|---|
| `calle` | TEXT | sí |
| `numero` | TEXT | sí |
| `aclaracion` | TEXT | sí |
| `telefono_adicional` | TEXT | sí |

```sql
ALTER TABLE cliente ADD COLUMN calle TEXT;
ALTER TABLE cliente ADD COLUMN numero TEXT;
ALTER TABLE cliente ADD COLUMN aclaracion TEXT;
ALTER TABLE cliente ADD COLUMN telefono_adicional TEXT;

ALTER TABLE proveedor ADD COLUMN calle TEXT;
ALTER TABLE proveedor ADD COLUMN numero TEXT;
ALTER TABLE proveedor ADD COLUMN aclaracion TEXT;
ALTER TABLE proveedor ADD COLUMN telefono_adicional TEXT;
```

El campo `domicilio` existente **no se elimina** (datos históricos). En los formularios nuevos se usa `calle + numero + aclaracion`; `domicilio` se guarda como `null` en registros nuevos.

### Schema Drizzle (`personas.ts`)

Agregar las 4 columnas con `text()` nullable en ambas tablas.

### Payloads IPC

`ClienteUpsertPayload` y `ProveedorUpsertPayload` reciben los 4 campos opcionales. Los handlers los escriben con `?? null`.

### Journal

Agregar entrada `0009_personas_v2` en `meta/_journal.json` con `idx: 9`.

---

## Sección 2: Utilidades de validación/formato

Archivo nuevo: `packages/client/src/renderer/utils/documento.ts`

### `formatDocumento(tipo, rawValue): string`

- Extrae solo dígitos del input.
- **CUIT / CUIL** (11 dígitos máx):
  - 0–2 dígitos → sin guiones
  - 3–10 dígitos → `XX-XXXXXXXX`
  - 11 dígitos → `XX-XXXXXXXX-X`
- **DNI** (8 dígitos máx): devuelve solo dígitos, sin formato adicional.

### `validarDocumento(tipo, valor): string | null`

- Devuelve mensaje de error o `null` si es válido.
- **CUIT/CUIL:** debe tener exactamente 11 dígitos (ignorando guiones).
- **DNI:** debe tener entre 7 y 8 dígitos.

### `validarTelefono(valor): string | null`

- Acepta: dígitos, espacios, `+`, `-`, `(`, `)`.
- Rechaza letras → devuelve `"El teléfono solo puede contener números"`.
- Vacío → `null` (campo opcional).

### `validarCodigoPostal(valor): string | null`

- Alfanumérico, máx 8 caracteres.
- Vacío → `null` (campo opcional).

---

## Sección 3: `DireccionGeo` — fix dropdown tapado

**Problema:** `.card` tiene `overflow: hidden` en CSS global. El dropdown de Localidad (posición absoluta) queda recortado.

**Solución:** `ReactDOM.createPortal()` en `document.body`.

### Cambios en `DireccionGeo.tsx`

1. Agregar `dropdownPos: { top, left, width } | null` en estado local.
2. Al abrir el dropdown (`onFocus` / `onChange`): calcular `inputRef.current.getBoundingClientRect()` y setear `dropdownPos`.
3. Renderizar el `<ul>` via `createPortal(ulElement, document.body)` con `position: fixed`, usando los valores de `dropdownPos`.
4. El handler `onClickOutside` y la lógica de filtrado no cambian.

---

## Sección 4: Formulario Proveedor

Archivo: `packages/client/src/renderer/views/compras/proveedores/ProveedorForm.tsx`

### Cambios en `FormState`

```typescript
type FormState = {
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;       // formateado con guiones para CUIT/CUIL
  razon_social: string;
  nombre_fantasia: string;
  condicion_fiscal: 'RI' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  calle: string;
  numero: string;
  aclaracion: string;
  direccion: DireccionGeoValue;
  telefono: string;
  telefono_adicional: string;
  email: string;
  persona_contacto: string;
  observaciones: string;
};
```

El campo `domicilio` desaparece del estado (no se envía al backend en registros nuevos).

### Cambios de layout

**Tarjeta "Identificación fiscal":**
- `Condición Fiscal`: `<label style={{ maxWidth: 220 }}>` para que el select no se extienda innecesariamente.
- `Número de documento`: al cambiar el valor, pasar por `formatDocumento(tipo, valor)` antes de setearlo. `onChange` del `select` de tipo_documento también reformatea el número existente.

**Tarjeta "Contacto":**
```
[ Teléfono ] [ Teléfono adicional ]
[ Email    ] [ Persona de contacto ]
```

**Tarjeta "Domicilio"** (reemplaza el campo libre + DireccionGeo):
```
[ Calle (flex:2) ] [ Número ] [ Aclaración ]
[    DireccionGeo (Provincia / Localidad / CP)    ]
```
- `Número`: `type="text"` con `onChange` que filtra solo dígitos (no se permiten letras).
- `Calle`: texto libre, min 2 chars si se completa.

**Tarjeta "Observaciones":**
- `<textarea style={{ width: '100%', resize: 'vertical' }}>`.

### Validaciones en `validate()`

Agregar:
- `validarDocumento(form.tipo_documento, form.numero_documento)` → error si no es válido
- `validarTelefono(form.telefono)` → error si tiene letras
- `validarTelefono(form.telefono_adicional)` → igual
- `validarCodigoPostal(form.direccion.codigo_postal)` → error si supera 8 chars

### Payload al IPC

Agregar `calle`, `numero`, `aclaracion`, `telefono_adicional` al objeto enviado. No enviar `domicilio` (queda null para registros nuevos).

### Carga al editar (`useEffect`)

Mapear los nuevos campos desde el proveedor existente (`p.calle ?? ''`, etc.).

---

## Sección 5: Formulario Cliente

Archivo: `packages/client/src/renderer/views/clientes/ClienteForm.tsx`

Idéntico al Proveedor en cuanto a campos de domicilio y contacto:

### Cambios en `FormState`

Agregar: `calle`, `numero`, `aclaracion`, `telefono_adicional`. Eliminar `domicilio`.

### Cambios de layout

**Tarjeta "Identificación":**
- `Tipo de documento` ya existe; verificar que esté visible en la primera fila.
- `Número de documento`: misma máscara CUIT/CUIL/DNI que en Proveedor.
- `Condición Fiscal`: `maxWidth: 220`.

**Tarjeta "Contacto":**
```
[ Teléfono ] [ Teléfono adicional ]
[ Email    ]
```

**Tarjeta "Domicilio":**
```
[ Calle (flex:2) ] [ Número ] [ Aclaración ]
[    DireccionGeo (Provincia / Localidad / CP)    ]
```

### Validaciones

Iguales a Proveedor: documento, teléfonos, CP.

---

## Sección 6: Punto de Venta — Selección de cliente

### `usePosSession.ts` — estado nuevo

El tipo de `formaPago` se expande para incluir `cuenta_corriente` (ya es valor válido en el enum de la DB):

```typescript
useState<'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente'>('efectivo')
```

Nuevo estado de cliente:

```typescript
const [clienteId, setClienteIdState]   = useState(CONSUMIDOR_FINAL_ID);
const [clienteInfo, setClienteInfo]    = useState<{ razon_social: string; habilita_ccc: boolean } | null>(null);

function setCliente(id: string, info: { razon_social: string; habilita_ccc: boolean } | null) {
  setClienteIdState(id);
  setClienteInfo(info);
  // Si el cliente no tiene CCC y la forma de pago actual es cuenta_corriente, resetear a efectivo
  if (!info?.habilita_ccc && formaPago === 'cuenta_corriente') setFormaPago('efectivo');
}
```

`confirmar()` usa `clienteId` en lugar de `CONSUMIDOR_FINAL_ID`.  
`reset()` reinicia `clienteId` a `CONSUMIDOR_FINAL_ID` y `clienteInfo` a `null`.

Exponer `clienteId`, `clienteInfo`, `setCliente` en el return del hook.

### Componente nuevo: `PosClienteSelector.tsx`

Ubicación: `packages/client/src/renderer/views/pos/PosClienteSelector.tsx`

Comportamiento:
- Estado: `query` (string), `resultados` (array), `open` (bool).
- Al montar: muestra "Consumidor Final" con botón "Cambiar".
- Al hacer click en "Cambiar": muestra un input de búsqueda.
- `onChange` del input (debounce ~200ms): llama `ferreteria.cliente.list()` y filtra en cliente por `razon_social` o `numero_documento` (filtrado en cliente para no sobrecargar IPC).
- Dropdown con hasta 10 resultados: `razon_social` + tipo+número de documento.
- Al seleccionar: llama `onSeleccionar(id, { razon_social, habilita_ccc })`, cierra dropdown.
- Botón "✕" junto al nombre seleccionado → vuelve a Consumidor Final.

Props:
```typescript
type Props = {
  clienteId: string;
  clienteInfo: { razon_social: string; habilita_ccc: boolean } | null;
  onSeleccionar: (id: string, info: { razon_social: string; habilita_ccc: boolean } | null) => void;
};
```

### `PosView.tsx`

Reemplazar el bloque estático:
```tsx
<div className="font-bold" style={{ marginTop: 4 }}>Consumidor Final</div>
```
por:
```tsx
<PosClienteSelector
  clienteId={clienteId}
  clienteInfo={clienteInfo}
  onSeleccionar={setCliente}
/>
```

### `PosTotalsPanel.tsx`

Agregar prop `habilitaCcc: boolean`. Mostrar la opción `cuenta_corriente` en el selector de forma de pago solo si `habilitaCcc === true`.

---

## Tests a cubrir

### Nuevos unitarios
- `documento.ts`: `formatDocumento` para CUIT, CUIL, DNI con distintas longitudes de input
- `documento.ts`: `validarDocumento` casos válidos e inválidos
- `documento.ts`: `validarTelefono`, `validarCodigoPostal`

### IPC handlers (integración)
- `clienteUpsertHandler`: guarda y recupera `calle`, `numero`, `aclaracion`, `telefono_adicional`
- `proveedorUpsertHandler`: igual

### Hook
- `usePosSession`: `setCliente` actualiza `clienteId`; si no tiene CCC y formaPago era CCC, resetea a efectivo; `reset()` vuelve a CF

### Componentes UI
- `PosClienteSelector`: render default "Consumidor Final"; selección actualiza display; ✕ vuelve a CF
- `PosTotalsPanel`: opción CCC aparece solo con `habilitaCcc=true`

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `migrations/0009_personas_v2.sql` | Crear |
| `migrations/meta/_journal.json` | Actualizar (entrada idx 9) |
| `db/schema/personas.ts` | Modificar (4 cols × 2 tablas) |
| `ipc/cliente.ts` | Modificar (payload + handlers) |
| `ipc/proveedor.ts` | Modificar (payload + handlers) |
| `renderer/utils/documento.ts` | Crear |
| `renderer/components/DireccionGeo.tsx` | Modificar (portal) |
| `renderer/views/compras/proveedores/ProveedorForm.tsx` | Modificar |
| `renderer/views/clientes/ClienteForm.tsx` | Modificar |
| `renderer/hooks/usePosSession.ts` | Modificar |
| `renderer/views/pos/PosClienteSelector.tsx` | Crear |
| `renderer/views/pos/PosView.tsx` | Modificar |
| `renderer/views/pos/PosTotalsPanel.tsx` | Modificar |

---

## Fuera de alcance

- Migrar el contenido del campo `domicilio` a `calle`/`numero`/`aclaracion` (datos históricos quedan como están).
- Buscar clientes por servidor/nube (filtrado local).
- Validación de dígito verificador del CUIT.
