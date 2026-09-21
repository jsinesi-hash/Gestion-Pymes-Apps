# PRD — Software de Gestión de Ferretería

## 0. Control documental

| Campo | Valor |
|-------|-------|
| Producto | Sistema de gestión integral para ferretería |
| Versión del PRD | 2.0 (consolida definiciones de las sesiones de trabajo) |
| Fecha | Junio 2026 |
| Estado | En revisión |
| Tipo de producto | Aplicación híbrida offline-first (cliente de escritorio + nube) |
| Alcance inicial | Una (1) ferretería, con arquitectura preparada para multi-sucursal |

> Este documento define **qué** debe hacer el producto y **hasta dónde** llega su alcance. Las decisiones de **cómo** implementarlo se resuelven en la fase de arquitectura mediante ADRs (sección 11). El detalle técnico de tablas y procesos vive en el Tech Spec.

---

## 1. Resumen ejecutivo

El producto es un sistema de gestión integral para una ferretería que permite operar el día a día del comercio —vender, controlar stock, ubicar físicamente la mercadería, facturar legalmente, gestionar compras y clientes a cuenta corriente, y manejar la caja— funcionando de forma confiable **aun sin conexión a internet**, con sincronización a la nube para backup, acceso remoto y reportes consolidados.

El diferencial operativo es la **gestión de inventario con QR y un lector inalámbrico 1D/2D**: cada producto lleva un QR único que lo identifica y permite localizarlo, y el lector lee tanto los códigos de barra del fabricante (EAN/UPC) como los QR, sin depender de conexión.

---

## 2. Objetivos del producto

1. Permitir vender y cobrar de forma ágil con lector de códigos, incluso sin internet.
2. Mantener el inventario exacto y trazable, con localización física de cada producto vía QR.
3. Cumplir con la facturación electrónica argentina (AFIP/ARCA) según la condición fiscal del comercio.
4. Cubrir el ciclo comercial completo: compras, proveedores y cuenta corriente de clientes.
5. Garantizar resiliencia operativa (offline-first) y respaldo de la información en la nube.
6. Habilitar decisiones basadas en datos mediante reportes y dashboard.

### Métricas de éxito (a validar con el cliente)

- La operación de venta no se interrumpe ante un corte de internet (0 ventas bloqueadas por conectividad).
- Reducción medible del tiempo de localización de un producto en el depósito.
- 100% de los comprobantes fiscales emitidos con CAE válido.
- Diferencia de inventario por debajo de un umbral acordado en los conteos periódicos.

---

## 3. Alcance

### 3.1 Dentro del alcance (in scope)

- Catálogo de productos (CRUD, categorías N niveles, marcas, variantes).
- Inventario y control de stock (saldo + libro de movimientos trazable).
- Ubicaciones físicas de almacén (catálogo controlado) y QR único por producto para identificación y localización.
- Escaneo de códigos mediante **lector inalámbrico 1D/2D** (EAN/UPC para productos y QR para inventario), en POS y depósito.
- Punto de venta (POS) offline.
- Caja y cobranzas (registra todos los medios de pago).
- Facturación electrónica AFIP/ARCA configurable por condición fiscal (RI A/B/C y Monotributo C), con CAE y notas de crédito/débito.
- Compras y proveedores (órdenes de compra, recepciones parciales, cuenta corriente de proveedores).
- Cuenta corriente de clientes (ventas a crédito, cobros, saldos).
- Listas de precios por porcentaje (general y por producto).
- Control de acceso por roles (RBAC): Operador y Supervisor.
- **Importación masiva por Excel/CSV** (productos, clientes, proveedores, ubicaciones, stock inicial y listas de precios).
- **Reposición sugerida** (informativa) por stock mínimo.
- **Dashboard local** de análisis (ventas, stock, caja).
- Sincronización offline-first con la nube (backup, acceso remoto, consolidación).

### 3.2 Fuera del alcance (out of scope)

