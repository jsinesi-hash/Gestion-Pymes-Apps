# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Comandos

Todos los comandos se ejecutan desde la raíz del monorepo salvo que se indique lo contrario.

```bash
# Instalar dependencias
pnpm install

# Iniciar la app Electron en modo desarrollo (hot-reload)
pnpm dev

# Correr TODOS los tests (renderer + main process)
pnpm test
# O desde packages/client directamente:
cd packages/client && pnpm test   # vitest jsdom + test-node.cjs bajo Electron

# Solo tests del renderer (jsdom, rápidos)
cd packages/client && pnpm exec vitest run --config vitest.config.ts

# Solo tests del main process (corre bajo el binario de Electron)
cd packages/client && node scripts/test-node.cjs

# Un único archivo de test
cd packages/client && pnpm exec vitest run src/renderer/views/productos/ProductoDetalle.test.tsx
cd packages/client && ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron node_modules/vitest/vitest.mjs run --config vitest.node.config.ts src/main/ipc/__tests__/venta.handlers.test.ts

# Recompilar el módulo nativo según el runtime
pnpm rebuild                             # para Electron (antes de pnpm dev)
cd packages/client && pnpm rebuild:node  # para Node del sistema (antes de pnpm test)

# Build y empaquetado
pnpm build   # empaqueta packages/client
pnpm make    # genera instalador

# Seeds de datos
cd packages/client && node scripts/seed-dev.cjs   # catálogo + personas + ventas de prueba
cd packages/client && node scripts/seed-geo.cjs   # provincias/localidades

# Compilar el paquete shared (obligatorio al editar packages/shared/src)
cd packages/shared && pnpm build
```

## Arquitectura

### Estructura del monorepo

Monorepo multi-app (ADR-091 + ADR-092): un núcleo `@core/*` + `@ferreteria/shared` compartido, y una
app por familia de negocio. **El core NUNCA depende de una app** (invariante protegida por barandas
automáticas — B4 en `shared`, boundary core↛app por paquete).

```
packages/
  shared/          # TypeScript puro (browser-safe) — precios, SKU, navegación (crearNavegacion),
                    #   tipos de exportación y sync. Sin Electron/Node.
  core-db/         # @core/db     — esquema Drizzle universal + factory createDb/runMigrations
  core-ui/         # @core/ui     — design system + AppShell/vistas universales (renderer-only)
  core-main/       # @core/main   — plomería del main: auth/RBAC, runSeed, registerCoreHandlers,
                    #   caja/cta-cte/cliente/backup/restore/export/geo (main-only)
  core-preload/    # @core/preload — createBridge (único contextBridge.exposeInMainWorld universal)
apps/
  retail/          # ferreteria-client — 1er perfil de familia Retail (kiosco/librería/limpieza)
  elaborados/      # elaborados-client — familia Elaborados (heladería/gastronomía), 2º consumidor
    src/
      main/        # Proceso principal de Electron de la app (Node.js + SQLite)
      preload/     # llama a createBridge({ exposeAs, app }) — único punto que importa 'electron'
                    #   del lado renderer
      renderer/    # SPA React; shell/ compone AppShell del core con NAV/CRUMBS/comandos propios
      print/       # Interfaz IPrintService + implementación ElectronPrintService
```

Cada app tiene su propio `main/db/migrations/` (secuencia sobre el esquema compuesto core+app) y su
propia clave de bridge (`window.ferreteria` en Retail, `window.elaborados` en Elaborados).

### Puente IPC de Electron

El renderer **nunca** importa de `'electron'` directamente. Toda comunicación pasa por la clave de
bridge de la app (`window.ferreteria` en Retail, `window.elaborados` en Elaborados), expuesta por
`src/preload/index.ts` de la app vía **una única** llamada a `createBridge({ exposeAs, app },
deps)` (`@core/preload`): mezcla los canales universales del core con el namespace que arma la app,
y lanza `BRIDGE_COLISION: <ns>[.<metodo>]` si la app pisa una clave que el core ya define. El
renderer accede a esa API con `bridge()` (`@core/ui`; requiere haber llamado `configurarBridge
(exposeAs)` al arrancar) — nunca escribiendo `globalThis.<clave>` a mano.

Los handlers universales (auth, preferencias, parámetros, geo, cliente, cta-cte, caja, backup,
restore, dialog, exportar) se registran con un solo llamado a `registerCoreHandlers(ipcMain, db,
{ migrationsFolder, navegacion, exportadores?, caja? })` (`@core/main`) desde `src/main/index.ts` de
cada app. Los handlers propios de un dominio de la app exportan su propia función `register*
Handlers(ipcMain, db)`, llamada al lado de `registerCoreHandlers`.

Patrón para un dominio nuevo **de una app** (no universal):
1. Crear `apps/<app>/src/main/ipc/<dominio>.ts` con las funciones handler + `register<Dominio>Handlers`.
2. Agregar el namespace en `apps/<app>/src/preload/index.ts`, dentro del `app` que recibe `createBridge`.
3. Llamar a `register<Dominio>Handlers(ipcMain, db)` en `apps/<app>/src/main/index.ts`, junto a
   `registerCoreHandlers(...)`.
4. Crear hooks React en `apps/<app>/src/renderer/hooks/use<Dominio>.ts` que llamen a
   `bridge().<dominio>.*`.
5. Si el dominio tiene pantalla propia: declarar la ruta en `apps/<app>/src/renderer/routes/index.tsx`
   **y** darle entrada de navegación en `apps/<app>/src/renderer/shell/` (ver §Navegación).
   Una ruta sin entrada de nav es inalcanzable para el usuario.

Si el dominio es **universal** (lo necesitan o lo necesitarán ambas apps sin variar de forma — regla
de tres, ver ADR-091/ADR-092), va a `@core/main` (handler) + `@core/preload` (`coreCanales`) +
`@core/ui` (vista/hook) en vez de a la app, con el mismo patrón de seams que ya usan caja/exportar/
navegación: opts inyectadas en el registrador del core, cada app decide el contenido.
Ejemplo vigente: **venta** — `confirmarVenta`/`anularVenta` en `@core/main` (ADR-095); cada app
inyecta `validarPrevio`/`aplicarLineas`/`revertirLineas` con su lógica de líneas e inventario. El core
recibe los totales ya calculados y no conoce `venta_detalle` ni el stock de ninguna app.

### Dos runners de test (crítico — NMV)

`better-sqlite3` es un módulo nativo compilado para un Node Module Version (NMV) específico. Electron 32 usa **NMV 128**; Node 24 del sistema usa **NMV 137** — son incompatibles entre sí.

