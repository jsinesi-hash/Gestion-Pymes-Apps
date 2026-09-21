# RFC-001 — Sistema de Gestión de Ferretería: arquitectura y alcance

## 0. Metadatos

| Campo | Valor |
|-------|-------|
| RFC | 001 |
| Título | Sistema de Gestión de Ferretería: arquitectura, alcance y decisiones de diseño |
| Estado | **Borrador — abierto a comentarios** |
| Autor | Joaquín (Project Manager / Systems Engineer) |
| Revisores | _(a designar: cliente/dueño del comercio, referente técnico, contador)_ |
| Fecha de apertura | Junio 2026 |
| Fecha límite de comentarios | _(a definir)_ |
| Documentos relacionados | PRD v2.0 · Tech Spec v2.0 · Acta de Definiciones v1.0 |

> **Propósito de este RFC.** Poner a consideración la propuesta de arquitectura y alcance del sistema antes de comprometer el desarrollo, dejar registro del fundamento de las decisiones ya tomadas, y abrir formalmente las decisiones pendientes (sección 8) para recibir comentarios. No reemplaza al PRD ni al Tech Spec; los sintetiza y los somete a revisión.

---

## 1. Resumen

Se propone construir un sistema de gestión integral para una ferretería que opere de forma confiable **aun sin conexión a internet** (offline-first), cubriendo venta, inventario con localización por QR, caja, compras, cuentas corrientes y facturación electrónica argentina (AFIP/ARCA), con sincronización a la nube para respaldo y consolidación. El cliente es una aplicación de escritorio (Electron) con base local (SQLite) como fuente de verdad, y un backend en la nube (Node.js + PostgreSQL) que consolida. La captura de códigos se hace con un **lector inalámbrico 1D/2D**. La entrega es incremental en cinco releases, cada uno desplegable por sí solo.

---

## 2. Contexto y motivación

Una ferretería necesita operar el mostrador y el depósito de forma continua, con cortes de conectividad frecuentes y un catálogo extenso y heterogéneo (artículos con código de fabricante y artículos a granel sin código). Las soluciones que dependen de conexión permanente o que no resuelven la localización física de la mercadería no se adaptan a esa realidad. El problema a resolver:

- Vender y cobrar sin que un corte de internet detenga la operación.
- Mantener inventario exacto y **encontrar físicamente** la mercadería rápido.
- Cumplir con la facturación electrónica vigente.
- Cubrir el ciclo comercial completo (compras, proveedores, crédito a clientes) con trazabilidad.

---

## 3. Objetivos y no-objetivos

### Objetivos
- Operación de venta/stock/caja **100% funcional offline**.
- Localización física de productos vía **QR único** por producto.
- Cumplimiento fiscal AFIP/ARCA con CAE.
- Ciclo comercial completo con trazabilidad e idempotencia.
- Entrega incremental con valor en cada release.

### No-objetivos (explícitos)
- Tienda online / e-commerce.
- Operación multi-sucursal (la arquitectura se prepara, pero no se implementa).
- Aplicación o captura móvil (se usa lector 1D/2D).
- Controlador fiscal de hardware (se usa facturación por web service).
- Contabilidad/RRHH/sueldos; comprobante de compra del proveedor; reposición automática de compras.

---

## 4. Propuesta

### 4.1 Arquitectura
Aplicación **híbrida offline-first**, stack TypeScript de punta a punta:

- **Cliente local:** Electron + React + TypeScript; **SQLite** como fuente de verdad local.
- **Nube:** Node.js + **PostgreSQL** para backup, acceso remoto, consolidación y reportes.
- **Sincronización:** outbox / log de operaciones con `version` + `timestamp` e **idempotencia**.
- **Periféricos:** lector inalámbrico **1D/2D** (HID, lee EAN/UPC y QR) e impresora común (sin controlador fiscal).
- **Fiscal:** integración AFIP/ARCA vía **WSAA + WSFEv1** con CAE.

### 4.2 Principios de modelado
- **Saldo + libro de movimientos inmutable** (con `*_resultante`) para stock, caja y cuentas corrientes: el saldo es la foto, los movimientos la película auditable; los movimientos no se editan, se agregan (clave para sincronizar sin conflictos).
- **Snapshots** en líneas de venta y compra (precio, descripción, alícuota del momento).
- **IDs UUID generados en cliente** para evitar colisiones offline.
- **Baja lógica** en todas las entidades maestras.