- **Multi-sucursal operativo:** la arquitectura se prepara para escalar, pero la operación multi-sucursal **no** se implementa en este alcance.
- **Tienda online / e-commerce** y venta por canales externos.
- **Aplicación o captura móvil (celular/tablet):** la captura de códigos se hace con lector inalámbrico 1D/2D, no con dispositivos móviles.
- **Liquidación de sueldos / RRHH / contabilidad general** (más allá de lo que alimenta al contador externo).
- **Controlador fiscal de hardware:** se trabaja con impresora común y facturación electrónica por web service.
- **Integración con medios de pago electrónicos** (tarjetas, QR interoperable, billeteras), salvo incorporación explícita futura.
- **Comprobante de compra del proveedor:** la deuda se genera con la recepción de mercadería, no se modela la factura de compra.
- **Reposición y pedidos automáticos a proveedores** (la reposición sugerida es informativa).

> Cualquier ítem de esta lista que se quiera incorporar es un cambio de alcance y se replanifica.

### 3.3 Supuestos

- El comercio cuenta con conexión a internet **intermitente pero existente** (la nube no requiere conexión permanente, pero sí periódica para sincronizar y para obtener el CAE).
- Hay al menos una PC apta para ejecutar el cliente Electron y un **lector inalámbrico 1D/2D** (HID, lee EAN/UPC y QR).
- La impresión de comprobantes y etiquetas se realiza en impresora común o en impresora de etiquetas/rollo (ambas soportadas, configurable; no fiscal).
- Las **ubicaciones de los estantes están pre-impresas y fijas** (cartelería estática).
- El comercio tiene un único punto de venta físico en el alcance inicial.
- La normativa AFIP/ARCA vigente se verifica contra la documentación oficial al implementar el módulo fiscal.

### 3.4 Restricciones

- El cliente local debe operar **siempre** de forma funcional sin conexión.
- La fuente de verdad local es SQLite; la nube consolida pero no bloquea la operación.
- El stack tecnológico está fijado (ver sección 7).

---

## 4. Usuarios y roles (RBAC)

| Rol | Descripción | Responsabilidades principales |
|-----|-------------|-------------------------------|
| **Operador** | Persona que atiende mostrador y depósito (es la misma). | Vender y cobrar en el POS, operar su caja, alta/edición de productos, control de stock, ubicaciones, etiquetas QR, recepción de compras, cobro de cuenta corriente, localización de productos. |
| **Supervisor** | Mayor jerarquía; concentra la administración. | Todo lo del Operador + alta de usuarios, configuración, parámetros fiscales (AFIP/ARCA), proveedores y precios, reportes y dashboard, ajustes sensibles, autorizaciones, pagos a proveedores, importación masiva, anulaciones, override de precio. |

> Roles de sistema protegidos (`es_sistema`). La matriz detallada de permisos (por caso de uso) se especifica en el Tech Spec; todo caso de uso queda cubierto por dicha matriz.

---

## 5. Requisitos funcionales por módulo

### 5.1 Catálogo de productos
- CRUD con categorías (N niveles), marca, unidad de medida, variantes (producto padre).
- EAN/UPC del fabricante **opcional** (un solo código por producto), usado en la entrada.
- **QR único** generado por el sistema; SKU autogenerado (correlativo).
- Datos de costo (promedio ponderado) y precio de venta (con IVA incluido).

### 5.2 Inventario y stock
- Saldo por producto (Existencias) y libro de movimientos trazable e inmutable.
- Movimientos por venta, recepción, ajuste, devolución, merma.
- El stock siempre se modifica vía un movimiento (nunca hay stock sin justificación).

### 5.3 Ubicaciones y localización por QR
- Catálogo de ubicaciones (Sector/Estante/Posición), lista controlada, tres niveles obligatorios.
- Cada producto tiene una ubicación (atributo único).
- Localización escaneando el QR del producto con el lector 2D, u obteniendo la lista de productos por ubicación (consulta inversa). 100% offline.