- **Tests del renderer** (`src/renderer/**/*.test.{ts,tsx}`): corren con `vitest` bajo jsdom — sin módulos nativos, el Node del sistema funciona.
- **Tests del main process** (`src/main/**/*.test.ts`): corren vía `scripts/test-node.cjs`, que lanza el binario de Electron con `ELECTRON_RUN_AS_NODE=1`, garantizando el mismo NMV que producción.

`pnpm test` en `packages/client` ejecuta ambos en secuencia: `vitest run && node scripts/test-node.cjs`.

Al alternar entre `pnpm dev` y `pnpm test`, recompilar el módulo nativo con `pnpm rebuild:electron` o `pnpm rebuild:node` según corresponda.

### Tests del main process

Los tests en `src/main/ipc/__tests__/` usan una BD SQLite en memoria creada por `createTestDb()` en `src/main/ipc/__tests__/helpers.ts`: abre la BD, aplica todas las migraciones de Drizzle y llama a `runSeed` (seed de auth). Usar `setupDb()` + `loginAsAdmin()` para tests que requieran sesión autenticada.

### Base de datos

- BD de producción: `app.getPath('userData')/ferreteria.db`
- WAL mode y foreign keys siempre habilitados
- Migraciones en `src/main/db/migrations/`, aplicadas por `migrate()` de Drizzle al arrancar
- Esquema dividido en `src/main/db/schema/` por dominio (catalog, ventas, compras, credito, seguridad, precios, config, geo, personas)
- La tabla `__drizzle_migrations` es la fuente de verdad del estado de migraciones (usada por backup/restore)

### Motor de precios

Toda la lógica de precios vive en `packages/shared/src/precio.ts` como funciones puras sin efectos. El renderer llama a `resolverPrecio()` y `redondearPeso()` directamente — sin IPC.

### Rutas

Todas las rutas se declaran en `src/renderer/routes/index.tsx` — nunca inline en componentes. La app usa `createMemoryRouter` (no historial del browser) porque Electron sirve desde `file://`.

### Navegación (leer antes de agregar una pantalla)

**`AppShell` (`@core/ui`) es 100% por props — no tiene NAV ni CRUMBS propios.** El NAV/CRUMBS/
comandos/buscadores de cada app viven en `apps/<app>/src/renderer/shell/` (`nav.ts`, `crumbs.ts`,
`comandos.ts`) y ese shell (`RetailShell`/`ElaboradosShell`) es quien compone `<AppShell nav={...}
crumbs={...} comandos={...} .../>`. Agregar una pantalla requiere **tres** cosas, no una:

1. La ruta en `apps/<app>/src/renderer/routes/index.tsx`.
2. El ítem en el array `NAV_<APP>` de `apps/<app>/src/renderer/shell/nav.ts`, dentro del grupo que
   corresponda, con su `permiso` si es restringida (el shell filtra por permiso: si el rol no lo
   tiene, el ítem no aparece — eso es correcto, pero verificá con qué usuario estás probando).
3. La entrada en el mapa `CRUMBS_<APP>` de `apps/<app>/src/renderer/shell/crumbs.ts`, o el
   breadcrumb queda vacío.

Elaborados automatiza la verificación de 1↔2↔3 con un test (`apps/elaborados/src/renderer/shell/
nav.test.tsx`): por cada item de `NAV_ELABORADOS` con `to`, comprueba con `matchRoutes` que existe
una ruta real y que `buildBreadcrumb` no cae al fallback "Inicio". Un ítem de NAV sin ruta o sin
crumb hace fallar ese test — **replicar el mismo test al agregar pantallas en Retail** (hoy Retail
no lo tiene) en vez de confiar solo en abrir la app a mano.

> ⚠️ **Regla general (lección de `ConfigShell.tsx`, ya eliminado en ADR-081).** Ese archivo
> era un menú de Configuración huérfano —tenía `NavLink` + `<Outlet/>` pero no lo importaba
> nadie (las rutas `config/*` son planas, no anidadas)— y una vez se le agregó "Email / SMTP"
> que quedó invisible en la app (ADR-048). Se dio de baja, pero la clase de error persiste:
>
> **Regla general que evita esta clase de error:** antes de editar un componente para que
> algo "aparezca", confirmá que está efectivamente montado —
> `grep -rn "<NombreComponente" src/` sobre el resto del código. Si nadie lo importa, no se
> renderiza, y el cambio no se puede verificar con tests unitarios del propio componente
> (van a pasar igual). Los tests de un componente huérfano dan verde y no prueban nada.

---

## Sistema de Gestión de Ferretería — Contexto de dominio

> Contexto permanente del proyecto para Claude Code. Es la fuente de verdad de las
> decisiones ya tomadas. **No reintroducir decisiones cerradas** (registradas como ADR).
> Ante una duda de arquitectura, **preguntar antes de improvisar**. Las decisiones
> abiertas (ADR-012 a 016) **no se cierran unilateralmente**.

---

## 1. Objetivo

Sistema de gestión integral para una ferretería que opera **OFFLINE-FIRST**: vender,
controlar stock, localizar mercadería por QR, facturar (AFIP/ARCA), gestionar compras,
cuentas corrientes y caja. La operación **nunca** se detiene por falta de internet.

## 2. Stack (fijo — ADR-002)

- TypeScript de punta a punta.
- Cliente de escritorio: **Electron + React**.
- Base local: **SQLite** (fuente de verdad local — ADR-001).
- Backend nube (desde R4): **Node.js + PostgreSQL**.
- Monorepo TypeScript con **pnpm workspaces**; ORM **Drizzle** (SQLite y PostgreSQL con el mismo esquema). (ADR-016)

## 3. Principios de arquitectura (no negociables)

1. **Offline-first:** toda operación se escribe primero en SQLite local; la nube
   consolida pero no bloquea. (ADR-001)
2. **IDs UUID generados en el cliente.** (ADR-003)
3. **Campos de sincronización** en toda tabla sincronizable: `version` (int),
   `origin_id` (terminal), `sync_state` (`pending`|`synced`|`conflict`), `updated_at`.
4. **Outbox + idempotencia:** reaplicar una operación por su `id` no duplica efectos.
   El motor de sync real es R4, pero el esquema se respeta desde R1. **Conflictos:
   last-write-wins por registro en entidades maestras + log de conflictos revisable por
   el Supervisor** (los libros de movimientos inmutables casi no generan conflictos). (ADR-012)
5. **Saldo + libro de movimientos inmutable** para stock, caja y cuentas corrientes: los
   movimientos no se editan, solo se agregan; cada uno guarda el `*_resultante`. (ADR-006)
6. **Snapshots** en líneas de venta y compra (descripción, precio/costo, alícuota del
   momento; no referencia viva al producto).
