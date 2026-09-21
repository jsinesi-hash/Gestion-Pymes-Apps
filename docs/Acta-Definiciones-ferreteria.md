# Acta de Definiciones — Software de Gestión de Ferretería

> **Documento de respaldo.** Consolida todas las definiciones de modelo de datos y procesos acordadas en las sesiones de trabajo. No reemplaza al PRD ni al Tech Spec (que aún no se actualizaron); es la fuente de verdad de las decisiones para volcarlas luego a esos documentos.
>
> Versión del acta: 1.0 · Fecha: Junio 2026 · Estado: definiciones en curso (faltan procesos y transversales al final).

---

## 1. Decisiones de alcance (cambios respecto de la versión original del PRD/Tech Spec)

1. **Se elimina toda la parte mobile / PWA.** Se reemplaza por un **lector inalámbrico 1D/2D** (HID) que lee EAN/UPC y QR, usable en POS y depósito, y funciona offline. Esto elimina los riesgos de dependencia de conexión de la PWA, soporte de cámara en iOS y librería de escaneo.
2. **Doble código con roles separados:**
   - **EAN/UPC del fabricante (`gtin_barcode`)**: opcional, se usa en la **entrada** (alta de producto y entrada/recepción de stock).
   - **QR generado por el sistema (`codigo_qr`)**: único por producto, identifica el ítem; se usa en **inventario y localización**.
3. **Un único QR por producto.** La **ubicación es un atributo del producto** (FK a catálogo `Ubicacion`), no una entidad con QR propio. Se descartó la relación N:M producto↔ubicación. **Cada producto tiene una sola ubicación.**
4. **Estantes con ubicaciones pre-impresas y fijas** (cartelería estática, no la imprime el sistema).
5. **Etiqueta de producto: solo el QR**, en tres tamaños seleccionables: **chico 5×5 cm, mediano 10×10 cm, grande 15×15 cm**. Formato de impresión (adhesiva vs. A4) queda como decisión abierta.
6. **Solo IVA** como impuesto (sin percepciones de IIBB ni otros, por ahora).
7. **Sin comprobante de compra**: la OC + recepción alcanzan (la recepción genera la deuda con el proveedor).
8. **Roles unificados a dos**: **Operador** (Cajero/Vendedor + Encargado de depósito) y **Supervisor**.
9. **Adaptación a Argentina**: CUIT/CUIL/DNI, condición fiscal ARCA, IVA 21/10,5/27/exento, moneda ARS.
10. **Diferidos a futuro (no descartados)**: e-commerce (slug, imágenes, web), envíos (peso, dimensiones), multi-sucursal operativo.

---

## 2. Modelo de datos

### 2.1 Patrones transversales (aplican a todas las tablas salvo indicación)

- **Campos de sincronización offline-first**: `version`, `origin_id`, `sync_state` en todas las tablas.
- **IDs**: `UUID` generados en cliente (evita colisiones al sincronizar).
- **Baja lógica**: campo `activo` (no se borra físicamente).
- **Auditoría**: `usuario_creacion_id` / `fecha_creacion` y, en entidades editables, `usuario_modificacion` / `fecha_actualizacion`.
- **Patrón saldo + libro de movimientos inmutable** con campo `*_resultante` (foto histórica): aplicado a stock, caja, cuenta corriente de clientes y de proveedores.
- **Snapshots** en las líneas de venta y de compra (descripción, precio/costo, alícuota al momento de la operación).

### 2.2 Catálogo y stock

#### Producto (datos maestros)
- `id` UUID · `sku` (autogenerado, **correlativo simple** 00001…, editable) · `codigo_qr` (único) · `gtin_barcode` (VARCHAR nullable, **uno solo** por producto)
- `nombre_corto` · `nombre_largo` · `descripcion_tecnica`
- `unidad_venta` (stock/venta) · `unidad_compra` · `factor_conversion` (unidad_venta por unidad_compra, default 1) · `permite_fraccion` (BOOLEAN, venta a granel)
- `precio_costo_promedio` · `precio_venta_lista` (**con IVA incluido**) · `margen_ganancia` (calculado, no almacenado) · `impuesto_id` (FK) · `moneda` (ARS por defecto)
- `categoria_id` (FK única; la subcategoría es una categoría con padre) · `marca_id` (FK) · `producto_padre_id` (FK nullable, variantes) · `garantia_meses`
- `ubicacion_id` (FK → Ubicacion, **una sola**)
- `activo` · auditoría · sync
- **Stock NO vive acá** (va en Existencias). **`limite_credito` NO vive acá** (va en CuentaCorriente).
- **Diferidos**: `slug`, `imagenes`, `peso_kg`, `dimensiones`.