### 4.3 Identificación de productos
- **EAN/UPC del fabricante**: opcional, para la entrada (alta y recepción).
- **QR único generado por el sistema**: identifica el producto y permite localizarlo.
- **Ubicación** como atributo del producto (catálogo controlado Sector/Estante/Posición); estantes con cartelería **pre-impresa fija**.

### 4.4 Roles
Dos roles: **Operador** (mostrador + depósito) y **Supervisor** (administración, autorizaciones, configuración fiscal, pagos a proveedor, reportes).

### 4.5 Entrega incremental (releases)
- **R1 — Núcleo operativo local:** catálogo, stock, ubicaciones/QR, POS, caja, RBAC, importación masiva, reposición sugerida, localización y dashboard local.
- **R2 — Fiscal:** AFIP/ARCA, comprobantes con CAE, NC/ND.
- **R3 — Abastecimiento y crédito:** compras, recepciones, cuentas corrientes de clientes y proveedores, listas de precios.
- **R4 — Nube y sincronización:** backend cloud, sync offline-first, backup, acceso remoto.
- **R5 — Inteligencia y escala:** reportes consolidados, KPIs, preparación multi-sucursal.

---

## 5. Decisiones de diseño tomadas (con fundamento)

| # | Decisión | Fundamento |
|---|----------|-----------|
| D1 | **Offline-first con SQLite como fuente de verdad local** | La operación no puede detenerse por un corte de internet; la nube consolida pero no bloquea. |
| D2 | **Lector 1D/2D inalámbrico** en lugar de captura móvil/PWA | Funciona offline, es robusto, instantáneo y sin dependencia de cámara/navegador; elimina riesgos de iOS y de librería de escaneo. |
| D3 | **QR único por producto; ubicación como atributo** | Mover un producto no obliga a reimprimir (el QR identifica el ítem, no el lugar); la ubicación se administra como dato. |
| D4 | **Saldo + libro de movimientos inmutable** | Trazabilidad total y sincronización sin conflictos sobre datos que cambian seguido. |
| D5 | **Dos roles (Operador/Supervisor)** | En el comercio, mostrador y depósito son la misma persona; se conserva la separación solo donde aporta control (autorizaciones del Supervisor). |
| D6 | **Listas de precios por porcentaje (con signo), % por producto pisa al general** | Mantenimiento simple con inflación; el detalle cubre excepciones. |
| D7 | **Redondeo a $1 sobre el total**, con `ajuste_redondeo` | Operación de mostrador sin centavos; el ajuste mantiene el arqueo exacto. |
| D8 | **Sin stock, no hay venta** | Evita vender lo que no se tiene; regla simple y sin excepciones. |
| D9 | **Solo IVA** como impuesto | Alcance acotado; la tabla queda preparada para sumar otros tributos sin rediseño. |
| D10 | **Sin comprobante de compra**: la recepción genera la deuda | El hecho económico relevante es la entrada de mercadería. |
| D11 | **Numeración interna con prefijo de terminal** | Garantiza unicidad entre cajas trabajando offline en paralelo. |

---

## 6. Alternativas consideradas

| Tema | Alternativa evaluada | Por qué se descartó |
|------|----------------------|---------------------|
| Captura de códigos | PWA en el celular conectada a la nube | Rompe el offline-first del POS; problemas de cámara en iOS y de velocidad en mostrador. |
| Identificación/ubicación | Dos QR (producto + ubicación) o QR de ubicación en el estante | El cliente opera con una ubicación única por producto; un solo QR simplifica etiquetado y evita reimpresiones. |
| Ubicación | Texto libre o tres campos sueltos en Producto | Riesgo de inconsistencia (typos) y mala consulta inversa; se eligió catálogo controlado con FK. |
| Categorías | Dos tablas fijas (Categoría + Subcategoría) | Limita a dos niveles; se eligió tabla autorreferenciada (N niveles). |
| Roles | Tres roles (Cajero, Depósito, Supervisor) | En este comercio cajero y depósito son la misma persona; se unificó en Operador. |
| Stock en Producto | Campos de stock dentro de la tabla Producto | Ensucia el registro maestro y genera conflictos de sync; se separó en Existencias + MovimientoStock. |
| Reposición | Doble umbral (mínimo + punto de reposición) | Se optó por un solo umbral (`stock_minimo`) por simplicidad operativa. |