7. **Baja lógica** (`activo`) en entidades maestras; no borrado físico.
8. **Auditoría:** `usuario_creacion_id`/`fecha_creacion` y, en editables,
   `usuario_modificacion`/`fecha_actualizacion`.

## 4. Identificación de productos (ADR-005, redefinido por ADR-025)

- `sku`: **única fuente de verdad de identidad interna**. Formato `P-NNNNNNN-D`
  (correlativo + dígito verificador), opaco: prohibido codificar categoría, proveedor o
  marca en él. Correlativo desde `sku_proximo_secuencial` en `parametros_sistema`,
  incrementado en la misma transacción del alta.
- `gtin_barcode` (EAN/UPC del fabricante): **opcional, uno solo** por producto; se usa en
  la entrada (alta y recepción). `producto_presentacion` tiene su propio `gtin_barcode`
  nullable, para escanear la caja/bulto (ADR-040).
- **No existe columna `codigo_qr`.** ADR-025 la eliminó: guardaba una proyección del SKU.
  El QR y el code128 son **representaciones del `sku` generadas en la capa de impresión de
  etiqueta** (ADR-026), no columnas. Codifican el SKU pelado, sin máscara ni prefijo.
- Discriminación de scan en POS **por patrón, no por prefijo**: EAN = 13 dígitos numéricos;
  SKU = `^P-\d{7}-\d$`.
- `ubicacion_id`: atributo del producto (FK a catálogo `Ubicacion`), **una sola**
  ubicación por producto. Estantes con cartelería pre-impresa fija (la ubicación no se
  imprime ni se escanea).
- Periférico: **lector inalámbrico 1D/2D** como HID (lee EAN/UPC y QR). **No hay captura
  móvil ni PWA.** (ADR-004)

## 5. Roles (ADR-008)

Dos roles de sistema, **un rol por usuario**, permisos como datos (`codigo`):

- **OPERADOR:** mostrador + depósito (vende, cobra, opera su caja, alta/edición de
  productos, stock, ubicaciones, etiquetas QR, recepción de compras, cobro de cuenta
  corriente, localización).
- **SUPERVISOR:** todo lo del Operador + administración (usuarios, configuración,
  parámetros fiscales, proveedores, precios, reportes/dashboard, autorizaciones, pagos a
  proveedor, importación masiva, anulaciones, override de precio).

No se puede desactivar el último Supervisor activo. Roles base con `es_sistema = true`.

## 6. Reglas de negocio clave

- **Precio:** base (`precio_venta_lista`, **IVA incluido**) → % de lista (el % por
  producto **pisa** al general; ambos **con signo**) → descuento de línea → descuento
  global. (ADR-009)
- **Redondeo a $1 sobre el TOTAL** de la venta; diferencia en `Venta.ajuste_redondeo`;
  las líneas conservan centavos. (ADR-010)
- **Sin stock disponible no hay venta** (sin excepción).
- **Productos inactivos no se venden.**
- El stock **siempre** cambia vía un `MovimientoStock` (nunca hay stock sin movimiento).
- **Costo promedio ponderado** en cada entrada con costo:
  `nuevo = (stock*costo_actual + cantidad*costo_entra) / (stock + cantidad)`
- **Solo IVA** como impuesto.
- **Unidades (ADR-014):** stock y precios se llevan en `unidad_venta`. Se puede comprar en
  `unidad_compra` (ej. caja) y el sistema convierte con `factor_conversion`
  (stock += cantidad_compra × factor; costo_unitario_venta = costo_compra / factor). Caso
  simple: factor = 1.
- **Impresión (ADR-015):** soportar ambas salidas (etiquetadora/rollo y A4 en impresora
  común) detrás de una interfaz de impresión configurable; el contenido (QR + tamaño) es
  independiente del medio.
- **Numeración interna:** `prefijo + terminal + correlativo` (ej. `V-C1-000001`,
  `OC-C1-000001`), asignada al confirmar; visible en ticket. La numeración fiscal es de
  ARCA y aplica en R2.
- **Caja:** registra **todos** los medios de pago; el arqueo cuenta **solo el efectivo**;
  diferencia > umbral parametrizable requiere autorización del Supervisor.
- **Autorizaciones del Supervisor** (registradas): exceso de límite de crédito,
  sobre-recepción, cierre de caja con diferencia sobre umbral, anulación, override de
  precio, pago a proveedor.
- **Sobrepago** (cobro/pago) permitido → deja saldo a favor.

## 7. Modelo de datos

> **La fuente de verdad es `packages/client/src/main/db/schema/*.ts`, no esta sección.**
> Esta sección es un mapa para orientarse; ante cualquier duda de nombre, tipo o
> nullabilidad, abrir el archivo de esquema. **51 tablas** en 12 archivos de dominio.
>
> Patrones transversales (salvo excepción anotada): `id` TEXT UUID generado en el cliente;
> sync (`version`, `origin_id`, `sync_state`, `updated_at`); baja lógica `activo`;
> auditoría (`usuario_creacion_id`/`fecha_creacion` y, en editables,
> `usuario_modificacion_id`/`fecha_actualizacion`). `*_resultante` en libros de
> movimientos. Snapshots en líneas. Los timestamps son INTEGER Unix.
>
> **Unidades de dinero — leer antes de tocar importes.** Conviven dos convenciones:
> - **Centavos (INTEGER), doctrina vigente:** `venta_pago`, `cuenta_corriente_cliente`,
>   `movimiento_cuenta_corriente`, `producto_proveedor`, `lista_precio_valor`,
>   `promocion`, `recalculo_masivo`, `cambio_programado`, `orden_compra`, `item_oc`,
>   `recepcion_detalle`, `comprobante_compra`, `presupuesto`, `presupuesto_detalle`,
>   `importacion_costo_proveedor_detalle`. **Toda tabla nueva va en centavos.**
> - **Pesos (REAL), deuda legacy conocida:** `venta`, `venta_detalle`, `caja`,
>   `movimiento_caja`, `comprobante`, `producto` (`precio_*`, `margen_ganancia`). No se
>   migró; no agregar columnas nuevas de dinero en `real`.
>
> Los porcentajes son `real` en todos lados (`*_pct`, `alicuota_iva`,
> `ajuste_porcentual`, `descuento_*`) — son porcentajes, no montos.

### Catálogo y stock (`schema/catalog.ts` — 9 tablas)

- **`producto`** (maestro): `id`, `sku` (único), `sku_secuencial`, `gtin_barcode`
  (nullable), `nombre_corto`, `nombre_largo`, `descripcion_tecnica`, `unidad_venta`
  (= unidad de **stock**, texto), `unidad_compra`, `factor_conversion` (default 1),
  `permite_fraccion`, `precio_costo_promedio`, `precio_venta_lista` (IVA incluido),
  `margen_ganancia`, `impuesto_id`, `moneda` (default `ARS`), `categoria_id` (NOT NULL),
  `marca_id`, `producto_padre_id`, `garantia_meses`, `ubicacion_id`, `activo`, auditoría,
  sync.
  *No hay `codigo_qr` (ADR-025). El stock no vive acá (ver `existencias`), ni el precio de
  lista real (ver `lista_precio_valor`).*