#### Ubicacion (catálogo cerrado)
- `id` UUID · `codigo` (único, coincide con el cartel físico, ej. `A-04-22`)
- `sector`, `estante`, `posicion` — **los tres obligatorios**
- `descripcion` (opcional) · `activo` · auditoría · sync
- Unicidad sobre `codigo` y sobre (`sector`, `estante`, `posicion`). **Sin QR** (la ubicación no se escanea).

#### Existencias (saldo por producto)
- `id` UUID · `producto_id` (FK única, 1 fila por producto)
- `stock_fisico` (DECIMAL, admite fracción) · `stock_reservado` (**nullable**, a futuro) · `stock_en_transito` (**nullable**, a futuro)
- `stock_disponible` (calculado = físico − reservado) · `stock_minimo` · `stock_maximo` (opt, usado por la reposición sugerida)
- `ultima_fecha_movimiento` · sync
- **`punto_reposicion` eliminado** (se decidió un solo umbral: `stock_minimo`).

#### MovimientoStock (libro inmutable)
- `id` UUID · `producto_id` (FK)
- `tipo` ENUM: `entrada` / `salida` / `ajuste` / `transferencia`
- `motivo` ENUM: `venta` / `recepcion_compra` / `devolucion` / `ajuste_conteo` / `merma_rotura` / `inicial`
- `cantidad` · `stock_resultante` (foto histórica) · `costo_unitario` (opt)
- `referencia_tipo` · `referencia_id` (documento origen) · `ubicacion_id` (opt) · `usuario_id` · `fecha` · `observaciones` · sync

#### Categoria (autorreferenciada, N niveles — Opción B)
- `id` UUID · `categoria_padre_id` (FK nullable; null = raíz) · `nombre` (único dentro del padre) · `descripcion` · `activo` · auditoría · sync

#### Marca
- `id` UUID · `nombre` (único) · `descripcion` · `activo` · auditoría · sync

#### Impuesto (solo IVA)
- `id` UUID · `nombre` · `tipo` ENUM (`iva` / `exento` / `no_gravado`) · `alicuota` (DECIMAL) · `codigo_arca` (para R2) · `activo` · `predeterminado` (BOOLEAN, default 21%) · auditoría · sync

### 2.3 Personas

#### Cliente
- `id` UUID · `tipo_documento` ENUM (`DNI`/`CUIT`/`CUIL`) · `numero_documento` · `razon_social` · `nombre_fantasia` (opt)
- `condicion_fiscal` ENUM (`Responsable Inscripto` / `Monotributo` / `Consumidor Final` / `Exento`) — define el comprobante
- `domicilio` · `localidad` · `provincia` · `codigo_postal` · `telefono` · `email` (todos opt)
- `habilita_cuenta_corriente` (BOOLEAN) · `lista_precio_id` (FK opt) · `activo` · auditoría · sync
- **`limite_credito` movido a CuentaCorriente.**
- **Cliente fijo "Consumidor Final"** por defecto para ventas anónimas de mostrador.

#### Proveedor
- `id` UUID · `tipo_documento` · `numero_documento` · `razon_social` · `nombre_fantasia` (opt) · `condicion_fiscal`
- domicilio/localidad/provincia/CP (opt) · `telefono`/`email` (opt) · `persona_contacto` (opt) · `observaciones` (opt) · `activo` · auditoría · sync

### 2.4 Ventas

#### Venta (cabecera)
- `id` UUID · `numero_interno` · `fecha` · `cliente_id` (FK, default Consumidor Final) · `usuario_id` · `caja_id`
- `subtotal` (real, con centavos) · `descuento_global` · `importe_iva` · `total` (redondeado) · **`ajuste_redondeo`** (diferencia por redondeo a $1)
- `forma_pago` ENUM (`efectivo`/`cuenta_corriente`/`transferencia`/`tarjeta`) · `estado` ENUM (`borrador`/`confirmada`/`anulada`)
- `comprobante_id` (FK opt) · `observaciones` · auditoría · sync

#### VentaDetalle (líneas)
- `id` UUID · `venta_id` · `producto_id`
- `descripcion` (**snapshot**) · `cantidad` (DECIMAL) · `precio_unitario` (**snapshot**) · `descuento_linea` · `alicuota_iva` (**snapshot**) · `subtotal` · sync