---

## 7. Impacto y riesgos

- **Dependencia de ARCA (R2):** disponibilidad y normativa vigente de WSAA/WSFEv1; mitigación: comprobante en `pendiente_cae` y reintento al recuperar conexión.
- **Conflictos de sincronización (R4):** dos orígenes editando el mismo dato; mitigación: política de conflictos a definir (ver 8.1) + libros inmutables.
- **Mínimos de stock mal cargados:** la reposición avisa recién al tocar el mínimo; mitigación: cargar mínimos que contemplen el plazo de entrega.
- **Granel/caja:** el modelo actual usa una sola unidad por producto; ver decisión abierta 8.3.
- **Hardware:** requiere lector 1D/2D compatible HID; bajo riesgo (estándar de mercado).

---

## 8. Cuestiones abiertas para comentar

> Esta es la sección central del RFC. Cada punto está pendiente de decisión y se solicita comentario de los revisores.

### 8.1 Política de resolución de conflictos de sincronización
Cuando dos orígenes (terminales) editan el mismo registro offline, ¿qué gana? Opciones: **last-write-wins por registro** (simple) vs **merge por campo** (más fino, más complejo). Afecta a R4. **Se solicita opinión.**

### 8.2 Ubicación de la integración fiscal
¿La integración AFIP/ARCA corre en el **cliente** (cada terminal habla con ARCA) o en la **nube** (centralizada)? Impacta numeración fiscal, certificados y comportamiento offline. **Se solicita opinión.**

### 8.3 Unidad de compra vs. unidad de venta (factor de conversión)
Productos tipo tornillo/granel: ¿se venden **solo por caja**, **solo por unidad**, o **ambas**? Si es "ambas", se agregan `unidad_compra`, `unidad_venta` y `factor_conversion` a Producto y se ajusta la reposición. **Decisión del negocio pendiente.**

### 8.4 Formato de impresión
Etiquetas (solo QR, tamaños 5/10/15 cm) y comprobantes: ¿**impresora de etiquetas/rollo** o **plancha A4 en impresora común**? Confirmar además el caso de uso de las etiquetas QR grandes. **Se solicita opinión.**

### 8.5 Stack de implementación
ORM (Prisma vs Drizzle) y monorepo (pnpm workspaces vs turborepo). Decisión técnica; **abierta a la opinión del referente técnico.**

### 8.6 Facturación electrónica (R2)
El proceso completo (WSAA → WSFEv1 → CAE, manejo offline, NC/ND, numeración fiscal) **aún no fue especificado**; se abordará en una sesión dedicada. Se anticipa aquí para que los revisores aporten requisitos fiscales propios del comercio.

---

## 9. Plan de implementación

Entrega por releases (sección 4.5). Cada release se valida contra sus criterios de aceptación (PRD §9) y queda desplegable. La secuencia prioriza poder **vender y controlar stock desde R1** sin esperar la nube ni el fiscal, e incorpora el cumplimiento legal (R2) y el ciclo comercial completo (R3) sobre esa base.

---

## 10. Proceso de revisión

1. Los revisores leen este RFC y los documentos relacionados (PRD, Tech Spec).
2. Cada comentario se registra en la tabla de la sección 11, referenciando la sección (ej. "8.1").
3. Las cuestiones abiertas (sección 8) se resuelven y se documentan como ADR en el Tech Spec.
4. Cuando las cuestiones bloqueantes están resueltas, el estado del RFC pasa de **Borrador** a **Aceptado** y se libera el desarrollo del release correspondiente.

---

## 11. Registro de comentarios

| # | Sección | Revisor | Comentario | Estado | Resolución |
|---|---------|---------|------------|--------|------------|
| | | | | | |
| | | | | | |
| | | | | | |

---

## 12. Historial de cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 0.1 | Junio 2026 | Versión inicial para revisión, basada en PRD v2.0 y Tech Spec v2.0. |
