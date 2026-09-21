# Spec: Realineamiento de menú y funcionalidades pendientes

**Fecha:** 2026-07-03  
**ADRs:** ADR-029 (auth), ADR-030 (navegación), ADR-031 (categorías), ADR-032 (marcas), ADR-033 (baja clientes)  
**Tests base:** 725 verdes  

---

## Alcance

Cinco cambios coordinados que tocan pantallas aprobadas de R1/R3. Ninguno introduce
nuevas dependencias. Todos los ADRs están cerrados; no hay decisiones abiertas en este
spec salvo las explícitamente marcadas como "futura fase".

---

## 1. Autenticación por contraseña (ADR-029)

### Motivación
Eliminar el PIN rápido como mecanismo de autenticación. Toda autenticación —login
principal y autorización de supervisor en cierre de caja— pasa por `usuario + contraseña`
usando scrypt (ya implementado en `src/main/auth/hash.ts`).

### Cambios de schema

**Migración `0011_drop_pin_rapido.sql`:**
```sql
ALTER TABLE usuario DROP COLUMN pin_rapido;
```

**`src/main/db/schema/seguridad.ts`:** eliminar campo `pin_rapido` del objeto Drizzle.

### Cambios en main process

**`src/main/ipc/auth.ts`:**
- `loginHandler`: eliminar rama `pin`; payload acepta solo `{ nombreUsuario, password }`
- Eliminar `usuarioSetPinHandler` y el registro `ipcMain.handle('usuario:setPin', ...)`
- Tipo `LoginPayload`: eliminar campo `pin?`

**`src/main/ipc/caja.ts` — `cajaCerrarHandler`:**
- Payload cambia de `{ ..., supervisor_pin? }` a `{ ..., supervisor_usuario?, supervisor_password? }`
- Verificación: buscar usuario activo con `nombre_usuario = supervisor_usuario` que tenga
  permiso `config.fiscal`; verificar `verifyPassword(supervisor_password, user.hash_password)`
- Errores: `DIFERENCIA_REQUIERE_AUTORIZACION` (sin credenciales), `SUPERVISOR_NO_ENCONTRADO`,
  `CREDENCIALES_INVALIDAS`

### Cambios en renderer

**`src/renderer/views/Login.tsx`:**
- Eliminar toggle "Contraseña / Usar PIN" y rama PIN
- Formulario: solo `Usuario` + `Contraseña`
- Tipo `Mode` y estado `pin` eliminados

**`src/renderer/views/caja/SupervisorPinModal.tsx` → renombrar `SupervisorAuthModal.tsx`:**
- Campos: `Usuario supervisor` (text, autoFocus) + `Contraseña` (password)
- Props: `onConfirm: (usuario: string, password: string) => Promise<void>`
- Error `PIN_INCORRECTO` → mapear a `CREDENCIALES_INVALIDAS`

**`src/renderer/views/caja/CajaCierreView.tsx`:**
- Importar `SupervisorAuthModal` en lugar de `SupervisorPinModal`
- Pasar `supervisor_usuario` + `supervisor_password` al IPC `caja:cerrar`

**`src/renderer/views/config/ConfigMiCuenta.tsx`:**
- Verificar y eliminar cualquier UI de gestión de PIN (sección "PIN rápido" si existe)

### Restricciones
- No se agrega `bcryptjs` ni ninguna otra librería de hashing; scrypt de `node:crypto` es el
  único mecanismo.
- Los PINs existentes en BD quedan como datos muertos hasta que la migración elimine la
  columna.

---

## 2. Sidebar con grupos colapsables (ADR-030)

### Motivación
Reorganizar la navegación en grupos semánticos colapsables. Reducir ruido visual al
colapsar secciones irrelevantes para el rol activo.

### Estructura nueva

```
POS                      /pos
Caja                     /caja
▼ Catálogo
    Productos            /productos
    Ubicaciones          /ubicaciones
Stock                    /stock
▼ Abastecimiento
    Órdenes de compra    /compras/ordenes         [compra.recibir]
    Proveedores          /compras/proveedores      [proveedor.gestionar]
    Reposición sugerida  /stock/reabastecimiento   [dashboard.ver]
▼ Clientes
    Clientes             /clientes                 [ctacte.cobrar]
    Cuenta corriente     /credito                  [ctacte.cobrar]
Reportes                 /dashboard                [dashboard.ver]
▼ Configuración
    Categorías           /config/categorias
    Marcas               /config/marcas
    Importar datos       /importar                 [import.masiva]
    Listas de precios    /config/listas-de-precios
    Etiquetas            /etiquetas
    Backup/Restore       /config/backup-restore    [backup.crear]
```

**Fuera de esta fase:** "Parámetros del sistema" — excluido del grupo Configuración hasta
que se defina qué campos de `parametros_sistema` son editables desde UI (ADR pendiente).

### Implementación

**`src/renderer/views/shell/AppShell.tsx`:**