#### Comprobante
- `id` UUID · `venta_id` (FK opt; null en NC/ND independientes)
- `tipo` ENUM: `ticket_interno` / `factura_a` / `factura_b` / `factura_c` / `nota_credito` / `nota_debito`
- `punto_venta` · `numero` · `fecha_emision` · `cae` · `cae_vencimiento`
- `condicion_fiscal_emisor` · `condicion_fiscal_receptor` (define A/B/C)
- `importe_neto` · `importe_iva` · `importe_total`
- `estado` ENUM (`pendiente_cae`/`autorizado`/`rechazado`/`anulado`) · `comprobante_referencia_id` (FK, para NC/ND) · sync

#### Caja (sesión)
- `id` UUID · `usuario_id` · `fecha_apertura` · `fecha_cierre` (opt) · `monto_inicial`
- `monto_esperado` (opt, al cierre) · `monto_contado` (opt) · `diferencia` (opt) · `estado` ENUM (`abierta`/`cerrada`) · `observaciones` · `usuario_cierre_id` (opt) · sync

#### MovimientoCaja
- `id` UUID · `caja_id`
- `tipo` ENUM: `ingreso` / `egreso`
- `motivo` ENUM: `venta` / `cobro_cta_cte` / `pago_proveedor` / `retiro` / `aporte` / `gasto` / `ajuste`
- `monto` (positivo; el signo lo da `tipo`) · `forma_pago` (opt) · `referencia_tipo` · `referencia_id` · `usuario_id` · `fecha` · `observaciones` · sync
- **La caja registra todos los medios de pago**, no solo efectivo.

### 2.5 Cuenta corriente de clientes

#### CuentaCorriente
- `id` UUID · `cliente_id` (FK única) · `saldo` (positivo = el cliente debe) · `limite_credito` (movido desde Cliente) · `fecha_ultimo_movimiento` · `activo` · sync

#### MovimientoCtaCte (libro inmutable)
- `id` UUID · `cuenta_id`
- `tipo` ENUM: `cargo` / `pago`
- `motivo` ENUM: `venta_credito` / `cobro` / `nota_credito` / `nota_debito` / `ajuste` / `saldo_inicial`
- `monto` · `saldo_resultante` · `referencia_tipo` · `referencia_id` · `usuario_id` · `fecha` · `observaciones` · sync

### 2.6 Compras (R3)

#### OrdenCompra (cabecera)
- `id` UUID · `numero_interno` · `proveedor_id` · `fecha` · `fecha_entrega_estimada` (opt)
- `estado` ENUM (`borrador`/`emitida`/`recibida_parcial`/`recibida_total`/`anulada`) · `subtotal` · `importe_iva` · `total` · `usuario_id` · `observaciones` · auditoría · sync

#### OrdenCompraDetalle (líneas)
- `id` UUID · `orden_compra_id` · `producto_id` · `descripcion` (snapshot) · `cantidad_pedida` · `cantidad_recibida` (acumulado) · `costo_unitario` · `alicuota_iva` (snapshot) · `subtotal` · sync

#### Recepcion (entrada contra OC)
- `id` UUID · `orden_compra_id` · `fecha` · `usuario_id` · `remito_proveedor` (opt) · `observaciones` · sync

#### RecepcionDetalle (qué se recibió en cada recepción)
- `id` UUID · `recepcion_id` · `orden_compra_detalle_id` · `cantidad_recibida` · `costo_unitario_real` (opt) · sync
- Soporta **recepciones parciales** (varias entregas por OC).

#### CuentaCorrienteProveedor
- `id` UUID · `proveedor_id` (FK única) · `saldo` (positivo = le debés) · `fecha_ultimo_movimiento` · `activo` · sync

#### MovimientoCtaCteProveedor (libro inmutable)
- `id` UUID · `cuenta_id`
- `tipo` ENUM: `cargo` / `pago`
- `motivo` ENUM: `recepcion` / `pago` / `ajuste` / `saldo_inicial`
- `monto` · `saldo_resultante` · `referencia_tipo` · `referencia_id` · `usuario_id` · `fecha` · `observaciones` · sync

### 2.7 Precios

#### ListaPrecio (cabecera)
- `id` UUID · `nombre` (único) · `descripcion` · `tipo` ENUM (`general`/`especial`) · `ajuste_porcentual` (**con signo**: − descuento, + recargo) · `predeterminada` · `activo` · `vigencia_desde`/`vigencia_hasta` (opt) · auditoría · sync