- **`producto_presentacion`** (ADR-040; 1 producto → N presentaciones): `id`,
  `producto_id`, `unidad_id` (FK → `unidad`), `factor_a_stock` (**REAL**, default `1.0` —
  ver "Correcciones de implementación" de ADR-040), `gtin_barcode` (nullable, único
  cuando no es null), `es_default`, `activo`, `sin_confirmar`, sync.
  *Índices únicos parciales sólo en la migración SQL: uno por `gtin_barcode` no nulo y uno
  de `producto_id WHERE es_default = 1`.* Sin auditoría.
- **`unidad`** (catálogo, ADR-041): `id`, `nombre`, `abreviatura` (única), `activo`,
  auditoría, sync.
- **`existencias`** (saldo por producto): `id`, `producto_id` (FK única), `stock_fisico`
  (REAL), `stock_reservado` / `stock_en_transito` (nullable, **sin uso** — ADR-033),
  `stock_minimo`, `stock_maximo`, `ultima_fecha_movimiento`, sync. Sin `activo` ni
  auditoría. *`stock_disponible` es calculado, no columna.*
- **`movimiento_stock`** (inmutable): `id`, `producto_id`, `tipo`
  (`entrada`|`salida`|`ajuste`|`transferencia`), `motivo` (`venta`|`recepcion_compra`|
  `devolucion`|`ajuste_conteo`|`merma_rotura`|`inicial`|`entrada_manual`), `cantidad`,
  `stock_resultante`, `costo_unitario`, `referencia_tipo`, `referencia_id`,
  `ubicacion_id`, `usuario_id`, `fecha`, `observaciones`, sync.
- **`categoria`** (autorreferenciada, N niveles): `id`, `categoria_padre_id` (null = raíz),
  `nombre`, `descripcion`, `activo`, auditoría, sync.
- **`marca`**: `id`, `nombre` (único), `descripcion`, `activo`, auditoría, sync.
- **`impuesto`** (solo IVA): `id`, `nombre`, `tipo` (`iva`|`exento`|`no_gravado`),
  `alicuota`, `codigo_arca` (R2), `predeterminado`, `activo`, auditoría, sync.
- **`ubicacion`**: `id`, `codigo` (único), `sector`, `estante`, `posicion` (los tres
  obligatorios), `descripcion`, `activo`, auditoría, sync. Unicidad adicional sobre
  (`sector`,`estante`,`posicion`). Sin QR.

### Personas (`schema/personas.ts` — 2 tablas)

- **`cliente`**: `id`, `tipo_documento` (`DNI`|`CUIT`|`CUIL`), `numero_documento`,
  `nombre` + `apellido` (ambos NOT NULL — ADR-050, reemplazan a `razon_social`),
  `nombre_fantasia`, `condicion_fiscal` (`Responsable Inscripto`|
  `Monotributo`|`Consumidor Final`|`Exento`), domicilio desglosado (`domicilio`, `calle`,
  `numero`, `aclaracion`, `codigo_postal`), `localidad_id` (FK → `localidad`) **y**
  `localidad`/`provincia` como texto libre —convivencia deliberada, ADR-024—, `telefono`,
  `telefono_adicional`, `email`, `habilita_cuenta_corriente`, `lista_precio_id`, `activo`,
  auditoría, sync.
  *`lista_precio_id` se asigna desde `ClienteForm` (selector "(Predeterminada)"=null) y se ve en
  `ClienteDetalle`; lo persiste `clienteUpsertHandler` y lo consume el motor de precios vía
  `resolverListaEfectiva` (ADR-083 — antes la columna existía pero no había UI de asignación).
  Cliente fijo "Consumidor Final" sembrado (`nombre`="Consumidor", `apellido`="Final").
  El límite de crédito vive en `cuenta_corriente_cliente`. Nombre para mostrar: siempre
  vía `nombreCompletoCliente()` de `@ferreteria/shared`, nunca concatenar a mano — filas
  migradas desde `razon_social` sin apellido real quedan con el placeholder
  `"(revisar)"` en `apellido` (ADR-050).*
- **`proveedor`**: mismos campos de identidad y domicilio que `cliente` **salvo
  identidad** — conserva `razon_social` (columna única, no se tocó por ADR-050), más
  `persona_contacto`, `observaciones` y `codigo` (único). Sin `lista_precio_id` ni
  `habilita_cuenta_corriente`.

### Geografía (`schema/geo.ts` — 3 tablas, ADR-024)

Catálogo de solo lectura sembrado por `scripts/seed-geo.cjs`. **Sin sync, sin auditoría,
sin `activo`** — es dato de referencia, no dato de usuario.

- **`provincia`**: `id`, `nombre`, `nombre_norm`.
- **`departamento`**: `id`, `nombre`, `nombre_norm`, `provincia_id`.
- **`localidad`**: `id`, `nombre`, `nombre_norm`, `provincia_id`, `departamento_id`,
  `codigo_postal`.

### Ventas (`schema/ventas.ts` — 6 tablas)

- **`venta`**: `id`, `numero_interno` (`V-C1-000001`, único), `fecha`, `cliente_id`,
  `usuario_id`, `caja_id`, `subtotal`, `descuento_global`, `importe_iva`, `total`
  (redondeado), `ajuste_redondeo`, `vuelto_centavos`, `forma_pago`, `estado`, `alias`,
  `en_espera_desde`, `turno_creacion_id`, `comprobante_id`, `presupuesto_id`,
  `observaciones`, auditoría, sync.
  - `estado`: `borrador`|`confirmada`|`anulada`|**`en_espera`**|**`descartada`**
    (ADR-033). **Todo punto de lectura debe filtrar explícitamente**: una venta
    `en_espera` no impacta caja ni stock y no debe aparecer en reportes.
  - `forma_pago` (`efectivo`|`cuenta_corriente`|`transferencia`|`tarjeta`) es **campo
    legado solo-lectura**: se deriva del primer medio de `venta_pago` al confirmar
    (`cheque` mapea a `efectivo`). **No es el modelo de pago** — ese es `venta_pago`.
    La migración del histórico es decisión abierta en ADR-032.
  - `presupuesto_id` se completa al convertir (ADR-046). Es TEXT sin `.references()` en
    Drizzle para romper la circularidad; la FK real está en la migración 0025.