Reemplazar `navItems[]` plano por estructura tipada:

```ts
type NavLink  = { kind: 'link';  label: string; to: string; icon: JSX.Element; permiso?: string }
type NavGroup = { kind: 'group'; label: string; icon: JSX.Element; children: NavLink[] }
type NavEntry = NavLink | NavGroup
```

Estado de collapse: `Map<string, boolean>` en `useState`; grupos arrancan abiertos si
algún hijo está activo en la ruta actual (evaluado con `location.pathname.startsWith`),
cerrados en caso contrario. El colapso total del sidebar (`collapsed`) sigue existiendo
y oculta tanto links directos como grupos.

Grupos colapsables renderizan un `<button>` con chevron rotado CSS (`rotate(0)` cerrado /
`rotate(90deg)` abierto) en lugar de `<NavLink>`.

`CRUMBS` map actualizado: "Reabastecimiento" → "Reposición sugerida", "Importar CSV" →
"Importar datos", "Dashboard" → "Reportes".

**`src/renderer/views/config/ConfigShell.tsx`:**
- Añadir `{ label: 'Categorías', to: '/config/categorias' }` visible a todos
- Añadir `{ label: 'Marcas', to: '/config/marcas' }` visible a todos
- Mantener el resto sin cambios (Listas de precios, Usuarios, Backups)

### Movimientos de ítems
| Ítem | De | A |
|------|----|---|
| Etiquetas | Catálogo (sidebar) | Configuración (sidebar) |
| Reposición sugerida | Catálogo (sidebar) | Abastecimiento (sidebar) |
| Importar datos | Admin (sidebar) | Configuración (sidebar) |
| Dashboard | Admin (sidebar) | Directo "Reportes" (sidebar) |

---

## 3. ABM Categorías (ADR-031)

### Motivación
Categorías actualmente no tienen pantalla de gestión propia. Solo se crean inline desde
ProductoForm. Falta baja lógica con bloqueo por productos activos.

### Cambios en main process

**`src/main/ipc/categoria.ts`:**

`categoriaListHandler(db, opts?: { includeInactive?: boolean })`:
- Sin `opts` o con `opts.includeInactive = false`: comportamiento actual (solo activas)
- Con `opts.includeInactive = true`: retorna todas

`categoriaDesactivarHandler(db, { id: string })`:
1. Contar `producto` con `categoria_id = id AND activo = true`
2. Si count > 0: lanzar `Error('CATEGORIA_CON_PRODUCTOS:N')` donde N es el conteo
3. Si count = 0: llamar `categoriaUpdateHandler(db, { id, activo: false })`

IPC nuevo: `categoria:desactivar`

La reactivación reutiliza `categoria:update` con `{ id, activo: true }`.

### Vista `ConfigCategoriasView.tsx`

Ruta: `/config/categorias`

Tabla: Nombre · Descripción · Estado (badge) · Acciones

- **Modal compartido** (crear/editar): campos Nombre (required) + Descripción (opcional) +
  Categoría padre (select de activas, opcional)
- **Crear:** botón "Nueva categoría" → modal vacío → `categoria:create`
- **Editar:** botón por fila → modal pre-cargado → `categoria:update`
- **Dar de baja:** botón (guard `dashboard.ver`) → confirmation → `categoria:desactivar`
  - Error `CATEGORIA_CON_PRODUCTOS:N` → `"No se puede dar de baja: N producto(s) activo(s) usan esta categoría"`
- **Reactivar:** botón en filas inactivas (guard `dashboard.ver`) → `categoria:update` con `activo: true`
- Toggle "Mostrar inactivas" para ver el listado completo (guard `dashboard.ver`)

ProductoForm y sus selectores inline no se modifican.

### Rutas y nav

`routes/index.tsx`: `{ path: 'config/categorias', element: <ConfigCategoriasView /> }`  
ConfigShell sub-nav: ítem "Categorías" → `/config/categorias` (todos los roles)

---

## 4. ABM Marcas (ADR-032)

### Motivación
Marcas solo tienen alta inline desde ProductoForm. Faltan edición, baja lógica y vista
de gestión propia.

### Cambios en main process

**`src/main/ipc/marca.ts`:**

`marcaListHandler(db, opts?: { includeInactive?: boolean })`: igual que categorías.

`marcaUpdateHandler(db, { id, nombre?, descripcion?, activo? })`:
- Si `nombre` cambia: verificar unicidad contra otras filas → `MARCA_DUPLICADA`
- Actualizar campos provistos + campos de auditoría/sync

`marcaDesactivarHandler(db, { id })`:
1. Contar `producto` con `marca_id = id AND activo = true`
2. Si count > 0: lanzar `Error('MARCA_CON_PRODUCTOS:N')`
3. Si count = 0: `marcaUpdateHandler(db, { id, activo: false })`

IPC nuevos: `marca:update`, `marca:desactivar`

La reactivación reutiliza `marca:update` con `{ id, activo: true }`.