#### ListaPrecioDetalle (excepción de % por producto)
- `id` UUID · `lista_precio_id` · `producto_id` · `ajuste_porcentual` (**con signo, % propio que reemplaza al general para ese producto**) · sync

### 2.8 Seguridad

#### Usuario
- `id` UUID · `nombre_usuario` (único) · `nombre_completo` · `hash_password` · `rol_id` (FK, **un rol por usuario**)
- `email` (opt) · `pin_rapido` (hasheado, cambio rápido de cajero en POS) · `activo` · `ultimo_acceso` · auditoría · sync

#### Rol
- `id` UUID · `nombre` (único) · `descripcion` · `es_sistema` (protege roles base) · `activo` · sync
- **Roles de sistema: `Operador` y `Supervisor`.**

#### Permiso
- `id` UUID · `codigo` (único, ej. `venta.crear`, `stock.ajustar`) · `descripcion` · `modulo` · sync
- Permisos como datos (no hardcodeados); seed inicial en R1.

#### RolPermiso (N:M)
- `id` UUID · `rol_id` · `permiso_id` · sync

#### UsuarioPreferencias (1:1 con Usuario)
- `id` UUID · `usuario_id` (FK única) · `tema` (`claro`|`oscuro`) · `acento` (`amber`|`blue`|`green`|`violet`|`brick`) · `ui_font` (`Hanken Grotesk`|`Figtree`|`Onest`) · `densidad` (`comfortable`|`compact`) · sync
- Preferencias de apariencia **por usuario**; se cargan al iniciar sesión. La fuente numérica no es configurable.

---

## 3. Procesos definidos

> Todos los procesos cerrados usan la plantilla: objetivo · actor/rol · precondiciones · flujo principal · alternativos/errores · postcondiciones · datos afectados · offline/sync · release. Acá se resume el flujo y las **decisiones clave**.

### 3.1 Alta de producto (R1)
- SKU **autogenerado correlativo**; EAN/UPC opcional (se escanea si el artículo lo trae).
- **Validación de duplicados**: con EAN, match exacto por `gtin_barcode`; sin EAN, búsqueda por **nombre similar** que **advierte** (no bloquea).
- Datos: nombre, categoría, marca, unidad de medida, fracción, impuesto (sugiere 21%), costo, precio.
- Ubicación elegida del **catálogo** (lista controlada).
- Al guardar: genera `codigo_qr` único, crea `Existencias` en **0**.
- Etiqueta **solo-QR** opcional en tamaño chico/mediano/grande.

### 3.2 Entrada de stock (R1)
- Busca producto por QR / EAN / nombre / SKU; ingresa cantidad y costo opcional.
- **Stock siempre vía `MovimientoStock`** (nunca hay stock sin movimiento que lo justifique).
- Recalcula **costo promedio ponderado** (fórmula en sección 4).

### 3.3 Recepción de compra (R3)
- Contra OC en estado `emitida`/`recibida_parcial`; registra `Recepcion` + `RecepcionDetalle`.
- Genera `MovimientoStock` (`entrada`/`recepcion_compra`), incrementa Existencias, recalcula costo.
- **Recepciones parciales** soportadas (OC queda abierta por el resto).
- **Sobre-recepción** (más que lo pedido): **permitida con autorización del Supervisor**.
- **Costo distinto al pactado**: gana el **costo real** de la recepción.
- **Cargo al proveedor** = cantidad recibida × costo real (`MovimientoCtaCteProveedor` `cargo`/`recepcion`).

### 3.4 Reglas de resolución de precio
- Cadena: **precio base** (`precio_venta_lista`) → **ajuste de lista** del cliente (% propio del producto si existe en `ListaPrecioDetalle`, si no el % general de la lista) → **descuento de línea** → **descuento global**.
- **IVA incluido** en el precio de lista; se discrimina en factura A.
- **Redondeo a $1 sobre el TOTAL de la venta**; la diferencia se guarda en `Venta.ajuste_redondeo` (subtotales/líneas conservan centavos).
- Descuentos: el **Operador los aplica libremente** (sin tope ni autorización).
- **Sin override de precio** para el Operador (solo descuentos); editar precio = acción de Supervisor.