### 5.4 Punto de venta (POS)
- Venta con lector (QR o EAN) o búsqueda.
- Cliente "Consumidor Final" por defecto.
- Resolución de precio (lista + descuentos), IVA incluido, total redondeado a $1.
- Sin stock disponible no hay venta.
- Emisión de comprobante (interno no fiscal en R1; fiscal desde R2). Operación offline.
- Anulación por Supervisor (movimientos inversos).

### 5.5 Caja y cobranzas
- Apertura con monto inicial; cierre con arqueo por forma de pago (diferencia sobre efectivo).
- Registra todos los medios de pago.
- Retiros y gastos durante la sesión (auditados).

### 5.6 Facturación electrónica (AFIP/ARCA)
- Configurable por condición fiscal (RI A/B/C, Monotributo C).
- Integración WSAA + WSFEv1 con CAE; notas de crédito y débito.
- Comportamiento offline: comprobante en `pendiente_cae` y reintento al recuperar conexión.

### 5.7 Compras y proveedores
- Gestión de proveedores y órdenes de compra.
- Recepciones (parciales) que actualizan stock y costo, y generan la deuda con el proveedor.
- Cuenta corriente de proveedores.

### 5.8 Cuenta corriente de clientes
- Ventas a crédito (con habilitación y límite), cobros, saldos y estado de cuenta.
- Exceso de límite: advierte y bloquea salvo autorización del Supervisor.

### 5.9 Importación masiva (Excel/CSV)
- Plantilla por entidad; validación previa; previsualización; confirmación; resumen descargable.
- Crear + actualizar. Entidades: producto, cliente, proveedor, ubicación, stock inicial, listas de precios.
- Solo Supervisor; auditada.

### 5.10 Reposición sugerida
- Informativa (no compra). Dispara cuando el stock disponible cae al mínimo.
- Cantidad sugerida hasta el stock máximo. Alerta + reporte (R1).

### 5.11 Dashboard y reportes
- Dashboard local (R1): ventas, stock, caja.
- Compras y cuentas corrientes se incorporan en R3; consolidado multi-terminal en la nube (R4/R5).

---

## 6. Requisitos no funcionales

| Categoría | Requisito |
|-----------|-----------|
| **Disponibilidad / resiliencia** | El cliente local opera al 100% sin conexión; la nube nunca bloquea la operación. |
| **Integridad de datos** | Sincronización idempotente con versión + timestamp; sin pérdida ni duplicación. |
| **Seguridad** | Autenticación de usuarios y control de acceso por rol (RBAC). |
| **Rendimiento** | El POS responde con fluidez en la venta con lector. |
| **Trazabilidad** | Todo movimiento de stock y operación de caja queda registrado y auditable. |
| **Cumplimiento fiscal** | Comprobantes válidos con CAE según normativa AFIP/ARCA vigente. |
| **Compatibilidad de periféricos** | El lector 1D/2D inalámbrico funciona como HID estándar, sin drivers propietarios. |

---

## 7. Arquitectura objetivo (resumen)

Arquitectura **híbrida offline-first**, con stack TypeScript de punta a punta.

- **Cliente local:** Electron + React + TypeScript. Persistencia en **SQLite** (fuente de verdad local).
- **Nube:** Node.js + **PostgreSQL** para backup, acceso remoto, consolidación y reportes.
- **Sincronización:** outbox / log de operaciones con versión + timestamp e idempotencia.
- **Periféricos:** lector inalámbrico 1D/2D (HID, lee EAN/UPC y QR) e impresora común (sin controlador fiscal).
- **Fiscal:** integración AFIP/ARCA vía WSAA + WSFEv1 con emisión de CAE.

> El detalle de arquitectura, modelo de datos y procesos vive en el Tech Spec; las decisiones abiertas, en ADRs.

---

## 8. Roadmap de releases

Cada release es **desplegable y aporta valor por sí solo**.