- **`venta_detalle`**: `id`, `venta_id`, `producto_id`, `descripcion` (snapshot),
  `cantidad`, `precio_unitario` (snapshot), `descuento_linea`, `alicuota_iva` (snapshot),
  `subtotal`, `presentacion_id` (nullable — ventas previas a ADR-040),
  `factor_a_stock_aplicado` (nullable, REAL), sync.
  *`cantidad` está en unidades de **presentación**, no de stock. El descuento de stock es
  `cantidad × factor_a_stock_aplicado`, sin dividir.*
- **`venta_pago`** (ADR-032; **N filas por venta** — éste es el modelo de pago real):
  `id`, `venta_id`, `medio_pago` (`efectivo`|`tarjeta`|`cuenta_corriente`|`transferencia`|
  `cheque`), `monto_centavos`, `recargo_pct`, `recargo_centavos`, y para cheque
  `numero_cheque`/`banco`/`fecha_cheque`/`titular_cheque`, sync.
  *El recargo de tarjeta **nunca** infla `venta.total`; es un KPI aparte.*
- **`caja`** (turno): `id`, `usuario_id`, `fecha_apertura`, `fecha_cierre`,
  `monto_inicial`, `monto_esperado`, `monto_contado`, `diferencia`, `estado`
  (`abierta`|`cerrada`), `observaciones`, `usuario_cierre_id`,
  `supervisor_autorizacion_id`, sync. Montos en **pesos** (REAL).
- **`movimiento_caja`**: `id`, `caja_id`, `tipo` (`ingreso`|`egreso`), `motivo` (`venta`|
  `cobro_cta_cte`|`pago_proveedor`|`retiro`|`aporte`|`gasto`|`ajuste`), `monto`,
  `forma_pago`, `referencia_tipo`, `referencia_id`, `usuario_id`, `fecha`,
  `observaciones`, sync. *Registra todos los medios de pago; el arqueo cuenta solo
  efectivo.*
- **`comprobante`**: `id`, `venta_id` (TEXT sin FK, para romper la circularidad
  venta↔comprobante), `tipo` (`ticket_interno`|`factura_a`|`factura_b`|`factura_c`|
  `nota_credito`|`nota_debito`), `punto_venta`, `numero`, `fecha_emision`, `cae`,
  `cae_vencimiento`, `condicion_fiscal_emisor`, `condicion_fiscal_receptor`,
  `importe_neto`, `importe_iva`, `importe_total`, `estado` (`pendiente_cae`|`autorizado`|
  `rechazado`|`anulado`), `comprobante_referencia_id`, sync.
  *Hoy se usa **solo** para `ticket_interno`. Los campos fiscales están reservados para R2
  (ARCA); ADR-013 sigue Propuesto — no cerrarlo escribiendo código.*

### Precios (`schema/precios.ts` — 6 tablas, ADR-034)

- **`lista_precio`**: `id`, `nombre` (único), `descripcion`, `tipo`
  (`general`|`especial`), `ajuste_porcentual`, `predeterminada`, `vigencia_desde`,
  `vigencia_hasta`, `activo`, auditoría, sync.
- **`lista_precio_valor`** (**el motor**; historial SCD tipo 2 de precios absolutos):
  `id`, `lista_precio_id`, `producto_id`, `precio_centavos`, `fecha_desde`, `fecha_hasta`
  (null = vigente), `origen` (`manual`|`recalculo`|`importacion`), `recalculo_masivo_id`,
  `presentacion_id` (nullable por histórico; NOT NULL exigido en handlers — ADR-040),
  `usuario_id`, sync. *Índice único parcial `WHERE fecha_hasta IS NULL` sólo en la
  migración.*
- **`promocion`**: precio temporal que **pisa** a `lista_precio_valor` mientras está
  activa: `id`, `lista_precio_id`, `producto_id`, `precio_centavos`, `fecha_desde`,
  `fecha_hasta` (ambas NOT NULL), `descripcion`, `activo`, auditoría, sync.
- **`recalculo_masivo`** (registro inmutable de cada ejecución): `id`, `lista_precio_id`,
  `porcentaje`, `base_calculo` (`costo_proveedor`|`precio_lista`|`lista`|`manual`),
  `base_lista_id`, `base_valor_centavos`, `alcance` (`catalogo`|`rubro`|`marca`|
  `proveedor`|`lista`), `alcance_id`, `excluir_manuales_dias`, `productos_afectados`,
  `estado` (`aplicado`|`error`), `usuario_id`, `fecha_ejecucion`, `observaciones`, sync.
- **`cambio_programado`**: mismo cuerpo que `recalculo_masivo` más `fecha_aplicacion` y
  `estado` (`pendiente`|`aplicado`|`cancelado`) + `recalculo_masivo_id` una vez ejecutado.
  Lo dispara `main/scheduler/precios.ts`.
- **`lista_precio_detalle`** — ⚠️ **residual de pre-ADR-034, tabla inerte**: `id`,
  `lista_precio_id`, `producto_id`, `ajuste_porcentual`, sync. El modelo anterior era "% por
  producto sobre la lista"; hoy el precio es absoluto y vive en `lista_precio_valor`.
  **ADR-081 retiró su superficie IPC** (handler `lista-precio-detalle.ts`, registro en
  `main/index.ts`, namespace `precios.detalle.*` de preload y sus tests): ya no hay ruta de
  escritura. La tabla y sus migraciones **se conservan** (no se dropea ni se reescribe
  historia). No tiene consumidor de UI; queda como columna muerta.

### Cuenta corriente de clientes (`schema/credito.ts` — 2 tablas, R3)

- **`cuenta_corriente_cliente`**: `id`, `cliente_id` (FK única), **`saldo_centavos`**
  (+ = el cliente debe), **`limite_credito_centavos`**, `fecha_ultimo_movimiento`,
  `activo`, sync.
- **`movimiento_cuenta_corriente`** (inmutable): `id`, `cuenta_id`, `tipo`
  (`cargo`|`pago`), `motivo` (`venta_credito`|`cobro`|`nota_credito`|`nota_debito`|
  `ajuste`|`saldo_inicial`), **`monto_centavos`** (siempre positivo),
  **`saldo_resultante_centavos`**, `referencia_tipo`, `referencia_id`, `usuario_id`,
  `fecha`, `observaciones`, sync.

> **No existe cuenta corriente de proveedores.** ADR-019 la difirió; no hay
> `cuenta_corriente_proveedor` ni su libro de movimientos, y el tab Proveedores del
> dashboard omite el KPI de deuda a propósito (ADR-038 §4).

### Compras (`schema/compras.ts` — 9 tablas, R3)

