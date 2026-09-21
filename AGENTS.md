# AGENTS.md — Sistema de Gestión de Ferretería

> Contexto del proyecto para el agente (Cursor + Superpowers). Esto **manda** sobre la
> metodología genérica. No reintroducir decisiones cerradas; ante duda de arquitectura,
> **preguntar antes de improvisar**. No cerrar decisiones abiertas (ADR-013) sin confirmación.
>
> **Documentación de referencia** (abrir el documento puntual cuando se necesite el detalle):
> - Modelo de datos completo (29 tablas, campos, enums) y procesos → `docs/TechSpec-ferreteria.md`
> - Qué/alcance/roadmap → `docs/PRD-ferreteria.md`
> - UI/UX (tokens, componentes, teclado, personalización) → `docs/Sistema-Diseno-ferreteria.md`
> - Decisiones y su fundamento → `docs/ADR-Log-ferreteria.md`
> - Prompts por fase → `docs/System-Prompts-desarrollo-ferreteria.md`
> - Referencia visual canónica → `docs/mockups/mockup-pos-ferreteria-v2.html`

## Objetivo
Sistema de gestión integral para una ferretería, **offline-first**: vender, controlar
stock, localizar por QR, facturar (AFIP/ARCA), compras, cuentas corrientes y caja. La
operación nunca se detiene por falta de internet.

## Stack (fijo)
- TypeScript de punta a punta. Monorepo **pnpm workspaces**; ORM **Drizzle** (SQLite local
  y PostgreSQL nube, mismo esquema).
- Cliente: **Electron + React**. Base local: **SQLite** (fuente de verdad local).
- Nube (desde R4): **Node.js + PostgreSQL**.

## Principios no negociables
1. **Offline-first:** se escribe primero en SQLite local; la nube consolida, no bloquea.
2. **IDs UUID generados en cliente.**
3. **Campos de sync** en toda tabla sincronizable: `version`, `origin_id`, `sync_state`, `updated_at`.
4. **Outbox + idempotencia** (motor real en R4; esquema desde R1). **Conflictos:**
   last-write-wins por registro en entidades maestras + log revisable por Supervisor.
5. **Saldo + libro de movimientos inmutable** (con `*_resultante`) para stock, caja y
   cuentas corrientes: los movimientos no se editan, solo se agregan.
6. **Snapshots** en líneas de venta y compra (precio/descr./alícuota del momento).
7. **Baja lógica** (`activo`) en maestros. **Auditoría** en creación/modificación.

## Identificación de productos
- `gtin_barcode` (EAN/UPC): opcional, uno solo, para la entrada (alta/recepción).
- `codigo_qr`: único por producto, generado por el sistema; identifica y localiza.
- `ubicacion_id`: FK a catálogo `Ubicacion`, **una sola** por producto. Estantes con
  cartelería pre-impresa fija.
- Periférico: **lector 1D/2D** como HID (EAN/UPC y QR). **No hay captura móvil ni PWA.**

## Roles (RBAC)
Dos roles, un rol por usuario, permisos como datos (`codigo`):
- **OPERADOR:** mostrador + depósito (vende, cobra, opera su caja, productos, stock,
  ubicaciones, etiquetas, recepción, cobro cta. cte., localización).
- **SUPERVISOR:** todo + administración (usuarios, config, fiscal, proveedores, precios,
  reportes, autorizaciones, pago a proveedor, importación masiva, anulaciones, override de
  precio).
Matriz completa en el Tech Spec §5 / Sistema de Diseño. No desactivar el último Supervisor.

## Reglas de negocio clave
- **Precio:** base (`precio_venta_lista`, IVA incluido) → % de lista (el % por producto
  pisa al general; ambos con signo) → descuento de línea → descuento global.
- **Redondeo a $1 sobre el TOTAL** (diferencia en `Venta.ajuste_redondeo`; líneas con centavos).
- **Sin stock disponible no hay venta.** Productos inactivos no se venden.
- Stock **siempre** vía `MovimientoStock`. **Costo promedio ponderado** en cada entrada con
  costo: `nuevo = (stock*costo_actual + cant*costo_entra)/(stock+cant)`.
- **Solo IVA.** **Unidades:** stock y precios en `unidad_venta`; compra en `unidad_compra`
  con `factor_conversion` (stock += cant_compra × factor; costo_venta = costo_compra/factor).
- **Numeración interna:** `prefijo+terminal+correlativo` (ej. `V-C1-000001`), al confirmar.
  Numeración fiscal = ARCA (R2).
- **Caja:** registra todos los medios; arqueo cuenta solo efectivo; diferencia > umbral →
  autorización del Supervisor.
- **Autorizaciones del Supervisor** (registradas): exceso de crédito, sobre-recepción,
  cierre con diferencia, anulación, override de precio, pago a proveedor.
- **Impresión (ADR-015):** soportar etiquetadora/rollo y A4, configurable; contenido
  (QR + tamaño) independiente del medio.

## Releases (en orden)
R1 núcleo local · R2 fiscal · R3 compras+crédito · R4 nube+sync · R5 reportes consolidados
y preparación multi-sucursal. Construir por fases según `docs/System-Prompts-desarrollo-ferreteria.md`.

## Fuera de alcance (no implementar)
E-commerce · app/captura móvil · multi-sucursal operativo · controlador fiscal de hardware
· contabilidad/RRHH/sueldos · comprobante de compra del proveedor · reposición/pedido
automático · medios de pago electrónicos.

## Decisión abierta (no cerrar sin confirmación)
- **ADR-013:** ubicación de la integración fiscal (cliente vs nube) — se define en R2.
- **R2 (facturación)** completo: pendiente de especificación dedicada.

## Disciplina de trabajo
- Flujo: brainstorm → plan escrito (revisado) → TDD (RED-GREEN-REFACTOR) → verificación.
  No producción sin test que la cubra.
- No dependencias pesadas sin justificar. No implementar lo de "fuera de alcance".
- Cada fase termina **desplegable**, en verde, sin romper las anteriores.
- El detalle de cada campo/proceso está en `docs/TechSpec-ferreteria.md`: consultarlo antes
  de modelar o implementar, no asumir de memoria.