### Vista `ConfigMarcasView.tsx`

Ruta: `/config/marcas`

Estructura idéntica a `ConfigCategoriasView` salvo:
- Sin campo "Categoría padre" (marcas son planas)
- Mensaje de error: `"No se puede dar de baja: N producto(s) activo(s) usan esta marca"`

ProductoForm y sus selectores inline no se modifican.

### Rutas y nav

`routes/index.tsx`: `{ path: 'config/marcas', element: <ConfigMarcasView /> }`  
ConfigShell sub-nav: ítem "Marcas" → `/config/marcas` (todos los roles)

---

## 5. Baja lógica de Clientes (ADR-033)

### Motivación
Clientes ya tienen campo `activo` en schema y `clienteListHandler` ya filtra activos,
pero no existe operación de baja ni UI para gestionarla.

### Cambios de schema

**Ninguno.** El campo `activo boolean NOT NULL DEFAULT true` ya existe en `cliente`.

### Cambios en main process

**`src/main/ipc/cliente.ts`:**

`clienteListHandler(db, opts?: { includeInactive?: boolean })`:
- Sin opts: comportamiento actual (solo activos) — selectores de POS/OC sin cambios
- Con `includeInactive: true`: retorna todos

`clienteDesactivarHandler(db, { id })`:
1. Buscar `cuenta_corriente_cliente` del cliente
2. Si existe y `saldo_centavos ≠ 0`:
   lanzar `Error('CLIENTE_CON_SALDO:' + saldo_centavos)` con el saldo en centavos para
   que el renderer lo formatee y muestre
3. Si ok: `UPDATE cliente SET activo = false` + campos auditoría/sync

IPC nuevo: `cliente:desactivar` (guard `ctacte.cobrar`, igual que el namespace)

`clienteReactivarHandler(db, { id })`: setea `activo = true` + campos de auditoría/sync.
`clienteUpsertHandler` no toca `activo` en la rama update, por lo que no sirve para reactivar.
IPC nuevo: `cliente:reactivar` (guard `ctacte.cobrar`)

### Cambios en renderer

**`src/renderer/views/clientes/ClienteDetalle.tsx`:**
- Badge "Inactivo" en header si `activo = false`
- Campos en modo lectura si el cliente está inactivo
- Botón "Dar de baja" (guard `dashboard.ver`, cliente activo): confirmation → `cliente:desactivar`
  - Error `CLIENTE_CON_SALDO:N` → `"No se puede dar de baja: el cliente tiene saldo pendiente de $X.XX en cuenta corriente"`
- Botón "Reactivar" (guard `dashboard.ver`, cliente inactivo) → `cliente:reactivar`

**`src/renderer/views/clientes/ClientesListado.tsx`:**
- Toggle "Mostrar inactivos" (guard `dashboard.ver`) → llama a `cliente:list` con `includeInactive: true`
- Filas inactivas: opacidad reducida + badge "Inactivo"

### Selectores (POS, OC)
Sin cambios — ya usan `cliente:list` sin `includeInactive`, que filtra activos.

---

## Testing

Cada sección genera sus propios tests en el runner correspondiente:

| Cambio | Dónde testear |
|--------|---------------|
| Auth — loginHandler sin PIN | `src/main/ipc/__tests__/auth.handlers.test.ts` (node runner) |
| Auth — cajaCerrarHandler con usuario+password | `src/main/ipc/__tests__/caja.handlers.test.ts` (node runner) |
| categoriaDesactivarHandler | `src/main/ipc/__tests__/categoria.handlers.test.ts` (node runner) |
| marcaUpdateHandler + marcaDesactivarHandler | `src/main/ipc/__tests__/marca.handlers.test.ts` (node runner) |
| clienteDesactivarHandler + clienteReactivarHandler | `src/main/ipc/__tests__/cliente.handlers.test.ts` (node runner) |
| Login.tsx sin PIN | `src/renderer/views/Login.test.tsx` (jsdom runner) |
| AppShell nav groups | `src/renderer/views/shell/__tests__/AppShell.test.tsx` (jsdom runner) |
| ConfigCategoriasView | `src/renderer/views/config/__tests__/ConfigCategoriasView.test.tsx` (jsdom) |
| ConfigMarcasView | `src/renderer/views/config/__tests__/ConfigMarcasView.test.tsx` (jsdom) |
| ClienteDetalle baja lógica | `src/renderer/views/clientes/__tests__/ClienteDetalle.test.tsx` (jsdom) |

Flujo TDD: RED → GREEN → REFACTOR por cada handler y componente.

---

## Orden de implementación sugerido

1. Auth (migración + handler + Login + SupervisorAuthModal + CajaCierreView)
2. Categorías ABM (handler + vista + rutas)
3. Marcas ABM (handler + vista + rutas)
4. Baja lógica Clientes (handler + ClienteDetalle + ClientesListado)
5. Navegación (AppShell + ConfigShell) — último para no romper rutas durante desarrollo