- **`orden_compra`**: `id`, `numero_interno` (`OC-C1-000001`, único), `proveedor_id`,
  `tipo` (`manual`|`sugerida`), `estado` (`borrador`|`emitida`|`recibida_parcial`|
  `recibida_total`|`cerrada`|`anulada`), `fecha`, `fecha_entrega_estimada`,
  `subtotal_centavos`, `importe_iva_centavos`, `total_centavos`, `usuario_id`,
  `observaciones`, auditoría, sync.
- **`item_oc`** (línea de OC — **se llama `item_oc`, no `orden_compra_detalle`**): `id`,
  `orden_compra_id`, `producto_id`, `descripcion` (snapshot), `cantidad_pedida`,
  `cantidad_recibida` (acumulado), `costo_unitario_centavos` (congelado al emitir),
  `alicuota_iva` (snapshot), `subtotal_centavos`, sync.
- **`recepcion`**: `id`, `orden_compra_id`, `fecha`, `usuario_id`, `remito_proveedor`,
  `observaciones`, sync.
- **`recepcion_detalle`**: `id`, `recepcion_id`, **`item_oc_id`**, `cantidad_recibida`,
  `costo_unitario_real_centavos` (nullable = el operador no modificó el costo), sync.
- **`comprobante_compra`**: `id`, `recepcion_id` (TEXT sin FK; puede registrarse sin
  recepción previa), `proveedor_id`, `tipo` (`factura_a`|`factura_b`|`factura_c`|
  `nota_credito`|`nota_debito`), `punto_venta`, `numero`, `fecha_emision`,
  `importe_neto_centavos`, `importe_iva_centavos`, `importe_total_centavos`, `estado`
  (`pendiente`|`registrado`|`anulado`), `observaciones`, sync.
- **`producto_proveedor`** (ADR-036; N:M producto↔proveedor con costo): `id`,
  `producto_id`, `proveedor_id`, `costo_centavos`, `codigo_proveedor`, `preferido`,
  `deleted_at` (**soft-delete por timestamp, no por `activo`** — excepción al patrón),
  `usuario_creacion_id`, `fecha_creacion`, sync. Unicidad en la migración:
  (`producto_id`,`proveedor_id`) y un único preferido activo por producto.
- **`importacion_costo_proveedor`** (ADR-035): `id`, `proveedor_id`, `nombre_archivo`,
  `fecha_importacion`, `filas_totales`, `filas_matcheadas`, `filas_sin_match`, `estado`
  (`pendiente`|`confirmado`|`cancelado`), `usuario_id`, `observaciones`, sync.
- **`importacion_costo_proveedor_detalle`**: `id`, `importacion_id`, `producto_id`
  (nullable = fila sin matchear), `costo_anterior_centavos`, `costo_nuevo_centavos`,
  `fila_original`, `estado` (`matched`|`sin_matchear`|`resuelto_manual`|`descartado`),
  `matched_by` (`codigo_proveedor`|`gtin`|`manual`), `resuelto_por_usuario_id`,
  `fecha_resolucion`, sync.
- **`proveedor_importacion_config`** (mapeo de columnas, 1:1 con proveedor): `id`,
  `proveedor_id`, `formato_archivo` (`csv`|`xlsx`), `delimitador`, `fila_encabezado`,
  `columna_costo`, `columna_codigo_proveedor`, `columna_gtin`, `usuario_creacion_id`,
  `fecha_creacion`, sync.

### Remitos (`schema/remitos.ts` — 3 tablas, ADR-045)

Documento de entrega **interno**. No mueve stock ni caja: solo lee de
`venta`/`venta_detalle`/`comprobante`/`cliente`/`producto`/`transportista`.

- **`transportista`** (catálogo, iteración 2): `id`, `razon_social`, `telefono`, `email`,
  `persona_contacto`, `domicilio`, `observaciones`, `activo`, auditoría, sync. *Sin campos
  fiscales: no le factura a la ferretería.*
- **`remito`**: `id`, `numero_secuencial` + `numero` (único; **se asignan al emitir, nunca
  antes**), `venta_id`, `comprobante_id` (informativo), `estado`
  (`emitido`|`conformado`|`anulado`), `fecha_emision`, `fecha_entrega`, `recibido_por`,
  `domicilio_entrega` (snapshot), `transportista_id` + `transportista` (snapshot del
  nombre), `observaciones`, `anulado_en`/`anulado_por_usuario_id`/`motivo_anulacion`,
  `activo`, `creado_por_usuario_id`, `creado_en`, sync.
  *Transiciones: `emitido → conformado`, `emitido → anulado` y también
  `conformado → anulado`. Un remito anulado no admite ninguna transición.*
- **`remito_linea`**: `id`, `remito_id`, `venta_detalle_id`, `cantidad_entregada` (misma
  unidad que `venta_detalle.cantidad`, es decir de presentación), `producto_id`,
  `descripcion`, `unidad`, sync. **Sin importes**, a propósito.

### Presupuestos (`schema/presupuestos.ts` — 2 tablas, ADR-046)

- **`presupuesto`**: `id`, `numero_secuencial` + `numero` (único; **null hasta emitir**),
  `cliente_id` (null = consumidor final), `estado` (`borrador`|`emitido`|`vencido`|
  `convertido`|`anulado`), `fecha_emision`, `validez_dias`, `fecha_validez`,
  `descuento_global_pct`, `total_centavos`, `usuario_id`, `venta_id` (se completa al
  convertir), `observaciones`, `activo`, `creado_por_usuario_id`, `creado_en`, sync.
- **`presupuesto_detalle`**: `id`, `presupuesto_id`, `producto_id`, `descripcion`
  (snapshot), `cantidad`, `precio_unitario_centavos` (**null = precio sin congelar**; se
  congela al emitir con el motor), `descuento_linea_pct`, `alicuota_iva`,
  `subtotal_centavos`, `presentacion_id`, sync.

### Agenda y avisos (`schema/agenda.ts` — 3 tablas, ADR-047/048)

Módulo detrás del flag `agenda_habilitado`. Tres capas: 1 `rutina` → N `agenda_evento` →
N `aviso`.

- **`rutina`** (generador recurrente opcional): `id`, `nombre`, `descripcion`,
  `frecuencia_tipo` (`unica`|`diaria`|`semanal`|`mensual`|`cada_n_dias`), `intervalo`,
  `dia_semana` (0=domingo), `dia_mes` (31 → clamp al último día), `hora` (`"HH:MM"`),
  `fecha_inicio`, `fecha_fin`, `proximo_disparo` (null = agotada),
  `destinatario_tipo` (`usuario`|`rol`) + `destinatario_usuario_id`/`destinatario_rol`,
  `canal_in_app`, `canal_email`, `activa` (**pausa**, distinta de `activo` = baja lógica),
  `origen_sistema`, `activo`, auditoría, sync.