### 3.5 Venta en POS (R1 / R2 fiscal)
- Cliente **Consumidor Final** por defecto; opcional identificar cliente.
- Alta de líneas por QR / EAN / búsqueda; **snapshots** de precio, descripción y alícuota; cantidades decimales en fraccionables.
- **Sin stock disponible, no hay venta** (regla dura, **sin autorización** — corrige la definición previa que permitía autorización del Supervisor).
- **Productos inactivos no se venden** (no aparecen; si se escanea, avisa y no agrega).
- Cobro → `MovimientoCaja` (efectivo/tarjeta/transferencia) o `MovimientoCtaCte` (`cargo`/`venta_credito`).
- **Cuenta corriente**: exige cliente habilitado; **exceso de límite advierte y bloquea salvo autorización del Supervisor**.
- Emite comprobante (ticket interno R1; fiscal con CAE R2).
- **Obliga a tener caja abierta** para vender.
- **Anulación** (modelada): solo **Supervisor**, por **movimientos inversos** (no se borra nada); reintegra stock (`entrada`/`devolucion`), revierte caja o cuenta corriente; fiscal vía **nota de crédito** en R2. **Se permite anular ventas de cajas ya cerradas / días anteriores**: el movimiento inverso impacta en la **caja actual** y queda registrado el desfasaje.

### 3.6 Apertura y cierre de caja (R1)
- Apertura: monto inicial; impide abrir si ya hay una caja abierta del usuario.
- Cierre: calcula **esperado por forma de pago**; el Operador cuenta el **efectivo**; tarjeta/transferencia se concilian contra comprobantes.
- **Diferencia de arqueo solo sobre efectivo.**
- Diferencia mayor a un **umbral parametrizable** → requiere **autorización/observación del Supervisor** para cerrar.
- El **Operador puede registrar retiros y gastos** durante la sesión (auditados).
- Reporte de cierre (Z) con desglose por forma de pago.

### 3.7 Cobro de cuenta corriente (R3)
- Cliente paga su deuda → `MovimientoCtaCte` (`pago`/`cobro`) + `MovimientoCaja` (ingreso/`cobro_cta_cte`).
- **Sobrepago permitido** → deja **saldo a favor** (saldo negativo).
- **Todo cobro pasa por caja**, sin importar el medio.
- Requiere caja abierta.

### 3.8 Pago a proveedor (R3)
- Reduce la deuda → `MovimientoCtaCteProveedor` (`pago`) + `MovimientoCaja` (egreso/`pago_proveedor`).
- **Solo Supervisor.**
- **Sobrepago permitido** → saldo a favor.
- **Todo pago pasa por caja**, sin importar el medio. Requiere caja abierta.

### 3.9 Localización de producto (R1)
- Consulta (no modifica datos), **100% offline** con lector 2D.
- **Por producto:** escanea el QR (o busca por nombre/SKU/EAN) → muestra ubicación (`sector/estante/posicion` + `codigo`) y stock.
- **Por ubicación (consulta inversa, incluida en R1):** elige una ubicación → lista todos los productos asignados con su stock.
- **Reubicar** = edición normal (cambiar `ubicacion_id`, permiso Operador), **sin reimprimir** (el QR identifica el ítem, no el lugar).
- Bajada de R4 a **R1**.

### 3.10 Importación masiva (Excel/CSV) (R1)
- **Solo Supervisor**, auditada.
- Entidades: **Producto, Cliente, Proveedor, Ubicacion, stock inicial y Lista de precios (detalle)**.
- Flujo: descargar plantilla por entidad → completar → subir → **validación fila por fila** (tipos, obligatorios, duplicados, referencias existentes) → **previsualización** (OK / error con motivo / actualización) → confirmar → **resumen descargable**.
- **Crear + actualizar** (match por SKU/EAN en productos; por documento en clientes/proveedores).
- Importa filas válidas aunque otras fallen.
- Productos importados **autogeneran `codigo_qr` y SKU** y nacen con `Existencias` en 0; el **stock inicial entra por su propia importación** generando `MovimientoStock`.
- Planilla lista de precios: `lista`, `producto (SKU/EAN)`, `ajuste_porcentual`. Planilla stock inicial: `producto`, `cantidad`, `costo`.

### 3.11 Dashboard local (R1)
- **Solo Supervisor.** Local (datos de la terminal). Consolidado multi-terminal/histórico → nube (R4/R5).
- Áreas R1: **Ventas** (del día, ticket promedio, más vendidos, por forma de pago), **Stock** (bajo mínimo, valor de inventario a costo, sin movimiento), **Caja** (ingresos vs. egresos del día, estado de caja, diferencias de arqueo).
- **Compras y Cuentas Corrientes se incorporan en R3**; consolidado en nube R4/R5.