| Release | Foco | Entrega de valor |
|---------|------|------------------|
| **R1 — Núcleo operativo local (MVP)** | Catálogo + stock + ubicaciones + QR + POS + caja + RBAC (2 roles) + importación masiva + reposición sugerida + localización por QR + dashboard local. Todo local, comprobante interno no fiscal. | Se puede vender, controlar stock y localizar mercadería. |
| **R2 — Fiscal** | AFIP/ARCA (WSAA + WSFEv1), comprobantes A/B/C con CAE, notas de crédito/débito, numeración fiscal. | Operación legalmente válida. |
| **R3 — Abastecimiento y crédito** | Compras/proveedores, recepciones, cuenta corriente de clientes y proveedores, listas de precios; dashboard suma Compras y Cuentas Corrientes. | Ciclo comercial completo. |
| **R4 — Nube y sincronización** | Backend cloud, motor de sync offline-first, backup, acceso remoto. | Resiliencia y acceso distribuido. |
| **R5 — Inteligencia y escala** | Reportes/dashboard consolidados, KPIs, preparación multi-sucursal. | Decisión basada en datos. |

---

## 9. Criterios de aceptación generales

- Cada módulo tiene sus casos de uso definidos y todos están cubiertos por la matriz RBAC.
- La aplicación arranca y opera sin conexión a internet.
- Cada release queda en estado desplegable.
- Los comprobantes fiscales (desde R2) se emiten con CAE válido.
- La sincronización no produce pérdida ni duplicación de datos.

---

## 10. Glosario y definiciones

| Término | Definición |
|---------|-----------|
| **Offline-first** | El sistema funciona primero en local; la nube es complementaria, no requisito de operación. |
| **Fuente de verdad local** | La base local (SQLite) con el estado autoritativo del cliente entre sincronizaciones. |
| **Outbox / log de operaciones** | Cola de operaciones pendientes de sincronizar, idempotente. |
| **Idempotencia** | Aplicar la misma operación más de una vez produce el mismo resultado. |
| **RBAC** | Control de acceso basado en roles. |
| **POS** | Punto de venta. |
| **QR (de producto)** | Código QR único que identifica el producto y permite localizarlo. |
| **EAN/UPC** | Códigos de barra de producto del fabricante. |
| **Lector 1D/2D** | Lector inalámbrico que lee códigos de barra (1D) y QR (2D), conectado como HID. |
| **AFIP / ARCA** | Organismo fiscal argentino (ARCA, denominación vigente). |
| **WSAA / WSFEv1** | Web services de autenticación y de facturación electrónica de ARCA. |
| **CAE** | Código de Autorización Electrónico que valida un comprobante fiscal. |
| **RI (A/B/C) / Monotributo (C)** | Condiciones fiscales y tipos de comprobante. |
| **HID** | Dispositivo que el SO reconoce como teclado (ej. el lector). |
| **ADR** | Registro de decisión de arquitectura. |
| **Operador / Supervisor** | Los dos roles del sistema. |

---

## 11. Decisiones abiertas (ADR)

- **ADR-013** Ubicación de la integración fiscal (cliente vs nube) — se define al diseñar R2.

> Cerradas: unidades venta/compra + factor de conversión (ADR-014); impresión con soporte
> de etiquetadora/rollo y A4 configurable (ADR-015); conflictos de sync last-write-wins +
> log (ADR-012); ORM Drizzle + monorepo pnpm workspaces (ADR-016). Tamaños de etiqueta QR:
> chico 5×5, mediano 10×10, grande 15×15 cm.

---

## 12. Dependencias y riesgos

| Tipo | Detalle |
|------|---------|
| Dependencia externa | Disponibilidad y normativa vigente de los web services de AFIP/ARCA. |
| Dependencia de hardware | Lector inalámbrico 1D/2D compatible HID e impresora común. |
| Riesgo | Cambios regulatorios fiscales durante el desarrollo de R2. |
| Riesgo | Conflictos de sincronización si dos orígenes editan el mismo dato (mitigado por la política de conflictos a definir). |
| Riesgo | Definición de mínimos de stock demasiado bajos: la reposición sugerida avisa recién al tocar el mínimo (mitigación: cargar mínimos que contemplen el tiempo de entrega). |