- **`agenda_evento`** (accionable): `id`, `origen` (`rutina`|`manual`|`orden_compra`|
  `recepcion`|`bajo_minimo`|`cierre_caja`), `rutina_id`, `titulo`, `descripcion`, `fecha`,
  `estado` (`pendiente`|`completada`|`pospuesta`|`descartada`), `completado_at`,
  `completado_por`, `pospuesto_para`, `nota`, snapshot de destinatario y canales, FKs
  nullable de dominio (`proveedor_id`, `orden_compra_id`, `producto_id`), `activo`,
  auditoría, sync.
- **`aviso`** (outbox de entrega): `id`, `agenda_evento_id`, `origen_tipo`, `origen_id`
  (referencia blanda, sin FK), `canal` (`in_app`|`email`|`whatsapp`),
  `destinatario_usuario_id`, `destinatario_contacto` (email congelado al emitir),
  `payload` (JSON snapshot), `estado` (`pendiente`|`enviado`|`fallido`|`descartado`),
  `severidad` (`normal`|`alerta`), `intentos`, `ultimo_error`, `proximo_intento_at`
  (backoff), `dedupe_clave` (único; los NULL no colisionan), `generado_at`, `enviado_at`.
  **No sincroniza y no tiene `activo` ni auditoría**: es estado operativo local por
  terminal (ADR-047 §10).

### Seguridad (`schema/seguridad.ts` — 5 tablas)

- **`usuario`**: `id`, `nombre_usuario` (único), `nombre_completo`, **`hash_password`**
  (scrypt de `node:crypto`), `rol_id`, `email`, `activo`, `ultimo_acceso`, auditoría,
  sync.
  *No existe `pin_rapido`: ADR-027 eliminó el PIN. La columna `email` existe desde la
  migración 0001.*
- **`rol`**: `id`, `nombre` (único), `descripcion`, `es_sistema`, `activo`, sync.
- **`permiso`**: `id`, `codigo` (único), `descripcion`, `modulo`, sync.
- **`rol_permiso`**: `id`, `rol_id`, `permiso_id`, sync.
- **`usuario_preferencias`** (1:1 con usuario): `id`, `usuario_id` (FK única), `tema`
  (`claro`|`oscuro`), `acento` (`amber`|`blue`|`green`|`violet`|`brick`), `ui_font`
  (`Hanken Grotesk`|`Figtree`|`Onest`), `densidad` (`comfortable`|`compact`),
  `skin` (`actual`|`maximizar`|`confortable`, default `actual` — ADR-086), sync.
  *La fuente de los números no es configurable (siempre monoespaciada). El **Modo** (`skin`)
  reemplazó al control de Densidad en la UI: el Tema manda el color y el Modo la geometría
  (espaciado, radios, sombra, ancho de sidebar, nav y tabla, vía bloques `[data-skin]` en
  `global.css`). `densidad` se conserva pero se **deriva** del modo al aplicar al DOM
  (`maximizar`→`compact`, resto→`comfortable`) en `AuthContext.applyPreferences` y
  `AppearanceDrawer.applyToDOM`.*

### Configuración (`schema/config.ts` — 1 tabla)

- **`parametros_sistema`**: **clave-valor, no sigue ningún patrón transversal.**
  `clave` (TEXT PK), `valor` (TEXT), `tipo` (`number`|`string`|`bool`), `descripcion`,
  `actualizado_en`, `actualizado_por`. Sin `id` UUID, sin sync, sin `activo`.
  Guarda los contadores correlativos (`sku_proximo_secuencial`,
  `remito_proximo_secuencial`, `presupuesto_proximo_secuencial`), los feature flags
  (`*_habilitado`, default `false` — ADR-042/044), los umbrales del negocio y la config
  SMTP.
  ⚠️ **La contraseña SMTP NO vive acá**: va en `safeStorage` del sistema operativo, fuera
  de la BD y fuera del backup (ADR-048 §6, `seguridad/smtp-secret.ts`). Mismo tratamiento
  que tendrán los certificados de ARCA.


## 8. Matriz RBAC

Leyenda: ✔ permitido · ✱ con autorización del Supervisor · — no permitido.

| Caso de uso | Operador | Supervisor |
|-------------|:--------:|:----------:|
| Operar POS / vender | ✔ | ✔ |
| Abrir/cerrar caja | ✔ (la suya) | ✔ (cualquiera) |
| Cerrar caja con diferencia > umbral | ✱ | ✔ |
| Retiros / gastos de caja | ✔ | ✔ |
| Alta/edición de producto, ubicaciones, etiquetas QR | ✔ | ✔ |
| Entrada/ajuste de stock | ✔ | ✔ |
| Localización de producto | ✔ | ✔ |
| Recepción de compra | ✔ | ✔ |
| Sobre-recepción | ✱ | ✔ |
| Venta a cuenta corriente sobre el límite | ✱ | ✔ |
| Cobro de cuenta corriente (cliente) | ✔ | ✔ |
| Pago a proveedor | — | ✔ |
| Override de precio en venta | — | ✔ |
| Anulación de venta | — | ✔ |
| Gestión de proveedores / OC | — | ✔ |
| Configuración fiscal, precios, listas | — | ✔ |
| Importación masiva | — | ✔ |
| Dashboard / reportes | — | ✔ |
| Administración de usuarios | — | ✔ |
| Emitir / anular remito · gestionar transportistas | ✔ | ✔ |
| Crear / emitir / anular presupuesto | ✔ | ✔ |
| Backup: crear y restaurar | — | ✔ |
| Exportar (básico / supervisor) | ✔ básico | ✔ ambos |

> La **Agenda** (ADR-047/048) todavía no tiene fila: sus 13 canales IPC
> (`rutina:*`/`agenda:*`/`aviso:*`) exigen sesión pero **ningún permiso**. ADR-047 no los
> definió; es la única familia de IPC de escritura sin código de permiso. Decisión
> pendiente, no incumplimiento.

### Permisos reales

**Fuente de verdad: `PERMISOS` y `OPERADOR_PERMISOS` en `apps/retail/src/main/auth/seed.ts`.**
Son **28 permisos**, **17 de ellos al Operador**. El Supervisor los tiene todos.