---

## 3-bis. Transversales definidos

### Numeración
- **Dos numeraciones separadas:**
  - **Interna** (`numero_interno` en Venta/OrdenCompra): controlada por el sistema, desde R1, independiente de ARCA. Formato **prefijo + correlativo** con **prefijo de terminal** para unicidad offline: `V-C1-000001`, `OC-C1-000001`. Se asigna **al confirmar**. Engancha con `origin_id`.
  - **Fiscal** (`punto_venta` + `numero` en Comprobante): exigida por ARCA, correlativa **por (tipo de comprobante + punto de venta)**, se obtiene **al solicitar el CAE** (online, R2). Mientras está en `pendiente_cae` no tiene número fiscal.
- El `numero_interno` se **muestra en el ticket** (en R1 es el único número; en R2 el ticket fiscal muestra el de ARCA y el interno queda como referencia).

### Reposición sugerida (R1)
- **Informativa** (no ejecuta compras).
- Disparador: `stock_disponible <= stock_minimo` (**un solo umbral**; `punto_reposicion` **se elimina del modelo**).
- **Cantidad sugerida = `stock_maximo - stock_disponible`** (hasta el tope; sin máximo, alerta sin cantidad).
- **Alerta + reporte, ambos en R1** (adelantados desde R5). Solo lectura; rol Supervisor.

---

## 4. Reglas y fórmulas clave

- **Costo promedio ponderado** (en cada entrada con costo):
  `nuevo_costo = (stock_actual × costo_actual + cantidad_entra × costo_entra) / (stock_actual + cantidad_entra)`
- **Redondeo**: a **$1**, aplicado al **total de la venta**; diferencia en `ajuste_redondeo`.
- **Autorizaciones del Supervisor** (patrón común, quedan registradas): exceso de límite de crédito en venta a cuenta corriente, sobre-recepción de compra, cierre de caja con diferencia sobre umbral, anulación de venta, override de precio, pago a proveedor.
- **Regla de stock**: sin stock disponible no hay venta (sin excepción).

---

## 5. Pendiente de definir

### Procesos
- **Facturación electrónica R2** (WSAA → WSFEv1 → CAE; manejo de `pendiente_cae` sin conexión; NC/ND; asignación del número fiscal) — el más técnico, queda para la próxima sesión.

### Transversales
- **Política de conflictos de sincronización** (ADR abierto).

### Decisiones abiertas (ADR)
- **ADR-013** Ubicación de la integración fiscal (cliente vs nube) — R2.

> Cerradas en esta iteración: **ADR-014** (se venden ambas; `Producto` suma `unidad_venta`,
> `unidad_compra`, `factor_conversion`; stock y precios en `unidad_venta`; recepción
> convierte con el factor; reposición en `unidad_venta` con equivalente en cajas) y
> **ADR-015** (impresión soporta etiquetadora/rollo y A4, configurable). Previamente:
> ADR-012 (last-write-wins + log) y ADR-016 (Drizzle + pnpm workspaces).

---

## 6. Impacto sobre los documentos existentes (a aplicar cuando se actualicen)

> El PRD y el Tech Spec **no se modificaron**; estos son los cambios a volcar.

- **Reemplazar mobile/PWA por lector 1D/2D** en: PRD §3, §5, §7, §8, §10, §12 y Tech Spec §1, §3.4, §5, §6, §8, §9.
- **Reemplazar el modelo de datos** del Tech Spec §2 por el de esta acta (mucho más detallado; elimina la relación N:M `ProductoUbicacion`).
- **Rehacer la matriz RBAC** a dos roles (Operador / Supervisor); eliminar el permiso "vender con stock insuficiente".
- **Actualizar el proceso 3.1** (alta) y todos los procesos de la sección 3 con las versiones de esta acta.
- **Roadmap**: R4 ya no incluye PWA de captura; **localización por QR, reposición (alerta+reporte), importación masiva y dashboard local adelantados a R1**.
- **Correcciones a tablas ya cerradas**: `ajuste_redondeo` agregado a Venta; `limite_credito` movido de Cliente a CuentaCorriente; **`punto_reposicion` eliminado de Existencias**.
- **Procesos nuevos a documentar**: localización (R1), importación masiva (R1), dashboard local (R1); transversales numeración y reposición sugerida.