> **Desde ADR-092 (Elaborados E1), el seed de permisos está partido core + app.**
> `runSeed(db, opts: { permisos, operador })` (`@core/main`) siembra primero `PERMISOS_CORE` (12
> permisos universales — ventas, caja, cta-cte, dashboard, admin, export) y `OPERADOR_PERMISOS_CORE`,
> y les suma `[...opts.permisos]`/`[...opts.operador]` deduplicando por `codigo`. Retail delega:
> `runSeed(db) { runSeedCore(db, { permisos: PERMISOS, operador: [...OPERADOR_PERMISOS] }) }`, y la
> tabla de abajo (los 28 de Retail) **ya incluye** los 12 del core — no son una lista aparte. Cada
> app nueva pasa su propia lista de permisos de dominio; si no tiene ninguno todavía, `{ permisos: [],
> operador: [] }` alcanza (caso de Elaborados en E1). **Al agregar un permiso universal** (lo
> necesitan o lo necesitarán todas las apps) va a `PERMISOS_CORE`/`OPERADOR_PERMISOS_CORE`
> (`packages/core-main/src/auth/permisos-core.ts`); si es específico de una app, a su propio
> `PERMISOS` local, igual que antes.

| Módulo | Permiso | Operador |
|--------|---------|:--------:|
| `ventas` | `venta.crear` | ✔ |
| `ventas` | `venta.anular` | — |
| `ventas` | `precio.override` | — |
| `caja` | `caja.operar` | ✔ |
| `stock` | `stock.entrada` | ✔ |
| `stock` | `stock.ajustar` | ✔ |
| `catalogo` | `producto.crear` | ✔ |
| `catalogo` | `producto.editar` | ✔ |
| `catalogo` | `producto.consultar` | ✔ |
| `compras` | `compra.recibir` | ✔ |
| `compras` | `proveedor.pagar` | — |
| `compras` | `proveedor.gestionar` | — |
| `cuentas` | `ctacte.cobrar` | ✔ |
| `export` | `export.basico` | ✔ |
| `export` | `export.supervisor` | — |
| `remitos` | `remito.crear` | ✔ |
| `remitos` | `remito.conformar` | ✔ |
| `remitos` | `remito.anular` | ✔ |
| `remitos` | `transportista.gestionar` | ✔ |
| `presupuestos` | `presupuesto.crear` | ✔ |
| `presupuestos` | `presupuesto.emitir` | ✔ |
| `presupuestos` | `presupuesto.anular` | ✔ |
| `reportes` | `dashboard.ver` | — |
| `admin` | `import.masiva` | — |
| `admin` | `usuario.administrar` | — |
| `admin` | `config.fiscal` | — |
| `admin` | `backup.crear` | — |
| `admin` | `backup.restaurar` | — |

Los 16 primeros son el seed de R1. Después se sumaron: `export.basico`,
`export.supervisor`, `proveedor.gestionar`, `backup.crear`, `backup.restaurar`; ADR-045
agregó `remito.crear`/`remito.conformar`/`remito.anular` y, en su iteración 2,
`transportista.gestionar`; ADR-046 agregó `presupuesto.crear`/`emitir`/`anular`. Los ocho
de remitos y presupuestos van a **ambos** roles por decisión de producto: son operaciones
de mostrador. Existen granulares para poder restringir la anulación más adelante sin
refactor. La conversión de presupuesto a venta la gatea `venta.crear`.

> **Al agregar un permiso:** sumarlo a `PERMISOS` en `src/main/auth/seed.ts` (y a
> `OPERADOR_PERMISOS` si corresponde). `runSeed` corre en cada arranque y es aditivo, así
> que llega también a instalaciones ya inicializadas. Ojo: hay tests que afirman el
> **conteo exacto** de permisos por rol (`auth/__tests__/seed.test.ts`,
> `ipc/__tests__/auth.ipc.test.ts`) — hay que actualizar esos números.

## 9. Releases (ADR-011) — construir en este orden

- **R1** núcleo local · **R2** fiscal · **R3** compras y crédito · **R4** nube + sync ·
  **R5** reportes consolidados y preparación multi-sucursal.

**Mapa de versiones vigente (ADR-044, corrige a ADR-042):** `1.0.x` = R1+R3
(ya integrado) · `1.1.0` = **Remitos + Presupuestos + Agenda operativa/outbox de avisos
(ADR-047 Lote 1)** (features nuevas, sin ARCA ni nube — en cola, cada una con su propio
ADR/diseño; Remitos primero) · `1.2.0` = fiscal
ARCA (R2) · `2.0.0` = R4 nube · `2.x` = R5. Toda feature nueva va a `main`/feature
branch detrás de flag en `parametros_sistema` (default `false`), migraciones
aditivas/retrocompatibles (ver ADR-042).

## 10. Fuera de alcance (no implementar)

E-commerce/tienda online · aplicación o captura móvil · multi-sucursal operativo ·
controlador fiscal de hardware · contabilidad/RRHH/sueldos · comprobante de compra del
proveedor · reposición/pedido automático a proveedores · integración con medios de pago
electrónicos.

## 11. Decisiones abiertas (no cerrar sin confirmación)

- **ADR-013** ubicación de la integración fiscal cliente/nube (R2).

> Cerradas: ADR-012 (conflictos: last-write-wins + log), ADR-014 (unidades: venta/compra +
> factor de conversión), ADR-015 (impresión: etiquetadora y A4, configurable),
> ADR-016 (Drizzle + pnpm workspaces).

## 12. Disciplina de trabajo

- Flujo superpowers: **brainstorm → plan (escrito y revisado) → TDD (RED-GREEN-REFACTOR)
  → verificación.** No escribir producción sin test que la cubra.
- No introducir dependencias pesadas sin justificar.
- No implementar nada de la sección 10.
- Ante un ADR abierto, **proponer opciones y esperar confirmación**.
- Cada fase termina **desplegable**, en verde y sin romper las anteriores.
- **La suite en verde no prueba que una feature sea alcanzable.** Todo cambio con
  superficie de UI se cierra abriendo la app (`pnpm dev`) y llegando a la pantalla
  *navegando como lo haría el usuario* — no basta con que exista la ruta ni con que los
  tests del componente pasen. Ver §Navegación: un componente huérfano tiene tests verdes
  y cero efecto.
- **Al planificar, verificá el punto de integración antes de escribirlo en el plan.** Si
  el plan dice "agregar X en el archivo Y", confirmá que `Y` es el archivo que realmente
  se usa. Un plan que apunta al archivo equivocado se ejecuta prolijamente y no funciona.

---

## 13. Auditoría de mejoras UX / Seguridad (backlog vigente)

Hay una auditoría de mejoras priorizadas (carga de productos/precios, manejo de errores,
búsqueda, navegación, perfil y seguridad) con su backlog y plan de ejecución por fases:

- `docs/prompts-fases-mejoras-ux.md` — prompts autónomos por fase (Fase 1/2/3) para ejecutar
  cada tanda en una sesión limpia con el flujo superpowers.
- `docs/research-ux-best-practices.md` — buenas prácticas de la industria y fuentes que
  respaldan cada mejora (errores de formulario, importación de datos, paleta Ctrl+K, patrones POS).

Al retomar cualquiera de esas mejoras, empezar por esos dos archivos.
