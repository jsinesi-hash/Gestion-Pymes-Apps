# ADR Log — Sistema de Gestión de Ferretería

## 0. Sobre este documento

Registro de decisiones de arquitectura (Architecture Decision Records). Cada ADR documenta **una** decisión significativa: su contexto, la decisión tomada, sus consecuencias y las alternativas evaluadas. Los ADR son inmutables una vez aceptados; si una decisión cambia, se crea un ADR nuevo que **supersede** al anterior (no se edita el original).

| Campo | Valor |
|-------|-------|
| Proyecto | Sistema de Gestión de Ferretería |
| Versión del log | 1.0 |
| Fecha | Junio 2026 |
| Documentos relacionados | PRD v2.0 · Tech Spec v2.0 · RFC-001 · Acta de Definiciones v1.0 |
| Estados posibles | ver "Vocabulario de estados" abajo |

### Vocabulario de estados

El estado califica al **ADR** (masculino): se escribe `Aceptado`, no `Aceptada`, aunque el
título hable de una "arquitectura" o una "integración". El índice y el campo `**Estado:**`
del cuerpo deben coincidir literalmente.

| Estado | Significado |
|--------|-------------|
| `Propuesto` | Decisión planteada, todavía sin resolver. No se cierra unilateralmente. |
| `Aceptado` | Decisión tomada y vigente. No dice nada sobre si hay código. |
| `Aceptado — implementado` | Aceptado y con implementación en el repo. El cuerpo lleva una sección `### Implementación (fecha)`. |
| `Aceptado — Lote N implementado` | Variante del anterior cuando la implementación va por lotes y solo algunos están hechos. |
| `Aceptado (diferido)` | Decisión tomada, ejecución postergada a un release posterior. |
| `Diferido` | Postergado sin decisión de fondo tomada. |
| `Cerrado` | Aceptado, implementado y sin trabajo pendiente derivado. |
| `Rechazado` | Evaluado y descartado. Se conserva por su valor de contexto. |
| `Cancelado` | Aceptado en su momento y dado de baja antes de implementarse. |
| `Superseded` | Reemplazado por un ADR posterior, que se nombra en el cuerpo. |
| `Deprecado` | Vigente formalmente pero desaconsejado; en camino a `Superseded`. |

Los ADR son inmutables en su **decisión**. Corregir una errata de numeración, un estado mal
transcripto o agregar una sección de implementación no es una decisión nueva: es fe de erratas,
y se deja constancia en la bitácora al final de este documento.

### Índice

| ADR | Título | Estado |
|-----|--------|--------|
| 001 | Arquitectura offline-first con SQLite como fuente de verdad local | Aceptado |
| 002 | Stack TypeScript de punta a punta | Aceptado |
| 003 | Sincronización por outbox e idempotencia | Aceptado |
| 004 | Lector 1D/2D inalámbrico en lugar de captura móvil | Aceptado |
| 005 | QR único por producto; ubicación como atributo | Aceptado |
| 006 | Patrón saldo + libro de movimientos inmutable | Aceptado |
| 007 | Categoría autorreferenciada (N niveles) | Aceptado |
| 008 | Modelo RBAC con dos roles (Operador / Supervisor) | Aceptado |
| 009 | Listas de precios por porcentaje con signo | Aceptado |
| 010 | Redondeo a $1 sobre el total con ajuste de redondeo | Aceptado |
| 011 | Entrega incremental en cinco releases | Aceptado |
| 012 | Política de resolución de conflictos de sincronización | **Aceptado** |
| 013 | Ubicación de la integración fiscal (cliente vs nube) | Propuesto |
| 014 | Unidad de compra vs. unidad de venta (factor de conversión) | **Aceptado** |
| 015 | Formato de impresión de etiquetas y comprobantes | **Aceptado** |
| 016 | ORM y herramienta de monorepo | **Aceptado** |
| 017 | Reabastecimiento desacoplado de OC; modo manual y sugerido | Aceptado |
| 018 | Actualización de costo de referencia en recepción de mercadería | Aceptado |
| 019 | Cuenta corriente de proveedores fuera de scope de R3 | Aceptado (diferido) |
| 020 | Sección "Proveedores" en Detalle de Producto (excepción phase-gate R1) | Aceptado |
| 021 | Política de Backup — motor, cifrado y redundancia 3-2-1 | Aceptado |
| 022 | Restore atómico con validación de esquema | Aceptado |
| 023 | Integración nativa con Google Drive (diferida a R4) | Diferido |
| 024 | Catálogo geográfico normalizado para validación offline de direcciones | Aceptado |
| 025 | Formato de SKU interno y modelo de códigos del producto | Aceptado |
| 026 | Módulo de impresión de etiquetas por lote | Aceptado |
| 027 | Autenticación por usuario/contraseña, eliminación de PIN | Aceptado |
| 028 | Reorganización de navegación: sidebar agrupado | Aceptado |
| 029 | ABM de Categorías | Aceptado |
| 030 | ABM de Marcas | Aceptado |
| 031 | Baja lógica de Clientes | Aceptado |
| 032 | Rediseño de layout POS y modelo de pago combinado | Aceptado |
| 033 | Venta en espera (pausar/retomar sin impactar caja ni stock) | Aceptado |
| 034 | Motor de Precios con Vigencia y Auditoría Histórica | **Cerrado** |
| 035 | Importación de listas de costo de proveedor | **Cerrado** |
| 036 | Vistas cruzadas producto↔proveedor y edición de costo de compra | **Cerrado** |
| 037 | Arquitectura de Dashboard y Reportes; fase 1 (Ventas y Productos) | Aceptado |
| 038 | Dashboard, fase 2 (Caja, Clientes y Proveedores) | **Aceptado — implementado** |
| 039 | Reportes: menú separado del Dashboard + Detalle de Ventas | Aceptado |
| 040 | Multi-presentación de venta (una unidad de stock, N presentaciones) | **Aceptado** |
| 041 | ABM de Unidades | **Aceptado — implementado** |
| 042 | Corte de versión v1.0.0 y estrategia de branching pre-R2 | Aceptado |
| 043 | Empaquetado y distribución del cliente (instalable, seed limpio, updates) | **Aceptado — implementado** |
| 044 | Corrección del mapa de versiones: R3 ya integrado a 1.0.0; Remitos + Presupuestos toman 1.1.0, fiscal ARCA pasa a 1.2.0 | Aceptado |
| 045 | Módulo de Remitos (documento de entrega interno) | Aceptado |
| 046 | Módulo de Presupuesto (cotización previa a la venta) | Aceptado — implementado |
| 047 | Agenda operativa y outbox de avisos | Aceptado — Lote 1 implementado (1.1.0) |
| 048 | Agenda operativa y outbox de avisos Lote 2 | Aceptado |
| 049 | Motor de Precios v2: costo neto, reglas de margen y publicación por lote | Aceptado — implementado |
| 050 | Cliente: separar `razon_social` en `nombre` + `apellido` | Aceptado — implementado |
| 051 | Mejoras a la carga masiva (importación de costos y catálogo de proveedor) | Aceptado — implementado |
| 052 | Detalle de Producto: proveedor preferido seleccionable y compactación de Overrides Comerciales | Aceptado — implementado |
| 053 | Listado de Productos absorbe Localización; default activos y ordenamiento por cabecera | Aceptado — implementado |
| 054 | Revisión e Historial de Costos y Catálogo (unifica Cola de Revisión) + mejoras a Importar Catálogo de Proveedor | Aceptado — implementado |
| 055 | Proveedores: acceso al detalle por línea completa y estandarización del tab Productos | Aceptado — implementado |
| 056 | Punto de Venta: UI estándar, venta en curso persistente en UI y botones Cancelar/Confirmar | Aceptado — implementado |
| 057 | Defaults de listados (Remitos, Stock), layout de Etiquetas y baja de Reposición Sugerida | Aceptado — implementado |
| 058 | Importación masiva de Clientes/Proveedores: contrato de columnas completo + fix de sobreescritura de apellido | Aceptado — implementado |
| 060 | Habilitar por default los módulos de 1.1.x (Remitos, Presupuestos, Agenda) y el Motor de Precios v2 en instalaciones nuevas | Aceptado — implementado |
| 062 | Catálogo demo de arranque (15 productos), cargable/vaciable a demanda desde Configuración | Aceptado — implementado |
| 063 | Matching producto interno ↔ producto proveedor por similitud de nombre (normalización, sinónimos y sugerencia en la Cola de Revisión) | Aceptado — implementado |
| 064 | Ubicaciones: identidad canónica (normalización) + ABM completo en Configuración con exportación | Aceptado — implementado |
| 065 | Robustez del importador de productos: booleano canónico, idempotencia sin EAN, cobertura total de campos e informe de carga parcial | Aceptado — implementado |
| 066 | Correcciones de UX y regresiones: presentaciones (eliminar/reactivar), recepción parcial de OC y búsqueda por EAN | Aceptado — implementado |
| 067 | Sinónimos de búsqueda del catálogo (expansión acento-insensible, abreviaturas solo-entrada, match por marca) con ABM e importación CSV | Aceptado — implementado |
| 068 | Reuso de GTIN de presentación tras baja: condicionar `ux_pp_gtin` por `activo` | Aceptado — implementado |
| 069 | Lote de UI/UX: "clic en toda la fila abre detalle" en los listados restantes, restyle de Sinónimos y POS al CSS estándar, ajustes de Etiquetas/Ventas/Transportistas y reubicación de Sinónimos en el menú | Aceptado — implementado |
| 072 | Redondeo de punto flotante en el delta mostrado del Ajuste de Stock | Aceptado — implementado |
| 073 | Búsqueda por similitud en Catálogo (servicio token-set compartido) + enmienda a `normalizar()`: canonicalización de unidad con espacio | Aceptado — implementado |
| 074 | Sustitutos curados entre productos (equivalentes + reemplazos) y flag `discontinuado` | Aceptado — Fase 1 implementada |
| 075 | Match canónico de ubicación en el import de productos (ceros a la izquierda + case-insensitive) | Aceptado — implementado |
| 076 | Política de retención y depuración de backups | Aceptado — implementado |
| 077 | Fase 1 de mejoras UX: feedback central (toasts), traducción de errores, validación inline, fix de hook en listado, breadcrumb jerárquico y endurecimiento del main (nav guard + CSP) | Aceptado — implementado |
| 078 | Fase 2 de mejoras UX: stock inicial en el alta, hub de Precios/Costos y paleta de comandos | Aceptado — implementado |
| 079 | Fase 2b de mejoras UX: links de vuelta al producto, alta express y auto-bloqueo por inactividad | Aceptado — implementado |
| 080 | Fase 3 de mejoras UX (PERF-1 + NAV-3): inicio personalizable por usuario, favoritos de navegación y reorganización del sidebar | Aceptado — implementado |
---

## ADR-001 — Arquitectura offline-first con SQLite como fuente de verdad local

**Estado:** Aceptado

**Contexto.** La ferretería sufre cortes de conectividad frecuentes y la operación de venta no puede detenerse por eso. Se necesita decidir dónde reside el estado autoritativo del sistema.

**Decisión.** El cliente de escritorio usa **SQLite local como fuente de verdad**; toda operación se escribe primero en local y se sincroniza con la nube de forma asíncrona. La nube consolida pero **nunca bloquea** la operación.

**Consecuencias.**
- (+) La venta, el stock y la caja funcionan al 100% sin internet.
- (+) Latencia mínima en la operación de mostrador.
- (−) Requiere un mecanismo de sincronización y de resolución de conflictos (ver ADR-003 y ADR-012).
- (−) El dato consolidado/histórico completo vive en la nube, disponible recién desde R4.

**Alternativas.** Cliente puramente online contra la nube → descartada: un corte de internet detendría la venta.

---

## ADR-002 — Stack TypeScript de punta a punta

**Estado:** Aceptado

**Contexto.** Hace falta un stack único que cubra cliente de escritorio, backend y lógica compartida, con buen ecosistema y un solo lenguaje para el equipo.

**Decisión.** **TypeScript end-to-end**: cliente en **Electron + React**, backend en **Node.js**, base local **SQLite**, base nube **PostgreSQL**.

**Consecuencias.**
- (+) Un solo lenguaje; lógica y tipos compartibles entre cliente y nube.
- (+) Ecosistema maduro para escritorio (Electron) y datos (SQLite/PostgreSQL).
- (−) Electron tiene huella de memoria considerable; aceptable para una PC de mostrador.

**Alternativas.** Aplicación web pura (rompe offline-first robusto); stack nativo por plataforma (más costo de mantenimiento, dos lenguajes).

---

## ADR-003 — Sincronización por outbox e idempotencia

**Estado:** Aceptado

**Contexto.** Con SQLite local como fuente de verdad (ADR-001) y posibles múltiples terminales, hace falta sincronizar sin perder ni duplicar operaciones, tolerando cortes a mitad de proceso.

**Decisión.** Cada registro sincronizable lleva `id` (UUID generado en cliente), `version`, `updated_at`, `origin_id` (terminal) y `sync_state`. El cliente mantiene un **outbox** ordenado; el backend aplica las operaciones de forma **idempotente** (reaplicar el mismo `id` no duplica efectos).

**Consecuencias.**
- (+) Reanudar tras un corte no genera duplicados.
- (+) UUID en cliente evita colisiones de identificadores entre terminales offline.
- (−) No resuelve por sí solo qué pasa cuando dos orígenes editan el mismo registro: eso es ADR-012 (pendiente).

**Alternativas.** IDs autoincrementales en servidor → inviable offline (no se conoce el ID hasta sincronizar).

---

## ADR-004 — Lector 1D/2D inalámbrico en lugar de captura móvil

**Estado:** Aceptado (supersede la idea inicial de captura por PWA)

**Contexto.** El diseño original contemplaba una PWA en el celular para escanear EAN/UPC y QR. Esa PWA dependía de conexión a la nube y enfrentaba problemas de soporte de cámara (iOS) y de velocidad en el mostrador.

**Decisión.** Se elimina la captura móvil. La lectura de códigos se hace con un **lector inalámbrico 1D/2D** que se conecta como **HID** y lee tanto EAN/UPC como QR, en POS y depósito.

**Consecuencias.**
- (+) Escaneo offline, instantáneo y robusto; sin dependencia de cámara/navegador/iOS.
- (+) Elimina los riesgos de la librería de escaneo y de la PWA.
- (+) Un solo dispositivo cubre mostrador y depósito (inalámbrico).
- (−) Costo de hardware del lector (estándar de mercado, bajo).

**Alternativas.** PWA conectada a la nube; PWA en LAN; app móvil nativa → descartadas por dependencia de conexión y complejidad.

---

## ADR-005 — QR único por producto; ubicación como atributo

**Estado:** Aceptado

**Contexto.** Hay que identificar el producto y ubicarlo físicamente. Se evaluó usar el código de fabricante, generar QR de producto y/o QR de ubicación.

**Decisión.** Cada producto lleva un **QR único generado por el sistema** que lo identifica y permite localizarlo. La **ubicación es un atributo del producto** (FK a un catálogo controlado Sector/Estante/Posición). Los estantes tienen cartelería **pre-impresa fija**. El EAN/UPC del fabricante queda como dato opcional para la entrada.

**Consecuencias.**
- (+) Mover un producto no obliga a reimprimir (el QR identifica el ítem, no el lugar).
- (+) Catálogo de ubicaciones controlado evita inconsistencias (typos).
- (−) Cada producto tiene **una sola** ubicación; si se necesitara ubicación múltiple, requiere revisión del modelo.

**Alternativas.** Dos QR (producto + ubicación); QR de ubicación en el estante; ubicación como texto libre → descartadas por complejidad de etiquetado o riesgo de inconsistencia.

---

## ADR-006 — Patrón saldo + libro de movimientos inmutable

**Estado:** Aceptado

**Contexto.** Stock, caja y cuentas corrientes son datos que cambian con cada operación y requieren trazabilidad total, además de sincronizar bien en offline-first.

**Decisión.** Cada uno de esos dominios se modela como **saldo** (foto actual, una fila) + **libro de movimientos inmutable** (una fila por operación, nunca se edita, solo se agrega), con un campo `*_resultante` que guarda el saldo tras cada movimiento.

**Consecuencias.**
- (+) Auditoría completa: se reconstruye el saldo a cualquier fecha.
- (+) Movimientos inmutables = sincronización sin conflictos de edición.
- (+) Detección de inconsistencias comparando saldo vs. último `*_resultante`.
- (−) Redundancia controlada (saldo + movimientos); más escrituras.

**Alternativas.** Solo saldo (sin trazabilidad) o solo movimientos (recálculo costoso del saldo) → descartadas.

---

## ADR-007 — Categoría autorreferenciada (N niveles)

**Estado:** Aceptado

**Contexto.** El catálogo necesita clasificación jerárquica (categoría → subcategoría y posibles niveles más).

**Decisión.** Una sola tabla **`Categoria` autorreferenciada** (`categoria_padre_id`), que admite N niveles. En Producto queda un único `categoria_id`.

**Consecuencias.**
- (+) Flexibilidad de niveles sin rediseño; misma técnica que `producto_padre_id`.
- (−) Las consultas jerárquicas requieren recursión (manejable).

**Alternativas.** Dos tablas fijas (Categoría + Subcategoría) → limita a dos niveles.

---

## ADR-008 — Modelo RBAC con dos roles (Operador / Supervisor)

**Estado:** Aceptado (supersede el diseño inicial de tres roles)

**Contexto.** Inicialmente se definieron tres roles (Cajero/Vendedor, Encargado de depósito, Supervisor). En este comercio, mostrador y depósito son la misma persona.

**Decisión.** Dos roles de sistema: **Operador** (mostrador + depósito) y **Supervisor** (administración, autorizaciones, configuración fiscal, pagos a proveedor, reportes). Permisos como datos (`codigo`), un rol por usuario.

**Consecuencias.**
- (+) Matriz RBAC más simple, alineada a la operación real.
- (+) Se conservan los controles donde aportan (autorizaciones del Supervisor).
- (−) Menor separación de funciones (un Operador cubre todo el circuito operativo); aceptable en comercio chico.

**Alternativas.** Tres roles; roles a medida definibles por el Supervisor → diferido (sobrediseño para el alcance actual).

---

## ADR-009 — Listas de precios por porcentaje con signo

**Estado:** Aceptado

**Contexto.** Se necesitan precios alternativos (mayorista, tarjeta) sobre un precio base, fáciles de mantener con inflación.

**Decisión.** Cada lista tiene un **`ajuste_porcentual` con signo** (− descuento, + recargo) sobre el precio base; un **% por producto** en el detalle **reemplaza** al general para ese producto. El precio base es `Producto.precio_venta_lista` (con IVA incluido).

**Consecuencias.**
- (+) Mantenimiento simple (un % por lista); excepciones por producto cuando hace falta.
- (+) Un solo campo con signo cubre descuentos y recargos.
- (−) El precio final se calcula (no se almacena por producto/lista, salvo el % de excepción).

**Alternativas.** Precio fijo por producto en cada lista → mayor carga de mantenimiento.

---

## ADR-010 — Redondeo a $1 sobre el total con ajuste de redondeo

**Estado:** Aceptado

**Contexto.** Con inflación, manejar centavos en mostrador es incómodo. Hay que decidir nivel y punto de aplicación del redondeo.

**Decisión.** Redondeo a **$1**, aplicado al **total de la venta**. Las líneas y subtotales conservan centavos; la diferencia se registra en `Venta.ajuste_redondeo`.

**Consecuencias.**
- (+) Total sin centavos para el cliente.
- (+) El `ajuste_redondeo` mantiene el arqueo de caja exacto.
- (−) El total no es la suma exacta de las líneas (diferencia ≤ $0,99, explicada por el ajuste).

**Alternativas.** Redondear cada línea (descuadres acumulados); redondear a $10 (pierde precisión); no redondear (centavos en mostrador).

---

## ADR-011 — Entrega incremental en cinco releases

**Estado:** Aceptado

**Contexto.** Se busca entregar valor temprano sin esperar el sistema completo, y no rehacer trabajo entre etapas.

**Decisión.** Cinco releases, cada uno desplegable: **R1** núcleo local, **R2** fiscal, **R3** abastecimiento y crédito, **R4** nube y sincronización, **R5** inteligencia y escala.

**Consecuencias.**
- (+) Se puede vender y controlar stock desde R1, sin nube ni fiscal.
- (+) Cada release construye sobre la base anterior sin reescrituras.
- (−) Algunas funciones (consolidado, multi-terminal) recién llegan en R4/R5.

**Alternativas.** Entrega big-bang → mayor riesgo y sin valor hasta el final.

---

## ADR-012 — Política de resolución de conflictos de sincronización

**Estado:** Aceptado

**Contexto.** Con offline-first y posibles múltiples terminales (ADR-001/003), dos orígenes pueden editar el mismo registro estando offline. Hay que definir qué prevalece al sincronizar.

**Decisión.** **Last-write-wins por registro** (gana el `updated_at` más reciente) para las entidades maestras editables (Producto, precios, catálogos). Toda resolución de conflicto se asienta en un **log de conflictos revisable por el Supervisor**. El grueso del sistema usa libros de movimientos inmutables (ADR-006), donde el conflicto casi no ocurre porque las terminales agregan movimientos distintos en lugar de editar el mismo registro.

**Consecuencias.**
- (+) Simple de implementar y de razonar.
- (+) El impacto real es bajo: solo afecta a entidades maestras, no a los libros de movimientos.
- (+) El log de conflictos permite auditar y corregir manualmente los casos puntuales.
- (−) Puede perder un cambio concurrente sobre el mismo campo de una entidad maestra (mitigado por el log y por la baja frecuencia de edición concurrente).

**Alternativas.** Merge por campo → descartado: mayor complejidad para un beneficio marginal dado el uso intensivo de libros inmutables.

**Aplica a:** R4 (P4.2).

---

## ADR-013 — Ubicación de la integración fiscal (cliente vs nube)

**Estado:** Propuesto (pendiente de decisión)

**Contexto.** La facturación electrónica (R2) requiere hablar con ARCA (WSAA/WSFEv1). Puede correr en cada terminal o centralizarse en la nube.

**Decisión.** _Pendiente._
- **En el cliente:** cada terminal pide el CAE; funciona si la terminal tiene internet, pero distribuye certificados y complica la correlatividad con múltiples cajas.
- **En la nube:** centraliza certificados y numeración fiscal; requiere conexión para emitir el comprobante autorizado.

**Consecuencias (a evaluar).** Impacta numeración fiscal, resguardo de certificados y comportamiento offline del comprobante (`pendiente_cae`).

**Acción:** decidir al diseñar R2. Se solicita opinión (RFC-001 §8.2).

---

## ADR-014 — Unidad de compra vs. unidad de venta (factor de conversión)

**Estado:** Aceptado

**Contexto.** Productos a granel/caja (ej. tornillos en cajas de 100) se compran por caja y se venden por unidad suelta. El modelo con una sola `unidad_medida` no lo cubría.

**Decisión.** Se venden **ambas** modalidades. `Producto` incorpora:
- `unidad_venta`: unidad en la que se vende y se lleva el **stock** (reemplaza a `unidad_medida`).
- `unidad_compra`: unidad en la que se compra (ej. caja).
- `factor_conversion`: cuántas `unidad_venta` hay en una `unidad_compra` (default 1).
- Se conserva `permite_fraccion` (si la `unidad_venta` admite decimales, ej. cable por metro).

El **stock y los precios** se llevan siempre en `unidad_venta`. En la **recepción**, la cantidad puede registrarse en `unidad_compra` y el sistema convierte a `unidad_venta` con el `factor_conversion` (y el costo unitario en venta = costo de compra / factor). La **reposición sugerida** se calcula en `unidad_venta` y puede mostrarse también convertida a `unidad_compra` (cajas).

**Consecuencias.**
- (+) Cubre venta por unidad, por caja o ambas, con un solo producto.
- (+) El stock en la unidad más chica mantiene la exactitud del inventario.
- (−) Suma tres campos a `Producto` y lógica de conversión en recepción y reposición.
- Caso simple: `unidad_compra = unidad_venta` y `factor_conversion = 1`.

**Alternativas.** Una sola unidad por producto → no cubre comprar por caja y vender suelto.

**Aplica a:** R1 (`Producto`, P1.1/P1.3), recepción R3 (P3.2), reposición R1 (P1.10).

---

## ADR-015 — Formato de impresión de etiquetas y comprobantes

**Estado:** Aceptado

**Contexto.** Las etiquetas de producto son solo QR en tres tamaños (5×5, 10×10, 15×15 cm); los comprobantes se imprimen en impresora común. Faltaba decidir el formato físico de salida.

**Decisión.** Soportar **ambos** formatos de salida, configurable:
- **Impresora de etiquetas / rollo** (etiqueta adhesiva individual).
- **Plancha A4 en impresora común** (varias etiquetas por hoja / comprobante en A4 o ticket).

La capa de impresión se **abstrae** detrás de una interfaz de "salida de impresión" con dos implementaciones (etiquetadora y A4), seleccionable en configuración. El contenido (QR + tamaño) es independiente del medio.

**Consecuencias.**
- (+) El comercio usa el hardware que tenga (etiquetadora o impresora común) sin rehacer nada.
- (+) Desacopla generación de contenido de la salida física.
- (−) Hay que implementar y probar dos caminos de impresión y su configuración.

**Alternativas.** Fijar un único formato → ataría al comercio a un hardware específico.

**Aplica a:** R1 (etiquetas, P1.3) y comprobantes (R1 ticket interno / R2 fiscal).

---

## ADR-016 — ORM y herramienta de monorepo

**Estado:** Aceptado

**Contexto.** El stack TypeScript (ADR-002) requiere definir el acceso a datos y la organización del repositorio compartido cliente/nube, usando SQLite (local) y PostgreSQL (nube) con el mismo modelo.

**Decisión.** ORM **Drizzle**; monorepo con **pnpm workspaces**.

**Consecuencias.**
- (+) Drizzle es TypeScript-first, liviano y con SQL explícito; soporta SQLite y PostgreSQL de forma pareja con el mismo esquema tipado (clave para compartir modelo entre cliente y nube).
- (+) Menor capa de runtime que Prisma, lo que encaja mejor en el cliente Electron.
- (+) pnpm workspaces cubre la escala del proyecto (cliente + nube + paquete compartido) sin la complejidad de turborepo.
- (−) Drizzle delega más control al desarrollador (menos "magia"); requiere mayor disciplina en migraciones.

**Alternativas.** Prisma (runtime más pesado, manejo de SQLite/Electron más complejo); turborepo (complejidad innecesaria para esta escala) → descartados.

**Aplica a:** R1 (P1.0) en adelante.

## ADR-017 — Reabastecimiento desacoplado de Órdenes de Compra; OC con modo manual y sugerido

**Estado:** Aceptado
**Fecha:** 2026-06-19
**Release:** R3
**Contexto de decisión:** Joaquin (decisión) · Claude (asesor técnico)

### Contexto

El reporte de reabastecimiento (entregado en R1, P1.11) identifica productos
bajo mínimo, mezclando artículos de múltiples proveedores. Las órdenes de
compra, por regla de negocio, se emiten a un único proveedor (proveedor_id
vive en ordenes_compra, no por ítem). Al iniciar R3 surgió la pregunta de
cómo conectar ambos: si el reporte de reabastecimiento debía generar OCs
directamente, o si el flujo de compras debía construirse como módulo aparte.

Generar OCs desde el reporte exige una relación producto↔proveedor que el
modelo de datos no tenía, y modificar el reporte de R1 rompería el
phase-gate sobre un módulo ya aprobado.

### Decisión

1. **El reporte de reabastecimiento de R1 NO se modifica.** Queda intacto y
   funcionalmente informativo. El módulo de compras lo consume como fuente
   de datos (productos bajo mínimo), nunca al revés.

2. **Se crea un módulo de Órdenes de Compra independiente** con dos modos de
   creación:
   - **Manual:** el operador elige proveedor y arma la OC seleccionando
     productos asociados a ese proveedor.
   - **Sugerido:** el sistema lee los productos bajo mínimo, los agrupa por
     proveedor preferido, y arma una o varias OC sugeridas, una por
     proveedor. La sugerencia es siempre editable y requiere confirmación
     humana: el sistema propone, nunca emite directamente.

3. **Se introduce la relación producto↔proveedor** como tabla intermedia
   N:N con atributos (producto_proveedor): costo_centavos, codigo_proveedor
   (SKU del artículo según el proveedor), y preferido (booleano, un único
   preferido por producto). Esta relación es la pieza que habilita la
   sugerencia automática y la gestión de compras en general.

4. **Productos bajo mínimo sin proveedor preferido** quedan fuera de la
   sugerencia automática y se listan aparte ("sin proveedor asignado") para
   que el operador asigne uno.

5. **Congelamiento de costo:** producto_proveedor.costo_centavos es el último
   costo conocido (referencia/sugerencia). La OC congela su propio costo al
   emitirse, independiente del valor de referencia. Mismo principio de
   "congelar valores en el momento de la transacción".

### Consecuencias

**Positivas**
- No se toca un módulo aprobado de R1: phase-gate intacto.
- Compras y reabastecimiento evolucionan de forma independiente.
- La relación producto↔proveedor habilita gestión de compras, comparación
  de costos entre proveedores y trazabilidad de SKUs de proveedor.
- La sugerencia editable evita que el sistema genere obligaciones de compra
  sin intervención humana.

**Negativas / costos**
- Nueva tabla y nueva pantalla de gestión de la relación (P3.3), más
  superficie a mantener.
- La pantalla de detalle de producto (R1) recibe una sección/tab adicional
  para gestionar proveedores; ese cambio se documenta como ADR aparte por
  tocar una pantalla aprobada.
- "Preferido" como booleano no soporta prioridad ordenada de proveedores;
  si se necesita en el futuro, implica migración.

### Alternativas descartadas

- **Botón "generar OC" dentro del reporte de reabastecimiento:** acopla dos
  dominios, rompe phase-gate de R1 y mezcla un reporte informativo con un
  flujo transaccional.
- **Proveedor preferido como FK simple en producto:** no permite registrar
  costo ni SKU por proveedor, ni múltiples proveedores por producto.
- **Emisión automática directa de OCs:** descartada por generar obligaciones
  de compra sin confirmación humana.

### Decisiones abiertas derivadas

- ¿La recepción de mercadería (P3.5) actualiza producto_proveedor.costo_centavos
  con el costo real recibido? (pendiente de confirmar)
- "Preferido" booleano vs. prioridad ordenada: se arranca con booleano.

## ADR-018 — Actualización de costo de referencia en recepción de mercadería

**Estado:** Aceptado
**Fecha:** 2026-06-19
**Release:** R3 (aplica en P3.5)

**Decisión:** La recepción de mercadería actualiza
producto_proveedor.costo_centavos con el costo real recibido (último costo
conocido), de forma EXPLÍCITA y confirmada por el operador. La UI muestra
"costo anterior → costo recibido" y requiere confirmación. No hay
actualización silenciosa. La OC ya congeló su costo al emitirse; esta
actualización solo afecta la referencia para futuras sugerencias de compra,
no la transacción histórica.

**Alternativa descartada:** Actualización automática silenciosa — una compra
puntual a precio atípico ensuciaría la referencia sin trazabilidad.

---

## ADR-019 — Cuenta corriente de proveedores fuera de scope de R3

**Estado:** Aceptado (diferido)
**Fecha:** 2026-06-19
**Release:** diferido (post-R3)

**Decisión:** R3 incluye cuenta corriente de CLIENTES únicamente. El circuito
de compras de R3 llega hasta recepción de mercadería y comprobante de compra.
La cuenta corriente de PROVEEDORES (deuda con el proveedor, pagos a
proveedores, conciliación) es un dominio separado y se difiere a una release
futura, para no incurrir en scope creep.

**Consecuencia:** El modelo de R3 no contempla deuda ni pagos a proveedores.
Cuando se retome, será su propio bloque de fases con ADR de entrada.

## ADR-020 — Sección "Proveedores" en Detalle de Producto (excepción phase-gate R1)

**Estado:** Aceptado
**Fecha:** 2026-06-22
**Contexto:** R3 implementa la relación many-to-many producto↔proveedor
(`costo_centavos`, `codigo_proveedor`, `preferido`) y el modo sugerido de OC
agrupa faltantes por proveedor preferido. La UI de alta/modificación de producto
(Detalle de Producto, R1 aprobada) no expone ningún punto de entrada para
administrar esa relación, por lo que `preferido` nunca se puebla y el modo
sugerido de OC queda inutilizable (lista faltantes sin agrupar).

**Decisión:** Se agrega una sección/tab "Proveedores" al Detalle de Producto
para administrar la relación producto↔proveedor. Esto modifica una pantalla R1
aprobada y se documenta como excepción explícita a la disciplina de phase-gate.

**Reglas:**
- Un producto tiene a lo sumo un proveedor `preferido`. La exclusividad se
  garantiza a nivel transacción (al marcar uno, se desmarca el anterior).
- La sección solo asocia proveedores existentes; no los crea.
- IPC entity-namespaced (`producto.proveedores.*`).

**Alternativas consideradas:**
- B) Administrar la relación desde la ficha de Proveedor (módulo Compras, R3):
  mantiene R1 intacto pero genera fricción ("estoy en el producto, no quiero ir
  a Compras"). Descartada por flujo de uso del encargado.

**Consecuencias:** Se rompe la inmutabilidad de R1 de forma controlada y
documentada. El modo sugerido de OC pasa a ser funcional.

## ADR-021 — Política de Backup

**Estado:** Aceptado
**Fecha:** 2026-06-24
**Contexto release:** Configuración (transversal). Operativa desde R3.
**Decisores:** Joaquín (product owner)

### Contexto

La aplicación maneja datos críticos del negocio (inventario, ventas, cuenta corriente de clientes, compras) en SQLite local con WAL mode, más certificados AFIP/ARCA en `userData`. No existía mecanismo de resguardo. Una pérdida de la base (corrupción, falla de disco, error de usuario) implica pérdida total e irrecuperable de la operación.

### Decisión

Se implementa un módulo de Backup en Configuración con las siguientes definiciones:

1. **Artefacto único `.fbk`** (zip versionado) que contiene:
   - `ferreteria.db` — copia generada SIEMPRE vía `db.backup()` de `better-sqlite3` (consistente con WAL, sin frenar la app). Nunca copia manual de `.db`/`-wal`/`-shm`.
   - `certs/` — certificados AFIP/ARCA, **opcional** (ver ADR aparte / punto 4).
   - `manifest.json` — metadata de validación.
   - `checksums.sha256` — hash por archivo.

2. **`manifest.json`** incluye: `app_version`, `created_at` (ISO -03:00), `sucursal_id`, `db_sha256`, `row_counts{}`, `incluye_certs`, `tipo` (manual|auto), y el estado de esquema de Drizzle: `last_migration_hash`, `migrations_applied`, `last_migration_at`. El manifest y los checksums quedan **fuera de cualquier cifrado** para permitir la previsualización del restore sin contraseña.

3. **Versión de esquema:** se lee directamente de `__drizzle_migrations` (fuente de verdad gestionada por Drizzle). **No se usa `PRAGMA user_version`** (queda en 0, sin tocar) para evitar una segunda fuente de verdad desincronizable. Ver ADR-022.

4. **Destino (Capa 1):** carpeta elegida por el usuario vía diálogo nativo de Electron. Puede ser disco local, NAS, o una carpeta sincronizada por Google Drive Desktop / OneDrive. Esto cubre el requerimiento "subir a Drive" sin OAuth ni Google Drive API. La integración nativa con Drive API se difiere (ver ADR-023).

5. **Backup automático enganchado al cierre de caja**, no a cron horario. Más backup manual on-demand siempre disponible.

6. **Retención por rotación:** se borran backups más viejos que `backup_retencion_dias`, **solo dentro de la carpeta de backups gestionada**, nunca fuera de ella, y cada borrado se loguea.

7. **Parámetros en `parametros_sistema`** (editables por Supervisor):
   `backup_auto_habilitado` (true), `backup_frecuencia` (diaria), `backup_momento` (cierre_de_caja), `backup_retencion_dias` (30), `backup_destino_local` (ruta), `backup_incluir_certs` (false por defecto).

8. **Certificados AFIP (opcional + cifrado):** `backup_incluir_certs` por defecto en **false**. Si se activa, el `.fbk` se cifra con contraseña **AES** (no ZIP legacy). La contraseña **no se persiste**: se pide en cada backup/restore con certs. Advertencia explícita en UI al activar el flag ("Los certificados AFIP son credenciales fiscales. El backup se cifrará con contraseña. No compartas este archivo ni la contraseña.").

9. **Permisos:** backup ejecutable por rol con permiso (Supervisor; cajero on-demand opcional).

10. **IPC namespaced:** `backup:ejecutar`, `backup:listar`, `backup:eliminar`.

### Política de redundancia (estándar 3-2-1 adaptado)

- 3 copias: base productiva + 2 backups.
- 2 medios: local (disco/NAS) + remoto (carpeta Drive sincronizada).
- 1 fuera de sitio: la copia en Drive.

### Consecuencias

- **Positivas:** resguardo consistente sin frenar la operación; "subida a Drive" gratis vía cliente de sync, sin deuda de OAuth; política operativa parametrizable por el Supervisor; certs protegidos por opt-in cifrado.
- **Negativas / costo:** uso de disco por retención; depende de que el usuario configure correctamente la carpeta destino y, para off-site, tenga Drive Desktop instalado.
- **Riesgo mitigado:** el riesgo de carpeta volátil (`Downloads`/OneDrive) ya identificado se neutraliza porque el destino se elige conscientemente.

---

## ADR-022 — Restore atómico con validación de esquema

**Estado:** Aceptado
**Fecha:** 2026-06-24
**Contexto release:** Configuración (transversal). Operativa desde R3.
**Decisores:** Joaquín (product owner)

### Contexto

El restore es una operación destructiva e irreversible desde la perspectiva del usuario: reemplaza la base productiva. Sin diseño cuidadoso, los modos de falla son (a) restaurar un backup corrupto, (b) restaurar un backup con esquema incompatible y corromper la base silenciosamente, (c) quedar en estado "a medio restaurar" si el proceso se interrumpe.

### Decisión

Restore implementado como **wizard paso a paso, solo rol Supervisor, con log de auditoría**:

1. **Seleccionar origen** (`.fbk`) vía diálogo nativo. Si el manifest indica `incluye_certs` + cifrado, se pide la contraseña en este paso.

2. **Validación automática (read-only) antes de mostrar nada:**
   - Verificar checksums → si falla, **stop** ("archivo dañado o incompleto").
   - Leer `manifest.json` y comparar `last_migration_hash` del backup contra el actual:
     - **Hashes iguales** → mismo esquema, restore directo.
     - **Backup es subconjunto del historial actual** (su última migración existe más atrás en `__drizzle_migrations`) → compatible; se restaura y luego se corre `drizzle migrate()` sobre la copia temporal.
     - **Hash desconocido** (backup más nuevo que la app) → **stop** ("Este backup fue creado con una versión más nueva de la aplicación. Actualizá la app antes de restaurar"). Drizzle no migra hacia atrás.

3. **Tabla comparativa ACTUAL vs BACKUP** (fecha + `row_counts` por entidad + certs sí/no). El usuario ve qué gana y qué pierde antes de decidir.

4. **Backup pre-restore automático y obligatorio** (`pre-restore_<fecha>.fbk`) de la base actual. **No opcional.** Es la red de recuperación.

5. **Confirmación fuerte:** tipear `RESTAURAR` o doble checkbox de consentimiento (datos serán reemplazados / respaldo de seguridad guardado).

6. **Ejecución atómica:**
   - Restaurar a archivo temporal `ferreteria.db.restoring` (nunca sobre el archivo en uso).
   - `PRAGMA integrity_check` sobre el temporal.
   - Si el backup era subconjunto: `drizzle migrate()` sobre el temporal; verificar que `__drizzle_migrations` quedó al día.
   - Cerrar conexión → **swap atómico** del archivo → reabrir.
   - Si cualquier paso falla → revertir al original (que nunca se tocó). La app no puede quedar en estado intermedio.

7. **Verificación post-restore:** `integrity_check` final + mostrar `row_counts` reales de la base cargada (deben coincidir con lo prometido) + **forzar reinicio de la app** (estado limpio, sin conexiones colgadas ni caché en memoria).

8. **Permisos y auditoría:** restore **solo Supervisor**. Log: quién, cuándo, archivo origen, conteos antes/después.

9. **IPC namespaced:** `restore:validar` (read-only, alimenta los pasos 2-3) y `restore:ejecutar` (escritura, pasos 4-7), **separados**.

### Prerrequisito (resuelto)

El versionado de esquema necesario para el paso 2 **ya existe** vía `__drizzle_migrations`. No requiere desarrollo previo. `user_version` permanece en 0 sin uso (ver ADR-021 §3).

### Consecuencias

- **Positivas:** restore informado e intuitivo; imposibilidad de corrupción por esquema incompatible; atomicidad garantiza que nunca se pierde la base anterior; doble red (validación previa + backup pre-restore).
- **Negativas / costo:** flujo deliberadamente lento (es la intención); uso de disco extra por el pre-restore; requiere reinicio de la app post-restore.

---

## ADR-023 — Integración nativa con Google Drive (diferida)

**Estado:** Diferido
**Fecha:** 2026-06-24
**Contexto release:** Candidata a R4 (cloud sync / backend).
**Decisores:** Joaquín (product owner)

### Contexto

El requerimiento original pedía poder subir backups "directamente a un Drive de Google". La lectura literal implica integrar la Google Drive API vía OAuth dentro de la app de escritorio.

### Decisión

**Se difiere la integración nativa con Google Drive API.** En su lugar, ADR-021 resuelve el requerimiento vía Capa 1 (carpeta sincronizada por Drive Desktop), que cubre el caso de uso sin código de OAuth.

### Razones

- OAuth de Google para app de escritorio distribuida requiere registro en Google Cloud Console, consent screen, posible verificación de Google por scopes sensibles, y almacenamiento seguro de refresh tokens por instalación. Es fricción y superficie de soporte alta para una PyME que instala un `.exe`.
- Ata la operación de backup a disponibilidad de red, justo en la operación que debería ser la más confiable.
- El lugar arquitectónicamente correcto para manejar tokens OAuth es el backend (server-side), que aparece recién en R4 con la infraestructura de cloud sync.

### Condición de reevaluación

Se retoma en R4, cuando exista backend Node para el manejo de credenciales server-side. En ese momento la "subida a Drive nativa" se evalúa como botón in-app desacoplado del cliente de sync.

### Consecuencias

- **Positivas:** cero deuda técnica de OAuth en esta release; el requerimiento de off-site queda igualmente cubierto; los tokens, cuando existan, vivirán en el lugar correcto.
- **Negativas:** el usuario que quiera off-site depende de tener Google Drive Desktop (u OneDrive) instalado y la carpeta destino apuntada ahí.

---

## ADR-024 — Catálogo geográfico normalizado para validación offline de direcciones

**Estado:** Aceptado
**Fecha:** 2026-06-26
**Contexto release:** R3 (Compras y Crédito) — transversal a clientes y proveedores.
**Decisores:** Joaquín (product owner)

### Contexto

Los formularios de alta/edición de clientes y proveedores tenían campos `localidad`, `provincia` y `codigo_postal` como texto libre. Esto genera inconsistencias (escritura libre sin validación), imposibilita filtros futuros por zona, y dificulta la integración fiscal (R2) donde la localidad puede requerirse codificada.

Se necesitaba decidir si normalizar estas entidades como catálogo en la base local, y cómo poblarlas sin depender de conectividad en producción.

### Decisión

Se implementa un catálogo geográfico de tres niveles (`provincia` → `departamento` → `localidad`) en la base SQLite local, poblado por un script externo (`seed:geo`). Los campos libres `localidad`/`provincia`/`codigo_postal` se conservan en `cliente` y `proveedor` como fallback; se agrega la FK nullable `localidad_id → localidad.id`.

**Estructura de tablas:**
- `provincia`: `id`, `nombre`, `nombre_norm`
- `departamento`: `id`, `nombre`, `nombre_norm`, `provincia_id`
- `localidad`: `id`, `nombre`, `nombre_norm`, `provincia_id`, `departamento_id`, `codigo_postal`; índices en `provincia_id`, `nombre_norm`, `codigo_postal`

**Sin campos de sincronización:** estas tablas son datos de referencia estáticos (no datos del usuario). No llevan `version`, `origin_id`, `sync_state`, ni `updated_at`. El catálogo se actualiza ejecutando `seed:geo` sobre cada instalación.

**Fuentes de datos:**
- Provincias, departamentos y localidades: [APIs del gobierno — georef v2.0](https://apis.datos.gob.ar/georef/api/v2.0) (datos oficiales del INDEC).
- Códigos postales: dataset público `androdron/localidades_AR` en GitHub (match por `provincia_norm|localidad_norm`).

**Script `seed:geo`** (`pnpm seed:geo`):
- Descarga y cachea los CSV en `geo-cache/` (modo offline con `--offline`).
- Aplica las migraciones pendientes antes de insertar (idempotente via `ON CONFLICT DO UPDATE`).
- Carga en transacción atómica: ~24 provincias, ~530 departamentos, ~~5000 localidades.
- No depende del proceso Electron; usa su propia conexión a la DB (`ELECTRON_RUN_AS_NODE=1`).

**IPC (`geo:provincias` / `geo:localidades`):** ambos requieren sesión activa. `geo:localidades` filtra por `provincia_id` y acepta un query `q` (búsqueda por substring); retorna máximo 50 resultados.

**Componente `DireccionGeo`:** select de provincia + input autocomplete de localidad (dropdown con filtrado client-side) + campo CP editable. Cuando se selecciona una localidad, el CP se auto-completa desde `localidad.codigo_postal` pero puede editarse manualmente. El CP autopopulado es orientativo; el dato oficial es la FK.

**Rutas de clientes:** se crean `/clientes/nuevo` y `/clientes/:id/editar` con el componente `ClienteForm` que integra `DireccionGeo`.

### Alternativas evaluadas

- **Solo texto libre (statu quo):** simple pero sin validación ni posibilidad de filtrar por zona. Descartado.
- **API online en tiempo real:** consultar georef por cada keystroke. Descartado: viola el principio offline-first.
- **Tabla plana sin jerarquía:** una sola tabla `localidad` con provincia como texto. Descartado: duplicación de nombres de provincia, sin FK para joins futuros.

### Consecuencias

- **Positivas:** validación offline de localidades completa; CP auto-poblado reduce errores; base para filtros por zona en reportes futuros; sin dependencia de red en operación normal.
- **Negativas / costo:** `seed:geo` debe ejecutarse en cada instalación nueva (y periódicamente si el dataset cambia); ocupa ~5-10 MB en la DB local; el dataset de CP tiene cobertura parcial (~70-80% de localidades).
- **Deuda aceptada:** los registros existentes de clientes/proveedores con `localidad` texto libre no se migran automáticamente a `localidad_id`; se actualizan al editar cada cliente.

## ADR-025 — Formato de SKU interno y modelo de códigos del producto

**Fecha:** 2026-06-30
**Estado:** Aceptado
**Contexto de release:** R3 (previo a la primera carga masiva de productos)

### Contexto

Previo a la primera carga masiva se fija el formato del identificador interno del
producto (SKU) y se ordena el modelo de códigos de la tabla `producto`. El esquema
real reveló: PK `id` como UUID (correcto para offline-first), un `sku` correlativo
de 3 dígitos sin verificación, una columna `codigo_qr` que almacenaba el SKU con
máscara `QR-`, y `gtin_barcode` (EAN-13 del fabricante) NOT NULL. Los registros
existentes (`P-001`, `P-002`) son datos de prueba descartables.

### Decisión

**1. SKU interno: opaco, secuencial, estable, con check digit.**

Formato: `<TIPO>-<NNNNNNN>-<C>` — ej. `P-0000042-7`
- **TIPO:** alfabético mayúscula. v1: solo `P` (producto), hardcodeado. Se reserva el espacio de prefijos para entidades futuras (kits, servicios) sin implementar mecanismo multi-tipo ahora (YAGNI); el primer tipo nuevo se incorpora vía ADR breve.
- **NNNNNNN:** secuencial de 7 dígitos, cero-padded.
- **C:** dígito verificador módulo-10 (Luhn) sobre los 7 dígitos del secuencial. El
  prefijo NO participa del cálculo. Detecta errores de tipeo en ingreso manual.

**2. El secuencial vive en columna propia, NO se deriva del PK.**

El PK `id` es UUID generado en cliente (identidad de sync, opaca, sin coordinación
entre nodos). No es proyectable a un correlativo numérico. Por lo tanto el SKU se
alimenta de una columna dedicada `sku_secuencial` (INTEGER). El `sku` (TEXT) es la
proyección determinística de `sku_secuencial` + check digit.

UUID y SKU NO compiten: el UUID resuelve identidad técnica/sync; el SKU resuelve
identidad de negocio legible. Coexisten por diseño.

**3. Generación del secuencial: contador atómico en `parametros_sistema`.**

`sku_proximo_secuencial` en `parametros_sistema`, incrementado en la MISMA transacción del alta. Válido para instalación single-node (un local). El caso multinodo (R4, sync) se difiere: se resolverá con rango por nodo o generación server-side. En carga masiva (batch single-node) se asignan correlativos en orden.

**4. Modelo de códigos: una fuente de verdad, múltiples representaciones.**

- `gtin_barcode` (TEXT, **NULLABLE**): EAN-13 del fabricante. Nullable porque granel y productos sin código de fábrica no lo tienen. Es el código que se escanea en POS cuando el producto trae código impreso.
- **Barcode interno y QR NO son columnas.** Son representaciones del `sku` generadas en la capa de impresión de etiqueta (ADR-026): code128 y QR codifican el `sku` PELADO (`P-0000042-7`), sin máscara ni prefijo.
- Se **elimina la columna `codigo_qr`**: almacenaba una proyección del SKU (`QR-P-001`), redundante y contraria a "formateo solo en capa de render".

**5. Discriminación de scan en POS: por patrón, no por prefijo.**

El POS distingue EAN vs SKU por forma del string (EAN = 13 dígitos numéricos; SKU =
patrón `^P-\d{7}-\d$`), no por un marcador embebido. Si en el futuro se requiere un
marcador de tipo en el scan, se agrega vía máscara en la capa de render de etiqueta
(ADR-026) sin alterar el SKU almacenado. Camino de salida reversible.

### Reglas asociadas

- SKU opaco: PROHIBIDO codificar categoría, proveedor, marca o mnemónico en él.
- Categoría/proveedor/marca/etc. son atributos en columnas (FK UUID); su lectura humana se resuelve por JOIN, nunca almacenando el texto en `producto`.
- Recategorizar NO modifica el SKU.
- `sku_secuencial` nunca se recicla (respeta soft-delete).
- SKU interno ≠ `gtin_barcode`: identificadores distintos, columnas distintas, propósitos distintos.

### Consecuencias

- (+) SKU inmune a recategorización, sin colisiones, generación trivial en import.
- (+) Modelo de códigos con una sola fuente de verdad (el SKU); QR/code128 derivados.
- (+) Granel cargable (gtin nullable).
- (−) El secuencial single-node tiene una arista de sync diferida a R4 (documentada).
- (−) El check digit solo aporta valor en ingreso manual; en escaneo es inerte. Aceptado.
- (−) Inspección cruda en DBeaver muestra FK como UUID; se mitiga con vista legible
  (`producto_legible` con JOINs) sin tocar el modelo.

### Alternativas descartadas

- SKU parlante (mnemónico o rangos numéricos por categoría): acoplamiento a negocio,
  se rompe ante recategorización, colisiones, generación compleja. Descartado.
- Derivar el SKU del PK físico: inviable, el PK es UUID. Descartado.
- `codigo_qr` como columna almacenada: redundante con el SKU. Eliminado.

### Parámetros

Ancho del secuencial (7) y algoritmo de check digit son CONSTANTES DE DISEÑO: no van a `parametros_sistema` ni son editables por Supervisor (cambiarlos invalidaría SKUs). El contador `sku_proximo_secuencial` SÍ vive en `parametros_sistema` (es estado, no formato).

## ADR-026 — Módulo de impresión de etiquetas por lote

- **Fecha:** 2026-07-03
- **Estado:** Aceptado
- **Release:** R3 (excepción de phase-gate; funcionalidad de dominio R1 — catálogo/depósito)

### Contexto

Surge la necesidad operativa de imprimir etiquetas de góndola/estante en lote,
seleccionando y filtrando artículos del catálogo. Conceptualmente la impresión de
etiquetas pertenece al dominio de catálogo/depósito (R1), pero la necesidad aparece
durante R3. Modificar pantallas R1 aprobadas requeriría una excepción de phase-gate
con impacto sobre código ya cerrado.

El requerimiento incluye dos formatos físicos distintos (hoja A4 tipo Avery y rollo
de etiquetas para impresora térmica), selección/filtrado múltiple de artículos y
cantidad de etiquetas por artículo.

### Decisión

Se construye un **módulo aislado** (`etiquetas`) que **solo lee** de `producto` y
`producto_proveedor`. No modifica POS, caja ni el detalle de producto aprobados, por
lo que el riesgo de phase-gate es bajo y la excepción queda acotada a la creación de
un módulo nuevo, sin alterar artefactos R1/R2/R3 existentes.

1. **Salida unificada.** Ambas modalidades (hoja A4 y rollo térmico) se resuelven vía
   Electron `webContents.printToPDF` + driver de Windows. El render térmico es una
   "página" del tamaño exacto de la etiqueta del rollo. ZPL/ESC-POS nativo queda
   **fuera de alcance** (mejora futura documentada).

2. **Perfiles de etiqueta en `parametros_sistema`.** La geometría es configurable
   mediante perfiles guardados; el contenido de la etiqueta es fijo en v1. Estructura:
   perfil_etiqueta = {
    tipo: 'hoja' | 'rollo',
    ancho_mm, alto_mm,                       // tamaño de la etiqueta individual
    cols, filas, margen_mm, gap_mm,          // solo tipo 'hoja' (grilla A4)
    barcode_tipo: 'code128' | 'qr',
    campos: { nombre, precio, sku, barcode } // qué se imprime (fijo en v1)
    }

Se admiten varios perfiles guardados (ej. "Avery 3x8", "Rollo 50x30"); se elige uno
   al momento de imprimir.

3. **Dos destinos de salida.**
   - **Imprimir:** dispara `print` con selección de impresora (`silent: false`).
   - **Exportar a PDF:** guarda el lote como archivo mediante `dialog.showSaveDialog`
     (diálogo nativo). El operador elige la ruta; **no se persiste ninguna ruta** ni se
     usa ruta hardcodeada.

4. **Código de barras / QR.** El perfil define `barcode_tipo`. Ambos tipos codifican
   el **SKU/código interno** del producto (mismo payload); el QR es una elección
   visual/de tamaño, **no** de contenido. Esto garantiza que la etiqueta se escanee en
   POS de forma idéntica al Code128. `code128` vía jsbarcode (SVG inline); `qr` vía
   librería qrcode (SVG inline).

5. **Precio.** Enteros en centavos en toda la lógica; formateo únicamente en el render
   ("centavos hasta el borde").

6. **Celda de inicio.** Para perfiles `hoja`, se permite indicar la celda desde la cual
   comenzar la impresión, para reaprovechar hojas de etiquetas a medio usar.

7. **Soft-delete.** El listado de selección no muestra productos dados de baja.

### Convenciones respetadas

- IPC namespaced bajo `etiquetas:*`.
- Sin valores hardcodeados: geometría, perfiles y `barcode_tipo` viven en `parametros_sistema`.
- Módulo de solo lectura sobre el dominio de productos; sin efectos de escritura fuera
  de la persistencia de perfiles y la exportación de archivos elegida por el operador.

### Alcance excluido (mejoras futuras)

- Impresión nativa ZPL/ESC-POS directa a impresora térmica.
- Editor de plantillas (contenido/posiciones de campos configurables). En v1 el contenido
  es fijo: nombre + precio + código.
- Payload de QR distinto al código interno (URL, JSON con id+precio).

### Consecuencias

- **Positivas:** dos formatos físicos con un único motor de render; sin dependencias de
  protocolo de impresora; excepción de phase-gate de bajo riesgo por ser módulo aislado
  de solo lectura; escaneo en POS consistente independientemente del tipo de código.
- **Negativas / costos:** dos dependencias nuevas (jsbarcode, qrcode); calibración de
  márgenes de impresión dependiente de impresora/driver; el render térmico vía driver de
  Windows es menos exacto que ZPL nativo (aceptable para v1).

### Componentes afectados

- `packages/client/src/main/ipc/etiquetas.ts` — IPC (`etiquetas:*`).
- `packages/client/src/renderer/routes/etiquetas/` — pantalla de selección + preview.
- `packages/shared/` — tipos `PerfilEtiqueta`, `EtiquetaItem`.
- `parametros_sistema` — perfiles de etiqueta.

## ADR-027 — Autenticación por usuario/contraseña, eliminación de PIN.
Se elimina el PIN numérico en todo el sistema (login y autorización de cierre de caja). Todo usuario se autentica con usuario + contraseña; el rol se deriva de la cuenta, con selección de rol solo si tiene más de uno asignado (se mantiene el patrón condicional ya mockeado en P1.3). El cierre de caja con diferencia sobre umbral_diferencia_caja requiere reautenticación de un supervisor vía modal usuario+contraseña, reemplazando el ingreso de PIN. Esquema: se elimina pin_rapido de Usuario, se agrega contraseña_hash. Hashing con scrypt nativo de node:crypto (sin dependencia nueva). Pantallas R1 afectadas (fase-gate): Login/selección de rol, Caja — cierre de turno.


## ADR-028 — Reorganización de navegación: sidebar agrupado.
El sidebar pasa de lista plana a grupos colapsables: Catálogo, Abastecimiento, Clientes, Configuración. Reabastecimiento se relocaliza dentro de Abastecimiento como "Reposición sugerida" (ejecuta la decisión diferida en R3 al cierre del módulo de Compras). Importaciones se relocaliza a Configuración. Ubicaciones permanece en Catálogo (uso operativo diario de depósito, no aplica el criterio de baja frecuencia que rige Configuración). El grupo Clientes incluye el ABM de ficha de cliente junto con Cuenta Corriente — conviven porque comparten entidad, no porque sean la misma tarea.


## ADR-029 — ABM de Categorías.
Nueva pantalla /config/categorias: alta/edición/baja lógica de rubros. Se agrega alta rápida inline en el selector de rubro del alta/edición de producto. Resuelve la siembra pendiente de rubros identificada en ADR-P19-01. Baja bloqueada si existen productos activos referenciando la categoría (mensaje indica cantidad).


## ADR-030 — ABM de Marcas.
Nueva pantalla /config/marcas: alta/edición/baja lógica de marcas. Se mantiene el alta rápida inline ya existente en el formulario de producto. Baja bloqueada si existen productos activos referenciando la marca (mensaje indica cantidad).


## ADR-031 — Baja lógica de Clientes.
Se agrega activo boolean a Cliente (faltaba, rompía el principio de soft-delete transversal al proyecto). Baja lógica bloqueada si el cliente tiene saldo pendiente en cuenta corriente (saldo_cc ≠ 0, mensaje indica el saldo). Clientes inactivos se excluyen de búsquedas/selectores en POS y alta de OC; su historial de ventas y movimientos de CC permanece intacto.

## ADR-032 — Rediseño de layout POS y modelo de pago combinado (vuelto, mixto, recargo)
Estado: Aceptado · Release: R3 (excepción de phase-gate sobre POS R1/P1.8, en la línea de ADR-020/ADR-026)
Contexto. El layout actual del POS desaprovecha pantalla con una columna lateral fija (cliente, subtotal, total, forma de pago). El modelo de pago es single-method: un único valor forma_pago en venta (incluye CCC desde P3.5). No hay vuelto, pago combinado ni recargo por tarjeta. Existe un diseño previo de este mismo problema (sesión "Mejoras al módulo POS", nunca implementado) que este ADR reemplaza con datos de schema reales.
Decisión.

Layout de tres zonas:
Superior fijo: Cliente + Forma de pago. Este último es informativo/default únicamente — no vincula el cobro, solo pre-completa el popup de confirmación. Default: Efectivo + Consumidor Final.
Medio: lista de artículos, ancho completo.
Inferior fijo: Total, Descuento (reutiliza el descuento por ítem + descuento global ya implementados — sin cambio de modelo, solo reubicación visual) y botón ACEPTAR (reemplaza "Confirmar Venta").

Popup "CONFIRMAR VENTA": se abre al presionar ACEPTAR. No persiste nada en SQLite hasta confirmar dentro del popup. "Volver" descarta sin efectos colaterales. Mantiene la atomicidad ya establecida (venta + caja en una sola transacción).
Tabla venta_pago (1 venta → N filas), reemplaza el campo único forma_pago:

Medios: efectivo, tarjeta, cta_cte, cheque.
Cada fila: medio_pago, monto_centavos, recargo_pct (nullable, default 0, solo tarjeta), recargo_centavos (calculado).
cheque: numero, banco, fecha, titular. Sin validación de estado en v1.
CCC pasa a ser una fila más (medio_pago = 'cta_cte'), consistente con los demás medios en vez de caso especial; sigue impactando cuenta corriente como en P3.6.

Cálculo (todo en centavos):
total_a_cobrar = total_venta (post-descuentos) + Σ recargo_centavos
recargo_centavos = round(monto_pago_tarjeta × recargo_pct / 100)
vuelto = max(0, efectivo_recibido − (total_a_cobrar − Σ pagos_no_efectivo))
vuelto_centavos se persiste en venta (no se re-deriva en cada consulta), para simplificar auditoría de arqueo.
El redondeo a $1 (ADR-010) se aplica solo sobre el componente efectivo, igual que en el modelo single-method actual — no interactúa con recargo_centavos, que es un cargo aparte sobre medios no efectivo.
Validación: Σ pagos ≥ total_a_cobrar; no se confirma con saldo pendiente > 0.
total_venta (productos) no se modifica por el recargo — queda separado para cuando llegue R2/AFIP (probablemente tributa distinto).

Consecuencias.

(+) Desbloquea vuelto, pago mixto y recargo sin tocar el total fiscal de productos.
(+) CCC modelada igual que los demás medios.
(−) Migración de venta.forma_pago → venta_pago: qué hacer con histórico queda abierto — a resolver con Superpowers al ver el schema real (migrar 1 fila por venta vieja vs. dejar el campo legado solo-lectura).
(−) Excepción de phase-gate sobre POS R1/P1.8.

Alternativas descartadas. Recargo como ajuste al total de venta (complica R2/redondeo). Forma de pago superior vinculante (fuerza decisión antes de conocer el total, no soporta combinado).

## ADR-033 — Venta en espera (pausar/retomar sin impactar caja ni stock)
Estado: Aceptado · Release: R3 (excepción de phase-gate sobre POS R1/P1.8)
Contexto. El cajero necesita pausar una venta en curso sin confirmarla, liberar la caja, atender a otro cliente, y retomarla después.
Decisión.

Se reutiliza venta (no tabla separada). Estados nuevos: en_espera, descartada.

Máquina de estados: en_espera → confirmada → anulada ; en_espera → descartada.
descartada = venta abandonada, nunca tocó caja ni stock. No es anulación (distinto del flujo de movimientos inversos de P1.8); no aparece en reportes de ventas ni de anulaciones.

Campos nuevos: alias (opcional), en_espera_desde (timestamp), turno_creacion_id (trazabilidad).
El turno_id de cobro se asigna al confirmar, contra el turno abierto en ese momento — nunca fijo al de creación. Sin turno abierto al confirmar → bloquea (consistente con "cobro sin caja abierta → bloquear").
No impacta caja ni stock hasta confirmada. Stock no se reserva, se revalida al retomar/confirmar (avisa si bajó, no bloquea). Precio se repricea al retomar, avisando si cambió.
Compartidas por turno: cualquier Operador del turno/caja activa retoma o descarta.
Sobreviven al cierre de turno.
Sin correlativo fiscal en espera; se asigna al confirmar.
Parámetros nuevos en parametros_sistema: pos.ventas_en_espera.max (sugerido 10) y pos.ventas_en_espera.ttl_horas (sugerido 24, solo señaliza, nunca auto-descarta).

Riesgo principal. Que en_espera/descartada se cuelen en informes, arqueo o exportación. Mitigación: auditoría por código de todo punto que lea venta.
Decisión parkeada. Reserva de stock para ventas en espera (diferida).
Alternativas descartadas. Tabla separada — duplica lógica de líneas/totales ya existente en venta.

## ADR-034 — Motor de Precios con Vigencia y Auditoría Histórica

**Fecha:** 2026-07-08
**Estado:** Cerrado

### Decisión

Reemplazar el cálculo de precio en tiempo real en el renderer por una tabla de valores absolutos (`lista_precio_valor`) con historización SCD tipo 2. El backend resuelve la precedencia completa (promoción > vigente > fallback) en un único IPC call `listaPrecioValor:getPrecioEnLista`. El renderer nunca recalcula precio base — solo aplica descuentos de línea/global.

### Consecuencias

- Recálculo masivo atómico con múltiples bases (precio lista / costo proveedor / otra lista), alcances y exclusión de manuales recientes.
- Cambios programados con scheduler horario y compare-and-swap para race conditions.
- Auto-seed en alta de producto y alta de lista para minimizar el fallback a caso excepcional.
- Auditoría completa: `recalculo_masivo` registra cada recálculo; `importacion_costo_proveedor_detalle` lista para ADR-035.
- POS muestra badges: verde "en promo", ámbar "sin confirmar" para fallback.
- `PrecioPanel` en ProductoDetalle muestra estado vigente/promo/fallback con edición Supervisor.
- UI Supervisor: tabs "Precios vigentes" + "Cambios programados" + modal Recalcular en ListasPreciosView.

### ADR siguiente diferido

- ADR-035: Importación de listas de costo de proveedor (parser CSV).

## ADR-035 — Importación de listas de costo de proveedor

**Fecha:** 2026-07-08
**Estado:** Cerrado

**Contexto**
ADR-034 (Lista de Precios) dejó fuera de alcance el workflow completo de importación de costos por archivo, creando solo el schema base (`importacion_costo_proveedor`, `importacion_costo_proveedor_detalle`) y el CRUD manual de `producto_proveedor`. Este ADR define e implementa ese workflow: cómo se sube un archivo del proveedor, cómo se matchean sus filas contra el catálogo, y cómo se actualiza `producto_proveedor.costo_centavos` en bloque.

**Decisión**
- **Matching por cadena de fallback:** se intenta primero por `codigo_proveedor` (el código que el proveedor usa para ese producto, guardado en `producto_proveedor`). Si no matchea o el producto no tiene código de proveedor cargado, se intenta por GTIN/código de barras cuando el producto lo tenga. No todos los artículos tienen GTIN, por eso no puede ser el único criterio.
  Si ninguno matchea, la fila cae en la cola de revisión manual.
- **Mapeo de columnas persistente por proveedor:** se agrega `proveedor_importacion_config`
  (proveedor_id, columna_costo, columna_codigo_proveedor, columna_gtin nullable,
  fila_encabezado, formato_archivo, delimitador nullable). Se configura una vez por proveedor en la primera importación; las siguientes reutilizan la configuración guardada.
- **Filas sin matchear → cola de revisión manual.** No se crean productos nuevos
  automáticamente desde una fila sin matchear. Quedan visibles en una pantalla de revisión donde se puede asignar manualmente a qué producto existente corresponden (código nuevo, typo, etc.).
- **Preview obligatorio antes de confirmar.** Mismo patrón que el recálculo masivo de precios (ADR-034): se muestra la tabla completa de costo_anterior vs. costo_nuevo por producto antes de aplicar ningún cambio. Nada se escribe hasta la confirmación explícita del usuario.
- Se extiende `importacion_costo_proveedor_detalle` (creada en ADR-034) con: `fila_original` (dato crudo de la fila para auditoría), `estado` (matched / sin_matchear / resuelto_manual), `matched_by` (codigo_proveedor / gtin / manual), `resuelto_por_usuario_id` y `fecha_resolucion` (nullables, se completan si la fila pasó por revisión manual).

**Alternativas consideradas y descartadas**
- GTIN como único campo de matching: descartado, hay artículos sin GTIN cargado.
- Alta automática de producto nuevo desde fila sin matchear: descartada por ahora — se prioriza evitar productos duplicados o mal cargados por error de tipeo en el archivo del proveedor.
  Puede revisarse más adelante si la cola de revisión manual resulta poco práctica en el uso real.
- Mapeo de columnas a pedir en cada importación: descartado, es repetitivo para proveedores que mandan archivos con frecuencia.

**Consecuencias**
- Tabla nueva: `proveedor_importacion_config`.
- Columnas nuevas en `importacion_costo_proveedor_detalle` (extiende lo creado en ADR-034).
- Requiere UI: pantalla de importación (upload + configuración de mapeo la primera vez + preview + confirmación) y pantalla de cola de revisión manual para filas sin matchear.
- No crea productos nuevos automáticamente — mantiene el catálogo bajo control humano.

## ADR-036 — Vistas cruzadas producto↔proveedor y edición de costo de compra

**Fecha:** 2026-07-13
**Estado:** Cerrado
**Fase/Release:** R3 (Abastecimiento)

### Contexto

`producto_proveedor` ya existe en el schema (FKs a `producto` y `proveedor`, campos
`costo_centavos`, `codigo_proveedor`, `preferido`). Faltaba definir dónde vive la
edición de esa relación y dónde se consulta, ya que un producto puede tener varios
proveedores y un proveedor varios productos.

### Decisión

- **Proveedor es dueño de la relación.** El CRUD completo (asociar, desasociar
  con soft-delete, editar `costo_centavos` y `codigo_proveedor`, marcar `preferido`) vive exclusivamente en el detalle de Proveedor, pestaña "Productos".
- **Producto es solo lectura.** El detalle de Producto muestra una sección
  "Proveedores" (proveedor, costo, preferido) sin edición inline; cada fila linkea
  al detalle del proveedor correspondiente.
- **`preferido` es único por producto.** A lo sumo un proveedor preferido activo
  por producto, enforced con índice único parcial:
  `CREATE UNIQUE INDEX ux_producto_proveedor_preferido ON producto_proveedor(producto_id) WHERE preferido = 1 AND deleted_at IS NULL;`
  Al marcar preferido a uno nuevo, se desmarca el anterior en la misma transacción.
- **IPC namespaced por dueño de la relación:**
  - `proveedor.productos.listar`, `.asociar`, `.desasociar`, `.actualizar` (costo/código/preferido)
  - `producto.proveedores.listar` (solo lectura, para la sección en detalle de producto)
- **Costo en centavos hasta el borde**, formateo AR (`$ 12.345,67`) solo en render.

### Alternativas consideradas

- CRUD espejado en ambos lados: descartado — dos UIs mutando la misma tabla
  intermedia crean ambigüedad sobre cuál gana en un conflicto, sin beneficio real
  para el flujo de compras.

### Consecuencias

- El futuro módulo de Compras (orden de compra) puede apoyarse directamente en
  `proveedor.productos.listar` sin una tercera fuente de datos.
- La sección de solo lectura en Producto es una vista derivada; no requiere su
  propio set de validaciones de negocio.

### Implementación (2026-07-13)

**Migración** `0019_adr036_producto_proveedor.sql`:
- `ALTER TABLE producto_proveedor ADD COLUMN deleted_at INTEGER` — soft-delete.
- `DROP INDEX IF EXISTS pp_preferido_por_producto` + `CREATE UNIQUE INDEX ux_producto_proveedor_preferido ON producto_proveedor(producto_id) WHERE preferido = 1 AND deleted_at IS NULL` — reemplaza el índice anterior (sin condición) por uno parcial que respeta soft-delete.

**Schema Drizzle** (`schema/compras.ts`): campo `deleted_at: integer('deleted_at', { mode: 'timestamp' })` en `producto_proveedor`.

**IPC** (`ipc/producto-proveedor.ts`):
- Nuevos handlers: `proveedorProductosListarHandler` (JOIN producto, filtra `deleted_at IS NULL`), `proveedorProductosAsociarHandler` (crea o reactiva si existía soft-deleted), `proveedorProductosDesasociarHandler` (soft-delete + limpia `preferido`), `proveedorProductosActualizarHandler` (update costo/código/preferido; cuando `preferido=true` usa `db.transaction()` para desmarcar el anterior).
- Handlers existentes actualizados: `listByProducto` filtra `deleted_at IS NULL`; `remove` convertido a soft-delete; `setPreferido` excluye soft-deleted del sweep.

**Preload** (`preload/index.ts`): namespace `compras.proveedor.productos.{listar, asociar, desasociar, actualizar}`. El namespace `compras.pp` se conserva para `ProveedoresPanel` (solo lectura).

**UI**:
- `ProveedoresPanel.tsx` (detalle de Producto): convertido a solo lectura; cada fila es un `<Link>` al detalle del proveedor; estado vacío con texto descriptivo.
- `ProveedorDetalle.tsx`: tabs `[ Datos ] [ Productos ]`; "Datos" conserva el contenido existente; "Productos" renderiza `<ProveedorProductosTab>`.
- `ProveedorProductosTab.tsx` (nuevo): tabla densa con `<thead>` (Producto, Costo, Código proveedor, Preferido, Acciones); alta vía buscador por nombre/SKU; edición inline de costo y código; toggle preferido bidireccional mediante badge/icono clickable (★/☆) en la columna; baja con `window.confirm`; error banner no bloqueante para errores de acción; estado vacío descriptivo.

**Tests**: suites agregadas para los 4 nuevos handlers + actualización de suites existentes para soft-delete y filtrado. 624 tests verdes (54 archivos).

---

## ADR-037 — Arquitectura de Dashboard y Reportes; fase 1 (Ventas y Productos)

**Estado:** Aceptado
**Fecha:** 2026-07-13
**Release:** R3+ (pantalla marcada ☐ en el inventario de `ESTADO.md`; no aplica phase-gate por no haber pantalla previa aprobada)
**Contexto de decisión:** Joaquín (decisión) · Claude (asesor técnico)

### Contexto

El dashboard actual cubre indicadores básicos (ventas del día, top productos, margen, stock, resumen de caja). Se pidió ampliarlo con secciones por Productos, Caja, Clientes y Proveedores, gráficos dinámicos con filtros de período (trimestre/mes/semana), filtro por rubro/producto, distribución horaria y por día de semana/mes, y ranking por vendedor. Además, reportes de compras y ventas con filtros combinables (fecha, artículo, proveedor, tipo de comprobante) e IVA discriminado.

Se definió separar esto en dos superficies distintas — Dashboard (vista ejecutiva) y Reportes (menú, uso analítico/fiscal) — y secuenciar la implementación en fases, arrancando por Ventas y Productos.

### Decisión

1. **Separación Dashboard vs. Reportes.** El Dashboard es de solo lectura, sin exportación, con períodos rápidos. Los Reportes (Compras, Ventas con IVA) viven en el menú, con filtros libres y exportación; quedan para una fase posterior por su dependencia con el módulo fiscal de R2 (la tabla de comprobantes fiscales, cuya ubicación cliente/nube sigue abierta en ADR-013).

2. **Fase 1 = Ventas + Productos.** Caja, Clientes y Proveedores quedan definidos a nivel de propuesta (ver `Propuesta-Dashboard-Reportes.md`) pero no se implementan en este ADR; se abordan en un ADR de fase 2.

3. **UI: pantalla única `/dashboard` con tabs superiores.** Tabs: Resumen, Ventas, Productos (Caja/Clientes/Proveedores quedan como tabs deshabilitados/"próximamente" hasta fase 2, no ocultos — así queda visible el roadmap). Selector de rango de fecha compartido por tab: Hoy / Semana / Mes / Trimestre / Personalizado.

4. **Trimestre = trimestre calendario** (ene-mar, abr-jun, jul-sep, oct-dic), no rolling 90 días. Alineado a criterios contables.

5. **Librería de gráficos: Recharts.** Se agrega como dependencia de `packages/client`. El mapa de calor horario × día de semana se implementa con grid HTML/CSS propio (no es un tipo de gráfico nativo de Recharts).

6. **Todo se resuelve con agregación SQL en SQLite local** (offline-first, ADR-001). El frontend recibe series ya agregadas (`GROUP BY`), nunca agrega datos crudos en el renderer.

7. **Tab Ventas incluye:** evolución temporal (línea, con comparación vs. período anterior), filtro por rubro/categoría (ADR-007) y producto, mapa de calor horario × día de semana, distribución por día del mes, ranking por vendedor (usa `usuario_id`, ya existente por RBAC — ADR-008), top productos y margen (ya existente, se reubica bajo el tab).

8. **Tab Productos incluye:** $ en inventario, sin stock, bajo mínimo, sin movimiento (ya existente, se reubica), curva ABC/rotación (nuevo), margen por categoría (cruza con Motor de Precios, ADR-034).

9. **Vistas/queries de agregación nuevas** (a definir en detalle con Superpowers contra el schema real): venta agregada por período + rubro + producto; venta agregada por hora + día de semana; ranking por `usuario_id`; ranking ABC de productos por cantidad/monto vendido.

### Consecuencias

- (+) Ventas y Productos no tienen dependencias bloqueantes — se construyen ya.
- (+) El reporte de IVA queda correctamente secuenciado después del cierre de R2, sin bloquear esta fase.
- (+) Recharts es composición JSX nativa, fácil de alinear con los tokens de `design-system.md`.
- (−) Nueva dependencia (`recharts`) en el client — requiere gate de instalación.
- (−) Tabs Caja/Clientes/Proveedores quedan visibles pero deshabilitados hasta fase 2; a revisar si genera expectativa prematura en el usuario final del sistema.

### Alternativas descartadas

- **Rutas separadas por sección** (`/dashboard/ventas`, `/dashboard/productos`, etc.): más flexible a futuro, pero mayor complejidad de IPC/routing para un folio inicial que comparte casi todos los filtros.
- **Chart.js**: buena performance e interacción de fábrica, pero requiere colores hardcodeados (no toma las CSS variables de `design-system.md`) y es más imperativo que declarativo.
- **visx**: máxima flexibilidad D3, pero sobrediseño para gráficos de línea/barra/heatmap simple.

### Decisiones abiertas derivadas

- ¿Los tabs Caja/Clientes/Proveedores se muestran deshabilitados o directamente no aparecen hasta fase 2? (este ADR asume "deshabilitados/próximamente"; confirmar antes de implementar)
- ¿Ticket promedio y comparación vs. período anterior van en el primer corte de Ventas o se difieren? (asumido en scope de fase 1)
- Definición exacta de las queries de agregación — se resuelve con Superpowers contra el schema real de `venta`, `venta_pago`, `producto`, `categoria`.

## ADR-038 — Dashboard, fase 2 (Caja, Clientes y Proveedores)

**Estado:** Aceptado — implementado
**Fecha:** 2026-07-13
**Release:** R3+ (continúa ADR-037; tabs marcados "próximamente" en fase 1 se habilitan acá)
**Contexto de decisión:** Joaquín (decisión) · Claude (asesor técnico)

### Contexto

ADR-037 dejó los tabs Caja, Clientes y Proveedores como placeholders deshabilitados dentro de `/dashboard`, acotando la fase 1 a Ventas y Productos. Este ADR define e implementa esos tres tabs. Compras y los reportes de Ventas/IVA (menú, dependientes del módulo fiscal de R2, cuya ubicación cliente/nube sigue abierta en ADR-013) quedan diferidos sin cambios respecto a ADR-037.

### Decisión

1. **Se habilitan los tabs Caja, Clientes y Proveedores** en `/dashboard`, reemplazando los placeholders "próximamente" de ADR-037. Mismo selector de rango de fecha compartido y misma librería (Recharts) definidos en ADR-037.

2. **Tab Caja** — mantiene los KPIs existentes (estado, $ inicial, ingresos, egresos, arqueos) y suma:
   - Tendencia de ingresos/egresos por turno, últimos N turnos.
   - Breakdown por medio de pago (efectivo, tarjeta, cta. cte., cheque), desde `venta_pago` (ADR-032).
   - El monto de tarjeta se muestra **neto de recargo**; el recargo cobrado en el período es un KPI aparte — consistente con ADR-032, donde el recargo nunca infla `total_venta`.
   - Arqueos: fila resaltada en rojo/ámbar cuando `diferencia ≠ 0`.

3. **Tab Clientes (nuevo):**
   - Ranking de clientes por facturación neta del período (descuenta anulaciones).
   - Deuda total: suma de `saldo_cc` de clientes activos (ADR-031).
   - Deuda vencida: definida como **antigüedad genérica desde la venta**, no como vencimiento real por comprobante (que no existe en el modelo hoy). Es el saldo de ventas a crédito con más de `cc_dias_vencimiento` días desde la fecha de venta.
   - Clientes nuevos del período (altas) y clientes inactivos (sin compra en `cliente_dias_inactividad` días).
   - Drill-down: click en un cliente navega a la pantalla de Cuenta Corriente ya existente — no se duplica el detalle transaccional en el dashboard.

4. **Tab Proveedores (nuevo):**
   - Ranking de gasto por proveedor en el período (OCs recibidas × costo).
   - OCs pendientes de recepción y OCs sugeridas sin resolver (modo sugerido, ADR-017).
   - **Deuda con proveedor no se muestra.** La cuenta corriente de proveedores está diferida (ADR-019); se prefiere omitir el KPI antes que mostrar un placeholder que sugiera un dato disponible.

5. **Nuevos parámetros en `parametros_sistema`** (editables por Supervisor): `cc_dias_vencimiento` (default 30) y `cliente_dias_inactividad` (default 60).

6. Todo se resuelve con agregación SQL sobre SQLite local (ADR-001), igual que en fase 1 — sin cálculo de agregados en el renderer.

### Consecuencias

- (+) El Dashboard queda funcionalmente completo salvo los reportes fiscales de Compras/Ventas, que siguen dependiendo de R2.
- (+) La deuda vencida aproximada da valor inmediato sin esperar un modelo de vencimiento real por comprobante.
- (+) No mostrar deuda de proveedores evita exhibir un dato inexistente disfrazado de "pendiente".
- (−) La definición de "vencida" es aproximada (antigüedad desde la venta, no plazo pactado por comprobante); si en el futuro se pactan plazos de pago distintos por cliente, esta lógica queda desactualizada.
- (−) Dos parámetros nuevos en `parametros_sistema` a mantener.
- (−) El ranking de gasto por proveedor puede subestimarse si hay OCs recibidas cuyo costo real todavía no se actualizó en la recepción (P3.5).

### Alternativas descartadas

- **Vencimiento real por comprobante** (fecha de pago pactada por cliente/factura): más preciso, pero requiere modelo de datos nuevo (plazo de pago); se difiere a un ADR de crédito si se necesita en el futuro.
- **Placeholder "Próximamente" en el KPI de deuda de proveedor**: descartado — preferible omitir el KPI a mostrarlo con apariencia de dato disponible.

### Decisiones abiertas derivadas

- Si en el futuro se pacta un plazo de pago distinto por cliente, revisar la definición de "vencida" (ADR aparte).
- Confirmar si el ranking de proveedores debe excluir OCs cuyo costo todavía no fue actualizado en recepción, o mostrarlo igual con una marca de "costo preliminar".

### Implementación (2026-07-14)

Implementado completo mediante Subagent-Driven Development:

- **Migración 0020** (`0020_adr038_dashboard_fase2.sql`): INSERT OR IGNORE de `cc_dias_vencimiento=30` y `cliente_dias_inactividad=60` en `parametros_sistema`.
- **Handlers IPC** separados por dominio:
  - `dashboard-caja-rango.ts`: `dashboardCajaRangoHandler` (turnos con ingresos/egresos por caja, breakdown `venta_pago`, KPI recargo tarjeta).
  - `dashboard-clientes.ts`: `dashboardClientesRangoHandler` (ranking top-10, clientes nuevos) + `dashboardClientesEstadoHandler` (deuda total/vencida por `fecha_ultimo_movimiento`, inactivos).
  - `dashboard-proveedores.ts`: `dashboardProveedoresRangoHandler` (gasto por OC recibida) + `dashboardProveedoresEstadoHandler` (OCs pendientes, sugeridas sin resolver).
- **Preload y main/index**: 5 canales nuevos (`dashboard:caja-rango`, `dashboard:clientes-rango/estado`, `dashboard:proveedores-rango/estado`).
- **Vistas React**: `CajaTabView`, `ClientesTabView`, `ProveedoresTabView` — patrón `PS<T>`, KPIs de estado con leyenda "hoy" fijos, KPIs de rango filtrados por período.
- **DashboardView.tsx**: `TabId` extendido a 6 tabs, `TABS` sin `disabled`, `PeriodSelector` visible en todos los tabs nuevos.
- **Decisiones técnicas aplicadas**: timestamps SQLite almacenados como Unix seconds (comparaciones SQL en segundos); CF_ID excluido de conteos de clientes; `clienteUpsertHandler` con `habilita_cuenta_corriente=true` auto-crea CCC → tests usan UPDATE en lugar de INSERT.
- **Tests**: 36 tests nuevos (5 node caja + 7 node clientes + 5 node proveedores + 16 renderer nuevas vistas + 3 renderer DashboardTabs). 315 renderer + 657 node = 972 verdes.

## ADR-039 — Reportes: menú separado del Dashboard + Detalle de Ventas

**Estado:** Aceptado
**Fecha:** 2026-07-13
**Release:** R3+ (nueva sección de menú, sin pantalla previa aprobada — sin phase-gate salvo el sidebar, ver nota)
**Contexto de decisión:** Joaquín (decisión) · Claude (asesor técnico)

### Contexto

Se pidió un detalle de facturas realizadas (aunque no hayan viajado a AFIP) y se planteó si el universo completo de reportes (Ventas, Productos, Proveedores, Clientes) debía vivir fuera del Dashboard, como sección propia de menú con filtros y exportación — en línea con el criterio original (`Propuesta-Dashboard-Reportes.md`, sección 1).

Al revisar la dependencia real: `comprobante_fiscal` (módulo fiscal R2; ADR-013, Propuesto) **todavía no existe / está en diseño**. Un reporte de comprobantes fiscales no depende de que el CAE haya vuelto autorizado, pero sí depende de que la tabla exista y se pueble — hoy no es el caso. En cambio, un **detalle de ventas operativo** (línea a línea, sin relación con el circuito fiscal) no tiene esa dependencia y resuelve la necesidad inmediata planteada ("no tengo ningún reporte de ventas donde pueda ver el detalle").

### Decisión

1. **Nueva sección de menú "Reportes"**, separada del Dashboard (ADR-037/038). El sidebar hoy tiene los grupos Catálogo, Abastecimiento, Clientes, Configuración (ADR-028); se agrega un grupo nuevo "Reportes" con ítems: Ventas, Productos, Proveedores, Clientes.

2. **Reportes → Ventas se implementa en dos vistas, con dependencias distintas:**
   - **Detalle de ventas (operativo, disponible ya):** listado línea a línea de `venta`, filtrable por rango de fechas libre, cliente, rubro/categoría (ADR-007), producto, vendedor (`usuario_id`) y medio de pago (`venta_pago`, ADR-032). Exportable a CSV. No requiere R2.
   - **Detalle de comprobantes/facturas (fiscal, diferido):** listado de `comprobante_fiscal` con número, tipo de comprobante (Factura A/B/C, Nota de Crédito), cliente, fecha, monto, punto de venta, rango de numeración y estado CAE (pendiente / autorizado / rechazado). No depende de que el CAE esté autorizado — solo de que la tabla exista y se use. **Queda especificado en este ADR pero no se implementa** hasta que R2 tenga `comprobante_fiscal` en producción.

3. **Reportes → Productos, Proveedores, Clientes** quedan como ítems reservados del menú nuevo, **sin especificación de filtros en este ADR** — se definen en un ADR de fase posterior, para no comprometer alcance sin detalle acordado.

4. Mismo principio que el Dashboard: agregación 100% SQL sobre SQLite local (ADR-001). A diferencia del Dashboard, los Reportes permiten rango de fecha libre (no acotado a período rápido) y exportación.

### Consecuencias

- (+) Resuelve la necesidad inmediata de un detalle de ventas exportable, sin esperar a R2.
- (+) El detalle de comprobantes/facturas queda correctamente secuenciado, sin bloquear el resto.
- (+) Formaliza la separación Dashboard/Reportes, evitando ambigüedad futura sobre dónde va cada pantalla nueva.
- (−) Nuevo grupo de sidebar a mantener — toca la navegación general definida en ADR-028; a confirmar si esto requiere una excepción de phase-gate explícita sobre esa pantalla.
- (−) El detalle de comprobantes queda especificado con el modelo de `comprobante_fiscal` tal como se conoce hoy (pendiente de R2 / ADR-013); si ese modelo cambia antes de implementarse, esta sección de este ADR puede quedar desactualizada.

### Alternativas descartadas

- **Un solo ítem "Reportes" con el Dashboard como pestaña interna:** descartado — se prefiere la separación clara entre vista ejecutiva (Dashboard) y herramienta analítica/exportable (Reportes).
- **Esperar a que cierre R2 por completo antes de especificar cualquier reporte de ventas:** descartado — el detalle operativo no tiene esa dependencia y da valor ya; solo el detalle de comprobantes fiscales se difiere.

### Decisiones abiertas derivadas

- Filtros y alcance de Reportes → Productos, Proveedores, Clientes (a definir en ADR de fase posterior).
- Confirmar si agregar el grupo "Reportes" al sidebar requiere excepción de phase-gate sobre ADR-028.
- Revisar el detalle de comprobantes/facturas una vez que el modelo real de `comprobante_fiscal` esté definido en R2 — puede diferir de lo asumido acá.

## ADR-040 — Multi-presentación de venta (una unidad de stock, N presentaciones)

**Fecha:** 2026-07-16
**Estado:** Aceptado
**Release:** R3 (extiende ADR-014; toca schema de ADR-034)

**Contexto.**
ADR-014 dejó `unidad_venta` cumpliendo dos roles a la vez: unidad de stock y unidad de venta. Mientras coincidían no molestaba. Ahora se necesita vender el mismo artículo en varias modalidades con **precio propio por modalidad** (tornillo por unidad, por caja, por peso; cable por metro o por rollo). La caja no vale `100 × precio_unidad` —tiene descuento—, así que el driver real no es la conversión (eso ya lo hace ADR-014) sino el **precio diferenciado por presentación**.

**Decisión.**
Se separan los dos roles: **una unidad de stock por producto + N presentaciones de venta**.

- Nueva tabla `producto_presentacion` (1 producto → N):
  - `id` UUID PK · `producto_id` FK
  - `unidad_id` FK → `unidad` (catálogo; ABM en ADR-041)
  - `factor_a_stock`: INTEGER en **milésimas** de unidad de stock (default `1000` = 1). Caja×100 = `100000`. (Escala a confirmar contra cómo se persiste la cantidad de stock.)
  - `gtin_barcode` TEXT nullable, único cuando no es null (para escanear la caja)
  - `es_default` bool · `activo` bool · timestamps
- El **precio vive en el motor de ADR-034**, no en la presentación: `lista_precio_valor` incorpora `presentacion_id` (NOT NULL). La clave de resolución del motor pasa de (`producto`, `lista`) a (`presentacion`, `lista`). El renderer sigue sin recalcular base.
- **Stock siempre en la unidad base.** `venta_detalle` incorpora `presentacion_id` y el snapshot `factor_a_stock_aplicado`. Descuento de stock = `cantidad × factor_a_stock_aplicado / 1000`.
- **Invariantes de integridad:**
  - Exactamente una presentación default activa por producto (índice único parcial
    `producto_id WHERE es_default=1`). No se puede borrar la última ni dejar el producto sin default.
  - Todo producto nace con su default vía **una única función de creación** compartida por alta manual y alta masiva (no dos caminos que puedan divergir).
- **Precio de presentación nueva:** auto-seed (ADR-034) en cada lista con `precio_default × factor`,
  badge ámbar "sin confirmar"; el Supervisor lo confirma/pisa desde `PrecioPanel`. Es el "sugerir y editar", reusando UI existente.
- **Resolución de scan en POS:** `producto.gtin_barcode` → presentación default;
  `producto_presentacion.gtin_barcode` → esa presentación. Si no se escanea una específica, selector de presentación en la línea. (Misma lógica de fallback que ADR-035.)
- **Recálculo masivo (ADR-034):** opera por presentación. Las no-default con precio
  confirmado a mano entran en la **exclusión de manuales** ya existente; la default se recalcula como hoy.

**Regla stock discreto vs. continuo (obligatoria).**
Un SKU tiene **una sola** naturaleza de stock. Si el producto se cuenta (tornillos), la unidad base es discreta (`unidad`) y el "peso" es una presentación con factor derivado de un `peso_unitario` (se acepta imprecisión de balanza). Si se pesa/corta de verdad (cable, cadena, arena), la unidad base es la continua (`kg`, `metro`) y "por unidad" no aplica.
No se mezclan conteo y peso como fuentes de verdad simultáneas.

**Carga manual.** Alta: sin cambios de cara al usuario (nace con default por debajo).
Edición: sub-sección "Presentaciones" (agregar caja/peso con unidad, factor y gtin opcional; precio por `PrecioPanel`).
**Carga masiva.** **Sin cambio de formato**: 1 fila = 1 producto → solo la default.
Presentaciones extra se cargan a mano después (son minoría; extender el import no se justifica).
La creación masiva invoca la misma función de default que el alta manual.

**Migración (no destructiva).** Por cada producto existente: crear 1 presentación default (`unidad_id` = `unidad_venta` actual, `factor_a_stock=1000`, `es_default=true`, `gtin_barcode=NULL`).
Reasignar las filas existentes de `lista_precio_valor` a la presentación default del producto.
Comportamiento idéntico al actual: la feature queda latente y se activa producto por producto.

**Consecuencias.**
- (+) Precio propio por presentación con vigencia/promo/multi-lista gratis (reusa ADR-034).
- (+) Stock exacto en la unidad base; reportes aguas abajo intactos.
- (+) `unidad_compra`/`factor_conversion` de recepción (ADR-014) no se tocan.
- (−) `lista_precio_valor` (ADR-034, Cerrado) gana una dimensión → migración con reasignación.
- (−) `venta_detalle` suma 2 columnas; POS suma selector de presentación.

**Relación con ADR-014.** No lo supersede: la decisión compra-vs-venta con factor sigue vigente. `unidad_venta` pasa a leerse conceptualmente como **unidad de stock**; las presentaciones son una capa por encima.

**Alternativas descartadas.**
- Campo `precio_centavos` plano en `producto_presentacion`, fuera del motor → segunda fuente de verdad de precio, rompe la centralización que ADR-034 fijó a propósito; caja/peso perderían vigencia y promos. Descartada.
- Extender el import masivo a N presentaciones por fila → complejiza parser/preview para el ~10% de los casos. Descartada (YAGNI con reserva).

**Aplica a:** `producto_presentacion` (nueva), `lista_precio_valor` (+`presentacion_id`), `venta_detalle` (+`presentacion_id`, +`factor_a_stock_aplicado`), POS (P1.8), ProductoDetalle, recepción/reposición (lectura).

### Correcciones de implementación (2026-07-24)

Ajustes hechos al implementar, que no alteran la decisión pero corrigen el texto:

1. **Escala de `factor_a_stock`: `REAL`, no INTEGER en milésimas.** La decisión dejó la
   escala explícitamente **"a confirmar contra cómo se persiste la cantidad de stock"**.
   Esta corrección cierra esa pregunta abierta: la escala definitiva es **`REAL`, con
   default `1.0`**, y el descuento de stock es
   **`cantidad × factor_a_stock_aplicado`, sin dividir**.

   Fuente de la confirmación: `existencias.stock_fisico` es `real`
   (`db/schema/catalog.ts:125`). Una cantidad de stock que ya es de punto flotante no
   gana nada representando su factor en enteros de milésimas: la división por 1000
   reintroduce el redondeo que la escala entera pretendía evitar. La precaución de las
   milésimas tenía sentido para un stock **entero**, que no es el caso de este sistema —
   la regla de "stock discreto vs. continuo" de este mismo ADR admite unidades base
   continuas (`kg`, `metro`), incompatibles con un stock entero.

   Correspondencia con el texto original:
   - §Decisión, `producto_presentacion.factor_a_stock`: donde dice *"INTEGER en milésimas
     de unidad de stock (default `1000` = 1). Caja×100 = `100000`"*, léase **`REAL`
     (default `1.0`). Caja×100 = `100.0`**.
   - §Decisión, "Stock siempre en la unidad base": donde dice *"Descuento de stock =
     `cantidad × factor_a_stock_aplicado / 1000`"*, léase **`cantidad ×
     factor_a_stock_aplicado`**.
   - §Migración: la presentación default se crea con **`factor_a_stock = 1.0`**, no `1000`.

   Implementación vigente: `db/schema/catalog.ts:165`
   (`real('factor_a_stock').notNull().default(1.0)`), `db/schema/ventas.ts:93`
   (`factor_a_stock_aplicado` `real`, nullable para ventas previas a ADR-040) e
   `ipc/venta.ts:105,277,386` (multiplicación directa, con fallback `?? 1.0`).

   **No hay cambio de código asociado a esta corrección**: la implementación es coherente
   consigo misma y con el resto del esquema; lo que estaba desactualizado era el ADR.

## ADR-041 — ABM de Unidades

**Estado:** Aceptado — implementado (2026-07-16)

**Contexto:** La tabla `unidad` era necesaria como catálogo para ADR-040 (presentaciones). Los campos `unidad_venta`/`unidad_compra` en `producto` eran texto libre sin validación referencial. Se necesita un ABM para gestionar las unidades antes de formalizar la FK en `producto_presentacion`.

**Decisión:**
- Nueva tabla `unidad`: `id` UUID · `nombre` · `abreviatura` (único) · `activo` + sync + auditoría.
- IPC namespaced `unidad.*` (list, list-all, create, update, desactivar, reactivar).
- Baja lógica bloqueada si hay productos activos con `unidad_venta` o `unidad_compra` coincidente con la abreviatura (`TIENE_PRODUCTOS:N`). En Lote 2 (ADR-040) se añadirá el check de `producto_presentacion.unidad_id`.
- Vista `/config/unidades`: toolbar con búsqueda + filtro estado, tabla, modal create/edit. Permiso `usuario.administrar`.
- Migración `0021_adr041_unidad.sql` + entrada en `_journal.json`.

**Prerrequisito de:** ADR-040 (las presentaciones referencian `unidad.id` por FK).

**Tests:** 10 nuevos tests node (bloqueo de baja por unidad_venta y unidad_compra, CRUD completo). 338 renderer + 683 node = 1021 verdes.

## ADR-042 — Corte de versión v1.0.0 y estrategia de branching pre-R2 (fiscal)

**Fecha:** 2026-07-15
**Estado:** Aceptado

### Contexto
R1 (núcleo POS/inventario) más los módulos incrementales ya implementados están estables y en uso.
R2 (integración fiscal AFIP/ARCA vía `arcasdk`)
introduce migraciones de esquema nuevas (`comprobante_fiscal`) y una máquina de
estados de CAE que, por diseño, no debe bloquear el POS. Antes de tocar lo fiscal
necesitamos un punto de retorno congelado y auditable, y reglas de trabajo
inequívocas para que el agente de implementación (Superpowers) no mezcle el scope
estable con el scope en desarrollo.

### Decisión
1. **Tag `v1.0.0`** sobre `main`, en el commit que cierra el último estable
   pre-ARCA (R1 + incrementales aprobados hasta ADR-041). Es el punto de retorno.
2. **Rama de mantenimiento `release/1.0.x`** creada a partir de ese tag. Recibe
   únicamente hotfixes de producción; sin features nuevas.
3. **`main` continúa el desarrollo de R2**, apuntando a la próxima minor **1.1.0**
   (la facturación es aditiva sobre la base estable). El major **2.0.0** queda
   reservado para R4 (versión online / nube / multi-terminal); ver Mapa de versiones.
4. **Cherry-pick unidireccional:** los fixes fluyen `release/1.0.x → main`, **nunca**
   `main → release/1.0.x`. El trabajo fiscal en curso jamás entra a la rama estable.
5. **SemVer:** hotfixes en la línea estable bumpean patch (1.0.1, 1.0.2…). R2 se
   integra a `main` y se releasea como 1.1.0 cuando esté completo y migrado.
6. **Disciplina phase-gate (reafirmada):** tocar un módulo R1 aprobado desde el
   trabajo de R2 requiere un ADR nuevo. El tag v1.0.0 es la línea que define "qué
   está congelado".
7. **Features siempre en `main`, nunca en `release/1.0.x`.** La rama de mantenimiento
   recibe solo hotfixes. El desacople entre "feature lista en main" y "feature
   liberada" se maneja con **feature flags** en `parametros_sistema` (default `false`)
   + migraciones aditivas, de modo que `main` sea siempre liberable. Ver §Regla de ruteo.

### Consecuencias
- (+) Punto de retorno seguro y auditable mientras el módulo fiscal madura.
- (+) Imposible que una migración fiscal a medio hacer llegue a producción.
- (+) Reglas de branch explícitas → menos ambigüedad para Superpowers.
- (−) Los hotfixes hay que aplicarlos en `release/1.0.x` y luego cherry-pickear a
  `main`; disciplina manual, no automática.
- (−) Divergencia de esquema entre ramas mientras R2 avanza: un hotfix que toque
  esquema en la rama estable debe evaluarse a mano contra las migraciones de R2.

### Alternativas descartadas
- **Trunk-based sin rama de release:** un hotfix urgente obligaría a releasear R2 a
  medio hacer o a revertir commits fiscales. Descartada.
- **Cherry-pick bidireccional:** arrastra scope fiscal incompleto a la rama estable.
  Rompe la garantía de "estable = pre-ARCA". Descartada.

### Mapa de versiones (reserva — YAGNI con reserva documentada)
No implica implementación; fija la semántica de versión para no re-litigarla más adelante.

| Versión | Release | Alcance |
|---------|---------|---------|
| `1.0.x` | R1      | Núcleo POS/inventario estable (mantenimiento) |
| `1.1.0` | R2      | Integración fiscal AFIP/ARCA |
| `1.2.0` | R3      | Abastecimiento y crédito (aditivo) |
| `2.0.0` | R4      | **Versión online / nube / multi-terminal** (major: cambio arquitectónico) |
| `2.x`   | R5      | Inteligencia y escala (sin fijar aún) |

> **Nota (2026-07-19):** esta tabla quedó desactualizada — R3 ya se integró a `v1.0.0` y
> el slot `1.1.0` se reasignó. Ver **ADR-044** para el mapa de versiones vigente. Esta
> tabla se conserva sin editar por la regla de inmutabilidad de ADRs (§0).

### Regla de ruteo: feature nueva vs. hotfix

Distinción operativa:
- **Hotfix** — corrige un bug que YA está en producción y no puede esperar. → `release/1.0.x`.
- **Feature** — agrega comportamiento nuevo (ej.: mejora de roles y permisos). → SIEMPRE
  `main` (feature branch → PR/MR → main). Nunca a la rama de mantenimiento.

Cuándo una feature llega a producción:
- **Caso A (normal):** espera al próximo release; sale con la minor que corresponda.
- **Caso B (urgente, `main` no liberable por R2 a medio hacer):** se resuelve con
  **feature flags** (estándar adoptado, abajo).

Feature flags — mecanismo estándar:
- Toda feature grande y todo módulo R2 se desarrolla en `main` detrás de un flag en
  `parametros_sistema` (default `false`).
- **Requisito no negociable:** migraciones **aditivas / retrocompatibles**. La app debe
  arrancar y funcionar con el flag apagado. Prohibido: DROP de columnas/tablas en uso,
  `NOT NULL` sin default sobre tablas existentes, renombres destructivos.
- Con todos los flags en `false`, `main` es liberable en cualquier momento → se saca una feature sin arrastrar R2 incompleto.
- El flag se enciende en el release donde la feature está lista, probada y migrada.

Escaleras de escape (solo si feature flags no alcanza):
- **Reordenar roadmap:** la feature urgente pasa a ser la próxima minor y R2 se corre un número. Decisión de producto, se documenta en ESTADO.
- **Rama de release paralela** desde `v1.0.0`: última opción, alto costo de integración.

### Reconciliación de ramas (trunk único = `main`)
El repo tenía **dos ramas tronco**: `master` (con el R1 real, en el tip) y `main`
(15 commits atrás). Se unificó en `main` antes del corte:
1. Verificado que `main` no tenía commits propios:
   `git rev-list --left-right --count main...master` → `0  N`, y
   `git merge-base --is-ancestor main master` → OK (ff posible).
2. `git switch main && git merge --ff-only master` → `main == master`.
3. Tag `v1.0.0` y rama `release/1.0.x` creados sobre ese `main` ya alineado (nunca
   sobre el `main` viejo).
4. `master` retirado (borrado local y remoto) para eliminar el doble tronco.

Desde acá **`main` es el único trunk**; toda referencia del ADR a `main` es literal.

---

## ADR-043 — Empaquetado y distribución del cliente (instalable, seed limpio, updates)

**Fecha:** 2026-07-16  
**Implementado:** 2026-07-17  
**Estado:** Aceptado — implementado

### Contexto
El cliente (ferretería) recibe una primera instalación limpia y, después, mejoras
sucesivas. Necesitamos fijar cómo se empaqueta, cómo arranca sin basura de desarrollo y
cómo se actualiza sin perder datos. Runbook operativo asociado: `docs/RUNBOOK-release.md` (este ADR fija las decisiones; el runbook, el paso a paso).

### Decisión
1. **Distribución:** Electron empaquetado con electron-builder → **NSIS**, un instalable `.exe` por versión (`Ferreteria-Setup-<version>.exe`, versión leída de `package.json`).
2. **Datos fuera del binario:** la DB SQLite vive en `app.getPath('userData')`, nunca en la carpeta de instalación. El instalable **no empaqueta ninguna DB** (`.db/-wal/-shm`).
3. **Primera instalación limpia:** seed partido en `seed:base` (datos maestros
   imprescindibles: geo ADR-024, `parametros_sistema` defaults, unidades base, admin
   inicial) y `seed:demo` (solo desarrollo, **nunca se compila**). First-run guard: migra
   el esquema y corre `seed:base` idempotente una sola vez (flag
   `sistema.seed_base_aplicado` en `parametros_sistema`).
4. **Actualización:** en cada arranque se aplican las migraciones Drizzle pendientes sobre la DB existente. Deben ser **aditivas/retrocompatibles** (coherente con el corte y los feature flags). Antes de migrar, **backup `.fbk` automático** (ADR-021/022).
5. **Canal de update:** `electron-updater` con provider **`github`** (GitHub Releases).
   Fallback a instalación manual del `.exe` para PC aislada (Vía 2).
6. **Correspondencia versión↔rama:** 1.0.x se buildea desde `release/1.0.x`; 1.1.0 desde `main` (SemVer del ADR del corte).
7. **Firma de código: diferida.** Se distribuye sin firmar en esta etapa y se avisa al
   cliente del aviso de SmartScreen. Se reevalúa en rollout productivo o con más clientes.

### Consecuencias
- (+) Instalación inicial reproducible y limpia; actualizar el `.exe` nunca pisa datos.
- (+) Una mejora con cambio de esquema se aplica sola en el arranque, con punto de retorno.
- (−) La app depende de migraciones aditivas: una destructiva rompe el modelo (por eso es
  gate).
- (−) Auto-update requiere conectividad ocasional; offline puro obliga a la Vía 2 manual.
- (−) El feed queda atado a **GitHub Releases**: si migrás el `origin` a GitLab, hay que seguir publicando los releases en un repo GitHub o cambiar el provider a `generic`.
- (−) Instalable sin firmar → SmartScreen muestra advertencia en la primera ejecución
  (riesgo aceptado y documentado).

### Decisiones abiertas
Ninguna. Provider de feed (`github`) y firma (diferida) resueltos — ver Decisión 5 y 7.

- **Firma de código** (certificado): sin firma, Windows dispara SmartScreen. Pendiente de definir para cliente productivo.

### Alternativas descartadas
- **Bundlear una DB poblada en el instalable:** arrastra basura de desarrollo y rompe la  instalación limpia. Descartada.
- **Solo instalación manual, sin updater:** viable como fallback, pero no como mecanismo único; obliga a visita/pendrive en cada mejora. Descartada como estándar.

---

## ADR-044 — Corrección del mapa de versiones: Remitos + Presupuestos toman 1.1.0, fiscal ARCA pasa a 1.2.0

**Fecha:** 2026-07-19
**Estado:** Aceptado
**Contexto de release:** Transversal — corrige el "Mapa de versiones" de ADR-042 §Branching.
**Decisores:** Joaquín (product owner)

### Contexto

Se decidió construir dos features nuevas — **Remitos** (comprobante interno de
entrega/traslado de mercadería, sin CAE en esta fase) y **Presupuestos** (cotización
comercial que puede convertirse en Venta) — ninguna de las dos con dependencia dura de
la integración fiscal ARCA (R2) ni de nube/sync (R4). Al planificar dónde encajan en el
roadmap de versiones surgieron dos problemas con el "Mapa de versiones (reserva)" fijado
en ADR-042:

1. **La fila `1.2.0 = R3` está obsoleta.** R3 (abastecimiento y crédito: Órdenes de
   Compra, Recepción, Cuenta corriente de clientes) ya fue implementado y quedó
   integrado en el corte `v1.0.0` (el tag documenta "R1 + incrementales hasta ADR-41",
   que incluye las ADR-017 a 025, todas de R3, ya "Aceptada" antes del corte). El slot
   `1.2.0` quedó libre.
2. **Orden cronológico de entrega.** El módulo fiscal (R2/ARCA) todavía no arrancó
   (ADR-013 sigue "Propuesto"). Remitos y Presupuestos van a estar listos antes. Asignarles
   el slot libre `1.2.0` tal cual, dejando `1.1.0` reservado y sin usar para ARCA, generaría
   una versión más alta (`1.2.0`) publicada antes que una más baja (`1.1.0`) — confuso para
   cualquiera que lea el historial de releases.

### Decisión

Se corrige el mapa de versiones de ADR-042, aplicando la escalera de escape que esa
misma ADR ya prevé ("Reordenar roadmap: la feature urgente pasa a ser la próxima minor y
R2 se corre un número"):

| Versión | Contenido | Nota |
|---------|-----------|------|
| `1.0.x` | R1 + R3 (mantenimiento) | Sin cambios. R3 ya integrado al corte `v1.0.0`. |
| `1.1.0` | **Remitos + Presupuestos + Agenda operativa/outbox (ADR-047 Lote 1)** | Reasignado (antes reservado para R2/fiscal). Agenda sumada al incremental por decisión del PO (2026-07-21), mismo mecanismo: feature nueva detrás de flag en `main`. |
| `1.2.0` | **Fiscal AFIP/ARCA (R2)** | Corrido un número respecto al mapa original. |
| `2.0.0` | R4 — nube / multi-terminal | Sin cambios. |
| `2.x`   | R5 | Sin cambios, sin fijar aún. |

Reglas operativas (heredadas de ADR-042, sin cambios):
- Ambas features se desarrollan en `main` (o feature branch desde `main`), cada una
  detrás de su propio flag en `parametros_sistema` (`remitos_habilitado`,
  `presupuestos_habilitado`; default `false`), con migraciones aditivas/retrocompatibles.
- Cada feature tiene su propio diseño/ADR de entrada (Remitos primero, luego
  Presupuestos, por decisión de producto — no comparten entidades entre sí).
- **Remito tiene dos fases:** Fase 1 (interna, sin ARCA — cubierta por esta reserva de
  `1.1.0`) y Fase 2 (integración ARCA), que depende del avance real de R2 y se incorpora
  como parte de la release fiscal (`1.2.0` en este mapa), cualquiera sea el estado de
  Remitos Fase 1 en ese momento.
- Si el orden real de entrega vuelve a cambiar (ej. el fiscal se acelera y termina
  antes), se re-litiga con una ADR nueva — no se edita esta.

### Consecuencias

- (+) El historial de versiones queda cronológicamente coherente: los números suben en
  el mismo orden en que las features salen a producción.
- (+) No se inventa un mecanismo nuevo de versionado: se reutiliza tal cual la escalera
  de escape ya documentada en ADR-042.
- (+) Corrige una inconsistencia real en la documentación (R3 ya shippeado bajo un
  número que el mapa seguía marcando como pendiente).
- (−) El mapa de versiones deja de ser una reserva fija de una vez y para siempre: puede
  volver a correrse si el orden de entrega cambia (mitigado por el punto anterior — se
  documenta con una ADR cada vez).

### Alternativas descartadas

- **Mantener `1.2.0` para Remitos + Presupuestos tal cual estaba reservado:** descartada
  por el problema de orden cronológico (punto 2 del contexto).
- **No fijar número de antemano; decidirlo recién al momento del corte:** descartada — ya
  existe un mecanismo explícito en ADR-042 para esto (la escalera de "reordenar
  roadmap"); no hace falta un esquema ad hoc nuevo cuando el existente ya resuelve el
  caso.

  ## ADR-045 — Módulo de Remitos (documento de entrega interno)

**Fecha:** 2026-07-18
**Estado:** Aceptado
**Release:** R3 (excepción de phase-gate acotada — módulo nuevo aislado, patrón ADR-020/026)
**Decisores:** Joaquín (product owner) · Claude (asesor técnico)

### Contexto

Falta un documento que respalde el **traslado y la entrega física** de mercadería cuando la entrega se desacopla de la facturación (entrega diferida, a domicilio, parcial, o mercadería entregada antes de facturar en cuenta corriente). En la venta de mostrador "pago y me llevo", la factura/ticket ya respalda el traslado (RG 1415), por lo que un remito automático sería un documento inútil en la mayoría de los casos. Se necesita definir cuándo aplica, cómo se vincula con `venta` y `comprobante_fiscal`, y su impacto (o no) sobre stock.

### Decisión

**1. Opt-in por evento de entrega, no automático.** El remito es una acción del operador sobre una **venta confirmada**, disparada cuando hay traslado/entrega separada de la facturación. Ninguna venta genera remito por defecto.

**2. No mueve stock.** El stock se sigue descontando en la confirmación de la venta (ADR-006 intacto). El remito **documenta** qué se entregó físicamente de algo ya descontado del inventario; no escribe movimientos de stock. Se acepta la limitación de que no existe el concepto de "vendido-no-entregado" a nivel inventario físico; queda reservado como ADR futuro si el uso lo exige.

**3. Interno, no fiscal.** Numeración propia con prefijo `RE`, desacoplada del circuito CAE de R2. Formato `RE-<NNNNNNN>` (7 dígitos cero-padded, **sin** dígito verificador Luhn — coherente con la decisión de numeración-sufijos para documentos internos). Contador atómico `remito_proximo_secuencial` en `parametros_sistema`, incrementado en la misma transacción de la emisión. Single-node; el caso multinodo se difiere a R4 igual que el SKU. El "Remito R" fiscal (CAI/electrónico) queda reservado como evolución.

**4. Sin valorizar.** El remito lleva cantidades y descripción, no importes. El precio vive en la factura. Se reserva el parámetro `remito_valorizado` (default `false`, no cableado en v1) por si a futuro se quiere render valorizado.

**5. Modelo de datos — documento de entrega, no copia de la venta.**

`remito`:
- `id` UUID PK + campos de sync (`version`, `origin_id`, `sync_state`, `updated_at`).
- `numero_secuencial` INTEGER · `numero` TEXT (proyección `RE-NNNNNNN`, asignado **al emitir**, no antes).
- `venta_id` UUID FK → `venta` (NOT NULL).
- `comprobante_fiscal_id` UUID FK **nullable** → `comprobante_fiscal` (qué factura respalda; informativo).
- `estado` TEXT: `emitido` | `conformado` | `anulado`.
- `fecha_emision` · `fecha_entrega` (nullable) · `recibido_por` TEXT (nullable).
- `domicilio_entrega` TEXT (snapshot; puede diferir del domicilio del cliente) · `transportista` TEXT (nullable) · `observaciones` TEXT (nullable).
- Anulación: `anulado_en`, `anulado_por_usuario_id`, `motivo_anulacion` (nullables).
- `activo` boolean (soft-delete transversal) · `creado_por_usuario_id`, `creado_en`.

`remito_linea`:
- `id` UUID PK + campos de sync.
- `remito_id` FK → `remito` · `venta_linea_id` FK → `venta_linea`.
- `cantidad_entregada` (respeta `permite_fraccion` / `unidad_venta` del producto).
- Snapshot inmutable: `producto_id`, `descripcion`, `unidad`. **Sin importes.**

**6. Cardinalidades.** `venta` 1 → N `remito` (habilita entregas parciales). `remito` 1 → N `remito_linea`. Relación con factura N remitos → 1 comprobante vía FK nullable; el M:N real se difiere (sobrediseño hoy).

**7. Control entregado vs. pendiente.** Por `venta_linea`: `Σ cantidad_entregada` de remitos **no anulados** contra la cantidad vendida. Validación: una línea de remito no puede entregar más que lo pendiente. Se emiten N remitos hasta completar. Un remito anulado libera esas cantidades (vuelven a "pendiente").

**8. Máquina de estados.** `emitido → conformado` (se registra `fecha_entrega` + `recibido_por`); `emitido → anulado`. Nace `emitido` y numerado al confirmar en el modal (patrón POS: nada se persiste hasta confirmar). **La anulación NO genera movimientos inversos** —a diferencia de la anulación de venta (ADR-006)— porque el remito no toca saldos; es cambio de estado + auditoría.

**9. UI / navegación.** Grupo **Facturación**. Ruta `/remitos` (listado) + acción "Generar remito" desde el detalle/historial de venta, con modal de armado (selección de líneas + cantidades a entregar). Impresión reutiliza la capa `webContents.printToPDF` (ADR-015/026): encabezado del comercio + número RE + fecha, datos del cliente y domicilio de entrega, tabla cantidad/descripción sin importes, transportista/observaciones, pie con espacio para firma de recepción.

**10. Aislamiento (phase-gate).** El módulo **solo lee** de `venta`, `venta_linea`, `comprobante_fiscal`, `cliente`, `producto`. **Escribe únicamente** `remito`, `remito_linea` y el contador en `parametros_sistema`. No toca POS, caja, stock ni el circuito fiscal. IPC namespaced `remito:*`.

### Consecuencias

**Positivas**
- Cubre entrega diferida/parcial/a domicilio sin tocar ADR-006 ni el total fiscal.
- Control entregado-vs-pendiente gratis por diferencia de cantidades.
- Excepción de phase-gate de bajo riesgo (módulo de solo-lectura sobre dominios aprobados).

**Negativas / costos**
- No modela "stock comprometido pendiente de entrega" (reservado).
- Numeración `RE` single-node con arista de sync diferida a R4 (documentada, igual que SKU).
- El remito fiscal "R" (CAI/electrónico) no está cubierto; queda como evolución.

### Alternativas descartadas

- **Remito automático por venta:** genera un documento inútil en el caso mayoritario de mostrador; rompe el desacople entrega/facturación.
- **Remito que descuenta stock (estado "comprometido"):** cambio grande al modelo saldo/movimientos de ADR-006 para un beneficio no requerido hoy.
- **Remito fiscal "R" con CAE desde el arranque:** acopla al circuito de R2 y suma superficie fiscal antes de necesitarla.

### Parámetros

- `remito_proximo_secuencial` (INTEGER, estado del contador, arranca en 1) → se siembra.
- `remito_valorizado` (bool, default false) → **reservado**, no cableado en v1.

### Correcciones de implementación (2026-07-19)

Ajustes hechos al implementar, que no alteran la decisión pero corrigen el texto:

1. **Nombres de tabla.** El §5 nombra `venta_linea` y `comprobante_fiscal`; las tablas
   reales del repo son **`venta_detalle`** y **`comprobante`**. La implementación usa
   `remito_linea.venta_detalle_id` y `remito.comprobante_id`.
2. **Permisos.** El ADR no los especificaba. Se definen `remito.crear`,
   `remito.conformar` y `remito.anular`, otorgados a **ambos** roles (decisión de
   producto). Existen como permisos-dato para poder restringir la anulación más
   adelante sin refactor.
3. **Flag.** Se incorpora `remitos_habilitado` (default `false`) al alcance, por
   exigencia de ADR-044. Gatea la ruta, el grupo del sidebar y la acción desde la venta.
   **El gate es solo de UI**: el namespace IPC `remito:*` queda expuesto con el flag
   apagado.
4. **Unidades.** `venta_detalle.cantidad` está en unidades de *presentación* (ADR-040),
   no de stock. `cantidad_entregada` se compara directo contra ese valor, sin aplicar
   `factor_a_stock_aplicado` — así el módulo no hace aritmética de stock, coherente con §2.
5. **Máquina de estados.** El §8 enumera `emitido → conformado` y `emitido → anulado`.
   La implementación **también permite `conformado → anulado`**, para cubrir la
   devolución posterior a la entrega. Un remito anulado no admite ninguna transición.
6. **Numeración.** Se evaluó cambiar `RE-NNNNNNN` por `R-NNNNNNN` (paridad de prefijo
   con `V-` de ventas) y se descartó: `RE` ya empieza con R, y `R` es la letra del
   remito fiscal de ARCA que el propio ADR reserva para la fase 2.

**Migración:** `0023_adr045_remitos.sql` (aditiva: 2 tablas, 4 índices, 3 parámetros).

## ADR-046 — Módulo de Presupuesto (cotización previa a la venta)

**Fecha:** 2026-07-20
**Estado:** Aceptado — implementado (2026-07-21)
**Release:** 1.1.0 (feature nueva, detrás de flag `presupuestos_habilitado`)

### Contexto

El módulo de Presupuesto quedó sembrado como ítem 11 del backlog de bugs y mejoras pero nunca se diseñó: esa iteración se fue en Lista de Precios (ADR-034/035). Se necesita cotizar antes de vender: armar una lista de productos con precios, entregársela al cliente y —si acepta— convertirla en venta. La cotización no debe tocar stock, caja ni el módulo fiscal hasta convertirse en venta real.

### Decisión

**Entidad propia, no se reutiliza `venta`.** Se crean `presupuesto` y `presupuesto_detalle`,
espejo de la estructura de venta pero sin impacto en caja/stock/fiscal. Meter presupuestos dentro de `venta` ensuciaría `total_venta`, el módulo de pagos combinados (ADR-032) y el fiscal (ADR-034) — va contra el principio de separación fiscal limpia del proyecto.

**Máquina de estados:** borrador → emitido → (vencido | convertido | anulado)
- borrador: se arma y edita libremente. No tiene número todavía.
- emitido: se asigna número correlativo, se congela el snapshot de precios por línea y arranca fecha_validez. Documento estable a partir de acá.
- vencido: automático al pasar fecha_validez. Lo marca un job diario (mismo patrón de scheduler que cambio_programado, ADR-034). Señaliza, no borra.
- convertido: terminal. Enlaza venta_id.
- anulado: soft-delete con rastro (coherente con el soft-delete transversal del proyecto).

**Precio congelado al emitir.** Como los precios se historizan (lista_precio_valor) y hay promociones con vigencia, al emitir se guarda snapshot de precio_unitario_centavos por línea (mismo criterio que venta_detalle). Descuentos de línea/global se calculan y congelan igual que en el POS.
- Conversión dentro de validez → respeta el snapshot cotizado.
- Conversión de un presupuesto vencido → reprecio al valor vigente del día, con aviso explícito al operador antes de confirmar (mismo espíritu que el repricing al retomar una venta en espera, ADR-033).

**Numeración.** Sufijo propio PR (ej. PR-0000042), secuencial estilo SKU sin dígito Luhn, contador presupuesto_proximo_secuencial en parametros_sistema (patrón Numeración-sufijos, igual que OP/PE/RE/RX). El número se asigna al emitir, no al crear el borrador — no se queman correlativos en borradores descartados (mismo criterio que turno_id al confirmar, ADR-033).

**Cliente opcional.** Un presupuesto puede tener cliente asignado o ser a consumidor final (sin cliente), igual que el POS.

**Validez configurable.** presupuesto.validez_dias_default en parametros_sistema (sugerido 15 días). Editable al momento de emitir cada presupuesto.

**Conversión a venta.** venta.presupuesto_id nullable. Convertir = abrir el POS precargado con las líneas del presupuesto (a precio snapshot o repreciado según validez). El impacto en stock, caja y fiscal ocurre recién al confirmar la venta, con el flujo normal del POS.

**Export básico.** Se puede exportar el presupuesto a PDF para enviárselo al cliente. Export simple, sin plantilla fiscal (no es un comprobante AFIP).

### Modelo de datos (borrador — sujeto a schema discovery)

presupuesto: id (UUID), numero (null hasta emitir), cliente_id (nullable = consumidor final), estado, fecha_emision (null en borrador), validez_dias, fecha_validez (calculada al emitir), descuento_global_centavos (o %), total_centavos, usuario_id, venta_id (null hasta convertir), activo (soft-delete), version, origin_id, sync_state, updated_at.

presupuesto_detalle: id (UUID), presupuesto_id, producto_id, cantidad,
precio_unitario_centavos (snapshot al emitir), descuento_linea (% o centavos), version,
origin_id, sync_state, updated_at.

Montos en centavos (invariante del proyecto). Columnas/constraints finales se confirman en schema discovery antes de migrar (GATE Superpowers).

### Consecuencias

- Nueva sección/módulo Presupuesto en la navegación (definir grupo del sidebar, ADR-028).
- Nuevos parámetros presupuesto_proximo_secuencial y presupuesto.validez_dias_default en parametros_sistema.
- Job diario que marca emitido → vencido por fecha_validez.
- El POS gana modo "cargar desde presupuesto" (precarga de líneas + repricing condicional).
- venta gana columna presupuesto_id nullable (trazabilidad de conversión).

### Alternativas descartadas

- Reutilizar venta con un estado 'presupuesto' (como ADR-033 con en_espera): descartado. A diferencia de una venta en espera —venta real pausada—, un presupuesto puede no convertirse nunca y no debe contaminar total_venta ni el módulo fiscal.
- Recalcular siempre el precio al convertir (presupuesto solo indicativo): descartado. El número cotizado debe ser vinculante dentro de la validez.

### Decisiones parkeadas (fuera de alcance)

- Conversión parcial (convertir solo algunas líneas): diferida.
- Plantilla/branding del PDF más allá del export básico: diferida.
- Reserva de stock para presupuestos emitidos: descartada (igual que ventas en espera).

### Implementación (2026-07-21)

Rama `feat/adr-046-presupuesto` (desde `main`, que primero absorbió por fast-forward la
rama de Remitos ADR-045). Migración **`0025_adr046_presupuesto.sql`**.

**Decisiones de schema resueltas en GATE 0:**
- **Dinero en centavos INTEGER** (`total_centavos`, `subtotal_centavos`,
  `precio_unitario_centavos`), alineado con el motor de precios y las tablas modernas
  (`venta_pago`, `lista_precio_valor`), no con el `real` legacy de `venta`.
- **Descuentos como `_pct REAL`** (`descuento_global_pct`, `descuento_linea_pct`), no
  centavos: coincide con el runtime del POS (`descuentoGlobalPct`/`descuentoLineaPct`),
  así la conversión precarga el POS directo.
- **Clave normalizada** `presupuesto_validez_dias_default` (sin punto). **Feature flag**
  `presupuestos_habilitado` (bool, default `false`) agregado por convención ADR-044.
- **2 CHECK**: `numero`/`fecha_emision`/`fecha_validez` NOT NULL salvo estado
  `borrador`/`anulado`; `venta_id` NOT NULL cuando `convertido`.
- **Snapshots en el detalle**: `descripcion` + `alicuota_iva` (como `venta_detalle`) y
  `presentacion_id` + factor (coherencia ADR-040).

**Backend** (`ipc/presupuesto.ts`): `computarPresupuesto` reutiliza `resolverPrecio` de
`@ferreteria/shared` sobre la lista predeterminada; ABM de borrador (crear/editar/anular
con recálculo en vivo, sin congelar); `emitir` (numeración atómica `PR-NNNNNNN` consumida
tras validar SIN_LINEAS, congela snapshot, fija fecha_validez, todo en una transacción);
`vencerLote` (job diario, compare-and-swap `estado='emitido'`); `prepararConversion`
(snapshot si vigente, reprecio + aviso si vencido); `marcarPresupuestoConvertido` llamado
desde `ventaConfirmarHandler` en la MISMA transacción de la venta, condicionado a
`estado IN ('emitido','vencido')` (rollback si ya no es convertible); export PDF vía
`printToPDF` (patrón ADR-026), sin plantilla fiscal.

**Permisos:** `presupuesto.crear/emitir/anular` a **ambos** roles (cotizar es operación de
mostrador; la conversión la gatea `venta.crear`). Total permisos 25 → 28; Operador 14 → 17.

**UI:** grupo **Punto de venta** del sidebar pasa a contener `Punto de venta` +
`Presupuestos` (decisión de producto 2026-07-21), detrás del flag. `PresupuestosView`
(lista + emitir/convertir/PDF/anular), `PresupuestoFormModal` (ABM con preview de total),
y `usePosSession.precargarDesdePresupuesto` (precarga el carrito y envía `presupuesto_id`
al confirmar). Job de vencimiento registrado en `main/index.ts` (arranque + cada 24 h).

**Tests:** 25 de presupuesto + 2 de conversión en `venta` + ajustes de conteo de permisos
y 5 renderer.

**Ajustes post-verificación en la app real (2026-07-21):**
- Formulario: selección de cliente por combobox (búsqueda por nombre o documento) y de
  producto por nombre o SKU. Se corrigió un bug: `producto.list` es paginado
  (`{items,total}` con `page/pageSize`) y el form lo trataba como array → no traía
  resultados. Se agregó **stock por línea** (dropdown + columna con ⚠ si stock < cantidad).
- Listado: filtro por estado con default **Borrador + Emitido**, buscador por
  cliente/número, encabezados ordenables asc/desc, y **detalle al seleccionar la fila**
  (`PresupuestoDetalleModal`, cualquier estado; en convertidos muestra la venta asociada y
  avisa si el total difiere del cotizado). `obtenerInterno` suma `leftJoin` a `venta`.
- POS: `PosView` **ya no traga el error** al confirmar (mostraba modal cerrado sin feedback)
  — ahora traduce y muestra el código (`STOCK_INSUFICIENTE`, `PRODUCTO_INACTIVO`, …). Y al
  convertir avisa proactivamente si algún producto cotizado no tiene stock.

**Debate importe presupuesto vs venta (cerrado, sin cambio de diseño):** el presupuesto es
documento histórico (cotización con total congelado al emitir); la venta refleja lo
realmente vendido (el operador puede editar el carrito, p. ej. quitar un ítem sin stock).
Los totales pueden diferir legítimamente; el vínculo queda por `estado='convertido'` +
`venta_id`. Se decidió **no** reescribir el total del presupuesto (falsearía la oferta) ni
bloquear la conversión (la conversión parcial está parkeada en este ADR). La diferencia se
hace **visible** en el detalle.

**Integración:** `2026-07-21` — merge fast-forward `feat/adr-046-presupuesto` → `main` y
push a `origin/main` (30 commits: Remitos ADR-045 + Presupuesto ADR-046). Ambas features
detrás de flag (default `false`); `main` liberable. Total del proyecto al integrar:
**817 node + 399 renderer = 1216 verdes**.

## ADR-047 — Agenda operativa y outbox de avisos

- **Fecha:** 2026-07-21
- **Estado:** Aceptado — Lote 1 implementado
- **Release:** Transversal. **Núcleo (Lote 1) entra en `1.1.0`** como módulo nuevo detrás de flag (`agenda_habilitado`, default `false`), sin tocar aprobados — mismo mecanismo que Remitos/Presupuestos (ADR-044). Los productores se integran en lotes posteriores según su release: Caja (R1), Recepción/OC/bajo-mínimo (R3). Canal email opcional; WhatsApp nativo y `.ics` servido, diferidos a R4.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)

### Contexto

Se necesita una agenda operativa dentro del sistema para rutinas de pedidos y organización del negocio (revisar reposición de un proveedor, recordatorios, entregas de OC), con capacidad de avisar por fuera de la app (mail, `.ics`) antes de que exista la infraestructura de nube (R4). El destinatario es interno: el dueño o un responsable (usuarios del RBAC, ADR-008).

Dos restricciones ordenan el diseño:

1. **Offline-first (ADR-001):** la operación no puede depender de que un servicio externo sea alcanzable.
2. **La PC de mostrador no es un servidor:** pre-nube, cualquier disparo solo ocurre con la app abierta. Los avisos empujados en un horario fijo no son confiables si la máquina está apagada.

Integrar Google Calendar o WhatsApp de forma nativa reabre exactamente el problema que ya se cerró en ADR-023 (OAuth/tokens/backend server-side en un `.exe` distribuido), por lo que se descartan hasta R4.

### Decisión

**1. Tres capas, no una.** Se separan tres conceptos con relación `1 rutina → N eventos → N avisos`:
- `rutina` — generador recurrente **opcional** (definición + frecuencia + destinatario + canales como plantilla).
- `agenda_evento` — **entidad de primera clase**: "algo que pasa en una fecha y me interesa", accionable. Puede nacer de una rutina, a mano, o de un módulo de dominio (ej. emitir OC → evento "entrega estimada"). Lleva `rutina_id` **nullable** y `origen` (`rutina | manual | orden_compra | …`).
- `aviso` — fila de **outbox** de entrega, FK a `agenda_evento` o generada directa por un productor.

Es el mismo patrón que `1 venta → N venta_pago` (ADR-032) y `1 venta → N comprobante` (ADR-034).

**2. El evento es central; la rutina es un generador encima.** El evento de dominio (entrega de OC) no tiene rutina madre: nace como `agenda_evento` huérfano (`rutina_id = null`, `origen = 'orden_compra'`). La rutina, al disparar, copia (congela) sus valores al evento que genera.

**3. Frecuencia estructurada simple, proyectada a RRULE en el borde.** `rutina` guarda frecuencia estructurada (`frecuencia_tipo`: `unica | diaria | semanal | mensual | cada_n_dias`, + `intervalo`, `dia_semana?`, `dia_mes?`, `hora?`, `fecha_inicio`, `fecha_fin?`). Se calcula `proximo_disparo` con aritmética propia, sin librería. El string RRULE se proyecta solo al renderizar el `.ics`. Mismo principio que el SKU (ADR-025): guardar estructurado, formatear en la capa de render. `frecuencia_tipo` y el mapeo a RRULE son constantes de diseño, no van a `parametros_sistema`.

**4. Materialización lazy + catch-up al abrir.** Se materializa solo la próxima ocurrencia pendiente por rutina; al completarla, se genera la siguiente. Al abrir la app, un scheduler hace catch-up: barre rutinas activas con `proximo_disparo <= ahora`, materializa las ocurrencias vencidas mientras la app estuvo cerrada, genera avisos y avanza el puntero. Lo vencido aparece como atrasado.

**5. El outbox de avisos es la primitiva central.** Muchos productores → un outbox → muchos canales. Productores:
- Agenda hacia adelante: rutina, evento manual, entrega de OC (son `agenda_evento`).
- Notificaciones de hecho/condición (NO son eventos de agenda, no viven en el calendario): cierre de caja, recepción de mercadería, stock bajo mínimo. Van directo al outbox.

**6. Regla transaccional (la más importante).** `aviso.emitir(...)` inserta la fila del aviso en la misma transacción SQLite del hecho de negocio (garantía de outbox, ADR-003: si el hecho commitea, el aviso queda encolado). El envío por el canal es siempre fuera de la transacción, best-effort, async (async-first, ADR-034). Un canal que falla nunca revierte una venta ni un cierre de caja.

**7. Contrato del servicio `aviso.emitir(comando)`** (servicio interno de main-process; los módulos de dominio lo llaman sin conocer canales):
- `origen_tipo`, `origen_id?` (referencia blanda, no FK dura), `titulo`, `cuerpo`, `datos?`, `destinatario` (`{tipo: usuario|rol, id?/rol?}`), `canales?` (default por `origen_tipo`), `dedupe_clave?` (idempotencia, ADR-003).
- Internamente: resuelve destinatarios y congela su email al emitir; respeta flags de config; snapshotea payload por canal; deduplica; inserta filas `pendiente`; intento inmediato best-effort; nunca lanza de forma que bloquee al productor.

**8. Canales como adapters detrás de una interfaz** (patrón de abstracción de ADR-015):
- `in_app` — local, instantáneo. Se implementa ya.
- `email` — SMTP con credenciales en `safeStorage`. Interfaz definida; implementación opcional/diferida.
- `whatsapp` — stub "no disponible hasta R4".
- `.ics`: NO es un adapter de outbox. Como feed suscribible es proyección pull (Google lo busca), fuera del outbox y sin reintentos; el feed servido se difiere a R4. Como adjunto viaja dentro del adapter `email`.

**9. Integridad en dos capas.** `agenda_evento` engancha al dominio con FK explícitas nullable (`proveedor_id?`, `orden_compra_id?`, `producto_id?`) para navegar sin referencias colgadas. `aviso` usa `origen_id` como referencia blanda: su `payload` congelado es el registro. Integridad para lo transaccional; snapshot para el log de entrega.

**10. Sincronización asimétrica.** `rutina` y `agenda_evento` sincronizan (dato de usuario, campos de sync para R4). `aviso` NO sincroniza: es estado operativo local por terminal, como el propio outbox de sync. En R4 el dispatcher se muda al backend.

**11. Destinatario interno, configurado (no detectado).** Nada de detección de presencia. Flags por tipo en `parametros_sistema` (`notif_*`) que el Supervisor prende/apaga.

**12. Stock bajo mínimo = rutina interna, digest diario.** Se implementa como rutina del sistema que escanea productos bajo mínimo (read-only sobre el reporte de reabastecimiento R1, bajo riesgo de phase-gate como ADR-026) y emite un aviso digest. Default: digest. La variante event-driven en el cruce del umbral (con lógica anti-flapping) se difiere.

**13. UI — grupo nuevo "Agenda" en el sidebar** (extensión de ADR-028, autorizada por este ADR, como lo fue "Facturación"):
- Vista de eventos (default: lista Atrasadas / Hoy / Próximos). Acciones: completar · posponer · descartar · abrir origen. Filtros: origen/tipo, estado, entidad enganchada, responsable.
- Bandeja de avisos (log de entrega). Filtros: canal, estado de envío, origen. Acciones: reintentar, descartar, abrir origen, ver traza.
- Campana en topbar con contador de atrasadas + avisos fallidos. Es la superficie del canal `in_app`; distinta de la bandeja (auditoría completa).
- La grilla mensual se difiere: pelea con la materialización lazy; la lista es congruente con el modelo.

**14. Phase-gate de los productores.** Conectar cierre de caja (R1) y recepción/OC/bajo-mínimo (R3) toca módulos aprobados vía una llamada de una línea a `aviso.emitir`. Cada integración se hace en su propio lote y se documenta como excepción de phase-gate (como ADR-020/026). El lote 1 no toca ningún módulo aprobado salvo la extensión de sidebar autorizada acá.

### Consecuencias

**Positivas**
- Agenda operativa y avisos externos sin nube y sin OAuth, coherente con ADR-001 y ADR-023.
- El outbox resulta una primitiva reutilizable: sumar productores futuros (venta anulada, backup falló) no toca la arquitectura.
- Regla transaccional garantiza que un canal caído jamás compromete un hecho de negocio.
- La migración a R4 (dispatcher server-side, `.ics` servido, WhatsApp) no reescribe el modelo: solo enchufa adapters y mueve el drenado.

**Negativas / costo**
- Tres tablas nuevas + servicio + scheduler + worker: superficie a mantener.
- Pre-nube, los disparos horarios solo corren con la app abierta (mitigado por catch-up).
- El email, si se implementa, mete credenciales en el cliente (`safeStorage`), lo que ADR-023 marcó como lugar subóptimo; por eso es opcional.

### Alternativas descartadas

- Google Calendar / WhatsApp API nativos ahora: OAuth/tokens/backend en `.exe`; contradice ADR-023 y ADR-001. Diferidos a R4.
- Calendario como entidad central con eventos genéricos: aplasta la distinción agenda (to-do a futuro) vs notificación (hecho consumado).
- Rutina como entidad central con el evento colgando: no cubre el evento de dominio sin rutina madre.
- Materialización eager de ocurrencias futuras: costo y filas inútiles.
- `aviso` con FK dura a toda fuente posible: rígido; se usa referencia blanda + snapshot.
- Enviar dentro de la transacción del hecho: un mail caído revertiría una venta. Descartado por async-first.

### Decisiones abiertas derivadas

- Read/unread para `in_app` (`leido_at`): arranca sin unread salvo definición contraria.
- Retención del log de avisos (`aviso_retencion_dias`): purga de enviados/descartados viejos; los fallidos no se purgan por antigüedad.
- Bajo mínimo: arranca digest; event-driven diferido.
- Grilla mensual: diferida (requiere proyección de ocurrencias fantasma).
- Adapter email: cuándo se implementa (opcional).
- `.ics`: feed suscribible vs adjunto vs ambos; feed servido diferido a R4.

### Parámetros (`parametros_sistema`, editables por Supervisor)

`agenda_ventana_proximos_dias`, `agenda_catchup_limite`, `aviso_reintentos_max`, `aviso_backoff_base_seg`, `aviso_retencion_dias`, `notif_cierre_caja_email`, `notif_recepcion_email`, `notif_bajo_minimo_email`, y defaults de canal por `origen_tipo`.

## ADR-048 — Agenda Operativa y Outbox de Avisos Lote 2 - Productor "Cierre de caja" + adapter email (excepción phase-gate R1)

- **Fecha:** 2026-07-22
- **Estado:** Aceptado
- **Release:** R1 (Caja) para el productor; el adapter email es transversal. Se integra sobre ADR-047 como primer productor de dominio.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-047 (agenda operativa + outbox de avisos).

### Contexto

ADR-047 dejó el outbox y el servicio `aviso.emitir`, con el adapter email diferido. El primer productor de dominio es **cierre de caja**, cuyo caso de uso —avisar al dueño cuando no está en el local— **solo se cumple por email**: en una PC única, el `in_app` aparece en la misma máquina donde se cerró la caja y no alcanza al ausente. Por eso el adapter email se **funde en este lote**: sin él, el productor no tiene valor.

Conectar cierre de caja toca el módulo Caja (R1 aprobado), por lo que este ADR documenta la **excepción de phase-gate**, como ADR-020 y ADR-026.

### Decisión

**1. Disparador: solo cierre, no apertura.** La apertura es de baja información (ruido). El cierre emite el aviso en la misma transacción del cierre (regla transaccional de ADR-047 §6). Apertura queda como productor futuro si algún día aporta.

**2. Se emite en todo cierre.** El descuadre NO es condición de envío: todo cierre genera aviso. El canal `email` sale siempre que `notif_cierre_caja_email` esté on; `in_app` queda como registro en bandeja. El descuadre solo eleva la severidad (§4), no filtra.

**3. Payload: resumen, no detalle.** El aviso lleva: fecha, turno, quién cerró, total vendido, N de ventas, desglose por medio de pago (ADR-032), fondo inicial, efectivo esperado vs contado, y la diferencia. **No** el detalle línea por línea del arqueo: eso vive en el sistema; el aviso es un semáforo. "Abrir origen" navega al cierre. Snapshot congelado al emitir.

**4. Descuadre: mismo aviso, con severidad.** Se agrega `severidad` (`normal | alerta`) a `aviso` (campo genérico, reutilizable por otros productores). Si `|diferencia| > arqueo_diferencia_alerta_centavos`, el aviso se marca `alerta`: la campana/bandeja lo resaltan y el asunto del email lo refleja ("Cierre con descuadre de $X"). No se crea un `origen_tipo` aparte.

**5. Destinatario: rol Supervisor, configurable.** `destinatario = {tipo: rol, rol: 'supervisor'}` por defecto (llega a todos los supervisores, email resuelto del usuario y congelado al emitir). Parámetro `notif_cierre_destinatario` para apuntarlo a un usuario puntual.

**6. Adapter email.** Implementación de `AdapterEmail` detrás de la interfaz de ADR-047, con `nodemailer`. Config SMTP (host, port, secure, from) en `parametros_sistema`; **la contraseña SMTP en `safeStorage`**, nunca en `parametros_sistema` ni en backups (mismo tratamiento que los certs AFIP, ADR-021). Cuerpo de texto plano; **sin `.ics`** (el cierre es un hecho consumado, no un evento de calendario). Prerrequisito: se agrega `email` a `usuario` (ADR-027 no lo incluía).

### Consecuencias

**Positivas**
- Primer productor end-to-end con entrega externa real; valida el outbox y el worker de reintentos de ADR-047.
- `severidad` genérica queda disponible para bajo-mínimo y futuros productores.
- SMTP password en `safeStorage` mantiene la política de credenciales de ADR-021.

**Negativas / costo**
- Toca el módulo Caja aprobado (R1): excepción de phase-gate acotada a una llamada de una línea a `aviso.emitir` en el commit del cierre.
- Credenciales SMTP en el cliente (`safeStorage`), lo que ADR-023 marcó como subóptimo; aceptado por ser el único camino pre-nube.
- Dependencia nueva (`nodemailer`) y entregabilidad sujeta a la config SMTP del comercio.

### Alternativas descartadas

- **Solo `in_app` para cierre:** no alcanza al dueño ausente en PC única. Es el caso de uso entero.
- **Email solo si hay descuadre:** el dueño ausente quiere el resumen diario igual; el descuadre eleva severidad, no gatea el envío.
- **Detalle completo del arqueo en el aviso:** pesado y sensible (el mail se reenvía); el detalle vive en el sistema.
- **`origen_tipo` separado para descuadre:** innecesario; se resuelve con `severidad`.
- **Apertura como productor:** baja información, ruido.

### Decisiones abiertas derivadas

- Formato/plantilla del cuerpo del email (texto plano v1; HTML diferido).
- Umbral `arqueo_diferencia_alerta_centavos`: valor default a sembrar (a confirmar con el comercio).

### Parámetros (`parametros_sistema`)

`arqueo_diferencia_alerta_centavos`, `notif_cierre_destinatario` (default rol supervisor), `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_from`, `smtp_user`. (`notif_cierre_caja_email` ya viene de ADR-047.) La contraseña SMTP va en `safeStorage`, fuera de `parametros_sistema`.

### Notas de implementación (2026-07-22) — correcciones al texto del ADR

1. **`usuario.email` NO era un prerrequisito pendiente.** El §6 dice "se agrega `email` a `usuario` (ADR-027 no lo incluía)" — citaba ADR-029 hasta la fe de erratas del 2026-07-24 —, pero la columna ya existía desde la migración `0001` y ya era editable en Configuración → Usuarios. La migración `0027` de este lote agrega **solo** `aviso.severidad`.

2. **Unidades: Caja trabaja en pesos, el umbral en centavos.** `caja.monto_inicial/esperado/contado/diferencia` son `real` en **pesos** (y `umbral_diferencia_caja` = 50000 son $50.000). El parámetro nuevo `arqueo_diferencia_alerta_centavos` se mantiene **en centavos** (honra el nombre del ADR y el principio "centavos en toda la lógica"), y la comparación convierte en el borde: `Math.round(|diferencia| * 100) > umbral_centavos`. No se migró Caja a centavos (fuera de alcance).

3. **Default de `arqueo_diferencia_alerta_centavos` cerrado en `200000` ($2.000)**, configurable por el comercio. Resuelve la decisión abierta que dejaba el ADR.

4. **Extensión acordada con el PO sobre el §3 ("resumen, no detalle"):** el payload del cierre suma un bloque `bajo_minimo` con **conteo + top 10 por faltante** (incluyendo productos en stock 0 con mínimo definido). Se mantiene dentro del espíritu de "resumen": no es el detalle del arqueo, y le sirve al dueño ausente para reponer. **No** afecta la severidad — el §4 sigue valiendo: `alerta` solo por descuadre de efectivo. Esto **no** construye el productor/digest "bajo mínimo", que sigue fuera de alcance.

5. **Bug latente corregido en el marco de ADR-047:** `resolverDestinatarios` comparaba el nombre de rol de forma case-sensitive contra un seed en mayúsculas (`'SUPERVISOR'`), mientras el destinatario default llega en minúsculas (`{"rol":"supervisor"}`). No resolvía destinatarios y **no insertaba ningún aviso**. Corregido con match `lower(nombre) = lower(?)`. Afectaba a todo productor con destinatario por rol, no solo al cierre.
---

## ADR-049 — Motor de Precios v2: costo neto, reglas de margen y publicación por lote

- **Fecha:** 2026-07-24
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`, como módulo nuevo detrás de flag (`motor_precios_v2_habilitado` en `parametros_sistema`, default `false`), **antes del fiscal ARCA** (1.2.0). Mismo mecanismo que Remitos/Presupuestos/Agenda (ADR-044/045/046/047). Migraciones aditivas y retrocompatibles; con el flag y los modos en su default, el comportamiento de precios y del POS es idéntico al de hoy.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-034 (motor de precios con vigencia), ADR-035 (importación de costos), ADR-036 (producto↔proveedor), ADR-040 (presentaciones), ADR-008 (RBAC dos roles), ADR-006 (libro inmutable), ADR-028 (sidebar agrupado).
- **Fuentes de verdad:** plan aprobado `motor-de-precios-quiero-quiet-dove.md` · mockup `docs/Mockups/mock-adr049-motor-precios-circuito.html`.

### Contexto

ADR-034/035/036 dejaron en producción **la mitad inferior** del motor que describe `docs/Motor de Precios/Motor de Precios y Publicacion.md` (v2.0): `lista_precio_valor` es un SCD tipo 2 con historial completo, `recalculo_masivo` es atómico y auditado, existen `promocion` y `cambio_programado` con scheduler, y hay importación de costos por proveedor con matching y cola de revisión manual.

Falta **la cadena costo → margen → validación → aprobación**, y ahí están los riesgos operativos reales:

1. **El circuito de costo está abierto.** `importacionCostoConfirmarHandler` actualiza `producto_proveedor.costo_centavos` y termina: un aumento del 20% de un proveedor **nunca llega al precio de venta**. Ídem recepción de mercadería y cambio de proveedor preferido.
2. **No hay noción de margen.** El recálculo es `base × (1 + %)`; nadie valida precio < costo ni margen mínimo. Se puede vender bajo costo sin aviso.
3. **No hay costo neto.** `producto_proveedor.costo_centavos` es un único número: no modela bonificación, flete ni costo financiero.
4. **Publicación sin red.** `recalcularMasivo` escribe directo sobre miles de productos sin preview de impacto ni forma de revertir.
5. **El POS confía en el renderer.** `ventaConfirmarHandler` persiste el `precio_unitario` que llega por IPC sin re-resolverlo contra `lista_precio_valor`, y guarda `costo_unitario: null` en el movimiento de stock → no hay margen real por venta.
6. **La lista del cliente se ignora.** `cliente.lista_precio_id` existe pero `usePosSession` siempre usa la lista predeterminada.

**Resultado buscado:** que un cambio de costo dispare un lote de precios propuesto, validado contra reglas de margen, revisable con su impacto económico, aprobado por el Supervisor, publicado atómicamente y reversible.

### Decisión

**1. Costo neto (componentes comerciales por proveedor con override por producto).** Bonificación, costo financiero y flete se negocian por proveedor, no por artículo. Se cargan como **default en `proveedor`** (`bonificacion_pct_default` · `costo_financiero_pct_default` · `flete_pct_default`, todos `DEFAULT 0`) con **override nullable en `producto_proveedor`** (`bonificacion_pct` · `costo_financiero_pct` · `flete_pct` · `flete_centavos` —override **absoluto** para peso/volumen— · `otros_costos_centavos`). Resolución de cada componente: `override_producto ?? default_proveedor ?? 0`. Función pura `calcularCostoNeto` en `packages/shared/src/costo.ts` (aritmética testeable sin Electron, reutilizable en el renderer para previews):

```
flete     = flete_centavos_override ?? round(bruto × flete_pct / 100)          // absoluto pisa al %
costoNeto = round( (bruto × (1 − bonif_pct/100) + flete + otros) × (1 + cost_fin_pct/100) )
```

Con todo en su default 0, **costo neto = costo bruto** y nada cambia respecto de hoy. Los defaults se editan en `ProveedorForm`; el **panel Proveedores de `ProductoDetalle`** muestra el costo neto desglosado por proveedor y **es donde se cargan los overrides por producto** (la excepción por línea). La columna se rotula **«Cost. Finan.»**. Editar un default comercial del proveedor cambia el costo neto de **todos** sus productos → dispara un batch (§7).

> **Excepción acotada a ADR-036 (decidido con el PO, 2026-07-24).** ADR-036 dejó el panel Proveedores de `ProductoDetalle` en **solo-lectura** (el Proveedor es el dueño de la relación). Para los **overrides comerciales** de costo neto se reabre puntualmente esa lectura: se editan **en `ProductoDetalle`**, donde ya vive el desglose por proveedor, porque el override es una excepción *por producto* y ese es el contexto natural de carga. El costo **bruto** y la asociación siguen gobernados desde `ProveedorDetalle` (ADR-036 intacto en todo lo demás); su panel Productos muestra los valores efectivos en **solo-lectura**.

**2. Reglas de margen (`regla_precio`).** Tabla nueva en `db/schema/precios.ts`. Resuelve **una sola** regla por producto y lista, con prioridad — nunca combina reglas. Campos: `lista_precio_id`, `tipo` (`producto | marca | rubro | proveedor | lista`), `objetivo_id` (nullable; null para `lista` = regla base), `margen_pct`, `margen_min_pct`/`margen_max_pct` (nullable, alimentan la validación), `redondeo_modo` (`ninguno | terminacion_90 | terminacion_99 | multiplo`), `redondeo_valor`, `prioridad` (INTEGER, menor gana), más `activo`/auditoría/sync. **Semántica de margen: markup sobre costo neto** — `precio = costoNeto × (1 + margen_pct/100)`. Elegido por intuición de mostrador («marco un 40%») y continuidad con el recálculo actual. **La UI muestra al lado el margen real sobre precio** `(precio − costo)/precio` como dato derivado de **solo lectura** (40% de markup ⇒ 28,6% sobre precio), para ver la rentabilidad efectiva sin confundir convenciones. `resolverRegla` (función pura en `shared`) resuelve producto → marca → rubro → proveedor → lista; primera coincidencia gana; sin regla y sin fila vigente → el fallback actual.

**3. Modo de cálculo por lista.** `lista_precio` suma `modo_calculo`: `margen_costo | pct_sobre_lista | manual` (**default `pct_sobre_lista` → el comportamiento actual no cambia** hasta configurarlo). El cierre del circuito de costo (§7) solo actúa sobre listas en `margen_costo`.

**4. Redondeo comercial.** `redondearComercial(centavos, modo, valor)` en `packages/shared/src/precio.ts`, junto a `redondearPeso` pero **independiente**: se aplica al precio de lista después del margen, mientras `redondearPeso` sigue aplicándose al total de la venta (ADR-010, sin cambios).

**5. Lote de publicación (`price_batch` / `price_batch_detalle`).** Dos tablas nuevas. `price_batch` lleva `lista_precio_id`, **`proveedor_id` nullable** (se completa en orígenes de costo/proveedor; «—» en manual/margen — así el proveedor **no se pierde** en el listado ni en el detalle), `origen` (`PROVIDER_COST_UPDATE | MARGIN_UPDATE | SUPPLIER_CHANGE | PRODUCT_CREATED | PROMOTION_CREATED | MANUAL_RECALCULATION | ROLLBACK`), `referencia_tipo`/`referencia_id`, `estado` (`borrador → validado → pendiente_aprobacion → aprobado → publicado` | `validacion_fallida | cancelado | revertido`), `batch_revertido_id`, contadores (`productos_ok`/`advertencias`/`errores`/`excluidas`), métricas de impacto, usuario creador/aprobador, fechas, sync. `price_batch_detalle` (lo que el doc llama `PRICE_CALCULATION`) lleva por fila `producto_id`, `presentacion_id`, `costo_neto_centavos`, `precio_anterior_centavos`, `precio_propuesto_centavos`, `margen_anterior_pct`, `margen_nuevo_pct`, `regla_precio_id`, `variacion_pct`, `estado_validacion` (`ok | advertencia | error | excluida`), `motivo_validacion`. **No es la tabla publicada**: guarda la propuesta hasta aprobar. `recalculo_masivo` suma `price_batch_id` (nullable, FK) para no perder la traza.

**6. Motor de validación.** Módulo nuevo `main/precios/validacion.ts`. Por fila: precio < costo neto (**error**), margen fuera de `[min, max]` de la regla (**error**), variación > umbral parametrizable (**advertencia**), producto sin costo / sin proveedor preferido / inactivo (**error**), proveedor inactivo (**error**). Un `error` sin resolver deja el batch en `validacion_fallida` y **no permite aprobar**; las advertencias se muestran y se aprueban explícitamente. El bloqueo se destraba **excluyendo** las filas en error (una por una o «excluir todas las de error», canales `priceBatch:excluirFila` / `:excluirErrores`): una fila `excluida` no se publica y **no cuenta** para el bloqueo. Con cero errores no-excluidos el batch pasa a `validado`. Las excluidas quedan como **rechazados** (listado aparte de los **aprobados**, ambos exportables); los rechazados corregibles se arreglan en origen y se **reimportan solo esos** como batch nuevo, sin re-tocar lo publicado. **Listas de proveedor parciales son lo normal**, no un error: procesar menos filas que la vez anterior es legítimo; el «conteo esperado vs procesado» del doc original **se descarta como bloqueante** (a lo sumo dato informativo).

**7. Publicación atómica y rollback.** `publicarBatch(batchId)` en **una sola transacción**: verifica `estado = 'aprobado'`, cierra las filas vigentes de `lista_precio_valor` (`fecha_hasta = now`), inserta las nuevas (`origen = 'recalculo'`, `presentacion_id` vía `getDefaultPresentacionId`), marca el batch `publicado`. `revertirBatch(batchId)` genera un **batch nuevo** (`origen = 'ROLLBACK'`, `batch_revertido_id`) cuyo detalle son los `precio_anterior_centavos` del original, y pasa por el mismo camino de aprobación/publicación. **Nunca se modifica historia** (ADR-006). Para escalar a miles de productos, se precargan costos, reglas y presentaciones default en `Map`s antes del loop, dejando solo las escrituras dentro de la transacción.

**8. Cierre del circuito de costo.** Cuatro disparos, todos generando un batch en `borrador` — **nunca publican solos**, y **solo si la lista está en `modo_calculo = 'margen_costo'`**: (a) `importacionCostoConfirmarHandler` → `PROVIDER_COST_UPDATE` con `referencia_id = importacion_id`, en la misma transacción que actualiza los costos; (b) cambio de proveedor preferido / actualización de producto-proveedor → `SUPPLIER_CHANGE` acotado a ese producto; (c) recepción de mercadería con costo distinto → `PROVIDER_COST_UPDATE`; (d) editar un default comercial del proveedor → `PROVIDER_COST_UPDATE` para todos sus productos.

**9. POS: resolución de lista y precio de servidor.** `getPrecioEnListaHandler` acepta `clienteId` opcional y resuelve la lista `cliente.lista_precio_id → predeterminada` (el «Price List Resolver» del doc). `usePosSession.addLinea` pasa el `clienteId` actual y **repregunta el precio al cambiar de cliente**. `ventaConfirmarHandler` **re-resuelve el precio en el servidor** y rechaza con `PRECIO_DESACTUALIZADO` si difiere del recibido, salvo autorización `precio.override` (permiso ya existente). El movimiento de stock de venta pasa a guardar `costo_unitario` = costo neto del momento (hoy `null`), habilitando margen real por venta en el Dashboard.

**10. Navegación — alta autorizada del grupo `precios`.** Este ADR **autoriza el alta de un grupo de navegación nuevo `precios`** en `NAV_GROUPS` de `AppShell.tsx` (permiso `config.fiscal`), como precedente de los grupos «Facturación» (ADR-045) y «Agenda» (ADR-047). El grupo agrupa **4 ítems**: **Listas de precios**, **Lotes**, **Importar costos** y **Cola de revisión** — los tres primeros hoy cuelgan de **Configuración**, mezclados con Categorías/Marcas/Unidades/Etiquetas. **Las rutas existentes no se mueven** (`/config/listas-de-precios`, `/precios/importar-costos`, `/precios/cola-revision-costos` conservan su path: `createMemoryRouter` sin barra de direcciones hace el path invisible, y moverlo obligaría a tocar rutas/CRUMBS/tests a cambio de nada). Dos pantallas nuevas bajo `/precios/*`:

| Pantalla | Ruta | NAV | CRUMBS | Permiso |
|---|---|---|---|---|
| Lotes de precios | `/precios/lotes` | sí — «Lotes de precios» | «Lotes de precios» | `config.fiscal` |
| Detalle de lote | `/precios/lotes/:id` | no | **no** — título propio | + `precio.aprobar` |

`CRUMBS` no soporta rutas con parámetros (`CRUMBS[pathname] ?? ''`), así que el detalle de lote renderiza su propio `.detail-head h1` + enlace `.back` a «Lotes», como `ProductoDetalle`/`/productos/:id` — no se inventa un matcher de parámetros. El detalle lleva buscador + filtros (search por nombre/SKU, filtro por estado de validación y por regla).

**11. Reglas es un tab de Listas de precios, no una pantalla nueva.** Las reglas son por-lista (`regla_precio.lista_precio_id`) y `ListasPreciosView` ya despliega tabs al seleccionar una lista. **Reglas entra como tab y reemplaza a «Ajustes por producto»** (cuyo `DetalleAjustesTab` lee `lista_precio_detalle`, la tabla marcada muerta en CLAUDE.md, *«No escribir contra ella»*). El tab **«Cambios programados» se elimina** (§12). Quedan dos tabs: **Precios vigentes · Reglas**. Además: columna «Modo de cálculo» en el maestro y selector de `modo_calculo` en alta/edición.

**12. Se retira el recálculo programado.** Al pasar el precio por aprobación humana, programar una aplicación automática a fecha futura pierde sentido. `RecalcularModal` pasa de «Aplicar ahora» a **«Crear lote»** (conserva el gate de `contarAfectados`) y **pierde el campo de fecha / «Programar para fecha futura»**. Se **elimina el tab «Cambios programados»** y se **deja de registrar el job** de `scheduler/precios.ts` en `main/index.ts`; se retiran el namespace de preload y los canales IPC `cambioProgramado:*`. La tabla `cambio_programado` queda **deprecada** (como `lista_precio_detalle`), **sin migración destructiva**: filas pendientes en instalaciones viejas simplemente no disparan.

**13. Permiso nuevo `precio.aprobar` (solo Supervisor).** Guardea aprobar/publicar/revertir lotes. Se suma a `PERMISOS` en `auth/seed.ts` (no a `OPERADOR_PERMISOS`). Hay que actualizar los **conteos exactos** en `auth/__tests__/seed.test.ts` e `ipc/__tests__/auth.ipc.test.ts` (afirman el número exacto: 28 → 29 permisos totales; Operador sin cambio).

### Qué se reutiliza (no se reescribe)

| Activo existente | Uso en v2 |
|---|---|
| `lista_precio_valor` (SCD2) | **Sigue siendo la tabla publicada** = el `PRICE_LIST_ITEM` del doc. Su forma no se toca. |
| `recalculo_masivo` | Registro de ejecución; pasa a ser hijo de un batch (FK `price_batch_id`). |
| `resolveProductosAfectados()` | Resolutor de alcance (catálogo/rubro/marca/proveedor + exclusión de manuales recientes), tal cual. |
| `resolveBaseCentavos()` | Se extiende con el modo `margen_sobre_costo`; los modos actuales quedan intactos. |
| `getPrecioEnListaHandler()` | Cadena promoción → vigente → fallback; se le agrega resolución de lista por cliente. |
| `producto_proveedor` + preferido único | El `PRODUCT_SUPPLIER` del doc; se le suman columnas de costo. |
| `promocion` | Pisa el precio vigente por fecha; sin cambios de modelo. |
| `importacion_costo_proveedor` + parser configurable | Se conserva entero; solo cambia qué hace al confirmar. |
| `resolverPrecio()` / `redondearPeso()` | Funciones puras del carrito (venta). **No se tocan**; el redondeo comercial es otra función, en otro punto del pipeline. |
| `requirePermission()` + seed de permisos | Guard existente para el nuevo `precio.aprobar`. |
| `getDefaultPresentacionId()` | Se sigue usando al publicar. |

### Fuera de alcance (del doc, no se implementa)

Canales Web / Marketplace / Mobile (ADR-004/§10) · aprobación de **dos** niveles (solo hay Operador y Supervisor, ADR-008) · el principio «el Producto nunca almacena precios» — `producto.precio_venta_lista` se mantiene como **fallback offline** para productos sin fila vigente, que es lo que hoy evita que el POS se quede sin precio.

### Consecuencias

**Positivas**
- El circuito de costo queda cerrado: un cambio de costo se propaga al precio de venta de forma controlada, con impacto visible y aprobación humana.
- Publicación atómica y reversible sobre `lista_precio_valor` sin reescribir su modelo (SCD2 + historial ya existían).
- Margen real por venta disponible para el Dashboard (`costo_unitario` en el movimiento de stock).
- El POS deja de confiar en el precio del renderer: `ventaConfirmarHandler` re-resuelve en el servidor.
- Simulación gratis (§20 del doc): es un batch que se calcula, se mira y se cancela.
- Punto de corte útil: las fases 1–4 dejan un motor completo y usable a mano; si ARCA apura, se frena ahí sin nada a medio hacer.

**Negativas / costo**
- Tres tablas nuevas (`regla_precio`, `price_batch`, `price_batch_detalle`) + columnas comerciales + módulos `main/precios/{motor,validacion,publicacion}.ts`: superficie a mantener.
- Se retira funcionalidad existente (scheduler + tab «Cambios programados»); tabla `cambio_programado` deprecada.
- Costo neto agrega parámetros comerciales por proveedor que alguien debe cargar (mitigado: default 0 = comportamiento actual).
- Fase 6 (POS) es la más sensible: va última y detrás del flag.

### Alternativas descartadas

- **Componentes comerciales por producto** (3 campos × artículo): inmanejable en catálogos grandes; se resuelve con default por proveedor + override.
- **Margen como markup sobre precio** en vez de sobre costo: menos intuitivo en mostrador y rompe continuidad con el recálculo actual; el margen sobre precio se muestra igual, como dato derivado.
- **Publicar directo al cambiar el costo** (sin lote): es exactamente el agujero de «publicación sin red» que se quiere cerrar.
- **Aprobación de dos niveles** (del doc): no hay tercer rol; ADR-008.
- **Mantener el recálculo programado**: sin sentido cuando el precio pasa por aprobación humana.
- **Bloquear por «conteo esperado vs procesado»** en listas de proveedor: las listas parciales son legítimas.
- **Reglas como pantalla nueva**: son por-lista; entran como tab, reemplazando la tabla muerta `lista_precio_detalle`.

### Decisiones abiertas derivadas

- Bonificación como columna de **Importar Costos** (override desde el archivo del proveedor): candidata a fase posterior; no bloquea.
- Valores default de los umbrales del comercio (`precios.variacion_maxima_pct`, `precios.margen_minimo_pct`) — a confirmar en operación.
- Deuda menor a limpiar en el camino: `listaPrecioCreateHandler` inserta en `lista_precio_valor` **sin `presentacion_id`** (inconsistencia post-ADR-040), y `lista_precio_detalle` sigue con handler registrado pese a estar deprecada.

### Parámetros (`parametros_sistema`)

`motor_precios_v2_habilitado` (flag, default `false`) · `precios.variacion_maxima_pct` (default 30) · `precios.margen_minimo_pct` (default 0) · `precios.excluir_manuales_dias_default` (default 0).

### Plan de fases (gate por fase; cada una desplegable y en verde)

**Fase 0 — este ADR** (documento standalone + entrada en `Estado.md`, sin migraciones, con la autorización del grupo `precios`). *Gate: aprobación antes de tocar schema.* · **Fase 1 —** costo neto (migración aditiva + `shared/costo.ts` + UI en `ProveedorForm`/`ProductoDetalle`; sin impacto en precios). · **Fase 2 —** reglas, redondeo comercial y **alta del grupo de nav `precios`** (tab Reglas reemplaza «Ajustes por producto»; columna/selector «Modo de cálculo»). · **Fase 3 —** batch, validación y simulación (+ permiso `precio.aprobar` y sus conteos). · **Fase 4 —** UI de lotes (`LotesPreciosView` + `LoteDetalleView`; `RecalcularModal` genera batch); primer recorrido manual completo. · **Fase 5 —** cierre del circuito de costo (disparos desde importación/preferido/recepción + salida al lote). · **Fase 6 —** POS (`clienteId`, re-resolución, `PRECIO_DESACTUALIZADO`, `costo_unitario`). Las fases 1–4 dejan el motor usable a mano; 5–6 agregan el automatismo y cierran el POS.

### Implementación (2026-07-25)

Las seis fases se implementaron completas con TDD, todas detrás del flag `motor_precios_v2_habilitado` (default `false`) — con el flag apagado, y toda lista en su modo default `pct_sobre_lista`, el comportamiento es idéntico al de antes del ADR. **1368 tests verdes** (449 renderer + 919 node) + 102 en `shared`, sin migraciones adicionales a las tres documentadas abajo.

- **Fase 1** — `shared/costo.ts` (`calcularCostoNeto`/`resolverComponentesComerciales`/`costoNeto`); migración `0028`; overrides editables en el panel Proveedores de `ProductoDetalle` (excepción puntual a ADR-036, decidida con el PO: el override es la excepción *por producto*, su contexto natural de carga; el costo bruto y la asociación siguen gobernados desde `ProveedorDetalle`).
- **Fase 2** — `shared/regla.ts` (`resolverRegla`/`precioConMargen`/`margenRealPct`) y `redondearComercial` en `precio.ts`; migración `0029` (`regla_precio` + `lista_precio.modo_calculo`); tab **Reglas** en `ListasPreciosView`; alta del grupo de nav `precios` en `AppShell`.
- **Fase 3** — migración `0030` (`price_batch`/`price_batch_detalle` + `recalculo_masivo.price_batch_id` + los 3 umbrales); `main/precios/{motor,validacion,publicacion}.ts`; IPC `priceBatch:*`; permiso `precio.aprobar` (28→29, conteos actualizados en los 2 tests de permisos).
- **Fase 4** — `LotesPreciosView` + `LoteDetalleView`; `RecalcularModal` → «Crear lote» con el flag on.
- **Fase 5** — `crearBatchesPorEventoDeCosto` (núcleo compartido `crearBatchInterno`, refactor de `crearBatch`) disparado desde `importacionCostoConfirmarHandler`, cambio de preferido (`productoProveedorSetPreferidoHandler`/`proveedorProductosActualizarHandler`), `recepcionCrearHandler` con costo real distinto, y `proveedorUpsertHandler` al editar un default comercial (acotado a los productos donde ese proveedor es preferido). Todos los disparadores en `try/catch`: un fallo al generar el batch nunca revierte la operación de costo que lo originó. `ImportarCostosView` gana el bloque «Se generó el lote #N» + «Revisar lote →» + «Importar faltantes».
- **Fase 6** — `getPrecioEnListaHandler` acepta `clienteId` (`resolverListaEfectiva`: `cliente.lista_precio_id → predeterminada`); `usePosSession` repregunta el precio de todas las líneas al cambiar de cliente; `ventaConfirmarHandler` re-resuelve el precio en el servidor y rechaza con `PRECIO_DESACTUALIZADO` salvo autorización de Supervisor (mismo patrón que el override de límite de crédito); el movimiento de stock de la venta guarda `costo_unitario` = costo neto del momento (antes `null`).

**Bug de fondo corregido en el camino (no es parte de este ADR):** el scheduler de `cambio_programado` (mecanismo legado de ADR-034, retirado de la UI en la Fase 2) entraba en crash-loop en cada arranque si existía una fila pendiente con `base_calculo='lista'` y `base_lista_id=null` — causa: `RecalcularModal` deja elegir «Otra lista de precios» como base pero nunca pide ni envía `base_lista_id`. Corregido en `scheduler/precios.ts`: esas filas se cancelan (`estado='cancelado'`) en vez de reintentar por siempre.

**Pendiente:** verificación manual del circuito completo en la app real (activar el flag y recorrer costo → margen → batch → aprobación → publicación → POS).

---

## ADR-050 — Cliente: separar `razon_social` en `nombre` + `apellido`

- **Fecha:** 2026-07-31
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`, cambio de schema aditivo-destructivo acotado a `cliente` (migración
  de recreación de tabla, patrón ya usado en `0018_cola_revision_descartado.sql`). Sin flag:
  el split de identidad de cliente no es una feature opcional, es una corrección de modelo.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-024 (convivencia `localidad_id`/texto libre en `cliente`), ADR-036 (excepción
  puntual de identidad de proveedor, mismo patrón de "no tocar lo que no pidieron").

### Contexto

`cliente.razon_social` es un único campo de texto libre que en la práctica mezcla dos
cosas distintas: el nombre de una persona física (mostrador vende sobre todo a
consumidores finales, no a empresas) y la razón social de una empresa. Sin separar
nombre y apellido no se puede ordenar por apellido, no se puede saludar/formatear
"Sr. García" en un ticket, y cualquier futura integración (padrón AFIP, exportación a
un sistema de terceros que pida nombre/apellido por separado) tiene que parsear texto
libre con heurísticas frágiles.

**Alcance deliberadamente acotado a `cliente`.** `proveedor` y `transportista` son
personas jurídicas por diseño de negocio (le compran mercadería o le hacen la logística
a la ferretería, no le compran ellos) — mantienen `razon_social` tal cual. Separar
también proveedor/transportista no fue pedido y hubiera sido una decisión de modelo de
datos distinta, sin necesidad de negocio detrás.

### Decisión

**1. Schema.** `cliente.razon_social` se reemplaza por `cliente.nombre` (NOT NULL) +
`cliente.apellido` (NOT NULL — confirmado con el PO: no es opcional, toda fila de
cliente tiene los dos campos poblados, aunque sea con un placeholder a revisar).
`proveedor.razon_social` no se toca.

**2. Migración `0033_adr050_cliente_nombre_apellido.sql`.** SQLite no permite agregar una
columna NOT NULL sin default a una tabla con filas ni tampoco `DROP COLUMN` limpio en
todas las versiones en uso: se recrea la tabla completa (`cliente_new` → copia → drop →
rename), mismo patrón que `0018_cola_revision_descartado.sql`. Migración de datos:
`nombre = razon_social` para toda fila existente. Como una razón social histórica de
empresa no tiene un apellido real que separar, `apellido` se completa con el placeholder
**`"(revisar)"`** — visible en toda la UI que arma el nombre (aparece literalmente como
"Ferretería El Martillo (revisar)"), a propósito: nada silencioso, el Supervisor lo ve y
lo corrige a mano cuando corresponda. Excepción explícita: el cliente fijo "Consumidor
Final" (UUID determinístico sembrado en `0003_p1.8_venta.sql`) se separa correctamente en
`nombre="Consumidor"` / `apellido="Final"`, para que el nombre visible no cambie.

**3. Helper compartido `nombreCompletoCliente()`.** Función pura en
`packages/shared/src/persona.ts` (`{ nombre, apellido } → string`, trim de ambos lados,
sin espacio colgante si `apellido` es null/vacío). Es la única fuente de verdad para
armar el nombre para mostrar; ningún punto de lectura reconstruye la concatenación a
mano. En SQL crudo (`reportes.ts`, que no usa drizzle) se traen `nombre`/`apellido` sin
concatenar y se combinan en JS con el mismo helper después de la consulta — no se
reimplementa el armado de nombre en SQL.

**4. Formularios editables usan los dos campos por separado**, nunca el helper como
input: `ClienteForm` pasa a tener inputs "Nombre" y "Apellido", ambos obligatorios,
reemplazando el único input de "Apellido y nombre / Razón social". Todo el resto de la
UI (listados, detalle, selector de POS, presupuestos, remitos, cuenta corriente,
dashboard, reportes, impresión de tickets/remitos/presupuestos) es de solo lectura y usa
`nombreCompletoCliente()`.

**5. Importación masiva (Fase 2, no se adelanta acá).** `importar.ts` todavía trae el CSV
de clientes con una única columna `razon_social` (igual que proveedores). Para que
compile contra el schema nuevo sin adelantar la Fase 2 (que va a rediseñar el formato de
importación con columnas separadas), el importador mapea esa columna completa a
`nombre` y usa el mismo placeholder `"(revisar)"` en `apellido`. Efecto colateral
conocido: reimportar un cliente ya existente pisa un `apellido` corregido a mano de
vuelta a `"(revisar)"` — aceptable como comportamiento transitorio, documentado acá para
que la Fase 2 no lo repita.

### Consecuencias

**Positivas**
- Permite ordenar/buscar por apellido y sienta la base para cualquier integración futura
  que pida nombre y apellido por separado.
- Un único punto de armado de nombre (`nombreCompletoCliente`) en vez de la
  concatenación repetida (o directamente ausente) que había en cada pantalla.
- El placeholder `"(revisar)"` hace visible, no silenciosa, la deuda de datos que deja la
  migración — no hay clientes con apellido vacío indistinguibles de un bug.

**Negativas / costo**
- Recreación de tabla en SQLite (no un `ALTER TABLE` simple): más superficie de migración
  que un cambio aditivo puro, mitigado por seguir un patrón ya probado en el repo.
- Instalaciones existentes van a mostrar `"(revisar)"` en el apellido de todo cliente que
  no sea persona física con nombre y apellido ya separables a simple vista — requiere
  limpieza manual del Supervisor, no automatizable de forma confiable.
- El importador de clientes queda con el mismo efecto colateral de sobreescritura descrito
  en el punto 5 hasta que se haga la Fase 2.

### Alternativas descartadas

- **`apellido` nullable:** más simple de migrar (sin placeholder), pero el PO confirmó que
  el negocio nunca tiene un cliente sin apellido real — dejarlo nullable escondería datos
  incompletos en vez de forzar su revisión.
- **Separar también `proveedor`/`transportista`:** fuera de pedido; son personas jurídicas
  por diseño, no tienen "apellido" que separar.
- **Parsear automáticamente `razon_social` en nombre/apellido por heurística** (última
  palabra = apellido, etc.): decisión rechazada por el PO — un parseo automático de razón
  social de empresa produce basura silenciosa; mejor un placeholder explícito que fuerce
  revisión humana.

### Implementación (2026-07-31)

Fase única, con TDD, ambos test runners en verde. Sin flag — cambio de schema directo.

- **Schema + migración** — `schema/personas.ts` (`cliente.nombre`/`cliente.apellido`,
  ambos NOT NULL); migración `0033_adr050_cliente_nombre_apellido.sql` (recreación de
  tabla + placeholder `"(revisar)"` + caso especial "Consumidor Final").
- **Helper** — `packages/shared/src/persona.ts` (`nombreCompletoCliente`), exportado desde
  `@ferreteria/shared`.
- **Main/IPC** — `cliente.ts` (alta/edición/listado/export), `ctacte.ts`,
  `dashboard-clientes.ts`, `venta.ts` (ticket/export), `presupuesto.ts`, `remito.ts`,
  `reportes.ts` (SQL crudo + mapeo en JS), `dev-seed/personas.ts` (seed de desarrollo,
  con placeholder para las razones sociales de empresa del seed), `importar.ts` (ajuste
  mínimo, ver Decisión §5).
- **Renderer** — `ClienteForm` (dos inputs obligatorios), `ClienteDetalle`,
  `ClientesListado`, `PosClienteSelector`/`PosTopBar`/`usePosSession`,
  `VentaDetalleModal`, `CtaCteListado`, `PresupuestoFormModal`/`PresupuestoDetalleModal`/
  `PresupuestosView`, `RemitoDetalleModal`/`RemitosView`, `ReporteVentasView`,
  `ClientesTabView`.
- **Impresión** — `presupuesto-template.ts` y `remito-template.ts` (campo
  `cliente_nombre_completo`).
- **Tests** — todos los fixtures de tests existentes que sembraban `cliente.razon_social`
  se migraron a `nombre`/`apellido`; se agregó `packages/shared/src/persona.test.ts` y
  `renderer/views/clientes/ClienteForm.test.tsx` (nuevo, no existía cobertura previa del
  formulario).
- **Pendiente:** verificación manual en `pnpm dev` (navegar Clientes, POS, Presupuestos,
  Remitos, Cuenta Corriente, Reportes, Dashboard) — no se pudo ejecutar interactivamente
  en este entorno.

---

## ADR-051 — Mejoras a la carga masiva (importación de costos y catálogo de proveedor)

- **Fecha:** 2026-07-30
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Cambios sobre módulos ya liberados (importación masiva, importación de costos de ADR-035) más una pantalla nueva. Migración aditiva; sin flag (la carga masiva no está detrás de feature flag).
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-035 (importación de costos de proveedor), ADR-036 (relación producto↔proveedor), ADR-049 (motor de precios v2 — cierre del circuito de costo), ADR-025 (SKU interno), ADR-008 (RBAC dos roles), ADR-028/030 (sidebar agrupado).
- **Fuentes de verdad:** `docs/superpowers/specs/2026-07-25-importacion-ux-mejoras-design.md` · mockup `docs/superpowers/specs/2026-07-25-importacion-ux-mejoras-mockup.html`. Los ajustes posteriores (matching estricto, columnas, persistencia diferida, catálogo de proveedor) se cerraron en conversación con el PO sobre la app real (2026-07-30).

### Contexto

ADR-035 dejó la importación de costos con un **mapeo de columnas configurable por proveedor** (`proveedor_importacion_config`: letra/número/nombre de columna, delimitador y fila de encabezado) y matching por cadena código-de-proveedor → GTIN, con cola de revisión manual y preview obligatorio. Al ejercitarla sobre datos reales aparecieron problemas de UX y de lógica que el mockup de mejoras (Partes A/B/C) sólo cubría en parte:

1. **El mapeo configurable era un lastre.** Un paso de configuración por proveedor que se saltaba una vez guardado y quedaba **sin forma de corregirse** cuando el archivo cambiaba de formato (bug real: costo en otra columna, `CONFIG_NOT_FOUND` al reusar la config con otro proveedor). El proveedor no conoce nuestros nombres de columna igual: el formato lo termina fijando quien arma el archivo.
2. **Se persistía demasiado pronto.** Cada "procesar archivo" grababa la importación como `pendiente`; si el usuario navegaba fuera, quedaba huérfana e inflaba Histórico y Cola de Revisión sin haber confirmado nada.
3. **La re-validación al editar no re-identificaba.** Corregir un EAN/código inválido en el preview sólo re-chequeaba el formato del costo, no volvía a buscar el producto → seguía "sin identificar".
4. **No había control de proveedor cruzado ni de duplicados.** Un producto de otro proveedor podía matchear por EAN; dos filas al mismo producto aplicaban en silencio "la última gana".
5. **El Histórico era inconsistente.** Convivían "Pendientes (en vivo)" y "Sin matchear (congelado)" que se contradecían; el detalle filtraba las filas resueltas/descartadas y "desaparecían".
6. **No existía forma masiva de vincular productos a un proveedor** con su código: el onboarding de un catálogo entero se hacía de a uno por Cola de Revisión.

### Decisión

**1. Formato de archivo fijo, se elimina el mapeo configurable.** Importar Costos deja de usar `proveedor_importacion_config`: el archivo tiene **columnas fijas por nombre** — `EAN · COD_PRODUCTO_PROV · COD_INTERNO · DESCRIPCION · COSTO` — con delimitador autodetectado (`;`/`,`) y encabezado en la primera fila. Si un proveedor manda otro formato, se adapta el archivo antes de subirlo. Esto **supersede** el mapeo de columnas de ADR-035 (la tabla `proveedor_importacion_config` queda sin consumidores, no se migra de forma destructiva). Terminología explícita en la UI: **COD_PRODUCTO_PROV** = el código que *el proveedor* le puso al producto (`producto_proveedor.codigo_proveedor`); **COD_INTERNO** = nuestro SKU (`producto.sku`).

**2. Matching estricto al proveedor + cascada + re-matching real.** En Importar Costos sólo se identifican productos **ya vinculados a ese proveedor** (`producto_proveedor`): uno del catálogo que no sea de este proveedor cae en "sin identificar" aunque su EAN coincida (evita cargar costos de otro proveedor). Cascada de identificación: **EAN → código del producto del proveedor → código interno**. Editar una celda en el preview **re-corre el matching real** contra la base (handler `revalidarFila`), no sólo el formato.

**3. Persistencia diferida hasta Confirmar.** El parseo es de sólo lectura: nada se escribe en la base hasta que el usuario confirma. El estado del wizard vive en un Context (`ImportacionCostoWizardContext`) montado por encima de las rutas, así **Previsualizar sobrevive navegar y volver**; "Cancelar" es instantáneo (no hay nada que deshacer) y no aparece nada en Histórico/Cola de Revisión antes de tiempo. Al confirmar se persiste todo de una vez (cabecera en `confirmado`, detalle, y upsert de costos en `producto_proveedor`).

**4. Validaciones del preview.** (a) **Validación cruzada** (advertencia, no bloquea): si una fila matchea por EAN pero el código del producto del proveedor del archivo no coincide con el guardado, se avisa "¿es la lista correcta?" (cubre el caso de cargar la lista de otro proveedor con un producto en común). (b) **Detección de duplicados**: dos filas al mismo producto se marcan visiblemente en vez de aplicar "la última gana" en silencio. (c) Fila con costo no parseable pasa a `error_formato` **editable** (no se descarta); hard-stop si el 100% de las filas tiene costo inválido.

**5. Histórico con desglose en vivo y consistente.** El listado muestra **Total · Identificados · Rechazados · Pendientes**, todo recalculado en vivo desde el detalle, de modo que **Total = Identificados + Rechazados + Pendientes (+ Descartados)** siempre reconcilia (`identificados` = matched + resuelto_manual). Se retira la columna congelada "sin matchear al momento de la carga" que se contradecía con la de pendientes. El detalle deja de filtrar `resuelto_manual`/`descartado` y los muestra con badge propio. Se puede **eliminar** físicamente una importación `pendiente` o `cancelado` (nunca una `confirmado`, que es auditoría real).

**6. Consulta de productos y contexto de proveedor.** Modal de búsqueda de productos (por nombre/SKU/EAN, mostrando el código del producto para ese proveedor) accesible desde el wizard, y encabezado con razón social + código del proveedor una vez elegido.

**7. Importación de catálogo de proveedor (pantalla nueva, `/precios/importar-catalogo-proveedor`).** Establece la **relación producto↔proveedor** en bloque — el objetivo distinto de Importar Costos (que sólo actualiza costos de productos ya vinculados). Matching **global** por EAN → código interno (no crea productos: uno que no existe queda "sin identificar"). Al confirmar hace upsert de `producto_proveedor` (código del proveedor + costo opcional) y marca **preferido de forma no destructiva**: sólo si el producto no tenía ninguno (el primer proveedor gana); **nunca pisa** un preferido existente — porque "preferido" es una decisión por producto que un import masivo no puede tomar sin cambiar costos/precios en silencio (el motor de ADR-049 usa el costo del preferido). Cambiar el preferido a conciencia sigue siendo trabajo del panel Proveedores de `ProductoDetalle`. Dispara batches en borrador (ADR-049 §7) para los productos afectados.

**8. Ajustes de UX transversales.** La ventana de Electron inicia **maximizada** (`ready-to-show` → `maximize`). **Reorden del sidebar** (Punto de venta · Caja · Facturación · Stock · Catálogo · Abastecimiento · Precios · Clientes · Reportes · Agenda · Configuración · Sistema) y "Importar datos" movido a Configuración. **Drag & drop retirado** de ambas cargas (no funcionaba de forma confiable en Electron con `contextIsolation`) → selección por explorador. Todas las plantillas de muestra pasan a delimitador `;`.

### Consecuencias

- `proveedor_importacion_config` queda como **tabla muerta** (schema conservado, sin código que la use). Los handlers `getConfig`/`saveConfig` y el paso de mapeo se eliminaron. Corte definitivo de la tabla: pendiente de un ADR futuro, como el residual `lista_precio_detalle`.
- La cadena de matching ya no es la de ADR-035 (código-de-proveedor → GTIN global): ahora es EAN → código del producto del proveedor → SKU, **scoped al proveedor** en costos y **global** en catálogo. La cola de revisión y el principio de "no crear productos automáticamente" de ADR-035 se conservan.
- El motor de precios v2 (ADR-049 §7) ahora también recibe el disparo desde la importación de catálogo (alta/cambio de preferido), no sólo desde la de costos.
- Migración aditiva `0032_adr051_codigo_interno.sql` (columna nullable en `proveedor_importacion_config`) quedó aplicada aunque la funcionalidad de mapeo se retiró después; es inofensiva (columna sin uso).

### Implementación (2026-07-30)

Rama `feat/adr-051-mejoras-carga-masiva`, PR a `main`. Backend: `importacion-costo.ts` (parseo de sólo lectura, matching estricto, `revalidarFila`, `buscarProductos`, confirmar diferido, historial con desglose en vivo, eliminar), `importacion-costo.parser.ts` (columnas fijas), `importacion-catalogo.ts` (nuevo). Renderer: `ImportarCostosView`, `HistorialImportacionCostosView`, `ImportacionCostoWizardContext`, `ImportarCatalogoProveedorView` (nuevo) + ruta/nav/breadcrumb. Suite completa en verde (renderer vitest + main process bajo Electron + `tsc --noEmit`), con tests de handlers y de UI para cada punto. **Pendiente:** checkbox opcional de "marcar preferido en bloque" en la importación de catálogo (diferido a pedido del PO); verificación manual del catálogo con datos reales.

**Nota de integración (fusión con "ajustes varios", 2026-07-31):** esta rama y la de ADR-050/ADR-058 divergieron del mismo commit de `main` y cada una reordenó el sidebar por su cuenta (punto 8 de arriba vs. Fase 3 de ADR-058). Al fusionar se combinaron ambas decisiones: se mantuvo el agrupamiento con menos grupos de un solo ítem (Caja dentro de Facturación, Stock dentro de Catálogo, Transportistas en Configuración) pero reposicionado cerca del principio del sidebar, como pedía el punto 8. El orden final real está documentado en el comentario que encabeza `NAV_GROUPS` en `AppShell.tsx`, no en el listado de este punto.

Sobre la numeración de migraciones: ambas ramas generaron un archivo `0031_...sql` de
forma independiente (`0031_adr051_error_formato.sql` acá, `0031_adr050_cliente_nombre_apellido.sql`
en la otra rama). Se mantuvieron **estos dos archivos de esta rama con su nombre y su
campo `when` originales** (`0031_adr051_error_formato.sql`, `0032_adr051_codigo_interno.sql`)
porque bases reales que ya corrieron esta rama tienen esos valores de `when` grabados en
`__drizzle_migrations` como marca de agua — Drizzle decide qué migración correr comparando
`when` contra esa marca de agua, no por hash ni por nombre de archivo. La migración de
ADR-050 se renombró a `0033_adr050_cliente_nombre_apellido.sql` con un `when` posterior al
de `0032_adr051_codigo_interno.sql`, para garantizar que corra tanto en instalaciones
nuevas como en cualquier base que ya haya aplicado esta rama. Intentar lo inverso
(renombrar los archivos de esta rama) rompe el arranque en cualquier base real que ya los
haya corrido: el `ALTER TABLE` se reintenta y falla con "duplicate column name" porque
Drizzle igual lo vuelve a ejecutar al ver un `when` mayor a la marca de agua, sin importar
que el hash del archivo no coincida.

---

## ADR-058 — Importación masiva de Clientes/Proveedores: contrato de columnas completo + fix de sobreescritura de apellido

- **Fecha:** 2026-07-31
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x` (sigue a ADR-050 Fase 1, en la misma rama de trabajo).
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-050 (split `cliente.nombre`/`apellido`), ADR-024 (domicilio: `localidad`/
  `provincia` como texto libre, sin resolver FK en la importación), ADR-036/ADR-049
  §1 (identidad y defaults comerciales de `proveedor`, explícitamente fuera de esta
  importación).

### Contexto

ADR-050 (Fase 1) dejó `importar.ts` compilando contra el nuevo schema de `cliente`
(`nombre`/`apellido`) con un ajuste mínimo documentado en su punto 5: el CSV de clientes
seguía trayendo una única columna `razon_social`, mapeada íntegra a `nombre`, con
`apellido` fijo en el placeholder `"(revisar)"` **en cada fila procesada, sin distinguir
alta de reimportación**. Eso dejaba un bug real: reimportar un cliente ya existente volvía
a pisar un apellido que el Supervisor ya había corregido a mano en la pantalla de Clientes.

Además, el importador de clientes/proveedores nunca llegó a cubrir el resto de los campos
que el alta manual (`ClienteForm`, `ProveedorForm`) sí soporta desde hace tiempo:
`telefono_adicional` y el domicilio desglosado (`calle`, `numero`, `aclaracion`,
`codigo_postal`, `localidad`, `provincia`), y en proveedores además `codigo` (identificador
único editable). El importador de productos tampoco cubría `unidad_compra`,
`factor_conversion` ni `permite_fraccion`, que sí existen en el alta manual
(`ProductoForm`) desde ADR-014/ADR-040.

### Decisión

**1. CSV de clientes: `razon_social` → `nombre` (obligatoria) + `apellido` (opcional).**
El contrato de columnas cambia — no es aditivo — porque `razon_social` nunca existió como
concepto real para `cliente` después de ADR-050; mantenerlo como nombre de columna hubiera
sido confuso. `apellido` es opcional en el CSV: si no viene,
  - **INSERT** (cliente nuevo, sin match por `numero_documento`): se usa el mismo
    placeholder `"(revisar)"` que la migración de ADR-050 (`0033_adr050_cliente_nombre_apellido.sql`), para que la fila quede visiblemente
    marcada para revisión, igual que un cliente migrado desde `razon_social`.
  - **UPDATE** (cliente existente, match por `numero_documento`): **se preserva el
    apellido ya guardado en la BD**, no se pisa con el placeholder. Esto corrige el bug de
    Fase 1. La resolución vive en `resolverApellido()` en `importar.ts`: si el CSV trae
    `apellido` no vacío se usa ese valor (INSERT o UPDATE); si no, y es un UPDATE, se lee
    el `apellido` actual de la fila por `id` y se reusa tal cual; si no, y es un INSERT, se
    usa `"(revisar)"`.

**2. Domicilio y contacto como texto libre, mismo patrón que los formularios manuales.**
Clientes y proveedores suman `telefono_adicional`, `calle`, `numero`, `aclaracion`,
`codigo_postal`, `localidad`, `provincia` como columnas opcionales del CSV — todas de
texto libre, sin resolver `localidad_id` por FK (ADR-024 ya estableció esa convivencia
deliberada; la importación no necesita ni debe hacer más que el alta manual).

**2.bis Fix post-revisión — el mismo problema de "pisar con null" afectaba a estos 7
campos, no solo a `apellido`.** Una revisión de calidad detectó, con reproducción
empírica, que `clienteUpsertHandler`/`proveedorUpsertHandler` escriben siempre
`payload.campo ?? null` en su rama UPDATE (están pensados para un form que manda el
estado completo, incluido vaciar un campo a propósito). Como `confirmarClientes`/
`confirmarProveedores` solo agregaban una key al payload cuando `data[campo] != null`,
reimportar un cliente/proveedor existente con un CSV que **no trae** una de estas 7
columnas (CSV viejo, o armado a mano solo para tocar otro campo) borraba en silencio
`calle`/`localidad`/etc. ya guardados. Se generalizó el mismo enfoque de
`resolverApellido()`: `completarCamposAusentes()` en `importar.ts` — antes de armar el
payload de upsert, si es un UPDATE y el CSV no trae valor para uno de los 7 campos de
`CAMPOS_OPCIONALES_DOMICILIO`, se relee el registro existente y se completa `data` con el
valor ya guardado, de forma que el payload termine mandando ese mismo valor en vez de
`null`. `clienteUpsertInternal`/`proveedorUpsertInternal` (esta última extraída en el
mismo fix, antes el código estaba inline en `confirmarProveedores`) hacen esa lectura una
sola vez por fila de UPDATE y la reusan tanto para `apellido` como para los 7 campos de
domicilio. No se tocó `clienteUpsertHandler`/`proveedorUpsertHandler` — habría cambiado
la semántica que sí necesita el alta manual (poder vaciar un campo mandando `null` a
propósito desde `ClienteForm`/`ProveedorForm`).

**Hallazgo relacionado, fuera de este alcance:** el mismo patrón `payload.x ?? null`
también afecta a `nombre_fantasia`, `telefono`, `email` (cliente y proveedor),
`habilita_cuenta_corriente` (cliente) y `persona_contacto`/`observaciones` (proveedor) —
campos que ya existían en el importador **antes** de esta fase, no parte del pedido
original de "campos completos" de Fase 2. No se corrigieron acá para no ampliar el
alcance de este fix puntual; queda como deuda conocida para una fase futura o un fix
dedicado (el mismo `completarCamposAusentes()` generalizaría igual de bien a esa lista).

**3. Proveedores suman `codigo` (opcional, único).** Se valida en el preview (no se
delega al error crudo de SQLite de la constraint `unique()` del schema), con el mismo
criterio de unicidad que ya aplica `proveedorUpsertHandler` en el alta manual (si no se
provee, se autogenera; si se provee y coincide con el propio proveedor en un UPDATE, no
es colisión): duplicado dentro del propio archivo → error; coincide con el `codigo` de
**otro** proveedor ya existente en la BD → error. `razon_social` no se toca (proveedor
sigue fuera del alcance de ADR-050).

**4. Explícitamente fuera de esta importación:** los defaults comerciales de proveedor
(`bonificacion_pct_default`, `costo_financiero_pct_default`, `flete_pct_default`,
ADR-049 §1) y el vínculo `producto_proveedor` — ambos pedidos explícitamente retirados
del alcance en la planificación de esta fase. No se agregan aunque el resto de la
importación pase a ser "completa".

**5. Productos suman `unidad_compra`, `factor_conversion` y `permite_fraccion`** como
columnas opcionales, mismo patrón `has(columna)` que el resto de columnas opcionales del
importador de productos. `factor_conversion` exige un número > 0 cuando se provee (mismo
mínimo que el input de `ProductoForm`); `permite_fraccion` es un booleano `"true"`/resto
(mismo criterio que `habilita_cuenta_corriente`).

**6. No existe una capa de "revalidación inline" separada.** El plan original asumía
funciones `validarFilaCliente`/`validarFilaProveedor` reusadas por una revalidación en
`PreviewStep` del renderer — no existen en el código: la validación de clientes y
proveedores vive inline en `validarClientes`/`validarProveedores` (solo productos tiene
`validarFilaProducto` extraída), y `PreviewStep.tsx` es de solo lectura, sin edición ni
revalidación de filas. Se descarta esa parte del plan por no tener punto de integración
real; documentado acá para no reabrir la pregunta en una fase futura sin verificar primero
si se agregó desde entonces.

### Consecuencias

**Positivas**
- El bug de sobreescritura de apellido queda corregido: reimportar un CSV de clientes ya
  no destruye correcciones manuales.
- El bug gemelo en los 7 campos de domicilio/contacto (detectado en revisión de calidad,
  con reproducción empírica) también queda corregido: reimportar un cliente/proveedor con
  un CSV que no trae esas columnas ya no borra `calle`/`localidad`/etc. ya guardados.
- El importador deja de ser un subconjunto silencioso del alta manual: mismos campos,
  mismas reglas de unicidad para `codigo` de proveedor.
- `getPlantilla()` (antes un `Record` interno sin punto de prueba propio) queda exportado
  y testeado, así que un futuro cambio de columnas no puede desincronizarse de los tests.

**Negativas / costo**
- El CSV de clientes es una **ruptura de contrato**, no aditiva: una plantilla vieja con
  columna `razon_social` deja de reconocer el nombre del cliente (la fila fallaría por
  `nombre` faltante). Aceptado porque `razon_social` era ya conceptualmente incorrecto
  para `cliente` desde ADR-050; no había una plantilla "vieja" correcta a preservar.
- La resolución de apellido y domicilio en UPDATE hace **una** lectura extra a la BD por
  fila de UPDATE (ambas resoluciones comparten la misma consulta) — costo despreciable
  para el volumen de estas importaciones (herramientas de ferretería, no miles de filas
  por segundo).
- Deuda conocida y documentada (no corregida en este fix): el mismo patrón de
  sobreescritura sigue vigente para `nombre_fantasia`/`telefono`/`email`/
  `habilita_cuenta_corriente` (cliente) y `nombre_fantasia`/`telefono`/`email`/
  `persona_contacto`/`observaciones` (proveedor) — campos pre-existentes a esta fase, no
  parte del pedido de Fase 2 ni del hallazgo de la revisión de calidad que motivó este fix.

### Alternativas descartadas

- **Mantener `razon_social` como alias aceptado además de `nombre`:** más compatible hacia
  atrás, pero perpetúa el nombre de columna incorrecto y complica la plantilla descargable
  (¿cuál se documenta como la "oficial"?). Se prefirió cortar limpio.
- **Omitir `apellido` del payload en vez de resolverlo antes de llamar a
  `clienteUpsertHandler`:** hubiera requerido cambiar el contrato de
  `ClienteUpsertPayload` (volverlo opcional) y mover la lógica de placeholder/preservación
  al handler de alta manual, que no la necesita — el bug es específico del flujo de
  importación masiva, no del alta manual (que siempre tiene un input de apellido en
  pantalla). Se prefirió resolver el valor correcto antes de la llamada y mantener
  `clienteUpsertHandler` sin cambios de contrato.

### Implementación (2026-07-31)

TDD estricto, RED-GREEN, ambos test runners en verde (`vitest run` + `test-node.cjs`),
typecheck limpio. Implementada en dos pasadas: la Fase 2 original y un fix inmediato
posterior tras una revisión de calidad que detectó, con reproducción empírica, el bug
gemelo de sobreescritura descrito en la Decisión §2.bis.

- **Main/IPC** — `importar.ts`: `validarClientes`/`confirmarClientes` (CSV
  `nombre`+`apellido` opcional, domicilio, `resolverApellido()`),
  `validarProveedores`/`confirmarProveedores` (domicilio, `codigo` con validación de
  unicidad en preview), `validarFilaProducto`/`confirmarProductos` (`unidad_compra`,
  `factor_conversion`, `permite_fraccion`), `PLANTILLAS` actualizado para las tres
  entidades, nueva función exportada `getPlantilla()`. Fix posterior: `CAMPOS_OPCIONALES_
  DOMICILIO` + `completarCamposAusentes()` (helper genérico, reutilizado por cliente y
  proveedor), `resolverApellido()` pasa a ser una función pura que recibe el valor
  existente ya leído en vez de consultar la BD por su cuenta, `proveedorUpsertInternal()`
  extraída de `confirmarProveedores` (antes inline) para poder aplicarle el mismo patrón
  que `clienteUpsertInternal()`.
- **Renderer** — `PreviewStep.tsx`: la columna "Nombre / Clave" ahora también reconoce
  `data.nombre` (antes solo `nombre_corto`/`razon_social`/`codigo`), para no mostrar "—"
  en filas de cliente tras el rename de columna.
- **Tests** — `importar.handlers.test.ts` ampliado con los casos de INSERT/UPDATE con y
  sin apellido, domicilio opcional en las tres entidades, unicidad de `codigo` de
  proveedor (archivo y BD), validación de `factor_conversion`/`permite_fraccion`,
  contenido de `getPlantilla()` por entidad, y (fix posterior) UPDATE de cliente y de
  proveedor con un CSV que no trae ninguna columna de domicilio — verifica que el
  domicilio ya guardado no se pisa con `null`.
- **Pendiente:** verificación manual en `pnpm dev` (Importación → Clientes/Proveedores/
  Productos, subir un CSV con los campos nuevos y confirmar) — no se pudo ejecutar
  interactivamente en este entorno; ver nota de seguridad del entorno de trabajo.
  Deuda conocida sin resolver: generalizar `completarCamposAusentes()` a
  `nombre_fantasia`/`telefono`/`email`/`habilita_cuenta_corriente` (cliente) y
  `nombre_fantasia`/`telefono`/`email`/`persona_contacto`/`observaciones` (proveedor),
  que comparten la misma causa raíz pero quedaron fuera del alcance de este fix (ver
  Consecuencias).

---

## ADR-052 — Detalle de Producto: proveedor preferido seleccionable + compactar Overrides Comerciales

- **Fecha:** 2026-07-31
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Dos mejoras de UI sobre el panel Proveedores de `ProductoDetalle` (ya liberado con ADR-036/ADR-049). Sin migración de schema (la columna `preferido` ya existía) y sin flag (el panel no está detrás de feature flag).
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-036 (relación producto↔proveedor: N:M con costo, soft-delete e **índice único parcial de un solo preferido activo por producto**), ADR-049 (motor de precios v2 §1 overrides comerciales / §7 el cambio de preferido dispara batches de costo).
- **Fuentes de verdad:** `docs/superpowers/specs/2026-07-31-mejoras-varias-31-07-design.md` (sección ADR-052) · prompt `docs/ADR-052 - Proveedor preferido y Overrides Comerciales en Detalle de Producto.txt`.

### Contexto

El panel Proveedores del Detalle de Producto (`views/productos/ProveedoresPanel.tsx`, flag motor v2 encendido) muestra una tabla con el costo neto desglosado por proveedor. Dos asperezas de UX quedaron pendientes tras ADR-049:

1. **El proveedor preferido no se podía elegir desde el detalle.** La columna `Pref.` renderizaba un indicador `●/○` de sólo lectura; para cambiar el preferido había que ir a la ficha del proveedor (`proveedorProductosActualizarHandler`). El preferido es una decisión **por producto** (su costo neto alimenta las reglas de margen de ADR-049), así que el lugar natural para tomarla es el propio Detalle de Producto.
2. **La sub-sección "Overrides Comerciales" quedó desproporcionada.** El editor (modal) apilaba cinco campos (`%` y `$`) verticalmente con título y labels de tamaño grande, ocupando mucho más de lo que su importancia amerita frente al resto del formulario del detalle.

### Decisión

**1. Proveedor preferido seleccionable desde el panel.** El indicador de la columna `Pref.` de cada fila **no preferida** pasa a ser un botón accionable (`aria-label="Marcar <proveedor> como preferido"`); la fila ya preferida muestra `●` estático. Un clic marca ese `producto_proveedor` como preferido con **update optimista** (la fila pasa a `●` y las demás a `○` de inmediato) seguido de refetch; si el IPC falla se hace **rollback** al estado previo y se muestra el error.

El cableado reutiliza el IPC ya existente `compras.pp:setPreferido` (`productoProveedorSetPreferidoHandler`) — no hizo falta agregar handler ni tocar el preload. Ese handler se **endureció** para cumplir literalmente la regla de ADR-036 "desmarcar el anterior y marcar el nuevo en la **misma transacción**": los dos `UPDATE` (limpiar todos los preferidos activos del producto → setear el elegido) pasaron a envolverse en `db.transaction(...)`, igual que su hermano `proveedorProductosActualizarHandler`. El orden limpiar-antes-de-setear es obligatorio por el índice único parcial `ux_producto_proveedor_preferido`; la transacción además elimina la ventana de "cero preferidos" si el proceso cae entre ambos statements. Se conserva el disparo de batches de costo por cambio de preferido (ADR-049 §7).

**2. Compactar el editor de "Ajustes de costo del producto".** Puramente UI/CSS, sin tocar validaciones ni la semántica de los overrides (siguen: vacío = heredar el default del proveedor; `flete $` pisa a `flete %`; conversión pesos↔centavos al guardar). Los cinco campos se reorganizan en una grilla de **2 columnas** (`minmax(0, 1fr)` para que los inputs numéricos no desborden el modal), de a pares uno al lado del otro en vez de apilados. Se reduce el tamaño de fuente del **título** del modal (`h2` 15px) y de los **labels/campos** (label 11px, input 13px con padding menor, `width: 100%`), y se acortan los rótulos (el detalle largo pasa a `title`), para que el bloque quede proporcionado al resto del detalle. Además, a pedido del PO se renombró la leyenda anglicada "Overrides comerciales" a **"Ajustes de costo del producto"** (y el tooltip/`aria-label` del lápiz a "Ajustar costos"), evitando el anglicismo.

### Fuera de alcance (no se tocó)

Motor de precios / cálculo de márgenes / costo neto (ADR-049); el modelo `producto_proveedor` más allá del flag `preferido`; cualquier otra pantalla.

### Consecuencias

- El preferido de un producto ahora se cambia desde **dos** lugares (panel Proveedores del producto y ficha del proveedor), ambos atómicos y respetando el único-preferido-activo de ADR-036. La importación de catálogo (ADR-051 §7) sigue marcando preferido sólo de forma no destructiva; cambiarlo a conciencia es trabajo de este panel.
- El editor de overrides es sólo presentación: las etiquetas (`Bonif. %`, etc.) siguen asociadas a sus inputs vía `<label>`, así que la carga y guardado por `compras.pp:setOverrides` no cambian.

### Implementación (2026-07-31)

Rama `feat/adr-052-preferido-overrides`. Main process: `ipc/producto-proveedor.ts` (`productoProveedorSetPreferidoHandler` envuelto en transacción) + test de invariante "único preferido activo tras alternar A→B→A" en `__tests__/producto-proveedor.handlers.test.ts`. Renderer: `views/productos/ProveedoresPanel.tsx` (indicador `Pref.` accionable con optimista + rollback; grilla compacta de overrides) + tests de clic/optimista/rollback en `ProveedoresPanel.test.tsx`. Suite completa en verde (renderer vitest + main process bajo Electron + `tsc --noEmit`: 1016 tests main + renderer). **Pendiente:** verificación visual manual en `pnpm dev` (entrar a un Detalle de Producto con >1 proveedor, cambiar el preferido con un clic, confirmar que persiste al recargar y que el editor de overrides entra compacto).

---

## ADR-053 — Listado de Productos absorbe Localización; default activos y ordenamiento por cabecera

- **Fecha:** 2026-08-01
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Sin migración de schema y sin feature flag (reorganización de UI + extensión del IPC de lectura `producto.list`, ambos aditivos/retrocompatibles).
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-005/025 (identidad del producto por `sku`; **la ubicación no se escanea ni se imprime, no existe columna `codigo_qr`** — este ADR **no lo reabre**: la búsqueda de ubicación es textual), ADR-008 (la "Localización de producto" es una capacidad RBAC del Operador — se mueve, no se elimina).
- **Fuentes de verdad:** `docs/superpowers/specs/2026-07-31-mejoras-varias-31-07-design.md` (sección ADR-053) · prompt `docs/ADR-053 - Listado de Productos absorbe Localizacion, default activos y ordenamiento.txt`.

### Contexto

La pantalla "Ubicaciones" (`/ubicaciones` → `LocalizacionView` en `views/ubicaciones/UbicacionesDeposito.tsx`) **no era un ABM**: era un flujo scan-driven de *localización* con dos modos (Buscar producto / Buscar ubicación) que implementaba la capacidad RBAC "Localización de producto" del Operador. Como pantalla aparte sumaba poco valor y arrastraba textos legado ("Código QR de ubicación") y un `detectFormat` con el formato residual `qr` `^QR-\d+$` (pre-ADR-025). El PO decidió **mover esa capacidad al Listado de Productos** y de paso mejorar el listado (default de activos + ordenamiento por cabecera).

Verificación previa (GATE): las ubicaciones **se crean por Importación masiva** (`/importar` → entidad "Ubicaciones", ADR-051) y se **asignan** desde `ProductoForm` (dropdown). El IPC `ubicacion:create`/`update` no tiene otra pantalla de ABM; `ubicacion:update` (editar descripción/activo) no tenía consumidor de UI. Por lo tanto, dar de baja `LocalizacionView` **no** deja huérfana la gestión del catálogo `ubicacion` — el punto de entrada de creación (Importar datos) sigue intacto.

### Decisión

1. **Default = productos activos** al abrir `/productos`. El estado inicial de `filtros` en `CatalogoContext` pasa de `{}` a `{ activo: true }`; el filtro de estado sigue modificable a "Todos"/"Inactivos".
2. **Ordenamiento asc/desc por cabecera.** El IPC `producto.list` ya soportaba `sortBy`/`sortDir`; se **amplió** el union de `sortBy` con `precio_venta_lista` y `ubicacion_sector`/`ubicacion_estante`/`ubicacion_posicion`. La cabecera clickeada togglea dirección (mismo patrón que `StockListado`). Orden por defecto: `nombre_corto` asc. (Nota: SQLite ordena NULLs primero en ASC — los productos sin ubicación aparecen al inicio al ordenar por columnas de ubicación; se aceptó el default, sin `NULLS LAST`.)
3. **Columnas Sector / Estante / Posición** en el listado (los datos ya venían en `producto.list` vía el `leftJoin` a `ubicacion`).
4. **Búsqueda/filtro textual de ubicación** (nuevo param `busqueda_ubicacion`): `LIKE` sobre `ubicacion.sector`/`estante`/`posicion`/`codigo`. **Sin QR ni escaneo.** Requirió agregar el `leftJoin` a `ubicacion` también en la query de `count` (antes sólo joineaba `existencias`), o el total rompía al filtrar por ubicación.
5. **Absorción de "Buscar ubicación":** tipear un sector/estante/posición/código en el buscador de ubicación filtra el listado a los productos de esa ubicación — reemplaza la capacidad de "ver los productos de una ubicación" que daba el modo Ubicación de `LocalizacionView`.
6. **Baja de `/ubicaciones`:** se quitó la ruta y su import en `routes/index.tsx`, el ítem "Ubicaciones" del grupo Catálogo y `SVG_UBICACIONES` en `AppShell.tsx`, y su entrada en `CRUMBS`. Se borró la carpeta `views/ubicaciones/` (componente + `LocalizacionView.test.tsx` huérfano). El texto legado "Código QR de ubicación" y el formato `qr` de `detectFormat` desaparecieron con el archivo (no se trasladó `detectFormat`: no tenía otro consumidor y el nuevo buscador es textual, no scan-driven).

### Fuera de alcance (no se tocó)

QR real de ubicación, impresión de etiquetas de ubicación, escaneo de ubicación (no reabre ADR-005/025). Esquema de `ubicacion` y forma en que el producto referencia su ubicación (`producto.ubicacion_id`, una sola). La definición de export `exportUbicaciones` en `@ferreteria/shared` quedó sin consumidor de UI tras la baja (dead code inofensivo); su corte no era parte del alcance.

### Consecuencias

- La "Localización de producto" (capacidad RBAC del Operador, ADR-008) sigue disponible: ahora se ejerce desde el Listado de Productos (columnas de ubicación + buscador textual), no desde una pantalla dedicada. No se removió ningún permiso.
- `busqueda_ubicacion` y el orden viven en `CatalogoContext` (no en `filtros`), así que **no** se filtran al `ExportarButton` de productos — el export mantiene su contrato previo (busqueda + filtros de categoría/marca/activo/stock).
- `ubicacion:update` sigue sin UI; editar una ubicación existente continúa sin punto de entrada (situación preexistente, no introducida por este ADR).

### Implementación (2026-08-01)

Rama `feat/adr-053-listado-absorbe-localizacion`. Main process: `ipc/producto.ts` (`ProductoListParams.sortBy` ampliado, `busqueda_ubicacion`, `leftJoin ubicacion` en count, `buildProductoOrderClause` con columnas de ubicación/precio) + tests en `__tests__/producto.handlers.test.ts` (búsqueda por sector/código/estante/posición, count respetando el filtro, orden por columna). Renderer: `context/CatalogoContext.tsx` (default activos, estado de orden, `busquedaUbicacion`, `toggleSort`), `hooks/useProductos.ts` (pasa `sortBy`/`sortDir`/`busqueda_ubicacion`), `views/productos/ProductosListado.tsx` (columnas de ubicación, cabeceras ordenables, buscador de ubicación, placeholder sin "QR") + nuevo `ProductosListado.test.tsx`. Baja: `routes/index.tsx`, `views/shell/AppShell.tsx` (NAV/CRUMB/SVG) y su test actualizado; borrado `views/ubicaciones/`. Suite completa en verde: **1025 tests** (renderer vitest + main process bajo Electron) + `tsc --noEmit`. **Pendiente:** verificación visual manual en `pnpm dev` (en `/productos`: confirmar default activos, ordenar por cabeceras, ver columnas de ubicación, buscar por sector/estante/posición y por código; confirmar que `/ubicaciones` ya no está en el sidebar ni accesible por URL, y que la creación de ubicaciones por Importar datos sigue disponible).

---

## ADR-054 — Revisión e Historial de Costos y Catálogo + mejoras a Importar Catálogo Proveedor

- **Fecha:** 2026-08-01
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Cambios sobre módulos ya liberados (Importar Costos/Catálogo de ADR-035/051) más schema/IPC nuevos para el historial de catálogos. Migración aditiva; sin flag (la carga masiva no está detrás de feature flag, y los ítems de precios ya conviven con el flag `motor_precios_v2_habilitado` sin cambiar de ruta).
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-035 (importación de costos: `importacion_costo_proveedor` + `_detalle`, cola de revisión, preview obligatorio), ADR-051 (mejoras a la carga masiva: matching estricto, persistencia diferida, `ImportarCatalogoProveedorView` **sin** historial persistido, y la Cola de Revisión como pantalla separada), ADR-036/ADR-049 (relación `producto_proveedor`, preferido único, batches de costo), ADR-028/030 (sidebar agrupado), ADR-053 (patrón de orden por cabecera client-side).
- **Fuentes de verdad:** prompt `docs/ADR-054 - Revision e Historial de Costos y Catalogo, mejoras Importar Catalogo Proveedor.txt` · diseño `docs/superpowers/specs/2026-08-01-adr-054-revision-historial-design.md` · plan `docs/superpowers/plans/2026-08-01-adr-054-revision-historial.md`.

### Contexto

ADR-051 dejó tres pantallas de precios separadas para la carga masiva de costos: **Importar Costos**, **Cola de Revisión** (único lugar donde se re-resuelven las filas `sin_matchear`) e **Historial de costos**; y una pantalla nueva **Importar Catálogo Proveedor** que establece la relación `producto_proveedor` en bloque pero **no dejaba rastro persistido** (al confirmar hacía el upsert y descartaba las filas — no había historial análogo al de costos). El PO pidió consolidar la superficie y emparejar el catálogo con costos.

### Decisión

**1. Pantalla unificada de 3 tabs (`RevisionHistorialView`, ruta `/precios/revision-historial`).** Tabs **Revisión · Costos · Catálogos**, con **Costos por default**. El tab activo vive en el query param `?tab=` (deep-linkable). La **Cola de Revisión se reubica como tab sin cambiar su semántica**: sigue siendo el único lugar donde se re-resuelven filas `sin_matchear` (reusa `ColaRevisionCostosView` intacto). Esto **supersede parcialmente a ADR-051** en el punto donde ADR-051 dejó la Cola como pantalla separada. Un único ítem de menú "Revisión e Historial de Costos y Catálogo" reemplaza a los dos anteriores ("Cola revisión costos" + "Historial de costos") en el grupo **Configuración** y en `PRECIOS_GROUP` (flag `motor_precios_v2_habilitado`), con su entrada en `PRECIOS_PATHS`, ruta y `CRUMBS`.

**2. Rutas viejas: consolidadas (quitadas), sin redirect.** Se eliminaron `/precios/cola-revision-costos` y `/precios/historial-costos` (rutas, ítems de NAV, CRUMBS). El link interno "Ver pendientes en Revisión" del historial de costos ahora cambia de tab (callback `onVerPendientes`) en vez de navegar a una ruta separada. Decisión tomada con el PO; no había bookmarks externos a preservar (superficie interna).

**3. Historial de catálogos persistido (tablas nuevas paralelas).** Se agregan `importacion_catalogo_proveedor` (+ `_detalle`), espejo aditivo de las de costos de ADR-035, en `schema/compras.ts`, con **dinero en centavos** (INTEGER). Se descartó *generalizar* las tablas de costos por ser invasivo sobre código cerrado y requerir migración destructiva. `importacionCatalogoConfirmarHandler` ahora persiste cabecera + detalle en la misma transacción y devuelve las filas enriquecidas con `preferido_asignado`. Nuevos handlers `getHistorial`/`getHistorialDetalle`/`buscarProductos`. Las importaciones de catálogo se persisten siempre en estado `confirmado` (no hay flujo `pendiente`/`cancelado` como en costos, porque el catálogo confirma de una vez).

**4. Filtros y orden en ambos listados (Costos y Catálogos).** Filtro por **Proveedor** y por **estado** (selects poblados con los valores presentes) y **orden asc/desc por cabecera** en cada columna, resueltos **client-side** (el dataset de historial es chico y así no se toca el IPC cerrado de costos de ADR-035).

**5. Mejoras UX de Importar Catálogo Proveedor.** (a) **Buscador de productos** ("Consultar productos", solo lectura, espejo del de Importar Costos: busca por nombre/SKU/EAN y muestra el código que ese proveedor ya tiene). (b) Al finalizar, **tabla única de productos impactados** con **chips de filtro clickeables** (Todos · Creados · Actualizados · Preferido · Sin identificar · Con error), construida desde las filas devueltas por `confirmar`. (c) **Export CSV** de las filas del chip activo. Además `confirmar` pasa a recibir `nombreArchivo` (basename del archivo elegido) para la cabecera del historial.

### Fuera de alcance (no se tocó)

El matching/resolución de costos de ADR-035/051 (cerrado — la Cola solo se reubica). Creación automática de productos/marcas/ubicaciones. Motor de precios v2 (ADR-049) más allá del disparo de batches ya existente. No se escribió en `parametros_sistema` ni se agregaron dependencias.

### Consecuencias

- La superficie de precios pasa de 3 pantallas de revisión/historial a **una** de 3 tabs; el catálogo queda con historial persistido y auditable, análogo al de costos.
- ADR-051 queda **parcialmente superseded** en el punto de la Cola de Revisión como pantalla separada (ver Bitácora). El resto de ADR-051 sigue vigente. No se editó el cuerpo de ADR-051; su estado no cambia porque el vocabulario del log no tiene un estado "parcialmente superseded" y la supersesión es sólo de un punto.
- La migración `0034_adr054_importacion_catalogo.sql` es aditiva (dos `CREATE TABLE` + un índice), con su entrada `idx:34`/`when:1793577600000` en `meta/_journal.json`. Se redactó a mano (no con `drizzle-kit generate`): el snapshot más nuevo en `meta/` es el `0024`, así que un `generate` diffearía contra un estado viejo y emitiría una migración espuria — el journal se hand-manea desde ADR-051.

### Implementación (2026-08-01)

Main process: `db/schema/compras.ts` (dos tablas nuevas), migración `0034_adr054_importacion_catalogo.sql` + `_journal.json`, `ipc/importacion-catalogo.ts` (confirmar persiste cabecera+detalle y devuelve `filas` con `preferido_asignado`; `getHistorial`/`getHistorialDetalle`/`buscarProductos`; registro de canales), `preload/index.ts` (namespace `importacionCatalogo` ampliado). Renderer: `hooks/useImportacionCatalogo.ts`, `views/precios/RevisionHistorialView.tsx` (nuevo, 3 tabs), `views/precios/HistorialCatalogosView.tsx` (nuevo), `HistorialImportacionCostosView.tsx` (filtros/orden + callback `onVerPendientes`), `ImportarCatalogoProveedorView.tsx` (buscador + impactados con chips + export), `routes/index.tsx` y `views/shell/AppShell.tsx` (NAV/PRECIOS_PATHS/PRECIOS_GROUP/CRUMBS, rutas viejas quitadas). Tests: `importacion-catalogo.handlers.test.ts` (persistencia, historial, detalle, buscador), `HistorialCatalogosView.test.tsx` y `RevisionHistorialView.test.tsx` (nuevos), y actualizaciones en `HistorialImportacionCostosView.test.tsx`, `ImportarCatalogoProveedorView.test.tsx`. Suite completa en verde (renderer vitest + main process bajo Electron: **1029 tests main**) + `tsc --noEmit`. **Pendiente:** verificación visual manual en `pnpm dev` (3 tabs con Costos default; filtros/orden en Costos y Catálogos; correr una importación de catálogo, ver impactados con chips y exportar; confirmar que la Cola resuelve filas sin match desde su tab; probar con `motor_precios_v2_habilitado` en true y false).

---

## ADR-055 — Proveedores: acceso al detalle por línea completa + estandarización del tab Productos

- **Fecha:** 2026-08-01
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Cambio **puramente renderer**, sin schema, sin IPC, sin migración ni feature flag. Toca sólo presentación/navegación de UI.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** ADR-036 (relación `producto_proveedor`, preferido único — el modelo que muestra el tab, no se toca) y las **convenciones de UI del proyecto** (listados estándar: `.panel` + `.toolbar`/`.search` + `.table-wrap` + `table` + `.table-footer`, acciones por fila con `.row-act`/`.ia`, íconos de orden ↕/↑/↓, tokens CSS). Reserva de número: Bitácora 2026-07-31 (lote "Mejoras Varias 31-07", stubs 052–057).
- **Fuentes de verdad:** prompt `docs/ADR-055 - Proveedores acceso por linea y estandarizar tab Productos.txt` · diseño `docs/superpowers/specs/2026-07-31-mejoras-varias-31-07-design.md` (sección ADR-055).

### Contexto

En el listado de proveedores (`/compras/proveedores`) el acceso al detalle estaba sólo en la
celda "Razón social" (un `<Link>` anidado): clickear en cualquier otro campo de la fila no hacía
nada, a diferencia del listado de clientes (`ClientesListado`), donde la **fila entera** navega.
Y el **tab Productos** del detalle del proveedor (`ProveedorProductosTab`) usaba una maqueta
propia (search con `.input` inline, íconos de orden `⇅/▲/▼`, botones de acción de texto con
`font-size`/`padding` ad-hoc, estados vacíos como `<div>` fuera de la tabla) que se veía
distinta del resto de los listados del sistema.

### Decisión

**1. Clic en toda la fila abre el detalle (`ProveedoresListado`).** La `<tr>` pasa a ser el
elemento navegable: `onClick` → `navigate('/compras/proveedores/:id')`, más `role="button"`,
`tabIndex={0}`, `aria-label` y `onKeyDown` para **Enter/Espacio** (operable por teclado). Se
quitó el `<Link>` anidado en la celda de razón social (que ahora usa `.p-name`/`.p-sub`). No hay
acciones por-fila en este listado hoy, así que no hizo falta parar la propagación en botones; si
se agregan en el futuro, deberán llevar `stopPropagation` para no disparar la navegación. Patrón
tomado de `ClientesListado` (fila clickeable) + accesibilidad de teclado que ese listado no tenía.

**2. Tab Productos estandarizado (`ProveedorProductosTab`), sólo presentación.** Se reescribió la
maqueta para que quede **igual al resto de los listados**, sin tocar datos ni lógica: se envuelve
en `.panel`; el filtro va en `.toolbar` > `.search` (con lupa), "+ Agregar producto" como
`.btn-primary` a la derecha (`.ml-auto`); íconos de orden alineados a `ProductosListado`
(↕/↑/↓); nombre/SKU con `.p-name` + `.num p-code`; acciones por fila con `.row-act` + `.ia`/`.ia
del` (lápiz/✓ para editar/guardar, ✕ para quitar/cancelar), reemplazando los botones de texto;
estados vacíos como fila `<td colSpan>` dentro de la tabla; recuento en `.table-footer`. Se
conservaron intactos: buscador/filtro client-side, alta inline (asociar), edición inline de
costo/código, toggle de preferido, y la columna **Costo neto** condicionada al flag
`motor_precios_v2_habilitado` (ADR-049). Referencia canónica adicional: `ProveedoresPanel` (el
espejo del mismo vínculo, del lado del producto), que ya usa `.table-wrap` + `.row-act`/`.ia`.

**3. Menú (dos ajustes menores de producto).** (a) En el grupo **Abastecimiento** del sidebar,
**Proveedores** pasa por encima de **Órdenes de compra**. (b) El sub-ítem de Punto de venta se
muestra como **"POS"** (y el breadcrumb de `/pos` acompaña). *Nota:* el prompt encabeza este
punto como "Menú Catálogo", pero ambos ítems (Proveedores, Órdenes de compra) viven en el grupo
**Abastecimiento**, no en Catálogo (Productos/Stock); se ejecutó donde efectivamente están, que
es la única lectura operable del pedido.

### Fuera de alcance (no se tocó)

El modelo `producto_proveedor` ni la lógica de costos/costo neto (ADR-036/049). Otras pantallas de
proveedores fuera del listado y el tab. No se pidieron datos nuevos al backend (el tab ya tenía
todo lo que necesita para verse estándar). Sin cambios de schema, IPC, `parametros_sistema` ni
dependencias.

### Consecuencias

- El listado de proveedores queda consistente con el de clientes (fila clickeable) y además es
  operable por teclado. El tab Productos deja de ser una maqueta propia y hereda el look-and-feel
  de los listados estándar; futuros cambios de tokens/CSS globales lo alcanzan sin retoques.
- Al no haber acciones por-fila en el listado, la navegación por fila no pisa nada hoy; queda
  documentada la regla (`stopPropagation`) para cuando se agreguen.

### Implementación (2026-08-01)

Renderer únicamente: `views/compras/proveedores/ProveedoresListado.tsx` (fila navegable +
teclado), `views/compras/proveedores/ProveedorProductosTab.tsx` (reestilizado a listado estándar),
`views/shell/AppShell.tsx` (orden de Abastecimiento + label "POS" + CRUMB `/pos`). Tests:
`ProveedoresListado.test.tsx` (nuevo: clic en campo no-razón-social navega, clic en razón social
navega, Enter/Espacio navegan, el botón "+ Nuevo" no dispara navegación de fila) y actualizaciones
en `AppShell.test.tsx` (sub-ítem "POS"; Proveedores por encima de Órdenes de compra). Suite renderer
completa en verde (**83 archivos / 563 tests** vitest) + `tsc --noEmit` limpio; runner main-process
sin cambios (no se tocó `src/main`). **Pendiente:** verificación visual manual en `pnpm dev`
(clic en distintos campos de una fila de `/compras/proveedores` abre el detalle; el tab Productos
se ve igual que el resto de los listados, con `motor_precios_v2_habilitado` en true y false).

---

## ADR-056 — Punto de Venta: UI estándar, venta en curso persistente (UI) y Cancelar/Confirmar

- **Fecha:** 2026-08-01
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Cambio **puramente renderer**, sin schema, sin IPC, sin migración ni feature flag. Toca sólo estado/presentación/navegación de UI.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** **ADR-032** (modelo de pago combinado `venta_pago` y layout POS — no se toca) y **ADR-033** (venta en espera, estado `en_espera` en la BD — no se toca). Es clave la distinción con ADR-033: ver "Distinción con ADR-033" abajo. Reserva de número: Bitácora 2026-07-31 (lote "Mejoras Varias 31-07", stubs 052–057).
- **Fuentes de verdad:** prompt `docs/ADR-056 - Punto de Venta UI estandar, venta en curso persistente y Cancelar-Confirmar.txt` · diseño `docs/superpowers/specs/2026-07-31-mejoras-varias-31-07-design.md` (sección ADR-056).

### Contexto

El estado de la venta en curso del POS (líneas, cliente, descuentos, medios en preparación) vivía
**local a `PosView`** vía `usePosSession()`. Al navegar a otra opción del menú, `PosView` se
desmonta y ese estado se perdía: el operador que consultaba stock o un precio en otra pantalla
volvía al POS con el carrito vacío. Además la barra inferior sólo tenía un botón "ACEPTAR" (que
abre `ConfirmarVentaModal`) y no había forma explícita de descartar la venta en curso. Por
último, algunos detalles de CSS del POS usaban tokens inexistentes (`--color-warning`/
`--color-success`) en vez de los del design system.

### Decisión

**1. Venta en curso persistente (estado de UI, no BD).** Se elevó `usePosSession()` a un
`PosSessionProvider` (`context/PosSessionContext.tsx`) montado **por encima de `AppShell`** en
`routes/index.tsx` (dentro de `ProtectedRoute`). Como `AppShell` no se desmonta al cambiar de
ruta, el cart sobrevive a la navegación: al volver a `/pos` aparece idéntico. `PosView` consume
el estado con `usePosSessionContext()`. **GATE cumplido:** la persistencia no agrega ninguna
escritura — no crea `venta` borrador, ni movimientos de caja/stock, ni nada en la BD; sólo se
reubica dónde vive el estado del renderer. Como el provider vive desde el login (el init corre
una sola vez), `PosView` **re-consulta la caja activa al montarse** (`refrescarCaja()`, sólo
lectura) para reflejar una caja abierta/cerrada en `/caja` mientras el cart seguía en memoria.

**2. Botones Cancelar / Confirmar (`PosBottomBar`).** "ACEPTAR" se **renombró a "Confirmar"**
(consolida el botón existente que dispara `ConfirmarVentaModal`; no se duplica el flujo). Se
agregó **"Cancelar"**, que abre un `CancelarVentaModal` (confirmación para no vaciar por
accidente) y, al confirmar, llama a `reset()` — vuelve el cart a cero **sin registrar nada**.

**3. Alineación UI/UX/CSS.** Se normalizaron los badges de `PosItemsTable` a las clases/tokens
del design system (`.badge-warn` para "sin confirmar", `.tag` + token `--ok` para "en promo" y
la presentación), reemplazando los tokens inexistentes; y se corrigió el color del vuelto en
`ConfirmarVentaModal` (`--success` inexistente → `--ok`). Sin cambios de flujo de venta ni del
modelo de pago.

**4. Ordenamiento de menús (`AppShell`).** Grupo **Precios → "Precios / Costos"**; "Importar
costos" sube una posición (queda entre "Lotes de precios" e "Importar Catálogo del Proveedor");
"Importar catálogo prov." → **"Importar Catálogo del Proveedor"**; submenú "Revisión e Historial
de Costos y Catálogo" → **"Revisión de Costos y Catálogo"**; los renames se aplican también a la
copia de esos ítems en **Configuración** (flag `motor_precios_v2` apagado) y a los `CRUMBS`. En
**Configuración**: "Etiquetas" al primer lugar y "Transportistas" debajo de "Unidades". Los tabs
de `RevisionHistorialView` se renombraron: Revisión → **"Revisión Costos"**, Costos →
**"Historial de Costos"**, Catálogos → **"Historial de Catálogo"** (las claves internas y el
deep-link `?tab=` no cambian).

### Distinción con ADR-033 (venta en espera)

Son cosas distintas y conviven:
- **Cart persistente de UI (este ADR):** estado del renderer que sobrevive a la navegación
  dentro de la sesión. **No toca la BD.** No tiene alias, no aparece en el drawer de "Ventas en
  espera", no sobrevive a cerrar la app. Es simplemente "no perder lo que estabas cargando".
- **Venta en espera (ADR-033):** persiste en la BD con estado `en_espera` (`venta`/`venta_detalle`),
  tiene alias, se lista/retoma/descarta desde el drawer y sobrevive reinicios. Se dispara con
  "⏸ Espera" (F9), no con la navegación. **No se tocó.**

### Fuera de alcance (no se tocó)

Modelo de pago combinado (ADR-032), venta en espera / estado `en_espera` (ADR-033), redondeo,
motor de precios, caja, stock. Ninguna escritura a la BD para la persistencia del cart. Sin
cambios de schema, IPC, `parametros_sistema` ni dependencias.

### Consecuencias

- El operador puede salir del POS a consultar y volver sin rearmar el carrito. Como la caja se
  re-consulta al reentrar, abrir/cerrar caja en otra pantalla se refleja correctamente.
- Hay dos "Confirmar" en el DOM cuando el modal de pago está abierto (el de la barra y el del
  modal): en los tests se scopea al panel del modal. En la app no genera ambigüedad para el
  usuario (barra = abrir cobro; modal = confirmar el pago).
- Los dos menús de precios (grupo "Precios / Costos" con el flag encendido vs. ítems en
  Configuración con el flag apagado) son mutuamente excluyentes; los renames se mantienen
  consistentes en ambos.

### Implementación (2026-08-01)

Renderer únicamente. Nuevos: `context/PosSessionContext.tsx`, `views/pos/CancelarVentaModal.tsx`,
`context/__tests__/PosSessionContext.test.tsx`. Modificados: `views/pos/PosView.tsx`,
`views/pos/PosBottomBar.tsx`, `views/pos/PosItemsTable.tsx`, `views/pos/ConfirmarVentaModal.tsx`,
`hooks/usePosSession.ts` (expone `refrescarCaja`), `routes/index.tsx` (monta el provider),
`views/shell/AppShell.tsx` (menús + CRUMBS), `views/precios/RevisionHistorialView.tsx` (tabs), y
sus tests (`PosView.test.tsx`, `PosBottomBar.test.tsx`, `AppShell.test.tsx`,
`RevisionHistorialView.test.tsx`). Verificación: **ambos runners en verde** — renderer **84
archivos / 578 tests** (vitest) y main-process **81 archivos / 1029 tests**
(`scripts/test-node.cjs`) — más `tsc --noEmit` limpio. **Pendiente:** verificación visual manual
en `pnpm dev` (cargar un cart en `/pos`, navegar y volver → intacto; Cancelar → cero con
confirmación; Confirmar → flujo de cobro; comprobar en BD/logs que la navegación con cart no dejó
`venta`/movimientos; POS y menús alineados).

---

## ADR-057 — Defaults de listados (Remitos, Stock), layout de Etiquetas y baja de Reposición Sugerida

- **Fecha:** 2026-08-01
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Grab-bag de arreglos chicos e independientes. Cambio **casi enteramente renderer**; el único toque de `src/main` es un valor de filtro **aditivo y retrocompatible** (`stock_status: 'bajo_sin'`) y la **baja** de un handler IPC read-only (`stock:reabastecimiento`). Sin schema, sin migración, sin feature flag, sin dependencias nuevas.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** **ADR-017** (Reabastecimiento desacoplado de Órdenes de Compra; OC con modo manual y sugerido). La pantalla "Reposición sugerida" era una vista **read-only** de los productos bajo mínimo; su función quedó **cubierta por "OC Sugerida"** (`/compras/ordenes/sugerida`, modo sugerido de ADR-017), que corre la **misma consulta** (`activo = true AND stock_minimo > 0 AND stock_fisico <= stock_minimo`) y la **misma lógica de cantidad sugerida** (`stock_maximo − stock_fisico`), y además agrupa por proveedor y **crea** la OC. Reserva de número: Bitácora 2026-07-31 (lote "Mejoras Varias 31-07", stubs 052–057).
- **Fuentes de verdad:** prompt `docs/ADR-057 - Defaults de listados, layout Etiquetas y baja de Reposicion Sugerida.txt` · diseño `docs/superpowers/specs/2026-07-31-mejoras-varias-31-07-design.md` (sección ADR-057).

### Contexto

Cuatro ajustes disjuntos de UI/UX que venían molestando en el uso diario y no justificaban un ADR cada uno: (1) el listado de **Remitos** abría en "Todos", obligando a filtrar a mano el caso más frecuente (los emitidos, pendientes de conformar); (2) el listado de **Stock** abría sin filtro, cuando el interés operativo casi siempre es "lo que hay que reponer"; (3) en **Etiquetas**, al elegir un perfil de hoja (A4) el campo "Omitir primeras" se iba a un segundo renglón por wrap del flex, quedando visualmente desconectado del selector QR/CODE128; (4) "Reposición sugerida" (`/stock/reabastecimiento`) duplicaba, en modo sólo-lectura, lo que "OC Sugerida" ya resuelve y además acciona.

### Decisión

1. **Remitos — default "Emitido".** El estado inicial del filtro pasa de `''` (Todos) a `'emitido'`. El usuario sigue pudiendo cambiar a Conformado / Anulado / Todos. Un solo renglón en `RemitosView.tsx`.

2. **Stock — default "Bajo mínimo + Sin stock".** El listado abre mostrando ese conjunto. **Decisión de implementación (con el usuario):** en vez de convertir el filtro a multi-selección (que habría cambiado el contrato IPC a un array y el modelo de interacción single-select), se agregó una **opción combinada** `'bajo_sin'` al filtro existente — la **unión** de `'sin'` y `'bajo'` (equivale a "todo lo que no está OK") — y se la puso como valor por default del `select`. Las tarjetas "Bajo mínimo" y "Sin stock" quedan ambas resaltadas cuando el combinado está activo; clickear una tarjeta sigue acotando a ese único estado. El nuevo valor se propagó a las tres cláusulas que arman el `WHERE` de stock (`buildStockStatusClause` de `producto.list`, `productoQueryAll` y `stockQueryAll` para export), de forma aditiva.

3. **Etiquetas — "Omitir primeras" a la derecha, en una línea.** Cambio **puramente de layout**: el selector QR/CODE128 y el campo "Omitir primeras" se agruparon en un contenedor `flex` `nowrap` (para que nunca se rompan entre sí), la fila de configuración pasó a `nowrap` con `minWidth: 0`, y se comprimieron anchos (perfil 180→160, código 140→130, input 70→64). Sin cambios de lógica ni de datos.

4. **Baja de "Reposición sugerida".** Se quitaron los **tres** anclajes de navegación (ruta `/stock/reabastecimiento` en `routes/index.tsx`, ítem del grupo Abastecimiento y entrada `CRUMBS` en `AppShell.tsx`) más el componente `ReabastecimientoView.tsx`, el handler `ipc/reabastecimiento.ts` (canal `stock:reabastecimiento`), su registro en `main/index.ts`, el método `catalogo.stock.reabastecimiento` del preload y los tests huérfanos. El enlace del dashboard (`StockPanel` fila "Bajo mínimo") que apuntaba a `/stock/reabastecimiento` se **repuntó a `/stock`**, consistente con sus filas hermanas ("Sin stock" y "Sin movimiento" ya iban ahí) y con el nuevo default de Stock.

### GATE previo a la baja (obligatorio, resultado)

Se verificó que **nada quedara huérfano y en uso**: el canal `stock:reabastecimiento` / `catalogo.stock.reabastecimiento` tenía **un único consumidor** (`ReabastecimientoView`); no hay otro hook, vista ni IPC que lo use. Su capacidad está **cubierta por OC Sugerida** (ver §Marco). El permiso `dashboard.ver` **se conserva** (lo usan el Dashboard y muchas otras vistas). `SVG_REABASTECIMIENTO` **se conserva** (lo reusa el ítem "Rutinas"). GATE superado sin necesidad de parar.

### Fuera de alcance (no se tocó)

- **OC Sugerida** y su lógica (ADR-017): no se rediseñó.
- **Semántica de estados** de Remitos/Stock: sólo cambió el filtro por default, no los estados ni sus reglas.
- **Ítem 5 "Dashboard Look & Feel" del prompt — diferido por decisión.** El `.txt` del ADR listaba en Objetivo/Alcance un quinto ítem ("unificar el look & feel de la cabecera de dashboard/pestañas") que **no figura** en el Paso 0, la Secuencia, la Verificación final ni el design doc, y **no trae criterios de aceptación ni archivo ancla**. Se acordó con el usuario **diferirlo a su propio ADR** para no incorporar trabajo subespecificado y no verificable; la barra de pestañas de `DashboardView.tsx` (hoy con estilos inline) queda como candidata de ese ADR futuro.

### Consecuencias

- Remitos y Stock abren en el caso de uso frecuente; el resto de los filtros sigue disponible. El combinado `'bajo_sin'` queda como opción explícita del `select`, reutilizable fuera del default.
- Etiquetas presenta la configuración de impresión en una sola línea coherente en los perfiles de hoja.
- Desaparece una pantalla redundante; el árbol de navegación y el CRUMBS quedan más chicos. La ruta directa `/stock/reabastecimiento` ya no resuelve.

### Implementación (2026-08-01)

Renderer: `views/remitos/RemitosView.tsx` (default `'emitido'`), `views/stock/StockListado.tsx` (default `'bajo_sin'` + opción del `select` + resaltado de tarjetas), `views/etiquetas/EtiquetasView.tsx` (layout), `views/dashboard/stock/StockPanel.tsx` (link `/stock`), `routes/index.tsx` y `views/shell/AppShell.tsx` (baja: ruta + NAV + CRUMB + comentarios). Main: `ipc/producto.ts` y `ipc/stock.ts` (valor `'bajo_sin'` en tipos y cláusulas), y **eliminados** `ipc/reabastecimiento.ts` + su registro en `main/index.ts` + el método del `preload/index.ts`. Tests: nuevos casos en `RemitosView.test.tsx`, `StockListado.test.tsx` y `producto.handlers.test.ts` (filtro `bajo_sin`); **eliminados** `ReabastecimientoView.test.tsx`, `reabastecimiento.handlers.test.ts` y el caso de `/stock/reabastecimiento` en `AppShell.test.tsx`. Verificación: **ambos runners en verde** — renderer **83 archivos / 571 tests** (vitest) y main-process **80 archivos / 1018 tests** (`scripts/test-node.cjs`) — más `tsc --noEmit` limpio. **Pendiente:** verificación visual manual en `pnpm dev` (Remitos abre en "Emitido"; Stock en "Bajo mínimo + Sin stock" con ambas tarjetas resaltadas; en Etiquetas con perfil A4 "Omitir primeras" queda a la derecha del QR/CODE128 en una línea; "Reposición sugerida" no aparece en el sidebar ni por URL directa; OC Sugerida sigue funcionando).

---

## ADR-060 — Habilitar por default los módulos de 1.1.x (Remitos, Presupuestos, Agenda) y el Motor de Precios v2 en instalaciones nuevas

- **Fecha:** 2026-08-02
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Cambio de **datos de configuración** (no de esquema): una migración aditiva que flipa cuatro `parametros_sistema` de `'false'` a `'true'`. Sin cambios de código de producción.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** **ADR-042 / ADR-044** — establecieron la doctrina "toda feature nueva va detrás de un flag en `parametros_sistema`, default `false`". Este ADR **no la revierte como doctrina** (las features siguen naciendo apagadas), sino que toma la decisión de release de **encender de fábrica** los módulos que ya componen `1.1.0` (Remitos + Presupuestos + Agenda, ver CLAUDE.md §9) más el Motor de Precios v2 (ADR-049), para que una instalación nueva muestre el menú completo tal como se ve en desarrollo. La visibilidad por rol/perfil se gobernará más adelante (fuera de alcance acá).

### Contexto

Al instalar el `.exe` (`dist:full`) en una máquina limpia, el sidebar aparecía "incompleto/desorganizado": faltaban Remitos (grupo Facturación quedaba sólo con Caja), Presupuestos (grupo Punto de venta quedaba sólo con POS) y el grupo Agenda; Precios/Costos no se separaba de Configuración. **No era un bug ni un build viejo** (el cambio de ADR-057 estaba presente): los feature flags `remitos_habilitado`, `presupuestos_habilitado`, `agenda_habilitado` y `motor_precios_v2_habilitado` se siembran en `'false'` (migraciones 0023/0025/0026/0028) y **viven en la base por-instalación** (`userData/ferreteria.db`). La máquina de desarrollo los tenía encendidos; la instalación nueva, base virgen → todo apagado. No existe hoy UI para togglear estos flags (sólo backup/SMTP la tienen), así que dependían de editar la BD a mano.

### Decisión

Agregar la migración **`0035_adr060_habilitar_modulos_1_1`** que hace `UPDATE parametros_sistema SET valor='true'` sobre las cuatro claves. Al correr en orden después de las que siembran los flags en `'false'`, deja:
- Instalación **nueva**: los cuatro módulos encendidos desde el primer arranque.
- Instalación **existente**: se encienden al aplicar la migración en el próximo arranque (incluida la máquina donde ya se había instalado). Es un flip deliberado de datos; si alguien los había apagado a mano, vuelven a `true` — consistente con la decisión de producto (todo visible, se acota por rol después).

Riesgo del Motor de Precios v2: encenderlo muestra el grupo "Precios / Costos" y las columnas de costo neto, pero como 0028 sembró los componentes comerciales en `0`, **costo neto = costo bruto** hasta que se configuren — no cambia importes en una instalación nueva.

### Fuera de alcance (no se tocó)

- La **doctrina** de ADR-042/044 (features nuevas siguen naciendo detrás de flag `false`).
- El **modelo de permisos/roles**: la visibilidad fina por perfil es trabajo futuro; hoy el sidebar sigue filtrando por permiso como siempre.
- No se agregó UI para editar flags (candidata a un ADR aparte: pantalla "Funcionalidades" en Configuración).

### Consecuencias

- Una instalación nueva se ve igual que desarrollo, con el menú completo.
- Las migraciones ya publicadas quedan intactas (0035 es aditiva). Los tests que afirmaban el default `'false'` tras migrar (`remito.handlers`, `presupuesto.handlers`, `agenda_schema`) se actualizaron a `'true'`, documentando que 0035 los flipa.

### Implementación (2026-08-02)

Migración `src/main/db/migrations/0035_adr060_habilitar_modulos_1_1.sql` + entrada idx 35 en `migrations/meta/_journal.json`. Tests: nuevo `src/main/db/__tests__/feature_flags_1_1.test.ts` (afirma los cuatro flags en `'true'` tras migrar) y actualización de los tres que esperaban `'false'`. Verificación: **ambos runners en verde** — renderer **83 archivos / 571 tests** (vitest) y main-process **81 archivos / 1019 tests** (`scripts/test-node.cjs`) — más `tsc --noEmit` limpio. **Pendiente:** regenerar el instalador (`pnpm dist:full`) y verificar en máquina limpia que el sidebar aparece completo (Facturación con Remitos+Caja, Punto de venta con POS+Presupuestos, grupo Agenda, y Precios/Costos separado de Configuración). Nota: el número **059** queda reservado para otro trabajo en cola (`docs/ADR-059 - Continuación-Importación de costos y catalogo proveedores.txt`); por eso este ADR toma el 060.

---

## ADR-062 — Catálogo demo de arranque (15 productos), cargable/vaciable a demanda desde Configuración

- **Fecha:** 2026-08-02
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Cambio de **datos y de UI** (no de esquema): un seeder de catálogo demo, expuesto por IPC y una pantalla en Configuración. Sin migraciones.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** **ADR-006** (movimientos inmutables / stock siempre por `movimiento_stock`), **ADR-034** (motor de precios / `lista_precio_valor` en centavos), **ADR-040** (presentaciones — `producto_presentacion` default), **ADR-025** (SKU vía `sku_proximo_secuencial` + `formatSku`) y el patrón de dominios IPC (`register*Handlers` + namespace de preload + pantalla en `AppShell`, ver CLAUDE.md §Navegación).

### Contexto

Una instalación nueva arranca con el catálogo base (`runCatalogSeed`: IVA, unidades, categorías/subcategorías, marcas) pero **sin un solo producto**: Catálogo/Productos, Stock y POS aparecen vacíos, sin nada navegable para mostrar el flujo. Se pidió un **catálogo demo genérico de 10–15 productos** sembrado por los **caminos que respetan las invariantes** del dominio (no inserts crudos que las salteen).

**Dependencia crítica detectada al re-verificar (Paso 0):** ninguna migración ni seed crea una `lista_precio`. Sin una lista **predeterminada y activa**, `lista_precio_valor` (el motor de precios, ADR-034) queda vacío y los productos no muestran precio en POS/listados. `productoCreateHandler` siembra `lista_precio_valor` por cada lista activa, pero **sólo si ya existe alguna lista**.

### Decisión

Decisiones de producto confirmadas con el owner:
1. **A demanda desde Configuración, no en el arranque.** Se descartó el flag de build (habría obligado a mantener **dos instaladores** separados, demo y en blanco). En su lugar: **un solo instalador que arranca en blanco**, y una pantalla **Configuración → Datos demo** (Supervisor) con dos acciones: **Cargar catálogo demo** y **Vaciar catálogo demo**. El comerciante lo carga sólo si quiere evaluar la app, y lo vacía antes de operar en serio.
2. **15 productos** repartidos en las 10 subcategorías y las 6 marcas de `runCatalogSeed`, con costo/precio/unidad/ubicación/stock.
3. **Camino de siembra: replicar la lógica en el seeder** (no reutilizar `productoCreateHandler`). Motivo: el handler **fuerza `stock_fisico = 0`** (movimiento inicial de `cantidad 0`), por lo que los casos borde con stock no salen de él sin llamadas extra. El seeder replica su lógica de precios/presentación con control total sobre stock, costo, unidad y estado.

**El seeder** `runDemoCatalogSeed(db)` (`src/main/base-seed/demo-catalog.ts`) crea cada producto respetando invariantes: SKU vía `sku_proximo_secuencial`/`formatSku`; `existencias` + `movimiento_stock` (`motivo='inicial'`, `referencia_tipo='seed_demo'` — la marca que identifica los datos demo); presentación default (ADR-040); y `lista_precio_valor` en **centavos** (`round(precio_pesos*100*(1+ajuste/100))`) por cada lista activa, con `presentacion_id` seteado. Datos administrativos: `usuario_creacion_id='system'`, `origin_id='system'`, `sync_state='synced'`. Antes de crear los productos, `ensureListaPredeterminada` crea una `lista_precio` "General" predeterminada/activa si no existe (y reutiliza la existente si la hay).

**Casos borde a propósito** (para que Stock —default "Bajo mínimo + Sin stock", ADR-057— muestre algo al abrir): "Sierra manual 20\"" **sin stock**, "Amoladora 4½\" 850W" **bajo mínimo**, "Válvula esfera 1/2\"" **inactivo**.

**Vaciado quirúrgico:** `vaciarCatalogoDemo(db)` borra **sólo** los productos marcados `seed_demo` (y sus `existencias`/`movimiento_stock`/`producto_presentacion`/`lista_precio_valor`), en una transacción. **No toca** productos cargados por el comerciante, ni las ubicaciones (reutilizables), ni la `lista_precio` "General" (queda como predeterminada útil para el catálogo real — resuelve la misma dependencia crítica al alta de productos reales).

**Idempotencia / seguridad:** "Cargar" sólo siembra sobre un catálogo vacío (el seeder se niega si ya hay productos; el handler lo informa). Las tres acciones exigen sesión de Supervisor (`usuario.administrar`).

### Fuera de alcance (no se tocó)

- El **motor de precios**, las reglas de negocio y el **esquema** (sin migraciones). Sólo se siembran/borran datos por caminos existentes.
- **Datos reales de un cliente** (catálogo/proveedores/precios): eso es importación masiva (ADR-035/054) o restore `.fbk`.
- El **dev-seed** (`dev-seed/catalog.ts`, `seed-dev.cjs`): sigue siendo para desarrollo; el demo de producción es su propio seeder en `base-seed`.
- El **arranque** (`runBaseSeed`) queda intacto: sigue sembrando sólo el catálogo base; el demo no corre en first-run.

### Consecuencias

- Un solo instalador. La instalación arranca en blanco (comportamiento previo). El demo es una acción explícita y reversible en un clic, sin tocar el arranque ni exigir dos builds.
- Se agregó una pantalla nueva alcanzable por el usuario (ruta + ítem de nav en el grupo Sistema/Configuración + breadcrumb), gateada por `usuario.administrar`.

### Implementación (2026-08-02)

Archivos nuevos: `src/main/base-seed/demo-catalog.ts` (seeder + dataset inline de 15 productos + `vaciarCatalogoDemo`/`productosDemoIds` + `DEMO_REFERENCIA_TIPO`), `src/main/ipc/demo-catalog.ts` (handlers `estado`/`cargar`/`vaciar`, Supervisor-gated), `src/renderer/views/config/ConfigDatosDemo.tsx` (pantalla). Modificados: `src/preload/index.ts` (namespace `demoCatalog`), `src/main/index.ts` (registro), `src/renderer/routes/index.tsx` (ruta `config/datos-demo`), `src/renderer/views/shell/AppShell.tsx` (ítem de nav + breadcrumb). **Nota histórica de implementación:** una primera versión resolvió esto con un **flag de build** (`FERRETERIA_DEMO_SEED` horneado por `vite.main.config.mts`, gating en `runBaseSeed`); se **revirtió** al confirmar con el owner que implicaba dos instaladores, y se reemplazó por el camino a demanda descrito arriba. Tests: `src/main/base-seed/__tests__/demo-catalog.test.ts` (10 tests, seeder), `src/main/ipc/__tests__/demo-catalog.handlers.test.ts` (7 tests: cargar/vaciar/estado, "no toca reales", permiso), `src/renderer/views/config/__tests__/ConfigDatosDemo.test.tsx` (6 tests, UI). **Verificación:** `tsc --noEmit` limpio; **ambos runners en verde**. **Pendiente de cierre manual:** `pnpm dev` → Configuración → Datos demo → Cargar, y ver los 15 en Productos con precio, los casos borde en Stock, y buscar/agregar uno en POS; luego Vaciar. Nota: el número **061** queda reservado para otro trabajo en cola (`docs/ADR-061 - Pantalla de Funcionalidades…txt`) y **059** para `docs/ADR-059 - Continuación-Importación…txt`; por eso este ADR toma el **062**.

---

## ADR-063 — Matching producto interno ↔ producto proveedor por similitud de nombre

**Fecha:** 2026-08-17
**Estado:** Propuesto — Lote 1 implementado
**Release:** `1.1.x` (sobre carga masiva, sin feature flag). Migraciones aditivas.
**Decisores:** Joaquín (product owner) · Claude (asesor técnico)
**Marco:** ADR-035 (importación de costos: cola de revisión, preview obligatorio), ADR-051
(matching estricto scopeado EAN → código proveedor → SKU, persistencia diferida), ADR-054
(Cola de Revisión como tab de `RevisionHistorialView`), ADR-059 (ignorado persistente de
ítems — extensión aditiva paralela sobre la misma cola), ADR-036/049 (`producto_proveedor`,
preferido único, batches de costo), ADR-024 (patrón `nombre_norm` derivado + backfill),
ADR-025 (SKU interno), ADR-001 (offline-first).
**Fuente de verdad:** plan `docs/superpowers/plans/2026-08-17-adr-063-matching-similitud.md`
(este ADR es su resumen de decisión).

### Contexto

La importación de listas de proveedor matchea filas contra el catálogo por **EAN → código
del proveedor → SKU interno** (ADR-051). Cuando el proveedor no manda EAN y usa un código
nuevo/distinto, la fila cae en la **Cola de Revisión** (`sin_matchear`) y el operador la
resuelve a mano, una por una, con un buscador sin priorización. En el onboarding de un
catálogo entero eso son cientos de resoluciones manuales. Dos problemas concretos,
confirmados en el código:

1. **El match manual no se aprende.** `importacionCostoResolverFilaHandler`
   (`ipc/importacion-costo.ts`) creaba/actualizaba `producto_proveedor` con el costo pero
   insertaba `codigo_proveedor: null` y no lo tocaba en el UPDATE. La próxima importación del
   mismo proveedor volvía a fallar el match de esa fila y reaparecía en la cola. El dato
   crudo está en `detalle.fila_original`, así que recuperarlo es barato.
2. **No hay ayuda por nombre.** No existe ninguna señal de similitud que ordene candidatos.

### Decisión

1. **Persistir el match manual como código del proveedor (aprendizaje).** Al resolver una
   fila en la Cola de Revisión, además del upsert de costo, se escribe
   `producto_proveedor.codigo_proveedor` con el `COD_PRODUCTO_PROV` que traía la fila
   (recuperado de `fila_original`). Así la próxima importación auto-matchea por código y la
   fila no reaparece. Si la fila no traía código, se preserva el existente (no se pisa con null).

2. **Columna derivada `producto.nombre_norm`** (TEXT, indexada), regenerada desde
   **`nombre_corto`** en alta/edición + backfill de existentes. No reemplaza a `nombre_corto`.
   Mismo patrón que `localidad.nombre_norm` (ADR-024).

3. **`normalizar()` en `packages/shared`** — única función canónica aplicada a **ambos lados**
   de la comparación. Pipeline: NFD → sin diacríticos → minúsculas → canonizar medidas
   (`6 × 40` / `6 x 40` → `6x40`) → quitar no-alfanuméricos (preservando la `x` de medida y
   espacios) → colapsar espacios → trim. **Conserva unidades** (mm/cm): no se eliminan.
   Supersede el `norm()` privado de `geo-seed/index.ts`.

4. **Tabla `termino_equivalencia`** (diccionario de sinónimos controlado, ej.
   `tirafondo → tornillo`): `id`, `termino` (norm), `canonico` (norm), `rubro_id` (FK
   `categoria`, **nullable, reservado** — global en v1), `activo`, auditoría, sync. Se aplica
   **en tiempo de comparación**, mapeando cada token de ambos lados a su forma canónica;
   **no** se expande dentro de `nombre_norm` (para no recalcular el catálogo al editar el
   diccionario).

5. **Matcher token-set en `packages/shared`.** Compara conjuntos de tokens (no cadena
   completa), previa expansión de sinónimos; score = coeficiente de Dice. Devuelve top-N
   candidatos por encima de un piso, ordenados desc. TF-IDF **diferido**. El backend arma un
   índice invertido `token → productos` una vez por corrida y sólo puntúa productos que
   comparten ≥1 token.

6. **Similitud como sugerencia; el usuario decide siempre.** La Cola de Revisión e Importar
   Catálogo Proveedor muestran candidatos ordenados con el **% siempre visible**. Se mantiene
   el **preview obligatorio** de ADR-035: **nada se escribe hasta la confirmación explícita** y
   **no se crean productos**. Por fila el usuario puede **incluir, cambiar, rechazar o
   aceptar**. Opcionalmente, por proveedor, un **umbral de pre-selección**
   (`proveedor.match_umbral_preseleccion`, INTEGER 0-100, null = deshabilitado, default null):
   las filas cuyo top candidato ≥ umbral (y con margen sobre el 2º ≥ `MARGEN_MIN`) llegan al
   preview **pre-marcadas como aceptadas** —el usuario destilda las que no correspondan— pero
   **el gate humano no se saltea**. El umbral sólo cambia el estado inicial del preview; no hay
   escritura silenciosa. Un candidato aceptado se registra `matched_by = 'similitud'`; el pick
   por buscador manual sigue siendo `'manual'`.

### Rechazado

- **Embeddings / similitud semántica:** incompatible con offline-first, no auditable,
  sobreingeniería para un vocabulario acotado. Documentado como camino futuro, no se implementa.
- **Expandir sinónimos dentro de `nombre_norm`:** obligaría a recalcular el catálogo al editar
  el diccionario. Se aplica en tiempo de comparación.
- **Auto-escritura sin revisión (bypass del preview):** reintroduce el riesgo de falso match
  que ADR-051 buscó evitar. El umbral sólo pre-selecciona; la confirmación humana nunca se saltea.

### Consecuencias

- (+) La cola aprende: un match manual no se repite en la próxima lista del proveedor.
- (+) Sugerencia ordenada reduce el tiempo de resolución sin abrir la puerta a matches
  automáticos por default.
- (+) `normalizar()` compartida elimina la divergencia con el `norm()` privado de geo-seed.
- (−) Tres objetos de schema nuevos (columna `nombre_norm`, tabla `termino_equivalencia`,
  columna `match_umbral_preseleccion`) + backfill; más superficie a mantener.
- (−) El matcher token-set es heurístico; su calidad depende de la higiene de `nombre_corto`
  y del diccionario de sinónimos.

### Implementación

Por lotes (TDD). **Lote 1 (2026-08-17) implementado:** persistencia del match manual como
`codigo_proveedor` en `importacionCostoResolverFilaHandler` (helper
`codigoProveedorDeFilaOriginal` que re-mapea `fila_original` con el parser de columnas fijas;
INSERT y UPDATE escriben el código cuando la fila lo trae, preservan el existente si no).
Tests en `__tests__/importacion-costo.handlers.test.ts` (round-trip: resolver → reimportar
auto-matchea por código; INSERT crea la relación con código; no pisa un código previo cuando
la fila no trae). Suite del archivo en verde (57 tests) + `tsc --noEmit` limpio.
**Lote 2 (2026-08-17) implementado — vía ADR-067 (reconciliado):** el `normalizar()` canónico
vive en `packages/shared/src/texto.ts` (measure-aware: `6 × 40 → 6x40`, preserva unidades),
usado por ambos lados. La columna normalizada de `producto` es **`nombre_corto_norm`** (no se
creó un `nombre_norm` separado): derivada de `nombre_corto`, mantenida en alta/edición/import y
**backfilleada al arrancar** (`sinonimos/backfill.ts`). **Sin índice SQL**: el único consumo es
LIKE con comodín inicial (búsqueda) y tokenización full-scan (matcher), que no se benefician de
un índice B-tree — decisión explícita, no omisión. Pendiente al superseder el `norm()` privado
de `geo-seed` (fuera de alcance de estos lotes).

**Lote 3 (2026-08-17) implementado — vía ADR-067 (reconciliado):** en vez de `termino_equivalencia`
se **reutiliza la tabla `sinonimo`** de ADR-067 (más rica: grupos, abreviaturas, ABM, import) como
diccionario. Matcher token-set puro en `packages/shared/src/similitud.ts` (`tokenizar`,
`canonizarTokens`, `coeficienteDice`, `similitudNombres`); backend en
`main/matching/producto-matcher.ts` (`construirMapaSinonimos` desde `sinonimo` + `crearMatcher(db)`
que arma diccionario e índice invertido token→productos una vez por corrida y expone `sugerir(nombre)`
top-N sobre un piso). Tests: `shared/src/similitud.test.ts` (6) + `main/matching/__tests__/producto-matcher.test.ts`
(5). `tsc --noEmit` limpio; ambos runners en verde.

**Lote 4 (2026-08-17) implementado en la Cola de Revisión (parcial):** el formato de importación
de costos gana una columna opcional `NOMBRE` (parser `HEADERS_FIJOS`/`mapearFila`); la Cola de
Revisión (`importacionCostoGetColaRevisionHandler`) arma el matcher una vez y devuelve, por fila
`sin_matchear`, `nombre_producto_archivo` + `candidatos` (top-N con score) + `preseleccion`.
`resolverFila` acepta `origen: 'manual' | 'similitud'` → `matched_by` (estado sigue siendo
`resuelto_manual`, la reconciliación del Histórico no cambia). Umbral opt-in por proveedor:
migración `0038_adr063_match_umbral` (`proveedor.match_umbral_preseleccion` INTEGER nullable) +
`ProveedorForm`; en la cola, si el top ≥ umbral y con margen ≥ MARGEN_MIN (0.15) sobre el 2º, la
fila llega **pre-marcada** (destildable) — nunca escribe sin confirmar. UI: `ColaRevisionCostosView`
muestra el candidato con % + "Aceptar" (similitud) + lista de sugerencias en el modal. Tests:
`importacion-costo.similitud.test.ts` (4), `ColaRevisionCostosView.test.tsx` (3). Ambos runners en verde.

**Enganche en Importar Catálogo (2026-08-17):** `importacionCatalogoParseArchivoHandler` (y
`revalidarFila`) arman el matcher una vez y adjuntan `nombre_producto_archivo` + `candidatos` a las
filas `sin_matchear`. En `ImportarCatalogoProveedorView`, esas filas ofrecen los candidatos con % y un
botón "Asignar" que convierte la fila en `actualizar` con `matched_by='similitud'` (client-side; nada
se persiste hasta Confirmar; no crea productos). `matched_by` del detalle de catálogo extendido con
`'similitud'`. Test: `importacion-catalogo.handlers.test.ts` ("ofrece candidatos por NOMBRE…"). Con esto
**Lote 4 queda completo** en costos y catálogo.

**Superseder `norm()` de geo-seed (2026-08-17):** `geo-seed/index.ts` ahora usa el `normalizar()`
de `packages/shared`; se eliminó su `norm()` privado (había divergencia: mayúsculas + sin canonizar
medidas). Sin impacto de comportamiento: `nombre_norm` es hoy una columna de escritura (los handlers
de geo ordenan por `nombre` y no consultan `nombre_norm`), así que no hizo falta backfill. Con esto
queda **un único normalizador** en todo el código. **ADR-063 completo (Lotes 1-4 + cleanup).**

---

## ADR-064 — Ubicaciones: identidad canónica (normalización) + ABM completo con exportación

**Fecha:** 2026-08-17
**Estado:** Aceptado — implementado (2026-08-18; suites automáticas en verde, **pendiente
verificación manual en la app** — ver §Implementación)
**Release:** `1.1.x` (sobre el núcleo local, sin feature flag). **Sin migraciones de schema.**
**Decisores:** Joaquín (product owner) · Claude (asesor técnico)
**Marco:** ADR-005/025 (`ubicacion` como atributo del producto, una sola por producto, sin QR —
carteles pre-impresos fijos), ADR-024/063 (patrón de normalización canónica derivada:
`localidad.nombre_norm` / `normalizar()` en `@ferreteria/shared`), ADR-041 (ABM de Unidades:
baja bloqueada con productos asociados — precedente del que este ADR se aparta a propósito, ver
§Decisión 4), ADR-053 (retiro de `LocalizacionView`; la localización vive hoy en el Listado de
Productos), P1.12 / módulo de exportación (`packages/shared/src/export` + `main/export`),
principio de arquitectura 7 (baja lógica en maestros, sin borrado físico), CLAUDE.md §4
(identificación de productos) y §7 (tabla `ubicacion`).

### Contexto

Dos problemas del mismo dominio, detectados al probar la app con datos reales.

1. **Bug de identidad — ceros a la izquierda.** La carga de ubicaciones no normaliza: se cargó
   `A-0-1` y también `A-0-01` y quedaron como filas distintas, cuando son el **mismo** estante.
   Causas raíz confirmadas en el código:
   - `ubicacionCreateHandler` (`ipc/ubicacion.ts`) inserta `sector/estante/posicion` **crudos**,
     sin normalizar, y persiste el `codigo` tal como llega del renderer.
   - `validarFilaUbicacion` (`ipc/importar.ts`) arma `codigo = ${sector}-${estante}-${posicion}`
     sin normalizar y matchea la existente por `(sector, estante, posicion)` **exactos**.
   - El schema `ubicacion` tiene `codigo` único **y** unicidad `(sector,estante,posicion)`, pero
     como `'01' ≠ '1'` esas restricciones no atrapan el duplicado.

2. **ABM incompleto en Configuración.** Falta listar / editar / agregar / **eliminar**
   ubicaciones y exportarlas desde una pantalla propia.
   - `ipc/ubicacion.ts` sólo expone `list / get / create / update`. **No existe
     `ubicacion:delete`.**
   - Tras ADR-053 **no hay pantalla de ubicaciones**: `LocalizacionView` se retiró y los hooks
     del renderer sólo hacen `list/get`. El ABM hay que crearlo nuevo en Configuración.
   - La exportación **ya está cableada**: descriptor `exportUbicaciones`
     (`shared/export/descriptores/ubicaciones.ts`), `ubicacionQueryAll` (devuelve
     `cantidad_productos` por ubicación) y el `case 'ubicaciones'` en `ipc/exportar.ts`. Lo único
     que falta es el `ExportarButton` en la pantalla nueva; **no se inventa mecanismo nuevo**.

### Decisión

1. **Forma canónica en un único lugar reutilizable.** Función pura
   `canonicalizarUbicacion(sector, estante, posicion)` en `packages/shared` (testeable sin BD),
   que devuelve los tres segmentos canónicos y el `codigo` derivado. Pipeline por segmento:
   `trim → mayúsculas → si el segmento es todo dígitos, sacar ceros a la izquierda a la forma
   mínima` (`'01' → '1'`, `'007' → '7'`, `'0' → '0'`; un segmento no numérico como `EXT` sólo se
   trimea y pasa a mayúsculas). **Sin padding a ancho fijo** (se descartó: exige fijar un ancho y
   es frágil si un depósito usa otra cantidad de dígitos). `codigo = ${sector}-${estante}-${posicion}`
   sobre los segmentos ya canónicos. Así `a-0-01`, `A-0-1` y `A-00-1` colapsan a `A-0-1`.

2. **Normalizar al escribir (pisa el valor); sin columna nueva.** Se **guarda** el valor ya
   canónico en `sector/estante/posicion/codigo` — no se conserva lo tipeado ni se agrega una
   columna `codigo_norm` derivada. Los carteles del depósito son pre-impresos y no hay valor en
   preservar `0-01` frente a `0-1`. Se aplica en los **tres** puntos de entrada: alta manual
   (`ubicacionCreateHandler`), edición e importación (`validarFilaUbicacion` +
   `revalidarFila`). Como se persiste la canónica, las unicidades existentes de schema
   (`codigo`, `(sector,estante,posicion)`) pasan a ser efectivas — **sin migración**.

3. **Colisión en alta manual → rechazar, nunca pisar.** Si la canónica ya existe, el alta
   manual falla con mensaje claro (`YA_EXISTE: A-0-1`) y la UI ofrece editar la existente. No hay
   sobreescritura silenciosa. En **importación** se conserva el comportamiento actual: match a la
   existente = `update` (idempotente; sólo refresca `descripcion`). Reactivar una canónica dada de
   baja se deja fuera de alcance (se puede reactivar editándola).

4. **Eliminar = baja lógica; con productos, permitir reasignando.** El borrado es
   `activo = false` (principio 7, nunca físico). Nuevo handler **`ubicacion:delete`**. Si
   `cantidad_productos > 0`, en vez de bloquear (como hace ADR-041 en Unidades) se **permite la
   baja pidiendo destino**: la UI ofrece mover los productos afectados a otra ubicación o dejarlos
   **sin ubicación (`producto.ubicacion_id = null`)**; recién reasignados se marca `activo=false`,
   todo en una transacción. Se elige reasignar (no bloquear) porque una ubicación mal cargada por
   el bug **tiene** productos colgando y hay que poder limpiarla. Este mecanismo de
   *reasignar-y-dar-de-baja* es exactamente el que reutiliza el dedup (§6).

5. **Permiso.** El ABM (list/create/update/delete) queda para **ambos roles** —igual que la
   alta/edición de ubicaciones de hoy (RBAC), con guard de sesión autenticada, sin permiso nuevo
   ni cambios en conteos de tests de seed. La pantalla vive en Configuración **sin `permiso`**
   (precedente: "Etiquetas"), visible para Operador y Supervisor.

6. **Dedup de datos ya cargados = acción admin con preview (el GATE).** No hay migración
   destructiva silenciosa. En la pantalla de Configuración, una acción **"Detectar duplicados"**
   (gateada por `usuario.administrar`, Supervisor — decidido al aprobar el gate) agrupa
   las filas que colapsan a la misma canónica, muestra un **preview** (grupo → sobreviviente →
   productos a reasignar → filas a dar de baja), y **sólo tras confirmación** reasigna
   `producto.ubicacion_id` al sobreviviente y da de baja las duplicadas. **Sobreviviente:** la
   fila que ya está en forma canónica si existe; si ninguna lo está, la de mayor
   `cantidad_productos` (desempate: `fecha_creacion` más antigua), que se reescribe a su forma
   canónica. Todo con el backup pre-operación existente y sobre el patrón de baja lógica.

7. **Pantalla nueva (integración, CLAUDE.md §Navegación).** Alta de la pantalla ABM en
   Configuración exige las **tres** cosas: ruta en `routes/index.tsx`, ítem en el array `NAV` de
   `AppShell.tsx` (grupo Configuración) y entrada en `CRUMBS`. Se agregan los hooks/handlers
   faltantes (`ubicacion:delete`, reasignación, dedup) y el `ExportarButton` con el descriptor ya
   existente. No se toca `ConfigShell.tsx` (código muerto, ADR-048/§Navegación).

### Rechazado

- **Columna derivada `codigo_norm` (no pisar lo tipeado).** Válida y consistente con
  `nombre_norm` (ADR-024/063), pero acá no aporta: no hay razón de negocio para conservar
  `0-01` como display, y agrega superficie de schema + backfill. Se prefirió normalizar al
  escribir.
- **Padding a ancho fijo.** Exige fijar/parametrizar un ancho por depósito; frágil y con más
  configuración. La forma canónica mínima (sacar ceros) es determinística y suficiente.
- **Migración automática que canonicaliza y fusiona en el arranque.** Reasigna FKs y da de baja
  filas sin intervención ni preview: poco auditable y riesgosa sobre bases reales. El dedup va por
  acción admin visible. (Se consideró y descartó también la variante híbrida —migración sólo para
  filas sin colisión— por no justificar dos caminos.)
- **Bloquear la baja con productos (patrón ADR-041).** Correcto para Unidades, pero acá dejaría
  sin salida a las ubicaciones basura que el propio bug pobló. Se permite la baja reasignando.

### Consecuencias

- (+) `A-0-1` y `A-0-01` dejan de poder coexistir: una sola función canónica, aplicada en los tres
  puntos de entrada, cierra el bug de raíz **sin migración de schema**.
- (+) ABM completo y alcanzable (incluye `delete`) + exportación, reutilizando el módulo de export
  ya cableado.
- (+) El dedup es visible, previo a escribir y auditable; reusa el mecanismo de reasignación del
  delete.
- (−) La normalización al escribir **cambia lo tipeado** por el usuario (por diseño); quien esperaba
  ver `0-01` verá `0-1`.
- (−) La acción de dedup y la baja-con-reasignación agregan UI y casos de test (preview, transacción
  de reasignación) aunque no toquen schema.
- (−) Si en el futuro un depósito exigiera anchos fijos con ceros significativos, esta canónica
  habría que revisarla (hoy fuera de alcance).

### Pendiente / Gate

**GATE de datos aprobado (2026-08-17).** Definidos y cerrados: forma canónica (§1-2) y
estrategia de dedup (§6); la sub-decisión de permiso quedó en `usuario.administrar` (Supervisor)
para la acción de dedup. El resto del ABM (list/create/update/delete) es de ambos roles. Sigue a
plan (writing-plans) + TDD por lotes, con las migraciones/schema recién dentro del plan aprobado:
(L1) `canonicalizarUbicacion` en shared + normalización en los tres puntos de entrada;
(L2) `ubicacion:delete` con reasignación + ABM screen + `ExportarButton`;
(L3) acción de dedup con preview.

### Implementación (2026-08-18)

Rama `feat/adr-064-ubicaciones-canonicas`, TDD por lotes (subagent-driven). **Sin migraciones de
schema** (las unicidades existentes de `codigo` y `(sector,estante,posicion)` pasan a ser
efectivas al persistir la canónica). Commits:

- **L1 — canónica + normalización.** `canonicalizarUbicacion()` puro en
  `packages/shared/src/ubicacion.ts` (`trim → upper → sacar ceros a izquierda en segmentos
  all-dígitos`, sin padding; 5 tests). Alta manual (`ubicacionCreateHandler`) canonicaliza,
  **pisa** lo tipeado y rechaza colisión con `YA_EXISTE:<codigo>`. Importación
  (`validarFilaUbicacion`) matchea por `codigo` canónico y colapsa duplicados intra-archivo.
  Bug corregido en el camino: `confirmarUbicaciones` hacía `UPDATE ... WHERE id = undefined`
  (0 filas, silencioso) para el duplicado intra-archivo → ahora resuelve el destino por `codigo`
  (last-write-wins), con guard `NO_MATCH`.
- **L2 — delete + ABM + export.** `ubicacion:delete` (baja lógica; con `cantidad_productos > 0`
  reasigna `producto.ubicacion_id` a otra ubicación o `null` y recién da de baja, en una
  transacción; helper `reasignarProductos`), `ubicacion:list-all`, preload. Pantalla nueva
  `renderer/views/config/UbicacionesView.tsx` (tabla + alta/edición + baja-con-reasignación +
  `ExportarButton` con el descriptor `exportUbicaciones` ya existente), con ruta
  `/config/ubicaciones`, ítem NAV en Configuración **sin permiso** (ambos roles, precedente
  "Etiquetas") y CRUMB. Se actualizó el test de `AppShell` que afirmaba la ausencia del ítem
  (ADR-053) para reflejar su reintroducción. Bug latente corregido: el subquery
  `cantidad_productos` de `ubicacionQueryAll`/`ubicacionListAllHandler` interpolaba
  `${ubicacion.id}` como identificador pelado `"id"`, que SQLite ligaba a `producto.id` dentro
  del subquery → el conteo daba siempre 0 (afectaba la columna de exportación y el aviso de baja);
  ahora califica `ubicacion.id`.
- **L3 — dedup.** `ubicacion:dedup:preview` / `ubicacion:dedup:aplicar` (gateados por
  `usuario.administrar`, Supervisor): agrupan filas activas por canónica, eligen sobreviviente
  (la ya canónica; si ninguna, la de más `cantidad_productos`, desempate `fecha_creacion` más
  antigua, reescrita a canónica), reasignan productos de las duplicadas al sobreviviente y las dan
  de baja. UI "Detectar duplicados" con preview → "Fusionar duplicados" en la misma pantalla.

**Verificación automática:** suite node **1099 verdes** (91 archivos) tras L3; suite renderer y
`tsc --noEmit` limpios. **Pendiente: verificación manual en la app real** (`pnpm dev`, recorrido de
§7 del plan) — CLAUDE.md §12: la suite en verde no prueba alcanzabilidad. Fuente de verdad del
plan: `docs/superpowers/plans/2026-08-18-adr-064-ubicaciones-canonicas.md`. **Falta actualizar la
fila de `Estado.md`** (tenía cambios sin commitear de otra tarea al implementar este ADR).

---

## ADR-065 — Robustez del importador de productos: booleano canónico, idempotencia sin EAN, cobertura total de campos e informe de carga parcial

**Fecha:** 2026-08-17
**Estado:** Aceptado — implementado (2026-08-18; suites automáticas en verde + review final APROBADA, **pendiente verificación manual en la app** — ver §Implementación)
**Release:** `1.1.x` (sobre el núcleo local, sin feature flag). **Sin migraciones de schema.**
**Decisores:** Joaquín (product owner) · Claude (asesor técnico)
**Marco:** ADR-005/025 (identidad del producto: `sku` opaco único como única fuente de verdad interna, `gtin_barcode` nullable opcional — CLAUDE.md §4), ADR-063 (matching por similitud de nombre con `normalizarTermino`/`nombre_corto_norm`; principio "sugiere, humano confirma"), ADR-064 (mismo lote 064-066; identidad canónica de ubicaciones), ADR-051/035 (importación de costos: preview obligatorio, persistencia diferida, informe con desglose Total = Identificados + Rechazados), ADR-040 (`crearPresentacionDefault` en el alta), reglas de negocio (CLAUDE.md §6: productos inactivos no se venden; stock siempre vía `MovimientoStock`; CPP), §7 (tablas `producto`/`existencias`; dinero legacy en REAL/pesos — no se toca), §12 (disciplina: TDD, no producción sin test). Todo el importador vive en `packages/client/src/main/ipc/importar.ts`.

### Contexto

Reportes del PO al probar la carga masiva de productos con datos reales:

1. **`activo="si"` cargó el producto pero no aparecía por ningún lado.** El sistema decía "cargados correctamente" pero los productos no se veían, aun reintentando.
2. Cambiando `activo` a vacío/null sí los tomó, **pero todos por triplicado**.
3. En esa misma carga **no tomó stock máximo ni mínimo**.

Premisa del PO: en las importaciones hay que evitar **duplicados, faltantes e inconsistencias**; toda inconsistencia debe aparecer en el informe.

**Causas raíz confirmadas en el código:**

- **`activo="si"` → producto inactivo e invisible.** `importar.ts:208`:
  `activo: ['', 'true', '1'].includes(get('activo'))`. Con `"si"` da `false` → el producto se crea con `activo=false`; el Listado de Productos filtra `activo=true` y §6 prohíbe vender inactivos → "cargó ok" pero no se ve. Además el parser booleano está **fragmentado en tres formas divergentes**, ninguna reconoce `si/sí`: `activo` (`['','true','1'].includes`, línea 208, default `true` con celda vacía), `permite_fraccion` (`=== 'true'`, línea 198) y `habilita_cuenta_corriente` (`=== 'true'`, línea 341, entidad Clientes).
- **Triplicado al reimportar sin EAN.** `validarFilaProducto` sólo devuelve `status:'update'` dentro del bloque `if (codigoBarras)` (líneas 221-238), matcheando por `gtin_barcode`. Una fila **sin `codigo_barras` cae directo a `return { status:'ok', skuPreview:'auto' }`** (línea 240) → alta nueva con SKU nuevo en cada corrida. Reimportar el mismo archivo N veces crea N copias.
- **Stock máx/mín — falso negativo.** El código sí los maneja: `stock_maximo` (validación 158-168, insert `existencias` línea 1033, update línea 1096) y `stock_minimo` (línea 207, insert 1032, update 1095). El "no tomó" fue efecto colateral de los productos invisibles o de un desalineo de columnas del archivo. Se blinda con test golden, no con cambio de lógica.
- **Carga parcial no gobernada.** `confirmarProductos` (líneas 975-1148) itera con `try/catch` **por fila** e incrementa `stats.error++` por fila que explota al persistir → graba las válidas aunque otras fallen, pero los rechazos se determinan por **excepción en tiempo de escritura**, no en la validación, y el informe no separa con claridad importados de rechazos.

### Decisión

1. **Parser booleano canónico y compartido (función pura en `@ferreteria/shared`).** Una sola función, testeable sin BD, usada en todo el importador (productos y demás entidades con booleanos, p.ej. `habilita_cuenta_corriente`, `permite_fraccion`). Tras `trim().toLowerCase()`:
   - **true:** `si`, `sí`, `s`, `true`, `verdadero`, `v`, `1`, `x`.
   - **false:** `no`, `n`, `false`, `falso`, `f`, `0`.
   - **Celda vacía → default explícito por campo** (parámetro de la función, no default global): `activo` = `true` (se **mantiene** el comportamiento actual: un catálogo sin la columna carga productos vendibles — lo contrario del bug de invisibilidad); `permite_fraccion` y `habilita_cuenta_corriente` = `false` (opt-in).
   - **Token no reconocido** (ej. `"tal vez"`) = **error de fila** con mensaje claro, **nunca** un default silencioso. Reemplaza las tres formas divergentes de hoy.

2. **Idempotencia sin EAN — cascada de identidad + detección blanda (sin migración).**
   - **Claves de identidad (fuerzan UPDATE, idempotentes):** `sku` → `gtin_barcode`.
     - Nueva **columna opcional `sku`** en la plantilla de productos. Si viene y **existe** → UPDATE de ese producto. Si viene y **no existe** → **error de fila** (`SKU_INEXISTENTE`), nunca alta con un SKU ajeno (el SKU lo asigna el sistema, ADR-025).
     - Sin `sku`: `gtin_barcode` como hoy (match exacto, único).
   - **Detección blanda (no fuerza UPDATE; levanta rechazo con aviso):** una fila sin `sku` ni `gtin_barcode` cuyo `nombre_corto_norm` (+ `marca_id` cuando la fila trae marca) coincide con un producto existente se marca **`POSIBLE_DUPLICADO: <SKU>`** y se rechaza, para que el usuario lo resuelva (agregar el SKU en el archivo para actualizar, o confirmar que es alta real distinta). No fusiona en silencio (evita mezclar dos productos distintos) ni duplica en silencio (evita el triplicado): es el criterio de ADR-063, **la similitud sugiere, la confirmación es humana.**
   - **Aviso de inconsistencia:** cuando una fila matchea por una clave pero **otro campo del archivo difiere del guardado** (ej. mismo `sku`, `gtin_barcode` distinto), se reporta la discrepancia en el informe.
   - **Primera carga:** una fila sin `sku`, sin `gtin_barcode` y sin match por nombre → alta nueva, el sistema asigna SKU. **Reimportar el mismo archivo ya no triplica:** el match por nombre normalizado detecta las filas ya cargadas y las rechaza como `POSIBLE_DUPLICADO` (o, si el usuario reexporta con la columna `sku`, se actualizan).
   - **Sin migración:** `producto.sku` y `producto.gtin_barcode` ya son únicos; `producto.nombre_corto_norm` ya existe (lo escribe `confirmarProductos:1007` vía `normalizarTermino`); `marca_id` se resuelve en la validación (`marcaMap`). La `sku` es columna **de plantilla**, no de BD.

3. **Cobertura total de campos + test golden ida-y-vuelta.** Auditar que **todas** las columnas de la plantilla lleguen a las tablas definitivas `producto` + `existencias`: las 19 actuales — `nombre`, `unidad_medida`, `precio_venta`, `iva_alicuota`, `rubro`, `codigo_barras`, `costo` (→ `precio_costo_promedio` + CPP), `stock_minimo`, `activo`, `marca`, `ubicacion`, `stock_inicial` (→ `movimiento_stock` motivo `inicial`), `stock_maximo`, `nombre_largo`, `descripcion_tecnica`, `garantia_meses`, `unidad_compra`, `factor_conversion`, `permite_fraccion` — más la presentación default (`crearPresentacionDefault`, ADR-040) y la nueva `sku` (20 en total). Se cierra con un **test golden**: plantilla completa → import → leer de la BD → assert de **cada** campo, en alta y en update. Este test es la red que atrapa el falso negativo de stock máx/mín y cualquier desalineo futuro.

4. **Carga parcial con informe (skip-and-report).** *(Decisión del PO en esta sesión; **supersede** la premisa inicial "todo-o-nada / no realizar la carga" del prompt del lote — ver §Rechazado.)*
   - **Validación primero:** cada fila queda `ok` / `update` / `error` con motivo en el preview.
   - **Confirmar inserta las válidas** (`ok` + `update`) y **rechaza** las `error`, sin abortar el lote.
   - **Cada fila válida es atómica:** transacción por fila (`producto` + `existencias` + presentación default + `movimiento_stock` en una sola transacción). Si una fila falla al persistir, se revierte **sólo esa fila** y se reporta como rechazo. Se conserva la transacción por fila actual; lo que se corrige es que los rechazos se determinen en la **validación**, y el `try/catch` de persistencia quede sólo como red de seguridad.
   - **Informe final:** importados (creados / actualizados) + rechazados con `fila` + motivo, con el mismo desglose consistente que Importar Costos (Total = Importados + Rechazados). Visible en el wizard `importar:productos:*` (no en `ImportarCostosView`, que es de costos).
   - **Duplicados e inconsistencias caen como rechazos en el informe** (`POSIBLE_DUPLICADO`, `SKU_INEXISTENTE`, token booleano inválido, rubro/marca/ubicación inexistente) — nunca como carga silenciosa. Así se preserva el espíritu del PO ("nada malo entra sin avisar") aun con carga parcial.

### Alcance / límites

- **Ajuste masivo de campos no obligatorios** (descripción, `nombre_largo`, precio, marca, ubicación, `garantia_meses`, umbrales `stock_minimo`/`stock_maximo`) se hace por la vía UPDATE ya existente: exportar el catálogo, editar la columna y **reimportar con la plantilla completa** (match por `sku` → UPDATE). Respeta la premisa "no faltantes". No se agrega un modo de "planilla flaca" (ver §Rechazado).
- **El stock físico nunca se ajusta por este importador** (§6: el stock siempre cambia vía `MovimientoStock`). `confirmarProductos` sólo siembra `stock_inicial` cuando el producto está en 0 (`stockActual === 0`, línea 1104). Cambios masivos de stock físico van por el módulo de stock / ajustes de conteo, fuera del alcance de ADR-065.
- El parser booleano se **comparte** con las demás entidades (Clientes: `habilita_cuenta_corriente`, etc.), pero **no se rediseñan clientes/proveedores** (cerrados en ADR-058) más allá de reusar el parser.
- Dinero de `producto` sigue en **REAL/pesos** (deuda legacy §7) — no se cambia la convención.

### Rechazado

- **Match por nombre / nombre-marca que fuerza UPDATE.** Idempotente sin columnas nuevas, pero fusiona en silencio dos productos distintos con el mismo nombre → viola "evitar inconsistencias". El nombre se usa **sólo para detección con aviso** (rechazo `POSIBLE_DUPLICADO`), no para actualizar.
- **Bloquear toda fila sin identificador estable.** Máxima seguridad anti-duplicado, pero obliga a que todo producto tenga EAN o SKU en el archivo — fricción alta en el alta inicial de catálogo, donde el SKU todavía no existe. Se prefiere alta + detección por nombre.
- **Columna/índice nuevo para la clave de matching.** Innecesario: `sku`, `gtin_barcode` (únicos) y `nombre_corto_norm` ya existen. El gate se cierra sin migración.
- **Todo-o-nada (abortar todo el lote ante ≥1 error).** Era la premisa inicial del prompt del lote. El PO decidió en esta sesión **carga parcial con informe**: cargar las válidas y reportar los rechazos, en vez de frenar toda la importación por una fila mala. La seguridad se preserva porque duplicados/inconsistencias son rechazos visibles, no cargas silenciosas.
- **Default booleano silencioso para tokens no reconocidos.** Un `"quizás"` que caiga a `false` es exactamente la clase de inconsistencia invisible que originó el bug. Token desconocido = error de fila.
- **Modo de edición parcial por SKU (planilla "flaca").** `sku` + sólo las columnas a cambiar, con las obligatorias omitidas. Choca con la premisa "evitar faltantes", exige validación condicional (obligatoriedad según exista o no el producto) y UX propia de confirmación. **Se difiere a su propio ADR** — especificado en §Trabajo futuro. El ajuste masivo se cubre mientras tanto con export→editar→reimportar de plantilla completa.

### Trabajo futuro (fuera de este ADR)

**Edición masiva de productos por importación con planilla parcial.** Feature nueva (no corrección), no encaja en el paraguas de ADR-066 ("sin cambio de arquitectura") → **ADR propio, siguiente número libre** (069, dado que 067 y 068 están tomados; ADR-068 tomó el 068 para el reuso de GTIN de presentación). Especificaciones a resolver en ese ADR:

- **Objetivo:** actualizar un subconjunto de campos de muchos productos existentes con una planilla mínima, sin re-suministrar las columnas obligatorias del alta.
- **Identidad obligatoria por fila:** clave estable (`sku` o `gtin_barcode`). Fila sin clave → error; **en modo edición no se dan altas** (es lo que lo distingue del importador de ADR-065).
- **Semántica de columnas:** sólo las columnas **presentes** se actualizan; las ausentes quedan intactas (no se pisan con null/default). Definir explícitamente el caso **celda vacía en columna presente**: ¿limpia el campo (set null) o se ignora? — decisión del ADR.
- **Whitelist de campos editables:** descripción, `nombre_largo`, precio, marca, ubicación, `garantia_meses`, umbrales `stock_minimo`/`stock_maximo`. **Excluidos explícitos:** `sku` (inmutable, ADR-025), identidad, y **stock físico** (§6: sólo vía `MovimientoStock`).
- **Validación por columna:** mismas reglas del importador (marca/ubicación/rubro deben existir; booleano canónico de ADR-065; números ≥ 0).
- **UX:** modo **explícito** separado del alta ("Editar en masa" ≠ "Importar"); preview con **diff por fila** (campo: valor anterior → nuevo) y confirmación; carga parcial con informe (reusa el patrón de ADR-065).
- **Seguridad/permiso:** guard `import.masiva` (Supervisor); sin fusión silenciosa. **Sin migración esperada** (usa columnas existentes).

### Consecuencias

- (+) `activo="si"` deja de crear productos invisibles: un único parser booleano canónico, compartido por todas las entidades, reconoce el vocabulario real del PO y convierte lo ambiguo en error visible.
- (+) Reimportar un archivo sin EAN ya no triplica: identidad por `sku`/`gtin_barcode` + detección por nombre con aviso. Sin migración.
- (+) El test golden fija la cobertura de los 20 campos y atrapa de raíz el falso negativo de stock máx/mín y futuros desalineos.
- (+) Informe claro de importados vs rechazados; nada entra en silencio.
- (−) La columna `sku` en la plantilla suma una entrada que el usuario debe entender (se documenta: vacía = alta; con SKU = actualización).
- (−) La detección por nombre puede rechazar como `POSIBLE_DUPLICADO` filas que el usuario **sí** quería dar de alta con nombre repetido (dos productos distintos, mismo nombre); el escape es distinguirlos en el archivo o cargarlos por separado. Es el precio de no fusionar en silencio.
- (−) La carga parcial implica que una corrida puede quedar "a medias" (válidas cargadas, resto rechazado); el usuario corrige el archivo y reimporta — los ya cargados se detectan y no se duplican.

### Gate

**Clave de matching definida y cerrada (esta sesión):** cascada de identidad `sku` (columna opcional de plantilla) → `gtin_barcode`, más detección blanda por `nombre_corto_norm` (+`marca_id`) que rechaza con `POSIBLE_DUPLICADO`, y aviso ante cualquier inconsistencia. **No toca schema** (columnas y unicidades ya existen) → **el gate se cierra sin migración.**

Pendiente antes de plan + TDD: **OK del PO** a este ADR como Propuesto. Luego sigue el flujo de §12 (writing-plans → TDD RED-GREEN-REFACTOR → verificación manual en la app), con lotes sugeridos: (L1) parser booleano canónico en `shared` + reemplazo en el importador; (L2) cascada de matching sin EAN + detección `POSIBLE_DUPLICADO` + columna `sku` de plantilla; (L3) informe de carga parcial gobernado por validación; (L4) test golden de cobertura total.

### Implementación (2026-08-18)

Rama `feat/adr-065-importador-productos-robustez` (sobre `feat/adr-064-ubicaciones-canonicas`), TDD por lotes (subagent-driven). **Sin migraciones de schema.** Commits:

- **L1 — parser booleano canónico** (`8c8e84d`). `parseBooleanoImport(raw, {default})` puro en `packages/shared/src/booleano.ts` (true: `si/sí/s/true/verdadero/v/1/x`; false: `no/n/false/falso/f/0`; vacío = default **por campo**; token desconocido = `{ok:false}` → error de fila). Reemplaza las tres formas divergentes en `importar.ts`: `activo` (default `true`), `permite_fraccion` y `habilita_cuenta_corriente` (default `false`). Cierra el bug `activo="si"` → producto invisible.
- **L2 — cascada de identidad** (`1f4c40e`). En `validarFilaProducto`: `sku` (columna opcional de plantilla) → `gtin_barcode` → detección blanda por `nombre_corto_norm` (+`marca_id`). SKU presente+existe = UPDATE; presente+no existe = `SKU_INEXISTENTE`; match por nombre sin SKU/EAN = `POSIBLE_DUPLICADO` (intra-archivo vía `seenNombres` y contra BD), nunca alta ni fusión silenciosa; aviso de inconsistencia si el EAN del archivo difiere del guardado. Columna `sku` agregada a la plantilla (opcional; **no** en `PRODUCTOS_OBLIGATORIAS`).
- **L3 — informe de carga parcial** (`95611a0`). `useImportar.confirmar()` fusiona las filas rechazadas del preview en el `summary` (Total = Importados + Rechazados); las filas en error nunca se envían al backend (nada inválido se persiste).
- **L4 — test golden ida-y-vuelta** (`2cf21bd`). Alta con las 20 columnas → assert de cada campo en `producto`/`existencias`/presentación default/`movimiento_stock`; update por SKU sin duplicar. Atrapa el falso "no tomó stock máx/mín".
- **Fix de review final** (`1eda4b7`). `nombre_corto_norm` se sincroniza también en el path de UPDATE (antes sólo lo escribía el alta; tras un rename por SKU la detección de duplicados por nombre quedaba contra un norm viejo).

**Verificación automática:** shared **126** · node **1109** (91 archivos) · renderer **589** (88 archivos) · `tsc --noEmit` limpio. Review final independiente (subagente Opus): **APROBADO, sin issues Critical/Important**. **Pendiente: verificación manual en la app real** (`pnpm dev` como Supervisor — CLAUDE.md §12: la suite en verde no prueba alcanzabilidad): recorrido en §Cierre del plan `docs/superpowers/plans/2026-08-18-adr-065-importador-productos-robustez.md`.

---

## ADR-066 — Correcciones de UX y regresiones: presentaciones (eliminar/reactivar), recepción parcial de OC y búsqueda por EAN

**Fecha:** 2026-08-17
**Estado:** Aceptado — implementado (2026-08-18; tres ítems con test de regresión, suites en verde, `tsc` limpio — ver §Implementación). El cuarto reporte del lote (scroll en previews) se **descopeó por no reproducible** (ver §Fuera de alcance).
**Release:** `1.1.x` (sobre el núcleo local, sin feature flag). **Sin migraciones de schema — sin gate de schema.**
**Decisores:** Joaquín (product owner) · Claude (asesor técnico)
**Marco:** ADR paraguas de correcciones **sin cambio de arquitectura ni schema**; mismo lote 064-066 (surge de probar la app con datos reales). ADR-040 (`producto_presentacion`: `es_default`, `activo`, `sin_confirmar`, índice único parcial de `es_default` por producto y de `gtin_barcode` no nulo; `crearPresentacionDefault`; `venta_detalle.presentacion_id`, `lista_precio_valor.presentacion_id`), ADR-018/P3.12 (recepción parcial: `item_oc.cantidad_recibida` acumulado, estados `recibida_parcial`/`recibida_total`), ADR-005/025 (identidad del producto: `sku` opaco + `gtin_barcode` nullable — CLAUDE.md §4), ADR-053/067 (`productoListHandler` como punto único de búsqueda de Productos/POS; substring + normalización). CLAUDE.md §Navegación (un componente huérfano da tests verdes y cero efecto), §7 (dinero legacy REAL/pesos — no se toca) y §12 (TDD; cada ítem cierra con test de regresión). Si algún ítem exigiera decisión de arquitectura o migración, sale de acá a su propio ADR.

### Contexto

Tres reportes del PO al operar la app con datos reales. Ninguno requiere schema. (Un cuarto reporte del lote —scroll en previews— se descopeó por no reproducible; ver §Fuera de alcance.)

1. **Presentaciones — Detalle de Producto.** Al seleccionar una presentación se puede **editar pero no eliminar**, y sigue apareciendo en el listado. Si se **desactiva**, no se puede hacer nada más con ella (ni reactivar ni eliminar) → queda basura inaccionable.
2. **Recepción parcial de OC — REGRESIÓN.** Antes: se piden 10, se reciben 4, quedan 6 pendientes. Ahora **no deja editar el campo de cantidad a recibir**.
3. **Búsqueda por EAN.** En Productos, la búsqueda es sólo por SKU interno o nombre; **no encuentra por EAN/GTIN** tipeado.

**Causas raíz confirmadas en el código:**

- **(1) No hay `eliminar` ni `reactivar`; el listado no filtra `activo`.** `packages/client/src/main/ipc/presentacion.ts` sólo expone `desactivar` (baja lógica, `presentacion.ts:157`) que además **bloquea la default** (`NO_DESACTIVAR_DEFAULT`, `presentacion.ts:163`); no existe borrado (físico ni "eliminar") ni reactivación. `presentacionListByProductoHandler` (`presentacion.ts:56`) devuelve **todas** las filas sin filtrar `activo`. En `PresentacionesPanel.tsx` (`renderer/views/productos/`), la fila inactiva sólo renderiza el botón "editar" (`PresentacionesPanel.tsx:164-172`: ★ y ✕ salen únicamente con `!es_default && activo`) → una vez desactivada, la presentación queda visible y sin ninguna acción posible.
- **(2) Clamp en cada tecla sobre un campo pre-cargado al máximo.** `RecepcionView.tsx` (`renderer/views/compras/recepciones/`) inicializa "A recibir ahora" con **todo el pendiente** (`String(cantidad_pedida − cantidad_recibida)`, `RecepcionView.tsx:58-64`) y `clampItem` (`RecepcionView.tsx:31-40`) reclampa en cada `onChange`: si el valor ya está en el máximo, cualquier dígito **agregado** supera `max` y `clampItem` lo vuelve al tope → el campo parece congelado ("no deja editar"). Limpiar primero y tipear sí funciona; **agregar** sobre el valor pre-cargado no. El backend `recepcion.ts` (`recepcionCrearHandler`) es correcto: acumula `item_oc.cantidad_recibida` y recalcula estado `recibida_parcial`/`recibida_total`. El commit `2f36d8f` (SonarCloud) sólo extrajo `clampItem` verbatim — la trampa es previa; el diagnóstico se **fija con un test RED** antes de tocar código (systematic-debugging).
- **(3) La búsqueda de texto no incluye `gtin_barcode`.** En `producto.ts`, `buildProductoWhereClause` (`producto.ts:230`) arma el `busqueda` como `OR(like(nombre_corto), like(sku), …matchNorm sobre nombre_corto_norm/marca)` (`producto.ts:244-251`); **falta** `like(gtin_barcode)`. Existe un camino `exactCodigo` que matchea `sku` **o** `gtin_barcode` exactos (`producto.ts:239`) pero es la resolución de **scan** (EAN completo), no la búsqueda por substring del input. **Además** `productoQueryAll` (query de exportación de Productos) duplica el mismo OR y también omite `gtin_barcode`.

### Decisión

Orden de trabajo: **(2) recepción → (1) presentaciones → (3) EAN.** Recepción primero por ser la regresión más urgente. Cada ítem cierra con test de regresión.

1. **(2) Recepción parcial — dejar de clampear en tiempo real.** La validación de tope se hace en `blur`/submit (la validación de submit ya existe, `RecepcionView.tsx:78-91`: rechaza negativos y `> max` con mensaje), y `onChange` deja tipear libremente. Se conserva el pre-llenado al pendiente como comodidad, pero **agregar/editar dígitos ya no revierte**. **Root-cause primero con test RED**; recién después el fix. **Test de regresión:** OC de 10 pedidas → recibir 4 → OC queda `recibida_parcial` con 6 pendientes; y el campo acepta editar a un valor menor al pre-cargado sin que se revierta.

2. **(1) Presentaciones — `eliminar` + `reactivar` + invariante de default.**
   - **`presentacion:eliminar`** — **física** sólo si la presentación **nunca se usó** (sin referencias en `venta_detalle.presentacion_id` **ni** `lista_precio_valor.presentacion_id`): borra la fila. Si **tiene historial** → **baja lógica** (`activo=false`). **Nunca** se elimina la default (mismo bloqueo que desactivar): primero hay que marcar otra como predeterminada.
   - **`presentacion:reactivar`** — `activo=true` sobre una inactiva. Valida que no colisione el **índice único parcial de `gtin_barcode`** con otra presentación activa; si choca, error claro (el usuario limpia el GTIN de una de las dos primero). No cambia `es_default`.
   - **Invariante "1 default activa por producto":** se **bloquea** desactivar/eliminar la default (`NO_DESACTIVAR_DEFAULT` extendido a eliminar). El usuario primero marca otra como predeterminada (★). No se rompe la invariante ni el índice único parcial de `es_default`.
   - **UI (`PresentacionesPanel`):** el listado sigue mostrando activas e inactivas con su estado, pero **toda fila es accionable**: la inactiva gana **reactivar** y **eliminar**; la activa no-default gana **eliminar** además de ★ y desactivar. Se termina la "basura inaccionable".
   - **Tests:** eliminar física (sin historial) borra la fila; eliminar con historial hace baja lógica y no borra; reactivar reactiva (y rechaza colisión de GTIN); bloqueo de baja/eliminación de la default.

3. **(3) EAN — sumar `gtin_barcode` a la búsqueda de texto.** Agregar `like(schema.producto.gtin_barcode, '%${busqueda}%')` al OR de `busqueda` en `buildProductoWhereClause` **y en `productoQueryAll`** (para que el listado y la exportación sean consistentes), y ajustar el placeholder del input en `ProductosListado` ("Buscar por nombre, SKU o EAN..."). Sin tocar schema ni el camino de scan. **Test:** un EAN parcial encuentra el producto por su `gtin_barcode` (en búsqueda y en exportación).

### Alcance / límites

- **Sin schema, sin migraciones, sin feature flag.** Los tres ítems usan columnas, índices y tablas existentes.
- **No se reabre ADR-040** (modelo de presentaciones) ni ADR-018 (recepción): sólo se corrigen huecos de CRUD/UX sobre lo ya decidido.
- **Dinero de `producto`/recepción** sigue como está (REAL/pesos en `producto`, centavos en compras — §7); no se toca.

### Fuera de alcance

- **Scroll en previews/listados (cuarto reporte original del lote): descopeado por no reproducible.** Se reportó que "en la carga de Artículos se ven sólo un par de productos y no se puede scrollear". Al diagnosticar (2026-08-18) **no se pudo reproducir** —ni el PO en la app ni en el análisis del código—: el chain de scroll del preview es correcto y **sin cambios desde antes del reporte** (`.table-wrap { flex:1; overflow:auto }` en `global.css` desde 2026-06-16; `PreviewStep` como `flex:1; min-height:0; overflow:auto` dentro de `.panel{flex:1; min-height:0}` en `ImportarView`, cadena acotada hasta `.app-shell{height:100vh}`). Sin repro no se toca (systematic-debugging: no arreglar lo que no se reproduce). Si reaparece, se abre con la pantalla exacta y pasos de reproducción, en su propio ítem/ADR.

### Rechazado

- **(1) Auto-promover otra presentación a default al quitar la default.** Menos fricción, pero elige por el usuario y agrega lógica de selección (¿cuál?). Se prefiere **bloquear y pedir** que el usuario elija la nueva default (decisión explícita, predecible).
- **(1) Permitir que el producto quede momentáneamente sin default.** Rompe la invariante "1 default activa" y el sentido del índice único parcial. Rechazado.
- **(1) Ocultar las inactivas del listado por default.** Resolvería la "basura" visual, pero esconde presentaciones que el usuario quizás quiera reactivar/eliminar; se prefiere mostrarlas **con acciones**.
- **(2) Mantener el clamp en `onChange` y sólo cambiar el valor inicial.** Parchea el síntoma más común pero deja la trampa de "agregar dígitos revierte" para otros valores. Se corrige la causa (clamp en tiempo real), no el síntoma.
- **(4) Búsqueda difusa/typo-tolerante o discriminación por patrón EAN en el input.** Fuera de alcance: sólo se suma `gtin_barcode` al substring. El scan exacto ya existe (`exactCodigo`).

### Consecuencias

- (+) Presentaciones: CRUD completo (crear/editar/eliminar/reactivar/★) con invariante de default garantizada; se termina la basura inaccionable.
- (+) Recepción parcial vuelve a funcionar (editar la cantidad a recibir), con test de regresión que fija el caso 10→4→6.
- (+) La búsqueda de Productos encuentra por EAN tipeado, además de SKU y nombre — consistente entre listado y exportación.
- (−) `eliminar` con fallback a baja lógica puede confundir ("eliminé pero sigue en inactivas"): se comunica en la UI (mensaje "tiene historial: se dio de baja").

### Gate

**No hay gate de schema** (sin migraciones). Tras el OK del PO a este ADR (sesión 2026-08-18), se siguió el flujo de §12: writing-plans → TDD RED-GREEN-REFACTOR por ítem (subagent-driven, con review de spec + calidad por tarea) → **pendiente verificación manual en la app** (`pnpm dev`, navegando como el usuario — §Navegación). La recepción parcial fue primero (regresión más urgente; root-cause con test RED). Cada ítem cerró con su test de regresión.

### Implementación (2026-08-18)

Rama `feat/adr-066-fixes-ux-regresiones` (sobre `feat/adr-065-...`), TDD por ítem (subagent-driven). **Sin migraciones.** Los tres ítems, en orden de trabajo:

- **(2) Recepción parcial** (`9e53585`, `292e8dc`). `RecepcionView.tsx`: `onChange` guarda el valor crudo (`setCantidadRaw`) y el clamp a `[0,max]` corre en `onBlur` (`clampCantidad`), con `clampItem` normalizando vacío/no-numérico → `'0'` (evita que el submit descarte el ítem en silencio). La validación de submit queda como guarda final. Test de regresión 10→4→(6 pendientes) + edición sin revertir + normalización en blur (8/8).
- **(1) Presentaciones** (backend `837bd3a`, `26ff900`; UI `69953a9`, `b5756ed`). Backend: `presentacionEliminarHandler` (borrado **físico** sólo si la presentación no tiene historial en **ninguna** de las 4 FK —`venta_detalle`, `lista_precio_valor`, `presupuesto_detalle`, `price_batch_detalle`—; si tiene → baja lógica; bloquea la default con `NO_ELIMINAR_DEFAULT`) y `presentacionReactivarHandler` (reactiva; `GTIN_DUPLICADO` si **otra** activa —excluyendo el propio id— usa el gtin). UI (`PresentacionesPanel`): toda fila no-default es accionable (inactiva → reactivar + eliminar; activa → eliminar + ★ + desactivar), la × pasó a papelera y suma `confirm()` antes de borrar; la default sólo Editar. 21/21 backend + 4/4 UI.
- **(3) Búsqueda por EAN** (`0d8ec31`, `65939c8`). `like(gtin_barcode)` sumado al OR de `busqueda` en `buildProductoWhereClause` **y** en `productoQueryAll` (listado y exportación consistentes); placeholder del input actualizado; se invirtió el test previo que afirmaba lo contrario (documentado). 59/59.

**Nota — la nullabilidad de `gtin_barcode` en `LIKE`:** en SQLite `LIKE` contra `NULL` evalúa `NULL` (falsy en el `OR`), así que no rompe ni degrada el filtro.

**Hallazgo abierto (fuera de ADR-066, requiere schema):** `ux_pp_gtin` es único **sin** condicionar por `activo`, por lo que dar de baja una presentación **no libera** su GTIN para reusarlo en una nueva presentación; el chequeo `GTIN_DUPLICADO` en reactivar es defensivo (sólo alcanzable por merge de sync, ADR-012). Si se quiere permitir reusar el GTIN tras la baja, es un cambio de índice → su propio ADR.

**Pendiente:** verificación manual en la app (`pnpm dev` como Supervisor): recepción parcial 10→4; eliminar/reactivar/★ en Detalle de Producto; buscar por EAN parcial en Productos.

---

## ADR-067 — Sinónimos de búsqueda del catálogo (expansión acento-insensible, abreviaturas, marcas) con ABM e importación CSV

- **Fecha:** 2026-08-17
- **Estado:** Aceptado — implementado
- **Release:** `1.1.x`. Feature nueva detrás del flag `sinonimos_habilitado` (default `false`, doctrina ADR-042/044). Migraciones aditivas (0036/0037).
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** patrón de dominios IPC (`register*Handlers` + namespace de preload + pantalla en `AppShell`, ver CLAUDE.md §Navegación); flags en `parametros_sistema` (ADR-042/044); `productoListHandler` como punto de búsqueda de Productos y POS.

> **Nota de numeración.** Este trabajo se desarrolló rotulado provisionalmente como "ADR-063"; mientras se implementaba, el índice incorporó **ADR-063** (matching producto interno ↔ producto proveedor por similitud de nombre) y hasta el 066. Se renumeró a **067** (siguiente libre) en todo el código, migraciones (`0036_adr067_*`, `0037_adr067_*`) y tests.
>
> **Solapamiento con ADR-063 — revisado 2026-08-17.** ADR-063 (Lotes 2-3, aún NO implementados) planeaba tres objetos que ADR-067 ya construyó: una columna normalizada en `producto` (`nombre_norm` vs `nombre_corto_norm`), un `normalizar()` canónico en `packages/shared`, y un diccionario de sinónimos (`termino_equivalencia` vs la tabla `sinonimo`). Decisión tomada con el owner: **unificar el normalizador ahora** — se creó `packages/shared/src/texto.ts` (`normalizar`, measure-aware: canoniza `6 × 40 → 6x40`, preserva unidades) como **única función de normalización**, que ADR-067 ya consume (vía re-export en `main/sinonimos/normalizar.ts`). ADR-063 Lote 2 debe adoptar este `normalizar()` (en vez de crear otro) y Lote 3 debe **reutilizar la tabla `sinonimo`** (más rica: grupos, abreviaturas, ABM, import) como diccionario en vez de `termino_equivalencia`; la columna normalizada de `producto` debe consolidarse en una sola. Pendiente al retomar ADR-063: reconciliar el nombre de la columna y superseder el `norm()` privado de `geo-seed`.

### Contexto

La búsqueda de productos (Productos y POS) era un `LIKE '%texto%'` sobre `nombre_corto`/`sku`: no encontraba un producto si el cliente lo nombraba distinto de como está cargado ("pinza" vs "alicate", "foco" vs "lámpara", "Phil." vs "Philips"), ni toleraba acentos o abreviaturas de mostrador. Se pidió un diccionario de sinónimos del rubro, cargable y editable.

### Decisión

**Modelo de datos.** Tabla `sinonimo` (migración 0036): un **grupo** = filas que comparten `grupo_id`; una lleva `es_canonico`. `termino_norm` guarda la forma normalizada (minúsculas, sin acentos). `es_abreviatura` marca términos **solo-entrada**. `origen` (`seed|manual|import`). Flag `sinonimos_habilitado` sembrado en `false`.

**Búsqueda (con el flag encendido).** `productoListHandler` normaliza lo tipeado, busca el/los grupo(s) que contienen ese término y expande a los términos hermanos; el término propio + los hermanos se matchean **acento-insensible** contra `producto.nombre_corto_norm` (columna nueva, migración 0037, mantenida en alta/edición/import/seed y backfilleada al arrancar) y contra `marca.nombre` (marcas ASCII). Con el flag apagado, `matchNorm=[]` → comportamiento idéntico al previo.

**Abreviaturas solo-entrada.** Una abreviatura ("torn.", "bul.", "phil.") **dispara** la expansión al tipearla pero **nunca** se emite como patrón de substring — así "tornillo" no arrastra "destornillador". Es la razón de `es_abreviatura`.

**Match por marca.** Los términos normalizados también matchean `marca.nombre`, para que "phil" traiga los productos marca Philips aunque el nombre no la mencione.

**Dataset base.** ~154 grupos curados para ferretería AR (regionalismos, coloquiales, técnicos, inglés, errores de tipeo, abreviaturas y marcas), **embebidos como CSV en TS** (inline, sin extraResources) y parseados en carga; sembrados por `runSinonimoSeed` en el first-run (idempotente, `origen='seed'`).

**ABM (Configuración → Sinónimos, Supervisor).** Alta/edición/baja lógica por grupo, búsqueda, y **toggle del flag** desde la misma pantalla (vía `parametros:set`). **Importación CSV** con preview (parseo + validación sin escribir) y opción "reemplazar importaciones anteriores" (no toca `seed` ni `manual`). El **validador** (columnas, canónico vacío, término vacío, duplicado intra-grupo, mismo término en varios grupos) y el **parser CSV** los comparten el seed y el import.

### Fuera de alcance

- El **matcheo producto↔proveedor** de la importación (ADR-063): es otro subsistema.
- Búsqueda difusa/typo-tolerante más allá de acentos (Levenshtein): sólo normalización + sinónimos explícitos.

### Consecuencias

- Con el flag encendido, la búsqueda de Productos/POS encuentra por sinónimo, abreviatura y marca, sin importar acentos. Apagado (default), sin cambios.
- `producto` gana `nombre_corto_norm` (nullable, backfill al arrancar); todos los caminos de escritura de producto la mantienen.

### Implementación (2026-08-17)

Nuevos: `src/main/db/schema/sinonimos.ts`, migraciones `0036_adr067_sinonimos.sql` (+flag) y `0037_adr067_nombre_norm.sql`, `src/main/sinonimos/{normalizar,dataset,seed,buscar,validar,csv,backfill}.ts`, `src/main/ipc/sinonimo.ts` (ABM + import), `src/renderer/views/config/ConfigSinonimos.tsx`. Modificados: `base-seed/index.ts` (siembra), `startup.ts` (backfill), `ipc/producto.ts` (expansión + `nombre_corto_norm` + join marca), `ipc/importar.ts`/`base-seed/demo-catalog.ts`/`dev-seed/catalog.ts` (mantienen `nombre_corto_norm`), `schema/catalog.ts`, preload, `main/index.ts`, `routes/index.tsx`, `AppShell.tsx`. **Tests:** `sinonimos/__tests__/{seed,validar,csv}.test.ts`, `ipc/__tests__/{producto.sinonimos,sinonimo.handlers,sinonimo.import}.test.ts`, `renderer/.../ConfigSinonimos.test.tsx`. **Verificación:** `tsc --noEmit` limpio; **ambos runners en verde**. **Pendiente de cierre manual:** `pnpm dev` → Configuración → Sinónimos → activar el flag; en Productos/POS buscar "foco"/"phil"/"torn." y confirmar resultados; probar Importar CSV.

---

## ADR-068 — Reuso de GTIN de presentación tras baja: condicionar `ux_pp_gtin` por `activo`

**Fecha:** 2026-08-19
**Estado:** Aceptado — implementado (2026-08-19; migración de índice + guards con test de regresión, archivo de tests en verde 25/25 — ver §Implementación). Redactado y aceptado el mismo día tras superar el gate de schema (OK del PO).
**Release:** `1.1.x` (sobre el núcleo local, sin feature flag — es una corrección de schema sobre `producto_presentacion`, no una feature nueva). **Toca schema → tiene gate de schema.**
**Decisores:** Joaquín (product owner) · Claude (asesor técnico)
**Marco:** ADR-040 (`producto_presentacion`: `es_default`, `activo`, `sin_confirmar`, `gtin_barcode` nullable; índices únicos parciales `ux_pp_default` por `producto_id WHERE es_default=1` y `ux_pp_gtin` por `gtin_barcode` no nulo — sólo en la migración SQL, no en el schema Drizzle). ADR-066 §"Hallazgo abierto" (de donde surge esto). ADR-012 (conflictos de sync: last-write-wins + log). CLAUDE.md §4 (identidad del producto: `sku` opaco + `gtin_barcode`; `producto_presentacion` tiene su propio `gtin_barcode` para escanear la caja/bulto), §7 (tabla `producto_presentacion`; "índices únicos parciales sólo en la migración SQL"), §12 (TDD; gate de schema; migraciones aditivas/retrocompatibles con `_journal.json` mantenido a mano).

### Contexto

El índice único de GTIN de presentaciones **no está condicionado por `activo`**:

```sql
-- 0022_adr040_presentaciones.sql:48-50
CREATE UNIQUE INDEX `ux_pp_gtin`
  ON `producto_presentacion` (`gtin_barcode`)
  WHERE `gtin_barcode` IS NOT NULL;
```

Compárese con `ux_pp_default` (líneas 52-54), que **sí** condiciona (`WHERE es_default = 1`).

**Consecuencia (causa raíz confirmada):** al dar de **baja** una presentación con GTIN —vía `presentacion:desactivar` (`presentacion.ts:157`) o la baja lógica de `presentacion:eliminar` cuando la presentación tiene historial (`presentacion.ts:193-201`)— ese GTIN **sigue ocupando** el slot único. No se puede crear una presentación nueva que reuse ese código de barras, ni reactivar otra con el mismo GTIN. Localmente es **imposible** tener dos filas (activas o no) con el mismo GTIN.

**Estado del código relevante (verificado):**

- `presentacionBuscarPorGtinHandler` (el scan de POS) ya filtra `activo=true` (`presentacion.ts:246-249`) → no asume unicidad global.
- `presentacionReactivarHandler` tiene un guard defensivo `GTIN_DUPLICADO` que excluye el propio id y filtra `activo=true` (`presentacion.ts:216-226`); **hoy sólo es alcanzable por un merge de sync entre orígenes** (ADR-012), porque el índice global impide la situación en uso normal.
- `presentacionCreateHandler` (`presentacion.ts:75-104`) y `presentacionUpdateHandler` (`presentacion.ts:106-135`) **no** tienen guard JS de colisión: confían en el índice de la BD (una colisión activa-activa hoy tira un error crudo de constraint SQLite, no un `GTIN_DUPLICADO` amigable).
- La **importación** (`importar.ts`) opera sobre `producto.gtin_barcode` (maestro), **nunca** sobre el GTIN de presentación → tampoco asume unicidad global de presentación. El alta/import de presentaciones no tiene otro camino que los handlers de arriba.

### Decisión

**(A) Condicionar el índice único de GTIN de presentación por `activo`.** Sólo las presentaciones **activas** exigen GTIN único; la baja **libera** el código sin perder el dato (`gtin_barcode` se conserva en la fila inactiva y se restaura al reactivar).

1. **Migración nueva `0039_adr068_gtin_activo.sql`:**

   ```sql
   -- ADR-068: reuso de GTIN de presentación tras baja — condicionar ux_pp_gtin por activo
   DROP INDEX `ux_pp_gtin`;
   --> statement-breakpoint
   CREATE UNIQUE INDEX `ux_pp_gtin`
     ON `producto_presentacion` (`gtin_barcode`)
     WHERE `gtin_barcode` IS NOT NULL AND `activo` = 1;
   ```

   Más su entrada en `_journal.json` (idx 39, tag `0039_adr068_gtin_activo`, `when` mayor al último — hoy `0038` está en `1793923200000`). **La recreación es segura sin data-fix:** como el índice vigente es globalmente único, hoy es imposible tener dos filas con el mismo GTIN, así que no hay datos en conflicto al recrear el índice como parcial-sobre-activas.

2. **Guard JS de colisión en `create`/`update`** (decisión tomada — por consistencia con `reactivar` y para dar un `GTIN_DUPLICADO` amigable en vez del error crudo de SQLite). Replica exactamente lo que el índice parcial exige (unicidad activa-activa), pero con mensaje claro:
   - `create`: la fila nace `activo=true`; si el `gtin_barcode` colisiona con **otra** presentación **activa**, lanza `GTIN_DUPLICADO`.
   - `update`: sólo chequea cuando la fila destino **está activa** (el índice sólo cubre activas; una inactiva puede llevar cualquier GTIN); excluye el propio id.
   - El guard de `reactivar` no cambia — pero deja de ser sólo defensivo: pasa a ser **genuinamente alcanzable** en uso normal (dos inactivas pueden compartir GTIN; al reactivar una, si hay otra activa con ese GTIN, se rechaza).

### Migración y compatibilidad

- **Aditiva/retrocompatible:** es un swap de índice (DROP+CREATE), sin cambio de columnas ni de datos; no rompe migraciones anteriores ni el backup/restore (`__drizzle_migrations` sigue siendo la fuente de verdad). El `producto_presentacion` de Drizzle no declara este índice (política de §7: índices únicos parciales sólo en SQL), así que no hay drift de schema Drizzle.
- **Sync (ADR-012):** el índice más laxo **reduce** la posibilidad de conflicto local; el caso activa-activa entre orígenes lo siguen cubriendo el índice (activas) y el guard de `reactivar`/`create`/`update`.

### Rechazado

- **(B) NULL-ear `gtin_barcode` al dar de baja** (mantener índice global). Libera el slot pero **pierde el dato**: al reactivar, la presentación queda sin su GTIN y hay que recargarlo a mano. Menos limpio; descartado.
- **(C) Status quo + documentar la limitación.** No toca schema, pero deja el defecto real (la baja no libera el GTIN, el reuso es imposible). Se prefiere corregir la causa.

### Consecuencias

- (+) Dar de baja una presentación **libera** su GTIN: se puede crear una presentación nueva con ese código, o reactivar otra que lo use. El dato se conserva en la fila inactiva.
- (+) `create`/`update` devuelven `GTIN_DUPLICADO` amigable ante colisión con una activa, consistente con `reactivar`; se elimina el error crudo de SQLite en ese camino.
- (+) El guard de `reactivar` pasa de defensivo (sólo sync) a genuino.
- (−) Dos presentaciones **inactivas** pueden compartir GTIN (y una inactiva puede compartirlo con una activa). Es el comportamiento buscado; el índice (activas) + los guards garantizan que **nunca** haya dos activas con el mismo GTIN, que es la invariante que importa para el scan.

### Gate

**Gate de schema — ACTIVO.** Este ADR se redacta como **Propuesto** y el trabajo **frena acá** hasta el OK del PO. Recién entonces se sigue el flujo de §12:

1. **writing-plans** → plan escrito y revisado.
2. **TDD (RED-GREEN-REFACTOR)** con test de regresión del reuso de GTIN:
   - baja de una presentación con GTIN → crear otra (o reactivar otra) con el mismo GTIN **funciona**;
   - dos presentaciones **activas** con el mismo GTIN siguen **bloqueadas** (índice + guard `GTIN_DUPLICADO` en `create`/`update`);
   - reactivar cuando ya hay una activa con ese GTIN → `GTIN_DUPLICADO`.
   - Los tests corren bajo el runner del **main process** (NMV de Electron; `scripts/test-node.cjs`), donde viven `presentacion.handlers.test.ts` y `createTestDb()` aplica todas las migraciones.
3. **Verificación manual** en la app (`pnpm dev` como Supervisor, navegando como el usuario — §Navegación): en Detalle de Producto → Presentaciones, dar de baja una con GTIN y reusar ese GTIN en una nueva/reactivada.

### Implementación (2026-08-19)

Rama `feat/adr-068-gtin-reuso`. TDD RED→GREEN por ítem (plan en `docs/superpowers/plans/2026-08-19-adr068-gtin-reuso.md`).

- **Migración `0039_adr068_gtin_activo.sql`** (+ entrada idx 39 en `_journal.json`, `when` 1794009600000): `DROP INDEX ux_pp_gtin` + recreación como parcial `WHERE gtin_barcode IS NOT NULL AND activo = 1`. Sin snapshot en `meta/` (el proyecto no los mantiene por migración; `migrate()` sólo usa el `.sql` + journal). RED previo: crear una segunda presentación con el GTIN de una dada de baja lanzaba `UNIQUE constraint failed`; GREEN tras la migración.
- **Guards `GTIN_DUPLICADO`** en `presentacion.ts`: `presentacionCreateHandler` (colisión contra activas; la nueva nace activa, sin id propio que excluir) y `presentacionUpdateHandler` (sólo si la fila destino está activa y se setea un GTIN no nulo; excluye el propio id). Reemplazan el error crudo de SQLite por el mismo mensaje que ya usaba `reactivar`.
- **Test de reactivar-colisión** simplificado: se quitó el hack `DROP INDEX` (simulaba un merge de sync ADR-012) porque el escenario "una inactiva + una activa con el mismo GTIN" ahora es **nativo**; se quitó el import de `sql` que quedó sin uso.
- **Comentario de schema** (`catalog.ts`) actualizado: `UNIQUE (gtin_barcode) WHERE gtin_barcode IS NOT NULL AND activo = 1 (ADR-068)`.
- **Tests** en `presentacion.handlers.test.ts`: `libera su GTIN para una nueva`, `create rechaza GTIN_DUPLICADO`, `update rechaza GTIN_DUPLICADO`, `update permite tomar un GTIN que sólo tiene una inactiva`, + refactor del de reactivar. **Archivo en verde: 25/25.**
- **Pendiente de cierre:** verificación manual en la app (`pnpm dev`) según el paso 3 del gate.
---

## ADR-074 — Sustitutos curados entre productos (equivalentes + reemplazos) y flag `discontinuado`

- **Fecha:** 2026-08-25
- **Estado:** Aceptado — Fase 1 (fundación) implementada
- **Release:** `1.1.x`. Feature nueva detrás del flag `sustitutos_habilitado` (`parametros_sistema`, default `false`), migración aditiva. Sin cambios de comportamiento con el flag apagado.
- **Decisores:** Joaquín (product owner) · Claude (asesor técnico)
- **Marco:** Complementa —no reemplaza— la **búsqueda por similitud automática** por nombre (matcher token-set, ADR-063/067/073). Acá las relaciones son **curadas y explícitas**: el operador/supervisor declara qué producto equivale o reemplaza a cuál. Reutiliza el resolvedor de precio `getPrecioEnListaHandler` (ADR-049 §9) para mostrar el precio final informado. Permisos: se reutiliza `producto.editar` (ambos roles), sin permisos nuevos.

### Contexto

No existía ninguna relación de sustitutos entre productos (sólo `producto_padre_id`, que modela variantes padre-hijo, cosa distinta). Dos necesidades del mostrador: (1) ofrecer una **alternativa equivalente** cuando el producto pedido no está o es de otra marca ("también te sirve este"); (2) registrar que un producto **fue reemplazado** por otro (por el fabricante/proveedor) y que está entrando en discontinuación —se sigue vendiendo hasta agotar stock, pero se marca y se ofrece su sucesor.

### Decisión

- **Dos tipos de relación** en una tabla `producto_equivalencia`: `equivalente` (**simétrico**: si A equivale a B, B equivale a A) y `reemplazo` (**direccional**: A → reemplazado por B; el inverso "reemplaza a" se deriva por consulta). Una fila dirigida por relación (sin duplicar la inversa); soft-delete por `deleted_at` (patrón `producto_proveedor`/ADR-036).
- **Flag `discontinuado`** (columna nueva en `producto`, default `false`): no impide vender (eso lo sigue decidiendo `activo` + stock), es un marcador para UI y para excluir de sugerencias de compra.
- **Servicio** (`equivalencia.list/add/remove` + `setDiscontinuado`) bajo `catalogo.producto.*`, session-gated como el resto de `producto.ts` (permiso `producto.editar` gateado en el renderer). `list` devuelve tres grupos (`equivalentes` / `reemplazado_por` / `reemplaza_a`) **enriquecidos** con precio final (via `getPrecioEnListaHandler` × factor de presentación default), stock, marca y `discontinuado`; excluye relacionados inactivos. Integridad en el handler: sin auto-relación, sin duplicado activo, sin inversa duplicada para `equivalente`.
- **UI Fase 1:** `EquivalenciasPanel` en el detalle de producto (ABM por buscador + toggle `discontinuado`), detrás del flag.

### Fuera de alcance (Fase 2 y futuro)

- **Consumidores** de la relación: POS (ofrecer alternativa al elegir un producto discontinuado/sin stock), badge en el listado de Catálogo, sugerencia en Presupuesto → **Fase 2**, plan propio.
- Fusión/merge de productos; historial/cadena de reemplazos con timeline; sugerencia **automática** sin curar (eso lo da el matcher de ADR-073).
- Activar `sustitutos_habilitado` en producción (queda `false`).

### Consecuencias

- El detalle de producto gana un panel para curar equivalentes/reemplazos y marcar discontinuado, todo inerte hasta encender el flag.
- La relación queda lista para que los consumidores de Fase 2 la lean con el mismo servicio enriquecido.
- **Merge-time (resuelto):** al integrar `feat/menu-nativo` (que trae la cadena ADR-063→073, migraciones 0036-0040) sobre `main`, se conservó **`0036_sustitutos_equivalencia.sql`** (ya en `main`) y se **renumeró** la cadena de menu-nativo a **`0037`-`0041`** (`0037_adr067_sinonimos` … `0041_adr073_busqueda_similares_flag`) en `meta/_journal.json`, con `when` únicos y crecientes.

### Implementación (2026-08-25)

Rama `feat/sustitutos-curados` (sobre `main`), 4 commits, TDD. Migración `0036_sustitutos_equivalencia.sql` + entrada en `meta/_journal.json` (`ALTER producto ADD discontinuado`, `CREATE TABLE producto_equivalencia` con índices y único parcial `WHERE deleted_at IS NULL`, seed del flag). Servicio `src/main/ipc/equivalencia.ts` + `setDiscontinuadoHandler` en `producto.ts` + wiring preload/register. UI: hooks `useSustitutosHabilitado`/`useEquivalencias` + `EquivalenciasPanel` montado en `ProductoDetalle`. Cobertura: `sustitutos_schema.test.ts` (3), `equivalencia.handlers.test.ts` (8, incl. simetría/dirección/integridad/UNAUTHENTICATED), `EquivalenciasPanel.test.tsx` (3). Verificación: **ambos runners en verde** — renderer **84 archivos / 574 tests**, main **83 archivos / 1030 tests** — más `pnpm typecheck` limpio. **Pendiente:** verificación manual en la app real (abrir `pnpm dev`, encender el flag, curar relaciones y togglear discontinuado) y la Fase 2 (consumidores).

---

## Bitácora del ADR-Log

Registro de cambios sobre **este documento** que no son ADRs nuevos: fe de erratas,
correcciones de índice, normalización de vocabulario y secciones de implementación
agregadas a posteriori. Ninguna entrada de esta bitácora altera una decisión aceptada.

### 2026-07-24 — Remediación AUD-20260723, Lote 0

Origen: auditoría `docs/Auditoria/AUDIT-20260723.md`, hallazgos 003, 006, 010, 014 y 015.

1. **[AUD-003] Índice: ADR-038 figuraba como "Cancelada".** El cuerpo lo declara aceptado,
   tiene sección `### Implementación (2026-07-14)` y el código está en producción
   (`ipc/dashboard-caja-rango.ts`, `dashboard-clientes.ts`, `dashboard-proveedores.ts`,
   migración `0020_adr038_dashboard_fase2.sql`, vistas `renderer/views/dashboard/{caja,clientes,proveedores}/`).
   Corregido a **`Aceptado — implementado`** en el índice y en el cuerpo. Se alineó además
   el título del índice con el del cuerpo ("Dashboard, fase 2 …").
   El título de la fila 037 ya coincidía con su cuerpo; sin cambios.

2. **[AUD-006] Fe de erratas de numeración cruzada.** Se corrigieron citas que apuntaban a
   ADRs equivocados. Ninguna decisión cambia; cambia a qué ADR remite el texto:

   | Ubicación | Decía | Dice |
   |---|---|---|
   | ADR-037 §1 y ADR-038 §Contexto | `comprobante_fiscal` (ADR-034) | módulo fiscal R2 / ADR-013 (Propuesto) |
   | ADR-038 §Release, §Contexto (×2), §Decisión 1 (×2) | ADR-036 | ADR-037 |
   | ADR-039 §Contexto, §Decisión 1, §Consecuencias | ADR-034 / ADR-036 | ADR-013 / ADR-037 |
   | ADR-025 §4 y §5 | capa de impresión de etiqueta (ADR-027) | ADR-026 |
   | ADR-046 §10 | `printToPDF` (patrón ADR-027) | ADR-026 |
   | ADR-047 §13 | extensión de ADR-030 | ADR-028 |
   | ADR-048 §6 | `email` a `usuario` (ADR-029 no lo incluía) | ADR-027 |

   ADR-034 es el Motor de Precios y ADR-027 es autenticación: nada fiscal ni de impresión
   vive en ellos. La errata ADR-026→ADR-027 se había propagado al código
   (`packages/client/src/main/ipc/print.ts:14`), corregida en el mismo lote.

3. **[AUD-010] ADR-040 — sección "Correcciones de implementación (2026-07-24)".** Cierra la
   escala de `factor_a_stock`, que el ADR había dejado "a confirmar": queda **`REAL`
   (default `1.0`)** con descuento de stock **sin dividir por 1000**, porque
   `existencias.stock_fisico` es `real`. **No hubo cambio de código**: el desvío era
   documental. Sigue el patrón de la sección homóloga de ADR-045.

4. **[AUD-014] Vocabulario de estados (§0).** La enumeración declaraba cinco estados
   (`Propuesto · Aceptado · Rechazado · Superseded · Deprecado`) mientras el índice usaba
   además `Aceptada`, `Cerrado`, `Diferida`, `Cancelada`, `Implementado` y las formas
   compuestas `— implementado` / `— Lote N implementado`. Se reemplazó por una tabla con
   los estados realmente en uso y su significado, y se **unificó el género en masculino**
   (`Aceptado`), aplicado parejo en el índice y en el campo `**Estado:**` de cada cuerpo.
   Normalizaciones puntuales: `Implementado` → `Aceptado — implementado` (ADR-043),
   `Aceptado · Implementado 2026-07-16` → `Aceptado — implementado (2026-07-16)` (ADR-041,
   también en su fila del índice), `Aceptado` → `Aceptado — Lote 1 implementado` en el
   cuerpo de ADR-047 para que coincida con su fila del índice.

5. **[AUD-015] ADR-035 promovido de `###` a `##`.** Estaba anidado dentro del bloque de
   ADR-034, contra el nivel que usan todos los demás.

6. **Bitácora creada.** Este documento no tenía una; la fe de erratas se registra acá desde
   ahora, como pide el protocolo de auditoría (`docs/Auditoria/AUDITOR-TECNICO-v1.1.md` §9).

### 2026-07-31 — Renumeración ADR-051 → ADR-058 (choque entre ramas paralelas)

Esta rama (trabajo de "ajustes varios") y la rama `feat/adr-051-mejoras-carga-masiva`
divergieron del mismo commit de `main` y cada una, sin verse, registró un ADR distinto con
el número **051**: esta rama para "Importación masiva de Clientes/Proveedores: contrato de
columnas completo + fix de sobreescritura de apellido"; la otra rama (con 21 commits ya
implementados) para "Mejoras a la Carga Masiva (importación de costos y catálogo de
proveedor)".

Se decidió, junto con el usuario, dejar intacto el ADR-051 de la otra rama (más grande, ya
implementado en 21 commits con referencias cruzadas en código) y **renumerar el de esta
rama a ADR-058** — número libre confirmado por encima de las reservas 052-057 de un tercer
lote de trabajo, aún sin implementar. Se actualizaron: la fila del índice, el título del
cuerpo, y los dos comentarios `ADR-051` en `packages/client/src/main/ipc/importar.ts`
(líneas cercanas a `PLANTILLAS.clientes`/`PLANTILLAS.proveedores`). No se tocó ningún
commit ya mergeado a `main`: los mensajes de commit históricos de esta fase siguen
mencionando "ADR-051" en su texto y no se reescriben — la numeración correcta para
referencia futura es la de este documento.

### 2026-07-31 — Reserva de números ADR-052 a ADR-057 (lote "Mejoras Varias 31-07")

Se agregaron al índice **seis filas stub en estado `Propuesto`** (052–057) para reservar los
números del lote de mejoras recogido en `docs/Mejoras Varias 31-07.txt` y organizado en
`docs/superpowers/specs/2026-07-31-mejoras-varias-31-07-design.md`. Cada uno tiene su prompt de
Superpowers en `docs/ADR-05N - <título>.txt`.

- **Son reservas, no ADRs completos:** todavía **no tienen cuerpo** en este documento. La regla
  de §0 ("el índice y el `**Estado:**` del cuerpo deben coincidir") aplica recién cuando cada
  sesión escriba su sección; hasta entonces la ausencia de cuerpo es deliberada y no es un
  hallazgo de auditoría.
- Cada sesión que implemente su ADR debe **actualizar la fila** (no agregar una nueva) al estado
  que corresponda (`Aceptado` / `Aceptado — implementado`) y **agregar la sección al final** del
  documento.
- El número **050** sigue siendo el borrador suelto de otra sesión (`docs/ADR-050 - Costos reales
  de compra en OC.md`), no mergeado; esta reserva no lo toca.
- **Decisiones de producto ya cerradas** que estos stubs presuponen: ADR-054 **supersede
  parcialmente a ADR-051** (unifica la Cola de Revisión como tab); ADR-053 hace búsqueda de
  ubicación **textual, sin QR** (no reabre ADR-005/025).

### 2026-08-01 — ADR-054 supersede parcialmente a ADR-051 (Cola de Revisión como tab)

ADR-054 (implementado) **reubica la Cola de Revisión de costos como un tab** dentro de la
pantalla unificada "Revisión e Historial de Costos y Catálogo" (`/precios/revision-historial`),
en lugar de la pantalla separada `/precios/cola-revision-costos` que había dejado ADR-051. La
**semántica de la Cola no cambia**: sigue siendo el único lugar donde se re-resuelven las filas
`sin_matchear` (reusa `ColaRevisionCostosView` sin modificaciones de lógica). Se retiraron las
rutas `/precios/cola-revision-costos` y `/precios/historial-costos` (consolidadas, sin redirect).

- **No se editó el cuerpo de ADR-051** ni se cambió su `**Estado:**` (`Aceptado — implementado`):
  el vocabulario del log (§0) no tiene un estado "parcialmente superseded", y la supersesión
  alcanza sólo el punto de la Cola como pantalla separada — el resto de ADR-051 (matching
  estricto, persistencia diferida, formato de columnas fijo, importación de catálogo) sigue
  plenamente vigente. La relación queda documentada acá y en el `**Marco:**`/Consecuencias de
  ADR-054.

---

## ADR-069 — Lote de UI/UX: "clic en toda la fila abre detalle" en los listados restantes, restyle de Sinónimos y POS al CSS estándar, y ajustes de Etiquetas/Ventas/Transportistas

**Fecha:** 2026-08-19
**Estado:** Aceptado — implementado (2026-08-19; TDD por listado, 13 commits en `feat/adr-069-ui-ux-listados`, suite de renderer 627/627 verde — ver §Implementación. Verificación manual en la app pendiente, §12.)
**Release:** `1.1.x` (sobre el núcleo local, sin feature flag — es un lote de correcciones de UI/UX, no una feature nueva). **Puramente renderer; sin gate de schema** (no toca migraciones). Única salvedad: agregar la columna EAN en Etiquetas puede requerir **extender una query de solo lectura** para exponer un dato ya existente (`producto.gtin_barcode`); si eso obligara a tocar un handler IPC, se anota pero no cambia el modelo de datos.
**Decisores:** Joaquín (product owner) · Claude (asesor técnico)
**Marco:** ADR-055 (fijó el patrón "clic en toda la fila abre detalle" en `ProveedoresListado` y estandarizó el tab Productos del proveedor — este ADR **generaliza ese patrón** a los listados restantes). ADR-056 (POS: UI estándar, carrito persistente en UI vía store de renderer, botones Cancelar/Confirmar — este ADR **revisita** las divergencias de CSS que hayan quedado fuera de la tabla de ítems). ADR-053 (Listado de Productos: navegación al detalle por el nombre, orden por cabecera). ADR-057 (defaults y layout de Etiquetas). ADR-064 (Ubicaciones vive en Configuración — vecino del nuevo lugar de Sinónimos). ADR-067 (Sinónimos de búsqueda: **el motor**; acá se toca **solo** la UI del ABM `/config/sinonimos`, no la lógica de expansión). CLAUDE.md §Navegación (el único menú es `AppShell.tsx`; una ruta sin ítem es inalcanzable), §12 ("todo cambio con superficie de UI se cierra abriendo la app"). Sistema de Diseño (`docs/Sistema-Diseno-ferreteria.md`): tokens `--pad`/`--rowpad`, clases `.panel`/`.toolbar`/`.table-wrap`, `.p-name`/`.p-sub`/`.p-code`/`.num`.

### Contexto

El proyecto ya tiene un **patrón canónico** de listado con navegación al detalle por clic en toda la fila, establecido por ADR-055 en `views/compras/proveedores/ProveedoresListado.tsx`:

```tsx
const abrirDetalle = () => navigate(`/compras/proveedores/${p.id}`);
<tr tabIndex={0} role="button" aria-label={`Ver detalle de ${p.razon_social}`}
    style={{ cursor: 'pointer' }} onClick={abrirDetalle}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalle(); } }}>
```

Sin embargo, ese patrón **no está aplicado de forma uniforme**. Un relevamiento del renderer (2026-08-19) muestra el estado real por pantalla:

| Sección | Vista | Estado hoy | Qué falta |
|---|---|---|---|
| POS | `views/pos/*` | La **tabla de ítems** (`PosItemsTable`) ya usa `.table-wrap`/`.p-name`/`.num` (ADR-056) | Barras/contenedores (`PosView`, `PosTopBar`, `PosScanBar`, `PosBottomBar`) con estilos inline → alinear divergencias remanentes a tokens/clases estándar |
| Caja | `views/caja/CajaDashboard.tsx` | Tabla de ventas del turno abre `VentaDetalleModal` **solo por el botón** del `numero_interno`. Los movimientos manuales **ya** son fila-clickeable (`<tr onClick>`) | Fila completa → detalle de la venta |
| Producto | `views/productos/ProductosListado.tsx` | **Solo** el `nombre_corto` es `<Link to="/productos/:id">` (ADR-053) | Fila completa → detalle del producto |
| Stock | `views/stock/StockListado.tsx` | Filas con botones Entrada/Ajuste/Merma/Kardex; sin navegación de fila | Fila completa → detalle del producto (`/productos/:id`) |
| Proveedores → tab Productos | `views/compras/proveedores/ProveedorProductosTab.tsx` | CSS estandarizado (ADR-055); filas de vínculos **sin** navegación | Fila completa → detalle del producto |
| Orden de Compra | `views/compras/ordenes/OrdenesCompraListado.tsx` | **Solo** el `numero_interno` es `<Link to="/compras/ordenes/:id">` | Fila completa → detalle de la OC |
| Ventas | `views/reportes/ReporteVentasView.tsx` | Fila abre `VentaDetalleModal` **solo por el botón** del nro; fecha con AM/PM; nro de venta parcea a 2 líneas | Fila completa → detalle; fecha HH:MM 24h; nro en una línea |
| Transportistas | `views/remitos/transportistas/TransportistasListado.tsx` | `razon_social` es `<Link a /editar>`; filas más bajas que el resto | Fila completa → detalle; igualar densidad/look&feel |
| Sinónimos | `views/config/ConfigSinonimos.tsx` | Tabla y toolbar con **estilos inline** (no `.panel`/`.toolbar`/`.table-wrap`); vive en el menú **Sistema** | Restyle a estándar; fila completa → edición; **mover el ítem a Configuración, debajo de Ubicaciones** |
| Etiquetas | `views/etiquetas/EtiquetasView.tsx` | SKU en gris (`p-code`); sin columna EAN; multi-selección con checkbox; sin navegación de fila | SKU en negro; columna EAN; fila → detalle del producto; volver preservando la selección |

**Dos hallazgos que acotan el alcance:**

1. **El "volver" ya es genérico.** `ProductoDetalle` (`views/productos/ProductoDetalle.tsx:37`) vuelve con `navigate(-1)`, que regresa a la pantalla de origen por historial. Para **Stock** y para el **tab Productos del proveedor**, "volver" funciona sin trabajo adicional (solo verificación). El caso especial es **Etiquetas**: al volver, la vista se **desmonta** y `selectedIds` (estado local) se reinicia — ahí sí hace falta **persistir la selección**.

2. **El SKU gris es una clase compartida.** `.p-code { color: var(--ink-3); }` (`styles/global.css:460`) es lo que pinta el SKU en gris — y la usan **también** `ProductosListado` y `StockListado`. El pedido está acotado a **Etiquetas**; se corrige ahí (quitando `p-code` del SKU) y se deja constancia de que, si se quisiera "negro en todos los listados", es una decisión aparte (ver Decisiones abiertas).

### Decisión

**Adoptar el patrón canónico de ADR-055 como estándar de navegación de listados** y aplicarlo a las pantallas faltantes, junto con un lote de correcciones de look&feel. Todo con `stopPropagation` en las acciones por-fila (editar, eliminar, checkbox, botones de stock) para que el clic de navegación no las pise, y operable por teclado (tabIndex/Enter/Space), respetando accesibilidad como en ADR-055.

Por sección:

1. **POS** — **Envolver el área de ítems en un `.panel`.** Divergencia concreta confirmada por el PO (2026-08-19): a medida que se agregan productos, la lista se ve sobre el **fondo gris** de la app, **sin** el formato de tarjeta blanca con bordes redondeados del resto de los listados. Causa raíz verificada: `PosItemsTable` envuelve la tabla solo en `.table-wrap` (`{ flex:1; overflow:auto }`, sin fondo/borde/radio — `global.css:432`), dentro de un `<div style={{ flex:1, overflowY:'auto' }}>` de `PosView`; **falta el `.panel`** (`{ background:var(--surface); border; border-radius:var(--radius); box-shadow }` — `global.css:305`) que sí tienen `ProveedoresListado`/`ProductosListado`. Fix: dar al contenedor de ítems el formato `.panel` (fondo blanco `--surface`, borde `--line`, radio `--radius`, sombra), respetando el estado vacío ("Sin productos — escanee o busque un artículo") y el layout flex existente. No reabre el modelo de pago (ADR-032), el carrito persistente ni el flujo Cancelar/Confirmar (ADR-056): solo presentación. Verificar en la app si quedan otras barras (`PosTopBar`/`PosScanBar`/`PosBottomBar`) con inline styles fuera de estándar, pero el pedido concreto es la tarjeta blanca del área de ítems.

2. **Caja** — La `<tr>` de la tabla de ventas del turno abre `VentaDetalleModal` (`setDetalleVentaId(v.id)`) al clic en cualquier celda; `stopPropagation` en acciones por-fila si las hubiera. Referencia interna: los movimientos manuales del mismo componente, que ya son fila-clickeable.

3. **Producto** — Fila completa de `ProductosListado` navegable a `/productos/:id` con el patrón canónico. El `<Link>` del nombre puede quedar o absorberse en el clic de fila (sin doble navegación).

4. **Stock** — Fila completa de `StockListado` navegable a `/productos/:id`; `stopPropagation` en los 4 botones (Entrada/Ajuste/Merma/Kardex). "Volver" a Stock ya funciona por `navigate(-1)` de `ProductoDetalle` (verificar).

5. **Proveedores → tab Productos** — Fila de vínculos de `ProveedorProductosTab` navegable a `/productos/:productoId`; `stopPropagation` en las acciones del tab (desasociar / editar costo). "Volver" regresa al detalle del proveedor por historial.

6. **Orden de Compra** — Fila completa de `OrdenesCompraListado` navegable a `/compras/ordenes/:id`.

7. **Ventas** (`ReporteVentasView`):
   - Fila completa → `setVentaId(row.id)` (hoy solo el botón del nro).
   - **Fecha en HH:MM 24h.** `fmtFecha` ya usa `{ hour: '2-digit', minute: '2-digit' }` pero sin `hour12`, y el runtime lo renderiza con AM/PM. Fix: agregar **`hour12: false`** a `toLocaleTimeString` para forzar 24h y acortar la fila.
   - **Nro de factura en una línea.** El nro es un botón link-style que parcea a dos líneas; agregar `white-space: nowrap` a la celda/botón del `numero_interno`.

8. **Transportistas** (`TransportistasListado`):
   - Fila completa navegable al **form de edición** `/remitos/transportistas/:id/editar` (decisión confirmada por el PO). No se construye una vista de detalle read-only: el form **es** el detalle editable, consistente con los otros catálogos simples del proyecto.
   - **Igualar densidad/look&feel.** Las filas quedan más bajas porque la primera columna tiene contenido de una sola línea (sin el envoltorio `.p-name`/`.p-sub` que usan los otros listados). Alinear el markup de la columna al estándar para igualar el `--rowpad` efectivo. Causa exacta a confirmar abriendo la app.

9. **Sinónimos** (`ConfigSinonimos`):
   - **Restyle al CSS estándar:** reemplazar los estilos inline de tabla/toolbar por `.panel` + `.toolbar` + `.table-wrap` + `<table>` global (tomar `ProveedoresListado`/`ProductosListado` como referencia). Sin cambiar datos ni lógica.
   - **Fila completa → edición** del grupo (`editar(g)`), con `stopPropagation` en el botón Eliminar.
   - **Menú:** mover el ítem "Sinónimos" del grupo **Sistema** al grupo **Configuración**, **debajo de Ubicaciones**, en el array `NAV` de `AppShell.tsx` (conservando `permiso: 'usuario.administrar'`). La ruta `/config/sinonimos` **no cambia**. Actualizar el test de `AppShell` que afirma la ubicación del ítem.

10. **Etiquetas** (`EtiquetasView`):
    - **SKU en negro:** quitar la clase `p-code` del SKU (dejar `num`), para que herede el color de texto normal. **Solo en Etiquetas** (decisión confirmada por el PO): `ProductosListado` y `StockListado` conservan `p-code`, no se toca el look&feel global del SKU.
    - **Columna EAN:** agregar columna con `producto.gtin_barcode`. **Verificar que la query/hook de etiquetas traiga el EAN**; si el dato no está expuesto, **PARÁ y avisá** antes de tocar IPC (patrón ADR-055) — no se agregan columnas nuevas al esquema, el dato ya existe en `producto`.
    - **Fila completa → `/productos/:productoId`,** con `stopPropagation` en el checkbox de selección (el checkbox sigue siendo el control explícito de selección; el resto de la fila navega).
    - **Volver preservando la selección Y los filtros:** al volver con `navigate(-1)`, Etiquetas se desmonta y su estado local se pierde. **Decisión confirmada por el PO:** persistir tanto la **selección de tildes** (`selectedIds`) **como los filtros aplicados** (búsqueda por nombre/SKU y los `<select>` de la toolbar), para no perder el trabajo en curso. Elevar/persistir ese estado fuera del ciclo de vida de la vista — store/context de renderer análogo al carrito persistente de ADR-056, o `sessionStorage` (se elige en el plan). **Ítem de mayor alcance técnico del lote.**

### Fuera de alcance (NO tocar)

- **Esquema/migraciones.** No se agregan columnas ni tablas. La única lectura nueva posible (EAN en Etiquetas) usa `producto.gtin_barcode`, que ya existe.
- **Lógica de negocio:** venta, caja, stock, precios, motor de sinónimos de búsqueda (ADR-067), modelo de pago (ADR-032), venta en espera (ADR-033). Este ADR es **presentación + navegación**.
- **Rediseñar detalles existentes** (`VentaDetalleModal`, `ProductoDetalle`, `OrdenCompraDetalle`): se **reutilizan** tal como están.

### Decisiones tomadas (confirmadas por el PO, 2026-08-19)

- **(a) Transportistas — destino de la fila:** navega al **form de edición** `/remitos/transportistas/:id/editar`. No se construye detalle read-only.
- **(b) SKU en negro — alcance:** **solo Etiquetas**. Productos y Stock conservan `p-code` (gris); no se cambia el SKU a nivel global.
- **(c) POS — divergencia concreta:** el área de ítems se ve sobre **fondo gris sin tarjeta**; falta el `.panel` (fondo blanco `--surface` + bordes redondeados `--radius` + sombra). Fix acotado a envolver el área de ítems en `.panel` (ver Decisión §1).
- **(d) Etiquetas — qué se preserva al volver:** la **selección de tildes** (`selectedIds`) **y los filtros** (búsqueda + `<select>` de la toolbar). El mecanismo (store/context vs. `sessionStorage`) se define en el plan de implementación.

### Consecuencias

- **Positivas:** interacción uniforme (toda fila de listado abre su detalle), accesible por teclado; Sinónimos y POS dejan de divergir del sistema de diseño; Ventas más compacta y legible; Sinónimos queda junto a Ubicaciones en Configuración, donde el usuario lo busca.
- **Costo/mantenimiento:** al haber varios listados, el patrón de fila-clickeable conviene **factorizarse** (helper o pequeño componente `<FilaNavegable>`), para no repetir el bloque tabIndex/role/onKeyDown en cada vista. Se evalúa en el plan.
- **Riesgo acotado:** `stopPropagation` mal puesto podría romper una acción por-fila (editar/eliminar/checkbox/botones de stock) — se cubre con tests de componente por cada listado (navegación de fila **y** que las acciones no naveguen), como hizo ADR-055.
- **Verificación (§12):** `pnpm test` en verde (ambos runners) + abrir `pnpm dev` y recorrer cada pantalla navegando como el usuario: clic en distintas celdas abre el detalle correcto, las acciones por-fila siguen sin navegar, Sinónimos aparece en Configuración bajo Ubicaciones, Ventas muestra HH:MM y el nro en una línea, y en Etiquetas la selección sobrevive al ir al detalle y volver.

### Implementación (2026-08-19)

Ejecutado con Superpowers (subagent-driven, TDD RED→GREEN por tarea) en la rama
`feat/adr-069-ui-ux-listados`. **Plan:** `docs/superpowers/plans/2026-08-19-adr069-ui-ux-listados.md`.

- **Hook reutilizable** `renderer/hooks/useFilaNavegable.ts` (props `tabIndex/role/aria-label/cursor/onClick/onKeyDown` Enter+Space para esparcir sobre `<tr>`; función pura, sin estado). Consumido por Productos, Stock, OC, tab Productos del proveedor, Transportistas y Etiquetas. Caja y Ventas **no** lo usan: su acción es estado local (`setDetalleVentaId`/`setVentaId`), replican el shape a mano.
- **Clic en fila:** `ProductosListado` (nombre `<Link>`→`<span className="p-name">`), `StockListado` (+`stopPropagation` en `.row-act`), `OrdenesCompraListado` (nro `<Link>`→`<span>`), `CajaDashboard` (fila de ventas del turno), `ProveedorProductosTab` (navega solo la fila display, no la de edición; `stopPropagation` en Preferido y Acciones), `ReporteVentasView`.
- **Ventas:** `fmtFecha` exportada + `hour12: false` (HH:MM 24h, sin AM/PM); nro de venta con `white-space: nowrap` (una línea).
- **Transportistas:** fila → `/remitos/transportistas/:id/editar`; primera columna envuelta en `.p-name` (iguala densidad).
- **Sinónimos:** restyle a `.panel`/`.toolbar`/`.table-wrap`/`.p-name` (se quitaron los estilos inline); fila → `editar(g)`; ítem del menú movido del grupo **Sistema** al grupo **Configuración**, debajo de Ubicaciones (`AppShell.tsx`; ruta y `CRUMBS` sin cambios).
- **Etiquetas:** SKU sin `p-code` (negro, solo acá); nueva columna **EAN** (`gtin_barcode`, dato ya expuesto por `EtiquetaItem` y el handler `etiquetas.listarProductos` — **sin tocar shared ni IPC**); fila → `/productos/:productoId` con `stopPropagation` + `aria-label` en el checkbox; **selección + filtros persistidos en `sessionStorage`** (clave `etiquetas:estado`, lazy-init + efecto de guardado). Se movió el reset `setSelectedIds(new Set())` de `cargarProductos` a `handleFiltroChange`, para que volver del detalle **no** borre la selección (solo la borra un cambio de filtro).
- **POS:** el área de ítems (`PosView`) se envolvió en `.panel` (fondo blanco `--surface`, borde, `--radius`, sombra) con un scroll interno; antes se veía sobre el fondo gris. `PosItemsTable` y las barras, sin cambios.

**Tests:** suite de renderer **627/627 verde** (92 archivos), con tests de componente nuevos por listado (navegación de fila **y** que las acciones por-fila / checkbox no naveguen), 24h de `fmtFecha`, columna EAN, y persistencia de selección al desmontar/montar. Los tests del main process no se tocan (cambios 100% renderer). **Pendiente:** verificación manual abriendo la app (`pnpm dev`), por §12.

**Fe de erratas del plan (corregidas en implementación, no cambian la decisión):** (1) el import del hook desde `views/remitos/transportistas/` es a **3** niveles (`../../../hooks`), no 4; (2) el `role="button"` en `<tr>` de Etiquetas quita el rol implícito `row`, así que los tests de orden preexistentes pasaron de `getAllByRole('row')` a `querySelectorAll('tbody tr')`.

## ADR-070 — Edición del Costo bruto desde el modal de costos del producto (con valor efectivo 0 conservando herencia) y botón "Re-validar" en los Lotes de precios

**Estado:** Aceptado

- **Fecha:** 2026-08-20
- **Marco:** ADR-036 (relación producto↔proveedor N:M con costo + soft-delete), ADR-049 §1 (overrides comerciales por producto, regla `override ?? default ?? 0`, `packages/shared/src/costo.ts`) y §7 (eventos de costo disparan batches), ADR-052 (modal "Ajustes de costo del producto" compactado en el panel Proveedores del detalle de producto).

### Contexto

**A. Modal de costos del producto.** El modal "Ajustes de costo del producto" (`renderer/views/productos/ProveedoresPanel.tsx`, se abre con el lápiz de la fila de proveedor en el detalle del producto) hoy:

1. **No permite editar el Costo bruto** (`producto_proveedor.costo_centavos`). El costo base es solo lectura en la tabla; para cargarlo hay que salir a **Compras → Proveedores → [proveedor] → tab Productos** (`ProveedorProductosTab.tsx`) o a Importar costos. Editando un producto, el PO no encuentra dónde cargar el costo y debe navegar afuera y volver.
2. Los tres campos comerciales heredables (Bonif. %, Cost. fin. %, Flete %) se muestran **vacíos con placeholder gris "hereda"**. Es la representación de "override = null → hereda el default del proveedor" (ADR-049 §1). El PO lo reporta como poco intuitivo: parece que el dato falta, cuando en realidad hereda.

**B. Lotes de precios congelados.** Las filas de un lote (`price_batch_detalle`) se calculan **una sola vez** al crear el lote (`main/precios/motor.ts` → `calcularFilaConLista`) y se persisten como foto. Si después se arregla el producto (se le agrega proveedor preferido + costo), la fila **no se recalcula** y sigue en error "Sin proveedor preferido / sin costo" (`main/precios/validacion.ts:35`). No existe recálculo: la única salida hoy es *Excluir errores* (se pierde la fila) o recrear el lote. Es el dolor original del PO al revisar los lotes.

### Decisión

**(1) Agregar la edición del Costo bruto al modal.** Un campo "Costo bruto ($)" arriba de la grilla de overrides escribe `producto_proveedor.costo_centavos`. Queda editable en los dos lugares (ficha del proveedor y este modal); ambos apuntan a la misma columna, sin fuente de verdad nueva.

- Backend: extender `ProductoProveedorOverridesPatch` y `productoProveedorSetOverridesHandler` (`main/ipc/producto-proveedor.ts`) con `costo_centavos: number`, seteándolo junto a los overrides y **bumpeando los campos de sync** (`version`/`origin_id`/`sync_state`/`updated_at` con el mismo patrón `...sync` que usa `upsert`), que hoy ese handler no toca aunque el costo es campo sincronizable. El preload no cambia: `compras.pp.setOverrides` reenvía el `patch` entero.
- Validación: el costo ingresado debe ser número ≥ 0; vacío/NaN → error visible, no se guarda 0 en silencio.

**(2) Mostrar el valor efectivo (0) en vez de "hereda", conservando la herencia.** Los tres campos heredables se prellenan con el **valor efectivo** (`resolverComponentesComerciales(override, defaults)` de shared): si el proveedor está en su default 0, el campo muestra `0`, no la palabra "hereda". Para no romper la herencia (ADR-049 §1):

- Al guardar, por cada uno de los tres se compara el número ingresado contra el **default del proveedor**: si es **igual** se persiste `null` (sigue heredando); si **difiere**, se persiste el número (override del producto).

**Excepción explícita — Flete $ y Otros $ NO entran en la regla anterior** (no heredan; son componentes solo-producto):

- **Flete $ (`flete_centavos`)** conserva el comportamiento actual: placeholder `peso/vol.`, **vacío = null**. No se prellena en 0 porque `fleteCentavos != null` **pisa** al Flete % (`packages/shared/src/costo.ts`): un `0` literal significaría "flete absoluto 0, ignorá el %", un cambio de cálculo silencioso.
- **Otros $ (`otros_costos_centavos`)**: `?? 0`, así que 0 y null son equivalentes; empty/0 → se persiste `null` para no ensuciar con overrides.

**(3) Botón "Re-validar" en el detalle del lote de precios.** Reejecuta el cálculo/validación de las filas del lote contra el estado **actual** de costos/proveedores/reglas y actualiza estados, costos, márgenes, variación y contadores. Así un producto que se arregló deja de figurar en error sin recrear el lote.

- Backend: nueva función `revalidarBatch(db, id)` en `main/precios/motor.ts` (misma casa que `calcularFilaConLista`, `cargarReglas`, `leerUmbrales`, que son privados del módulo). Corre **solo** si el lote está en `validado` / `validacion_fallida` (los `aprobado`/`publicado`/`revertido` no se tocan). Recarga reglas + umbrales de la lista, y por cada fila **no excluida** reejecuta `calcularFilaConLista(...)` y actualiza la fila (costo neto, precios, márgenes, variación, regla, estado y motivo). **Las filas `excluida` se respetan** (fue una decisión manual del usuario; no se resucitan). Cierra llamando a `recontarBatch(...)` (`main/precios/publicacion.ts`), que recomputa OK/Advertencias/Errores/Excluidas + impacto y setea el estado. Todo en una transacción.
- IPC/preload: canal `priceBatch:revalidar` con guard `config.fiscal` (mismo permiso que Excluir errores/Aprobar); `precios.batch.revalidar(id)` en el preload.
- UI: botón **"Re-validar"** en la barra de acciones de `renderer/views/precios/LoteDetalleView.tsx`, visible cuando el lote está en `validado`/`validacion_fallida` y el usuario tiene `config.fiscal`; al terminar recarga la vista.
- **Sin permisos nuevos, sin migraciones, sin flag nuevo** (vive dentro de la pantalla de lotes de ADR-049).

### Consecuencias

- **Positivas:** el costo se carga desde donde se lo está mirando, sin navegar afuera; los campos comerciales muestran números concretos (más claros que "hereda") sin perder la herencia por proveedor.
- **Riesgo acotado:** la regla "igual-al-default ⇒ null" es la parte delicada; se cubre con tests de componente (guardar sin cambiar ⇒ patch con `null`; cambiar ⇒ número) y de handler (persiste `costo_centavos` + bump de sync). El Flete $ lleva su propio test (vacío ⇒ null, nunca 0).
- **Re-validar cierra el circuito manual:** con el costo editable desde el modal (A) y el botón Re-validar (B), el PO puede arreglar un producto y recuperar su fila del lote sin recrearlo ni navegar afuera.
- **Riesgo acotado (Re-validar):** respetar las filas `excluida` y no tocar lotes ya aprobados/publicados son las reglas delicadas; se cubren con tests de handler. `revalidarBatch` reutiliza `calcularFilaConLista`/`recontarBatch`, así que no duplica la lógica de cálculo ni la de conteo.
- **Deuda que NO se cierra acá:** el disparo **automático** de re-precio al editar el costo (ADR-049 §7, `crearBatchesPorEventoDeCosto`) sigue afuera — hoy solo lo dispara el cambio de preferido. Con el Re-validar **manual** alcanza para el caso del PO; el automático queda anotado como deuda.

### Fuera de alcance (NO tocar)

- Esquema/migraciones: `costo_centavos`, las columnas de override y las de `price_batch*` ya existen (ADR-036/049). **Cero migraciones.**
- Disparo **automático** de batches por costo (ADR-049 §7): queda como deuda (ver Consecuencias).
- La ficha del proveedor (`ProveedorProductosTab`) y la importación de costos: sin cambios (siguen escribiendo la misma columna `costo_centavos`).

### Implementación (2026-08-20)

Ejecutado con Superpowers (subagent-driven, TDD RED→GREEN por tarea) en la rama `feat/adr-070`.
**Plan:** `docs/superpowers/plans/2026-08-20-adr070-costo-bruto-y-revalidar.md`.

- **Parte A — backend** (`313b04c`): `ProductoProveedorOverridesPatch` suma `costo_centavos?: number` (opcional, retrocompat); `productoProveedorSetOverridesHandler` setea el costo condicionalmente y bumpea `...sync`. Preload sin cambios.
- **Parte A — frontend** (`091fe46`): en `ProveedoresPanel.tsx`, campo **Costo bruto ($)** en el modal; los 3 % se prellenan con el valor efectivo (`resolverComponentesComerciales`, 0 en vez de "hereda"); helper `overrideODefault(input, default)` → guarda `null` si el valor == default (sigue heredando), número si difiere. Flete $ sigue vacío = null (nunca 0). Se quitaron los `placeholder="hereda"` de los 3 %.
- **Parte B — backend** (`198bab5`): `revalidarBatch(db, id)` en `precios/motor.ts` (solo `validado`/`validacion_fallida`; reejecuta `calcularFilaConLista` por fila no excluida; respeta `excluida`; cierra con `recontarBatch`; todo en una transacción). Handler `revalidarBatchHandler` (guard `config.fiscal`) + canal `priceBatch:revalidar` en `price-batch.ts`.
- **Parte B — frontend** (`5872dc8`): `precios.batch.revalidar` en el preload; botón **"Re-validar"** en `LoteDetalleView.tsx` (visible en `validado`/`validacion_fallida` con `config.fiscal`).

**Sin migraciones, sin permisos nuevos, sin flag nuevo.** **Tests:** main **1127/1127** (91 archivos) y renderer **634/634** (92 archivos) en verde, con tests nuevos por cada parte (costo bruto + bump de sync; prefill efectivo + herencia + Flete $ null; rescate de fila en error, respeto de excluidas, rechazo de lote aprobado, guard de permiso; botón según estado/permiso). **Pendiente:** verificación manual abriendo la app (`pnpm dev`), por §12; merge de la rama. Deuda que sigue afuera: disparo **automático** de re-precio por costo (ADR-049 §7).

## ADR-071 — Mejoras a los listados de precios: lista en el detalle del lote, filtros y orden en Precios vigentes, filtro en Reglas

**Estado:** Aceptado

- **Fecha:** 2026-08-20
- **Marco:** ADR-034 (listas de precios, `lista_precio_valor`), ADR-049 (motor v2: lotes de precios, reglas de margen), ADR-069 (patrón de listados: `ThSort`/orden y clic de fila). Puramente **presentación + lectura**; sin migraciones, sin permisos nuevos.

### Contexto

Al revisar precios el PO detectó fricciones de usabilidad (no bugs):
1. **El detalle del lote no dice a qué lista impacta.** `LoteDetalleView` muestra estado/KPIs pero no el nombre de la lista; `obtenerBatchHandler` no lo trae (sí lo trae el listado `listarBatchesHandler` como `lista_nombre`). Esto contribuyó a confundir un lote publicado sobre una lista **no predeterminada** (el POS vende de la predeterminada — ver nota de análisis en la conversación; deuda del motor v2, fuera de este ADR).
2. **Precios vigentes** (`VigentesTab` en `ListasPreciosView`) no muestra el SKU, no se puede filtrar ni ordenar.
3. **Reglas** (`ReglasTab`) no tiene filtro.

### Decisión

1. **Detalle del lote — mostrar la lista.** `obtenerBatchHandler` (`main/ipc/price-batch.ts`) hace `innerJoin` a `lista_precio` y agrega `lista_nombre` (y `lista_precio_id`) al `batch` devuelto. `LoteDetalleView` muestra la lista en el header (junto al `Lote #…`).
2. **Precios vigentes** (`VigentesTab`):
   - **Columna SKU**: `listarVigentesPorListaHandler` (`main/ipc/lista-precio-valor.ts`) suma `sku` y `gtin_barcode` del `producto` al select; la tabla agrega la columna SKU.
   - **Filtro** por nombre / SKU / EAN (input de texto, client-side).
   - **Orden asc/desc** en las cabeceras Nombre, SKU y Precio, con el patrón `ThSort`/`SortIcon` ya usado en `ProveedorProductosTab` (ADR-069).
   - **Margen: NO** se agrega en esta iteración (decisión del PO — se posterga).
3. **Reglas** (`ReglasTab`): **filtro** de texto que matchea el nombre del objetivo (producto/marca/rubro/proveedor/lista) y, para reglas de tipo `producto`, también su **SKU y EAN**. Requiere que la carga de productos del tab traiga `sku` y `gtin_barcode` (hoy solo `{id, nombre}`).

### Consecuencias

- **Positivas:** el detalle del lote deja claro sobre qué lista opera (evita la confusión de listas); Precios vigentes y Reglas se vuelven navegables (buscar/ordenar) como el resto de los listados (ADR-069).
- **Riesgo acotado:** todo es lectura + UI; los cambios de handler agregan columnas al select (sin tocar escritura ni esquema). Se cubre con tests de componente (filtro/orden/columna) y de handler (el select trae sku/ean).

### Fuera de alcance (NO tocar)

- El **margen** en Precios vigentes (postergado).
- La **deuda del motor v2** (que publicar un lote sobre una lista no-predeterminada no impacta el POS; que la pantalla de Producto muestre el campo legacy `precio_venta_lista`): es un tema aparte, no de este ADR.
- Esquema/migraciones: cero.

### Implementación (2026-08-20)

Ejecutado con Superpowers (subagent-driven, TDD RED→GREEN por tarea) en la rama `feat/adr-071` (sale de `feat/adr-070`).
**Plan:** `docs/superpowers/plans/2026-08-20-adr071-listados-precios.md`.

- **Detalle del lote** (`df386f1`): `obtenerBatchHandler` (`price-batch.ts`) resuelve el nombre de la lista y lo agrega como `lista_nombre` al `batch`; `LoteDetalleView` lo muestra en el header ("Lista: …").
- **Precios vigentes** (`c8baa43`): `listarVigentesPorListaHandler` (`lista-precio-valor.ts`) suma `sku`+`gtin_barcode` al select y al type `VigenteConProducto`; `VigentesTab` gana columna **SKU**, **filtro** por nombre/SKU/EAN y **orden** asc/desc en Nombre/SKU/Precio con el patrón `ThSort`/`SortIcon` (ADR-069). `VigentesTab` se exportó para testeabilidad.
- **Reglas** (`ce6caf2`): `ReglasTab` carga `sku`/`gtin_barcode` en las opciones de producto (el handler `producto.list` ya los devolvía — sin cambios de backend) y agrega **filtro** que matchea objetivo + tipo + (para reglas de producto) SKU/EAN.

**Margen en vigentes: NO** (postergado por decisión del PO). **Sin migraciones, sin permisos.** **Tests:** main **1129/1129** (91 archivos) y renderer **643/643** (93 archivos) en verde, con tests nuevos por tarea (lista en obtener + header; SKU/filtro/orden en vigentes; filtro por SKU/EAN en reglas). **Pendiente:** verificación manual (`pnpm dev`, §12) y merge. No se toca la deuda del motor v2 (lote sobre lista no predeterminada no impacta POS; pantalla de Producto usa `precio_venta_lista` legacy) — tema aparte.

---

## ADR-072 — Redondeo de punto flotante en el delta mostrado del Ajuste de Stock

**Estado:** Aceptado — implementado (2026-08-21; test de componente en verde — ver §Implementación. Pendiente verificación manual en `pnpm dev`.)
**Fecha:** 2026-08-21
**Marco:** ADR-014 (unidades: stock permite fracción vía `permite_fraccion` / `factor_conversion`). Puramente presentación; sin migraciones, sin permisos nuevos, sin cambio en el cálculo enviado al backend.

### Contexto

En `StockAjusteModal.tsx:22`, `delta = cantidadNum - stockActual` se calcula con aritmética
de punto flotante de JS y se renderiza sin redondear (`StockAjusteModal.tsx:70`). Con
productos de stock fraccionario (`permite_fraccion`, ADR-014) el resultado expone el error
de representación binaria típico de JS: p.ej. stock actual `149.9` y cantidad contada `145`
muestra `-4.900000000000006` en vez de `-4.9`.

Afecta **solo el texto mostrado**. El payload que `handleSubmit` envía a
`ferreteria.catalogo.stock.ajuste` usa `cantidadNum` (el valor parseado del input, no el
`delta`) sin tocar; el handler del backend recalcula el ajuste real server-side. No hay
corrupción de dato ni de cálculo — es un defecto puramente visual.

`Kardex.tsx:43` ya resuelve el mismo problema para las cantidades de movimientos con un
helper privado `fmtNum` (`n.toLocaleString('es-AR', { maximumFractionDigits: 4 })`), no
exportado ni reutilizable desde otros archivos — es el único precedente de este patrón en
el renderer (no hay `renderer/utils/` compartido hoy).

### Decisión

Redondear el `delta` mostrado en `StockAjusteModal.tsx` con una función de formateo local al
componente, replicando el mismo criterio que `fmtNum` de `Kardex.tsx` (es-AR,
`maximumFractionDigits: 4`, sin ceros de relleno de más). Se aplica únicamente al valor
renderizado (línea 70); `cantidadNum`, `stockActual` y el payload IPC no cambian.

**Rechazado:**
- **(A) Extraer un util compartido** (`renderer/utils/format.ts` o similar) — sobre-diseño
  para dos usos existentes; `fmtNum` de Kardex no está exportada y este es recién el
  segundo lugar que necesita el mismo formateo. Si aparece un tercer punto, se revisita.
- **(B) `toFixed(n)` fijo** — trunca a una cantidad fija de decimales incluso cuando no
  hacen falta (mostraría `-5.0000` en vez de `-5`); `toLocaleString` con
  `maximumFractionDigits` ya evita eso, igual que en Kardex.

### Consecuencias

- (+) El delta se muestra correctamente redondeado (`-4.9` en vez de
  `-4.900000000000006`) para productos con stock fraccionario.
- (+) Sin cambio de contrato: `ferreteria.catalogo.stock.ajuste` sigue recibiendo
  `cantidadNum` crudo; el handler de backend no se toca.
- (−) Duplica ~3 líneas de formateo entre `Kardex.tsx` y `StockAjusteModal.tsx` (aceptado,
  ver Rechazado (A)).

### Fuera de alcance

- El cálculo real de ajuste (handler `stock.ajuste` del backend): sin cambios.
- Extracción de un util de formateo compartido (ver Rechazado (A)).

### Gate

Ninguno — sin schema, sin migración, sin permisos nuevos. Sigue el flujo estándar de §12:
TDD (test de componente de `StockAjusteModal` que cubra el delta con stock decimal, p.ej.
stock actual `149.9` / contado `145` → texto `-4.9`) y verificación manual abriendo el
modal de Ajuste sobre un producto con stock fraccionario (`pnpm dev`).

### Implementación (2026-08-21)

TDD RED→GREEN:

- **RED:** `StockAjusteModal.test.tsx` (nuevo) — stock actual `149.9`, cantidad contada
  `145`; falló mostrando `-4.900000000000006` en el DOM (bug reproducido).
- **GREEN:** `fmtDelta` (función privada en `StockAjusteModal.tsx`, mismo criterio que
  `fmtNum` de `Kardex.tsx`: `n.toLocaleString('es-AR', { maximumFractionDigits: 4 })`)
  aplicada al render del `delta`. Con locale es-AR el separador decimal es coma
  (`-4,9`), consistente con el resto de la app.
- `cantidadNum`, `stockActual` y el payload a `ferreteria.catalogo.stock.ajuste` sin
  tocar.
- **Tests:** renderer **644/644** (94 archivos) en verde, incluyendo el test nuevo.
- **Pendiente:** verificación manual (`pnpm dev`, §12) sobre un producto con stock
  fraccionario.

---

## ADR-073 — Búsqueda por similitud en Catálogo (servicio token-set compartido) + enmienda a `normalizar()`

**Estado:** Aceptado — implementado (2026-08-24; suite completa en verde — ver §Implementación. Pendiente verificación manual en `pnpm dev`.)
**Fecha:** 2026-08-24
**Marco:** ADR-063 (matcher por similitud de nombre), ADR-067 (sinónimos + `nombre_corto_norm`), ADR-024 (columna derivada + backfill), ADR-042/044/060 (features detrás de flag). Consolida el diseño de `docs/ADR-normalizacion-y-busqueda.md`, cuyos supuestos ("último ADR cerrado = 035", piezas inexistentes) ya estaban superados por ADR-063/067.

### Contexto

El operador necesita encontrar productos por características más que por identificador exacto ("traeme todos los pincel 3x8", "tarugo 8mm"). La búsqueda del Catálogo hoy ([`catalogo.producto.list`](../packages/client/src/main/ipc/producto.ts)) es substring + expansión de sinónimos (ADR-067); **no** rankea por similitud de nombre. El motor token-set (coeficiente de Dice + índice invertido + canonización por sinónimos) **ya existe** desde ADR-063 ([`similitud.ts`](../packages/shared/src/similitud.ts), [`producto-matcher.ts`](../packages/client/src/main/matching/producto-matcher.ts)), pero está cableado **solo** en los flujos de importación de costos/catálogo. Falta exponerlo como servicio de búsqueda del Catálogo.

Al hacerlo aparece un gap medible en `normalizar()` ([`texto.ts`](../packages/shared/src/texto.ts)): hoy `8 mm` y `8mm` tokenizan distinto (solo la `x` de medida colapsa espacios). Como el matcher parte por espacios, buscar `tarugo 8 mm` (unidad separada) contra "Tarugo plástico 8mm" da Dice 0.33 < piso 0.34 → **no matchea**. En cambio las fracciones/pulgadas (`3/4"` → `3 4`) se mutilan, pero como `normalizar()` se aplica a **ambos** lados de toda comparación, la mutilación es simétrica y el match funciona igual (no vale la pena tocarlo).

### Decisión

**1. Enmienda a `normalizar()` (amendment a ADR-063/067): canonicalización de unidad con espacio.** Se agrega una regla acotada que pega un número a la unidad conocida que le sigue separada por espacio(s): `8 mm`→`8mm`, `60 cm`→`60cm`, `8 m`→`8m`. Lista de unidades como constante comentada y extensible (`UNIDADES_FORMATO = ['mm','cm','m']`), con lookahead `(?![a-z])` para no comerse palabras (`8 metros` queda intacto). **No** borra unidades (preserva `8mm` ≠ `8cm`) ni infiere sinónimos. Las fracciones/pulgadas **no** se preservan (divergencia descartada: mutilación simétrica, riesgo alto / beneficio nulo). Sigue el principio de "sinónimos y equivalencias en comparación, no en la norma".

**2. Re-derivación one-shot de `nombre_corto_norm`, guardada por versión.** Como el cambio de norma deja *stale* los `nombre_corto_norm` almacenados de productos con unidad separada, se recomputan **todos** una sola vez tras el cambio, guardado por `parametros_sistema.nombre_norm_version` (idempotente: en el siguiente arranque no vuelve a correr). Reutiliza el patrón de derivación + backfill de ADR-024/067. Igual que el backfill, sólo escribe la proyección derivada; no toca campos de sync.

**3. Servicio único de búsqueda por similitud.** Handler IPC `producto:buscarSimilares` (namespace `catalogo.producto`) que recibe texto libre y devuelve productos rankeados por Dice. **Reutiliza `crearMatcher` de ADR-063; no reimplementa el matcher.** Nunca match automático: sólo sugerencias, la selección es humana. Consumido por Catálogo (revisar duplicados / buscar por característica), rol Operador/Supervisor.

**4. Detrás de feature flag** `busqueda_similares_habilitado` (default `false`, ADR-042/044/060). El modo "Buscar similares" del listado de productos ([`ProductosListado.tsx`](../packages/client/src/renderer/views/productos/ProductosListado.tsx)) sólo aparece con el flag on; el enable-toggle vive en Configuración → Sinónimos ([`ConfigSinonimos.tsx`](../packages/client/src/renderer/views/config/ConfigSinonimos.tsx)), search-adjacent y ya restringida a Supervisor.

**5. Cierre de la decisión abierta de ADR-035.** La persistencia del match manual (poblar `producto_proveedor.codigo_proveedor` al resolver una fila) **ya estaba resuelta** por ADR-063 §1 ([`importacion-costo.ts`](../packages/client/src/main/ipc/importacion-costo.ts)). Se deja constancia; sin cambios de código.

### Consecuencias

- **(+)** Un solo motor de búsqueda por similitud; Catálogo y (a futuro) POS lo comparten sin duplicar lógica.
- **(+)** `tarugo 8 mm` (unidad separada) ahora encuentra "Tarugo plástico 8mm". La enmienda mejora también el matching producto↔proveedor de ADR-063 y la búsqueda de ADR-067, de forma consistente en ambos lados.
- **(+)** La frontera formato/semántica se mantiene: la norma sigue "tonta"; sinónimos y unidad implícita quedan en la capa de comparación.
- **(−)** Un cambio en `normalizar()` toca todo lo que compara por nombre; mitigado por cobertura de tests en ambos consumidores y por la re-derivación guardada.
- **(−)** `crearMatcher` arma el índice invertido por llamada; aceptable para catálogos de cientos/miles con debounce en la UI. Memo con invalidación queda como punto de extensión si el catálogo crece mucho.

### Alternativas descartadas

- **Preservar fracciones/pulgadas en `normalizar()`** (spec original del prompt): re-tokeniza medio catálogo y rompe tests, sin ganancia de matching (mutilación simétrica). Descartado.
- **Lógica de búsqueda duplicada por pantalla:** descartado; el servicio es único.
- **Match automático por similitud / embeddings:** descartado (selección humana; offline-first + auditabilidad, heredado de ADR-063).

### Fuera de alcance (ADRs derivados, diferidos)

- **Búsqueda avanzada en POS:** consumirá este mismo servicio; arrastra excepción de phase-gate (POS R1/P1.8). ADR aparte.
- **Sustitutos curados (`producto_equivalencia` N:N):** curaduría humana. ADR aparte. No existe hoy.
- **Regla de unidad implícita** ("tornillo 8" ≡ "tornillo 8mm"): regla de equivalencia en la capa de comparación, sin implementar (YAGNI).
- **`termino_equivalencia` con `categoria_id`:** no se creó; el scope por categoría se difiere (se reutiliza la tabla `sinonimo` global de ADR-067).

### Gate

Migración **aditiva de datos** (`0040_adr073_busqueda_similares_flag.sql`: inserta el flag en `false`, no toca esquema). Sin permisos nuevos (Catálogo usa `producto.consultar`; el toggle usa `config.fiscal` vía `parametros:set`). Flujo estándar de §12: TDD (RED→GREEN) y verificación manual (`pnpm dev`).

### Implementación (2026-08-24)

TDD RED→GREEN en cada pieza:

- **`normalizar()`** ([`texto.ts`](../packages/shared/src/texto.ts)): regla de unidad-con-espacio + tests en [`texto.test.ts`](../packages/shared/src/texto.test.ts) (unifica `8 mm`/`8 MM`/`8mm`; `8cm`≠`8mm`; `8 metros` intacto; idempotencia). `packages/shared` recompilado (`dist`).
- **Re-derivación** `rederivarNombreCortoNorm` ([`backfill.ts`](../packages/client/src/main/sinonimos/backfill.ts)) guardada por `nombre_norm_version`, cableada en [`startup.ts`](../packages/client/src/main/startup.ts) junto al backfill existente.
- **Servicio** `buscarSimilaresHandler` + canal `producto:buscarSimilares` ([`producto.ts`](../packages/client/src/main/ipc/producto.ts)) reutilizando `crearMatcher`; preload actualizado.
- **UI**: toggle "Buscar similares" en Catálogo + hooks `useProductosSimilares` / `useBusquedaSimilaresHabilitado`; enable-toggle en `ConfigSinonimos`.
- **Flag**: migración `0040_adr073_busqueda_similares_flag.sql` (default `false`) + entrada en el journal de Drizzle.
- **Tests:** `shared` **131/131** · renderer **650/650** · main (Electron) **1136/1136** · typecheck limpio. Incluye la prueba end-to-end de que `tarugo 8 mm` encuentra "Tarugo plástico 8mm".
- **Pendiente:** verificación manual (`pnpm dev`, §12): Configuración → Sinónimos → activar "Búsqueda por similitud"; Catálogo → "Buscar similares" → `tarugo 8 mm`.

---

## ADR-075 — Match canónico de ubicación en el import de productos (ceros a la izquierda + case-insensitive)

**Estado:** Aceptado — implementado (2026-08-26; suite en verde — ver §Implementación. Pendiente verificación manual en `pnpm dev`.)
**Fecha:** 2026-08-26
**Marco:** ADR-064 (forma canónica de ubicación: `trim → mayúsculas → sacar ceros a la izquierda por segmento all-dígitos`, sin padding). Puramente de resolución de datos; sin migraciones, sin permisos nuevos, sin cambio de esquema ni de contrato IPC.

### Contexto

El import masivo de productos (`import.masiva`) resuelve la columna `ubicacion` a un
`ubicacion_id` por **igualdad exacta de string** contra el `codigo` guardado
(`importar.ts`: `ubicacionMap = new Map(ubicaciones.map(u => [u.codigo, u.id]))` y
`ubicacionMap.get(ubicacionVal)`). Eso rompe en dos casos reales:

1. **Ubicación legacy con código no canónico.** ADR-064 canonicaliza en el **alta** de
   ubicaciones (`ubicacionCreateHandler` y el import de ubicaciones ya llaman a
   `canonicalizarUbicacion`), pero las filas creadas *antes* de esa regla quedaron con el
   código viejo (p.ej. `A-01-03`). Un CSV de productos que trae la forma canónica `A-1-3`
   —o cualquier variante con ceros a la izquierda distinta— no matchea y da `Ubicación
   "A-1-3" no existe`, aunque la ubicación exista.
2. **Mayúsculas/minúsculas.** El match exacto es case-sensitive: `a-1-3` no encuentra
   `A-1-3`.

El alta manual de producto (`ProductoForm`) no sufre esto: elige la ubicación de un
`<select>` por `id`, no por texto. El defecto es exclusivo del path de import por código
de texto.

### Decisión

Canonicalizar **ambos lados** del match en el import de productos, con la misma regla de
ADR-064 aplicada a un código ya formado:

- Nueva función pura `canonicalizarCodigoUbicacion(codigo)` en `@ferreteria/shared`
  (`ubicacion.ts`): parte el código por `-`, canonicaliza cada segmento con la regla
  existente (`canonSegmento`) y re-une. `'A-01-03' → 'A-1-3'`, `'a-1-3' → 'A-1-3'`.
- `importar.ts` construye el `ubicacionMap` keyeado por la **forma canónica** del código
  guardado (helper `buildUbicacionMap`) y busca con `canonicalizarCodigoUbicacion(ubicacionVal)`.
- El producto se **asigna** a la ubicación existente (su `ubicacion_id`), incluida la
  legacy `A-01-03`. **No** se reescribe el `codigo` guardado de la ubicación: eso es
  higiene de catálogo y ya lo cubre "Detectar duplicados" en la pantalla de Ubicaciones.
- Ante duplicados legacy (una `A-01-03` vieja conviviendo con una `A-1-3` nueva que
  colapsan a la misma clave canónica), `buildUbicacionMap` prefiere la fila cuyo código ya
  está en forma canónica.

**Rechazado:**
- **(A) Migrar/reescribir los códigos legacy a la forma canónica durante el import de
  productos** — efecto colateral sorpresivo en un flujo de alta de productos, y con riesgo
  de colisión de unicidad `(sector,estante,posicion)` si ya existe la fila canónica. La
  limpieza de duplicados es una acción explícita del usuario, no un side effect del import.
- **(B) Canonicalizar solo el valor del CSV** (dejar el mapa keyeado por el código crudo)
  — no arreglaría el caso legacy: el código guardado `A-01-03` seguiría sin matchear la
  clave canónica `A-1-3`. Hay que canonicalizar los dos lados.

### Consecuencias

- (+) El import de productos matchea `A-1-3` contra la ubicación existente aunque esté
  guardada como `A-01-03`, y sin distinguir mayúsculas/minúsculas.
- (+) Regla de canonicalización única y compartida (`@ferreteria/shared`), consistente con
  ADR-064; sin duplicar la lógica de ceros a la izquierda en el importador.
- (+) Sin migración, sin permisos, sin cambio de contrato IPC ni de esquema.
- (−) Si conviven dos ubicaciones que colapsan a la misma canónica, el import elige una
  determinísticamente (la canónica); la desambiguación real sigue siendo "Detectar
  duplicados".

### Fuera de alcance

- Reescritura/merge de los códigos legacy no canónicos (queda para "Detectar duplicados").
- El alta manual de producto (`ProductoForm`), que ya resuelve por `id`.

### Gate

Ninguno — sin schema, sin migración, sin permisos nuevos. Flujo estándar de §12: TDD
(RED→GREEN) y verificación manual (`pnpm dev`).

### Implementación (2026-08-26)

TDD RED→GREEN:

- **RED:** en [`ubicacion.test.ts`](../packages/shared/src/ubicacion.test.ts) (falla por
  `canonicalizarCodigoUbicacion` inexistente) y en
  [`importar.handlers.test.ts`](../packages/client/src/main/ipc/__tests__/importar.handlers.test.ts):
  una ubicación legacy insertada con código crudo `A-01-03` no matcheaba `A-1-3`, y el
  match era case-sensitive.
- **GREEN:** `canonicalizarCodigoUbicacion` en
  [`ubicacion.ts`](../packages/shared/src/ubicacion.ts) (+ export en `index.ts`,
  `packages/shared` recompilado). En [`importar.ts`](../packages/client/src/main/ipc/importar.ts):
  helper `buildUbicacionMap` (mapa keyeado por forma canónica, prefiere la fila canónica
  ante duplicados), usado en `validarProductos` y `validarFilaUnica`; el lookup en
  `validarFilaProducto` canonicaliza el valor del CSV.
- **Tests:** `ubicacion.test.ts` **9/9** (4 casos nuevos para `canonicalizarCodigoUbicacion`)
  · renderer **687/687** · main (Electron) **1162/1162** · typecheck (`shared`+`client`)
  limpio. Los casos nuevos del importador: legacy `A-01-03` ← `A-1-3`, case-insensitive
  `a-1-1` ← `A-1-1`, y el `ok`/`ubicacion_id` esperado.
- **Pendiente:** verificación manual (`pnpm dev`, §12): Importar datos → Productos con una
  ubicación legacy `A-01-03` en catálogo y la columna `ubicacion=A-1-3` → la fila debe
  quedar `Nuevo`/`Actualiza`, no `Error`.

## ADR-076 — Política de retención y depuración de backups

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-04

Hoy los backups automáticos (pre-migración al arrancar y los de cierre de caja) se acumulaban sin depuración. **Decisiones:** (D1) retención **híbrida con piso**: protege los *últimos N* ∪ los *más nuevos que X días* ∪ los manuales, con un piso mínimo absoluto por carpeta y un tope de tamaño opcional; (D2) **consulta diferida**: nada se borra solo, se calculan candidatos y el Supervisor confirma; (D3) el aviso es exclusivo del Supervisor (permiso `backup.crear`); (D4) los backups **manuales están siempre protegidos**; (D5) modal una vez al abrir la app (si hay candidatos y sesión Supervisor) + banner permanente en Configuración → Backups, con "Ahora no" por sesión; (D6) defaults `N = 10`, piso `3` por carpeta, tope de tamaño desactivado y `backup_retencion_dias = 30`. Implementado como función pura de retención + IPC `backup:depurar` en `@core/main` y `DepuracionBackupsModal` en `AppShell` de `@core/ui`.

Detalle completo: [`docs/ADR-076 - Politica de retencion y depuracion de backups.md`](ADR-076%20-%20Politica%20de%20retencion%20y%20depuracion%20de%20backups.md).

## ADR-077 — Fase 1 de mejoras UX: feedback central, traducción de errores, validación inline y fix de hook

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-06

Primera fase de la auditoría de UX/seguridad (`docs/prompts-fases-mejoras-ux.md`), sin migraciones y sin dependencias nuevas: **BUG-1** (fila de listado extraída a un componente propio, fix de hook), **ERR-1** (capa de feedback única: `ToastProvider`/`useToast` + helper `useCallIpc`), **ERR-2** (`traducirError(e) → { mensaje, accion? }`, tabla de códigos de dominio traducidos), **PROD-1** (validación inline en `ProductoForm` como primer consumidor), **NAV-1** (breadcrumb jerárquico y clicable) y **SEC-1** (control de navegación y CSP en el main: `webSecurity.ts`). `traducirError` y los toasts son hoy la base de manejo de errores de **ambas apps** (viven en `@core/ui`).

Detalle completo: [`docs/ADR-077 - Fase 1 mejoras UX - feedback central, traduccion de errores, validacion inline y fix de hook.md`](ADR-077%20-%20Fase%201%20mejoras%20UX%20-%20feedback%20central,%20traduccion%20de%20errores,%20validacion%20inline%20y%20fix%20de%20hook.md).

## ADR-078 — Fase 2 mejoras UX: stock inicial en el alta, hub de Precios/Costos y paleta de comandos

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-07 · Detalle completo en
[`ADR-078 - Fase 2 mejoras UX - stock inicial, hub precios, paleta comandos.md`](ADR-078%20-%20Fase%202%20mejoras%20UX%20-%20stock%20inicial,%20hub%20precios,%20paleta%20comandos.md).

Continúa la auditoría de UX de ADR-077 (Fase 1). Implementa los **ítems 1–3 de la Fase 2**
(ítems 4–6 diferidos a Fase 2b):

- **PROD-2 — Stock inicial atómico en el alta:** `productoCreateHandler` acepta
  `stock_inicial?: { cantidad; costo? }` y lo aplica dentro de su transacción (movimiento
  `inicial`, `existencias`, CPP). El costo inicial va a `producto.precio_costo_promedio`
  (pesos/REAL), **no** a `producto_proveedor` (centavos). UI: sección opcional en
  `ProductoForm` (solo alta) + checklist "Para vender falta:" en `ProductoDetalle`.
- **PRICE-1 — Hub "Precios y Costos":** pantalla `PreciosHub` con pestañas (rutas anidadas
  aditivas bajo `/precios/hub`, sin tocar las rutas viejas → cero regresión). Flag nuevo
  `hub_precios_habilitado` (default `false`, sin migración, read-with-default); con el flag
  on, un único ítem de sidebar reemplaza a los dispersos y **gana** sobre
  `motor_precios_v2_habilitado`. Sin pantalla de toggle todavía (ADR-061 `Propuesto`): se
  enciende por `parametros.set` o seed futuro.
- **SRCH-1 — Paleta de comandos Ctrl/Cmd+K:** productos (IPC debounced con guarda de
  request), clientes/proveedores (gateados por permiso), acciones y navegación filtradas por
  `can()`; Escape vía pila LIFO `useEscapeAction`; recientes por usuario en `localStorage`
  con guarda `Array.isArray`.

**Alternativas descartadas:** para PRICE-1, (a) redirigir las rutas viejas al hub —
descartada porque con el flag apagado cambiaba el comportamiento del sidebar; (b) atar el hub
al flag `motor_precios_v2_habilitado` existente — descartada por mezclar dos decisiones bajo
un mismo switch; (c) solo consolidar el sidebar sin pantalla hub — no cumplía el pedido de
pestañas.

## ADR-061 — Pantalla de Funcionalidades para administrar feature flags

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-07

Cierra la ADR-061 que estaba `Propuesta`. Se construyó la pantalla de administración de
feature flags que faltaba (era el punto pendiente de ADR-078: no había forma de togglear
`hub_precios_habilitado` desde la UI).

- **Pantalla `/config/funcionalidades`** (grupo Sistema, gateada por `config.fiscal`):
  lista y permite prender/apagar cualquier feature flag. **Auto-descubrimiento**: muestra lo
  que devuelve `parametros:listFlags` (params `tipo='bool'` cuya `clave` termina en
  `_habilitado`), así que **un flag nuevo aparece solo**, sin tocar la pantalla. Etiqueta =
  `descripcion` del parámetro (fallback a la clave). Toggle vía `parametros:set` con
  `useCallIpc` (toast) + update optimista.
- **Backend:** handler `parametros:listFlags` (gateado por `config.fiscal`, igual que
  `set`), namespace `parametros.listFlags` en preload.
- **Migración 0044:** enciende de fábrica los 3 flags que faltaban
  (`busqueda_similares_habilitado`, `sinonimos_habilitado`, `sustitutos_habilitado`) →
  con esto **todas** las features quedan encendidas por default. Aditiva y retrocompatible.

Consecuencia: los feature flags dejan de administrarse sólo por código/DB; el Supervisor los
gobierna desde la UI. Estado de flags tras esta tanda: **todos encendidos** de fábrica.

## ADR-079 — Fase 2b mejoras UX: links de vuelta al producto, alta express y auto-bloqueo por inactividad

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-07 · Detalle completo en
[`ADR-079 - Fase 2b mejoras UX - links de vuelta, alta express, auto-bloqueo.md`](ADR-079%20-%20Fase%202b%20mejoras%20UX%20-%20links%20de%20vuelta,%20alta%20express,%20auto-bloqueo.md).

Cierra la **Fase 2** de la auditoría de UX (continúa ADR-077/078). Implementa los
**ítems 4–6**:

- **NAV-2 — Links de vuelta al producto:** el título del producto en `Kardex` y la celda
  "Producto" en `LoteDetalle` pasan a ser `<Link>` a `/productos/:id`. `StockListado` ya
  navegaba (fila clicable) → no se tocó. La **cola de revisión de costos** queda fuera a
  propósito: sus candidatos son sugerencias por similitud sin producto vinculado. Aditivo,
  sin IPC nuevo.
- **PROD-3 — Alta express:** handler `productoQuickCreateHandler` (IPC `producto:quickCreate`)
  que recibe `{ nombre_corto, precio_venta_lista, gtin_barcode? }`, resuelve server-side
  categoría `"Sin clasificar"` (idempotente), unidad `'unidad'` e IVA predeterminado, y
  **delega en `productoCreateHandler`** (DRY). Componente `AltaExpressModal` reutilizable,
  invocado desde `PosScanBar` (al no haber resultados) y desde `OrdenCompraDetalle`
  ("Agregar ítem"). El pedido original decía "Recepción", pero `RecepcionView` recibe contra
  líneas de OC ya definidas y no tiene alta de productos; el punto real es la OC.
- **SEC-3 — Auto-bloqueo por inactividad:** flag `bloqueo_inactividad_habilitado` (bool,
  default `false`, aparece como toggle en Funcionalidades de ADR-061) + umbral
  `bloqueo_inactividad_minutos` (number, default 15), ambos sembrados por **migración 0045**
  (`parametros:set` es UPDATE-only). IPC `auth:verifyPassword` verifica la contraseña del
  usuario de la sesión sin recrearla. `useIdleLock` + `PantallaBloqueo` montados en
  `AppShell` (dentro de `PosSessionProvider`): el overlay tapa la UI sin desmontar nada, así
  la **venta en curso se conserva**; `CommandPalette` se deshabilita mientras está bloqueado.

**Ajuste sobre el plan original de SEC-3:** al integrarse ADR-061 (pantalla de
Funcionalidades) durante la tanda, se pasó de "un solo número seteado a mano" a
"flag booleano en Funcionalidades + umbral en minutos", ambos por migración. Sigue apagado
por default (cero cambio de comportamiento hasta prenderlo).

## ADR-080 — Fase 3 mejoras UX: inicio personalizable, favoritos y reorganización del sidebar

**Estado:** Aceptado · **Fecha:** 2026-09-08 · Detalle completo en
[`ADR-080 - Fase 3 mejoras UX - inicio personalizable, favoritos y reorganizacion del sidebar.md`](ADR-080%20-%20Fase%203%20mejoras%20UX%20-%20inicio%20personalizable,%20favoritos%20y%20reorganizacion%20del%20sidebar.md).

Abre la **Fase 3** de la auditoría de UX (personalización y pulido; continúa
ADR-077/078/079). Unifica dos ítems del backlog:

- **PERF-1 — inicio personalizable + favoritos.** Migración aditiva sobre
  `usuario_preferencias` (`pantalla_inicio` nullable + `favoritos` JSON), flag
  `inicio_personalizable_habilitado` (bool, default `false`, aparece en Funcionalidades por
  terminar en `_habilitado`). El `<Navigate to="/productos">` fijo de la ruta índice se
  reemplaza por un `InicioRedirect`: con el flag off → `/productos`; con el flag on → la
  pantalla configurada (si el rol tiene permiso), o el default por rol
  (Supervisor→`/dashboard`, Operador→`/pos`) con fallback a `/productos`. Favoritos con
  estrella inline en el sidebar → grupo "Favoritos" fijo arriba (tope 8, validado y
  deduplicado en el borde del handler `preferencias.save`). `login`/`whoami` suman ambos
  campos al payload de sesión.
- **NAV-3 — reorganización del sidebar (directo, sin flag).** El grupo `configuracion` se
  aligera y se mantienen **dos grupos separados**: "Configuración" (operatoria: Etiquetas,
  Categorías, Marcas, Unidades, Ubicaciones, Sinónimos, Transportistas) y "Sistema" (propio
  del software, sin cambios). Las importaciones + Listas de precios van al hub de Precios
  cuando `hub_precios_habilitado` está on (se corrige que `Importar datos` también entre al
  hub); con el hub off caen en "Sistema" como fallback, nunca huérfanas.

**Fuera de alcance (Fase 3, otras sesiones):** SEC-2 (validación de payloads en todos los
handlers), SRCH-2/3 (SearchBox unificado), PERF-2 (vistos recientemente), PERF-3 (editor de
permisos por rol — decisión de producto abierta), BUG-2/PRICE-4 (higiene).

## ADR-081 — Fase 3 mejoras UX: búsqueda unificada, vistos recientemente e higiene

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-08 ·
Detalle completo en
[`ADR-081 - Fase 3 mejoras UX - busqueda unificada, vistos recientemente e higiene.md`](ADR-081%20-%20Fase%203%20mejoras%20UX%20-%20busqueda%20unificada,%20vistos%20recientemente%20e%20higiene.md).

Segundo lote de la **Fase 3** (pulido + higiene; continúa ADR-080). Unifica el clúster
coherente de la fase:

- **SRCH-2/3 — búsqueda unificada.** Componente `SearchBox` único (ícono, limpiar, debounce,
  resaltado del match) + persistencia de búsqueda/filtros al volver de un detalle vía hook
  `usePersistentListState` (store de sesión en memoria, semántica idéntica a la que ya da
  `CatalogoContext` para Productos). Adopción incremental en Clientes, Proveedores, OC,
  Presupuestos, Remitos, Transportistas, CtaCte.
- **PERF-2 — vistos recientemente.** Store por usuario/terminal en `localStorage` (espejo de
  `cmdk_recientes`, tope 8, LRU, sin sync ni backup), flag `vistos_recientes_habilitado`
  (bool, default `false`, migración 0047, aparece en Funcionalidades). Se registra al abrir
  detalle de producto/cliente; widget `VistosRecientemente` en el Dashboard (Supervisor) y en
  el encabezado de los listados de Productos/Clientes (mostrador del Operador) — "el inicio"
  es donde el usuario aterriza según su rol (la raíz es un redirect desde ADR-080).
- **BUG-2 — código muerto.** Se elimina el bridge `usuario:setPin` de preload (sin handler en
  main desde ADR-027/029), se borra el huérfano `ConfigShell.tsx`, y se retira la superficie
  IPC de escritura de `lista_precio_detalle` (handler + registro + namespace preload + tests);
  la tabla y la columna `pin_rapido` se conservan inertes (no se hacen migraciones
  destructivas ni se reescribe historia). Se corrigen dos notas de CLAUDE.md.
- **PRICE-4 — reporte de errores descargable.** Helper compartido
  `descargarReporteImportacion` con la convención CSV de ADR-EXP-03 (BOM + `;` + CRLF);
  se cablea al `SummaryStep` del wizard genérico `/importar` y se migra `ImportarCostosView`
  al helper.

**Fuera de alcance:** SEC-2 (ítem 3 — validación de payloads en ~100+ handlers, decisión
zod-vs-a-mano; su propio ADR) y PERF-3 (ítem 5 — editor de permisos por rol; decisión de
producto abierta, opciones A/B/C en el ADR, sin cerrar).

## ADR-082 — Fase 3 mejoras UX: SEC-2 (validación de payloads) + revisión integral de mensajes

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-10 ·
Detalle completo en
[`ADR-082 - Fase 3 mejoras UX - SEC-2 validacion de payloads y mensajes al usuario.md`](ADR-082%20-%20Fase%203%20mejoras%20UX%20-%20SEC-2%20validacion%20de%20payloads%20y%20mensajes%20al%20usuario.md).

Cierra el ítem 3 de la **Fase 3** (SEC-2), ampliado a una revisión integral de los mensajes al
usuario. Sin dependencias nuevas (validación a mano, no `zod`). Alcance = infraestructura +
tranche prioritario, resto asentado para próxima iteración. **Seam:** contrato de string
`CÓDIGO:arg` (y `VALIDATION:<campo>:<detalle>`) main↔renderer.

- **A — validadores (`main/validation/core.ts`).** Primitivas puras (`str`/`id`/`centavos`/
  `oneOf`/`arr`/…) que lanzan `ValidationError`; aplicadas al borde de los handlers de escritura
  del tranche (catálogos, producto, cliente, proveedor, stock/existencias/caja, venta +
  venta-espera, precios). En venta se valida **forma/tipos** sin duplicar las reglas de negocio.
- **B — catálogo de errores completo (`renderer/lib/errores.ts`).** ~64 códigos de dominio
  traducidos a español (antes casi todos caían al fallback), montos en centavos → pesos, tier
  `VALIDATION:campo` → `{ mensaje, campo }`, guard `Object.hasOwn`. Cubre **toda la app**.
- **C — inline en forms.** Hook `useFormErrors`, `useCallIpc` expone `traducido.campo`, helper
  `rutearCampoError`; ruteo backend→campo + foco en los forms del tranche. Cliente/Proveedor
  pasaron de fallar en silencio a mostrar el error.
- **D — confirmaciones de éxito** estandarizadas en las vistas del tranche.
- **Higiene:** se quitan ramas muertas `OBSERVACIONES_REQUERIDAS` en modales de Stock.

Ambos runners verdes (main 1320, renderer 852), `tsc` limpio.

**Regla adoptada:** no introducir requeridos nuevos más allá de lo que el handler ya exigía
(se evitó una regresión: `numero_documento` es opcional en el form → se valida como opcional
normalizado a `''`; `existencias.stock_minimo` quedó present-only).

**Fuera de alcance (próxima iteración):** validación A/inline C/éxito D en dominios no
prioritarios (el catálogo B ya los cubre); ruteo por-campo en `CajaCierreView`; **PERF-3**
(editor de permisos por rol — decisión de producto abierta, opciones A/B/C); deep-link "abrir el
existente".

## ADR-083 — Ajustes varios: relación producto-proveedor, alta masiva, nav de Importar, lista de precios por cliente

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-10 ·
Detalle completo en
[`ADR-083 - Ajustes varios proveedor-cliente-nav.md`](ADR-083%20-%20Ajustes%20varios%20proveedor-cliente-nav.md).

Batch de 4 ajustes de UX independientes (versión 1.0.x, aditivos, sin migraciones ni flags).
Un único handler nuevo (`asociarLote`) + persistencia de una columna existente que el handler
ignoraba. Ejecutado con subagentes (implementador + revisión de spec + revisión de calidad por
tarea, TDD RED→GREEN).

- **A — Agregar proveedor desde el producto.** `ProveedoresPanel` gana un botón "+ Agregar
  proveedor" (ambas ramas del componente) con mini-form (proveedor, costo, código). Preferido
  = **auto** si es el primero, **checkbox** si ya hay otros. Reusa `compras.pp.upsert` +
  `setPreferido`. Sólo Supervisor (hereda el guard `proveedor.gestionar` que ya regía el panel).
- **B — Alta masiva en el proveedor.** Se retira la búsqueda del toolbar (sobre asociados). Nuevo
  `ProveedorAgregarProductosModal` (modal grande): búsqueda + filtros Marca/Categoría + toggle
  "Mostrar ya asociados", checkboxes, Costo/Código inline opcionales, "Agregar seleccionados (N)";
  ya-asociados deshabilitados y marcados "ya cargado". Nuevo handler
  `proveedorProductosAsociarLoteHandler` (canal `compras.pp:asociarLote`, guard
  `proveedor.gestionar`), una transacción idempotente, no toca `preferido`.
- **C — "Importar datos" al tope de Configuración.** En `AppShell`, el ítem `/importar` pasa de
  Sistema al primer lugar de Configuración (revierte parcialmente ADR-080). Ruta y permiso
  `import.masiva` intactos.
- **D — Lista de precios por cliente.** Cierra un gap real: la columna `cliente.lista_precio_id`
  ya la consumía el motor pero no había forma de asignarla. `clienteUpsertHandler` ahora la
  valida (`optId`) y persiste (insert/update); `ClienteForm` gana el selector ("(Predeterminada)"
  = null); `ClienteDetalle` muestra la lista asignada.

Ambos runners verdes: **main 1326**, **renderer 866** (0 fallos).

**Fuera de alcance:** alta de relación producto-proveedor para el Operador (requiere tocar
permisos de `compras.pp:*`); edición masiva de costos/códigos ya existentes; cambios al motor de
precios.

## ADR-084 — Alta masiva de productos en el proveedor: pantalla completa en vez de modal

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-10 · Revisa **ADR-083 §B**.
Detalle en
[`ADR-084 - Alta de productos en proveedor como pantalla completa.md`](ADR-084%20-%20Alta%20de%20productos%20en%20proveedor%20como%20pantalla%20completa.md).

El alta masiva de productos en el proveedor pasa de **modal** a **pantalla a ancho completo** que
reemplaza in situ la lista del tab (early-return en `ProveedorProductosTab`; `showAdd` swap).
Motivo (PO, en uso real): el modal se cerraba por Escape/click-afuera y perdía toda la carga, y
recortaba el espacio de trabajo. Se quita el chrome de modal y `useEscapeToClose`; la única salida
es **"← Volver"** (header) o **"Agregar seleccionados"**. Componente renombrado
`ProveedorAgregarProductosModal` → `ProveedorAgregarProductosPanel`. Estilo alineado al resto:
filtros+tabla+acción dentro de un `.panel` (blanco/redondeado), ya asociados con chip `badge-warn`
"ya cargado" + fila atenuada. Sin migraciones ni handlers nuevos; el `asociarLote` de ADR-083
queda intacto. Renderer verde (swap del tab, ausencia de `.modal-overlay`).

## ADR-085 — Fase 3 mejoras UX: SEC-2 en dominios no prioritarios + CajaCierre + nombres de permisos

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-13 ·
Detalle completo en
[`ADR-085 - Fase 3 mejoras UX - SEC-2 dominios no prioritarios, CajaCierre y nombres de permisos.md`](ADR-085%20-%20Fase%203%20mejoras%20UX%20-%20SEC-2%20dominios%20no%20prioritarios,%20CajaCierre%20y%20nombres%20de%20permisos.md).

Cierra los puntos 1 y 2 del "Fuera de alcance" de ADR-082. Sin migraciones ni flags. Ejecutado
con subagentes (implementador + revisión de spec + revisión de calidad por tarea, TDD RED→GREEN)
en un **worktree aislado** (había una sesión concurrente en el mismo checkout). Se planificó como
"ADR-084" pero ese número (y el 083) los tomaron sesiones concurrentes → renumerado a **085**.

- **A — SEC-2 en 12 dominios no prioritarios** con el patrón de ADR-082 (handler `payload: unknown`
  → primitivas de `main/validation/core.ts` en locales `v_`, después de sesión, antes de DB; capa
  C/D con `useCallIpc`+`rutearCampoError`+toasts de éxito; test de validación + test de ruteo por
  dominio). Tanda 1: transportista, sinónimos, equivalencias, presentaciones, recepción, órdenes de
  compra, presupuestos, remitos. Tanda 2: producto-proveedor, reglas de precio, cambios programados,
  cuenta corriente. Regla mantenida: sin requeridos nuevos (omitido→TIPO, ''→REQUERIDO).
- **B — Ruteo por-campo en `CajaCierreView`**: validación de monto antes de abrir el modal; doble
  superficie (`errorMonto` inline + `errorCierre` banner); discriminador credencial-vs-dominio en la
  vista (`SUPERVISOR_INVALIDO` queda en `SupervisorAuthModal`, el resto cierra el modal y se rutea a
  la vista con toast unificado). `SupervisorAuthModal` y el handler `caja:cerrar` sin cambios.
- **C — Mapa `ETIQUETA_PERMISO`/`etiquetaPermiso` en `@ferreteria/shared`** (29 etiquetas amigables)
  + test de cobertura contra `PERMISOS` (exportado en seed.ts). Groundwork sin consumidor de UI aún.
- **Higiene:** renombre de locales que ensombrecían primitivas; baja de tipos de payload nominales
  muertos; alta de códigos de dominio faltantes en `errores.ts` (presentaciones y caja).

Ambos runners verdes: **main 1549** (135 archivos), **renderer 912** (140 archivos), `tsc` limpio,
build de `shared` OK.

**Fuera de alcance:** SEC-2 Tanda 3 (smtp, backup/restore, parámetros, importaciones — el catálogo
de errores ya los traduce); agenda (flag, sin permiso), geo/dashboards/infra de lectura; capa C/D en
`OcSugeridaView`/`ProveedorAgregarProductosModal` (backend igual valida); **PERF-3** (editor de
permisos por rol — decisión de producto abierta, diferida a ADR dedicado; insumos:
`docs/perf3-permisos-analisis.md` + `docs/perf3-permisos-mockup-opcion-B.html`).

## ADR-086 — Modos de la app (skin) + fix del selector de Apariencia

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-14 ·
Detalle en [`ADR-086 - Modos de la app (skin).md`](ADR-086%20-%20Modos%20de%20la%20app%20(skin).md).

Agrega un eje **Modo** (`skin`: `actual`|`maximizar`|`confortable`) en Apariencia. Principio: **el
Tema manda el color; el Modo, la geometría** (espaciado, radios, sombra, ancho de sidebar, nav,
tabla). El Modo **reemplaza** al control de Densidad (panel = Tema · Modo · Acento · Tipografía);
`densidad` se conserva en BD pero se **deriva** del modo al aplicar al DOM (`maximizar`→`compact`,
resto→`comfortable`) en `AuthContext.applyPreferences` y `AppearanceDrawer.applyToDOM`. De paso
arregla un bug del drawer: al cambiar tema/fuente/densidad el DOM cambiaba pero el botón no quedaba
seleccionado, porque reenviaba la fila completa de preferencias (`favoritos` como string JSON) a
`preferencias:save` → `normalizarFavoritos` lanzaba y `setPreferencias` nunca corría; fix: enviar
sólo los campos de apariencia.

- Migración `0048_adr086_skin_modo.sql` (columna `skin`, default `actual`, aditiva).
- Enum + tipos (schema/session/AuthContext/`SavePreferenciasPayload`), control **Modo** en
  `AppearanceDrawer`, bloques `[data-skin="maximizar"]`/`[data-skin="confortable"]` en `global.css`
  (base = `actual`). Suite verde (**main 1557** + renderer), `tsc` limpio. **Merge #46.**

## ADR-087 — PERF-3 (opción A): pantalla Roles y permisos (matriz RBAC de solo lectura)

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-16 ·
Detalle completo en
[`ADR-087 - PERF-3 opcion A - Matriz RBAC de solo lectura.md`](ADR-087%20-%20PERF-3%20opcion%20A%20-%20Matriz%20RBAC%20de%20solo%20lectura.md).

Primer consumidor del mapa `ETIQUETA_PERMISO` que dejó ADR-085. Cierra PERF-3 en su **opción A**
(solo lectura); la opción B (edición) sigue abierta. Sin migración, sin flags, sin escritura →
cero riesgo sobre invariantes RBAC.

- **Main:** `permisoMatrizHandler` (canal `permiso:matriz`, guard `usuario.administrar`) → `{ roles,
  permisos, porRol }` (roles activos + todos los permisos con módulo + códigos por rol vía join
  `rol_permiso × permiso`). `OPERADOR_PERMISOS` exportado en `seed.ts` para el test de conteo.
- **Preload:** namespace `permisos.matriz()`.
- **Renderer:** `RolesPermisosView` (tarjetas de resumen por rol, tabla agrupada por módulo con
  columnas por rol y celdas ✓/—, badge "Solo lectura", nombres amigables via `etiquetaPermiso`) +
  ruta `config/roles-permisos` + ítem NAV (grupo Sistema, `usuario.administrar`) + breadcrumb — las
  tres cosas de §Navegación.

Ambos runners verdes: **main 1560**, **renderer 922**, `tsc` limpio. Tests: handler
(`permiso-matriz.test.ts`) + vista (`RolesPermisosView.test.tsx`).

**Fuera de alcance:** PERF-3 opción B (edición con guardas) — su propio ADR (tabla de overrides +
`runSeed` que la respete + guardas de invariante).

## ADR-088 — Contraste en modo Oscuro + tokens de color semánticos

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-18 ·
Detalle en [`ADR-088 - Contraste modo oscuro y tokens semanticos.md`](ADR-088%20-%20Contraste%20modo%20oscuro%20y%20tokens%20semanticos.md).

Texto ilegible en Oscuro en cajas de mensaje (ej. "Se van a actualizar N productos" de
`RecalcularModal`) y resaltados. Causa raíz: varios componentes usan `var(--color-*, <fallback
claro>)` (`--color-info-bg`, `--color-danger-bg`, `--color-warning-bg`, `--color-success`, …) con
tokens que **nunca estaban definidos** → siempre caían al fallback claro; con `--ink` claro en
Oscuro, quedaba claro sobre claro.

- Fix (sólo `global.css`, cero cambios de componentes): define `--color-success/warning/danger/info`
  y sus `*-bg`/`*-text` para claro y Oscuro con **valores literales por tema**. (Gotcha: un alias
  `--a: var(--b)` declarado en `:root` resuelve `var(--b)` en el scope de `:root` y hereda el valor
  ya resuelto → el override de `--b` en `[data-theme="oscuro"]` no fluye; por eso literales.)
- Además: `.alert-warn` deja de estar hardcodeada, alta de `.alert-ok`/`.alert-info`,
  `<mark>`+`::selection` theme-aware, y `--accent-soft` con variante Oscuro (`color-mix`) vía
  `:root[data-theme="oscuro"]` (arregla nav activo y hover de fila del modo Maximizar). **Merge #49.**

**Follow-up (#51, 2026-09-18):** dos spots más reportados con captura — POS → dropdown de búsqueda
(`PosScanBar`: los `<button>` de resultado no seteaban `color`; un `<button>` **no hereda `color`**
→ usaba el default oscuro del navegador, invisible sobre superficie oscura → `color:'var(--ink)'`) y
Dashboard → KPIs "Ventas del día" (`VentasPanel`: tile `background:var(--accent-soft)` con valor
heredando color → `var(--surface-2)` + borde + `color:'var(--ink)'`).

## ADR-089 — Tipografías bundleadas localmente + nuevo set de 6

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-18 ·
Detalle en [`ADR-089 - Tipografias bundleadas y nuevo set.md`](ADR-089%20-%20Tipografias%20bundleadas%20y%20nuevo%20set.md).

Las 3 fuentes previas (Hanken Grotesk, Figtree, Onest) eran casi iguales y, además, Figtree/Onest
**nunca se cargaban** (no estaban en el `<link>` de Google del `index.html`). Nuevo set de 6 con
carácter bien distinto: **Hanken Grotesk, Inter, IBM Plex Sans, Atkinson Hyperlegible, Nunito,
Barlow Semi Condensed**.

- **Offline-first real:** los `.woff2` (subset latin, cubre español) se versionan en
  `src/renderer/styles/fonts/` y se declaran en `src/renderer/styles/fonts.css` (`@font-face`,
  `font-display:swap`), importado en `index.tsx` antes de `global.css`; incluye JetBrains Mono. Se
  elimina el `<link>` a Google del `index.html` y se endurece el CSP (`style-src 'self'
  'unsafe-inline'`, `font-src 'self' data:`).
- Migración `0049_adr089_tipografias.sql` remapea `ui_font` fuera del set → `Hanken Grotesk`. Enum +
  tipos + lista del `AppearanceDrawer` + default `--ui-font`. Suite verde, `tsc` limpio. **Merge #50.**

## ADR-090 — Matcheo de Importar Costos contra todo el catálogo + sugerencias inline; Exportar en 8 listados; Lote dentro del hub

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-18

Lote de correcciones sobre Importar Costos/Catálogo, exportación y navegación de Precios y Costos.

**1. Matcheo contra todo el catálogo (revierte el scope estricto de ADR-051).** `construirLookups`
(`main/ipc/importacion-costo.ts`) restringía EAN y COD_INTERNO a productos **ya vinculados** al
proveedor → un proveedor sin vínculos previos no matcheaba ninguna fila (0/N). Se revierte: EAN y
COD_INTERNO —identificadores del **producto**, no del vínculo— resuelven contra todo el catálogo
activo; el vínculo `producto_proveedor` se crea al Confirmar. `COD_PRODUCTO_PROV` sigue por vínculo
(es dato del vínculo). La advertencia cruzada por código cubre la carga al proveedor equivocado.
Importar Catálogo ya matcheaba global (sin cambio). `costo_anterior` pasa a `null` cuando no hay
vínculo previo.

**2. Bug de columna de descripción.** El parser leía `NOMBRE`, pero la plantilla y los archivos
reales usan `DESCRIPCION` → el matcher de similitud nunca recibía texto (tests verdes que inyectaban
`NOMBRE` a mano lo enmascaraban). Ahora lee `DESCRIPCION` con `NOMBRE` como alias. Afecta a la Cola de
Revisión de costos y a Importar Catálogo (parser compartido).

**3. Matcher por similitud.** `crearMatcher` normaliza **en vivo** (deja de confiar en la columna
`nombre_corto_norm`, que podía quedar desactualizada) y puntúa contra `nombre_corto` **y**
`nombre_largo` (best-field: máximo de ambos). Consumido por Cola de Revisión, Importar Catálogo y
"Buscar similares" (Catálogo/POS).

**4. Sugerencias inline en Previsualizar (paridad con Importar Catálogo).** `parseArchivo` y
`revalidarFila` devuelven `candidatos` + `nombre_producto_archivo` para filas sin identificar; la tabla
muestra botones "Asignar" (nombre + SKU + score), `matched_by='similitud'`, sin persistir hasta
Confirmar. Se agrega el filtro "Con sugerencia", el toolbar en una sola línea, anchos de columna
ajustados (Línea centrada, EAN fijo, `COD_PROD_PROV`/`SKU INT` acortados, DESCRIPCION ancha) y la nota
de ayuda del pie como `<details>` colapsable.

**5. Exportar en 8 listados nuevos (extiende P1.12/ADR-EXP; solo Supervisor).** Proveedores, Remitos,
Presupuestos, Categorías, Marcas, Unidades, Sinónimos, Transportistas: descriptor en `shared` +
`queryAll` en el handler (remitos/presupuestos reusan su list handler) + registro en
`DEFINICIONES`/`fetchFilas` de `exportar.ts` + `ExportarButton` en la vista. Permiso
`export.supervisor` (entidad y perfil). `ExportarButton` pasa a `useAuth()` (antes `useContext`
directo rompía vistas cuyos tests mockeaban solo `useAuth`).

**6. Lote detalle dentro del hub.** El detalle vivía en la ruta plana `precios/lotes/:id`, fuera de
`PreciosHub` → perdía las pestañas y el "Volver" salía del módulo. Se agrega la ruta hija `lotes/:id`
en el hub y navegación **consciente del contexto**: la lista navega relativo (`navigate(b.id)`);
detalle, `RecalcularModal` e `ImportarCostosView` calculan `lotesBase` según `pathname`
(`/precios/hub/lotes` vs `/precios/lotes`). `to=".."` relativo NO sirve (ambiguo entre montaje plano y
anidado). Ambos montajes se conservan.

TDD en las tres capas. Verificado: `tsc` limpio; **shared 157 · main 1578 · renderer 927** verdes.
Falta verificación manual en la app (§12).

## ADR-091 — Corte multi-rubro: boundary Opción C, 4 barandas y topología del monorepo

**Estado:** Aceptado — Fase 2 ejecutada y mergeada (PR #1) · **Fecha:** 2026-09-22

Se reestructura lo hecho como **base reutilizable** para disparar apps por familia de negocio (Retail, Elaborados, Servicios). Monorepo `Gestion-Pymes-Apps` con `packages/{shared, core-db, core-ui, core-main, core-preload}` y `apps/{retail, elaborados}`. **Boundary Opción C: una app puede depender del core, el core nunca de una app**, protegido por barandas automáticas (B4 `no-electron` en `shared` y boundary core↛app por paquete; B1 fiscal y B2 sync definidas, B2 implementada como test en ADR-092). Fase 2 extrajo al core, de forma incremental y acotada por la regla de tres: `shared` → `@core/db` (esquema universal + factory `createDb`/`runMigrations`) → `@core/ui` (design system + primitivos) → `@core/main` (plomería hoja). Lo demás quedó **diferido hasta el 2º consumidor real** (AppShell/vistas, preload, handlers de dominio, seed de auth). Las migraciones las posee cada app.

Detalle completo: [`docs/ADR-091 - Corte multi-rubro (boundary C, barandas, topologia monorepo) - Fase 2.md`](ADR-091%20-%20Corte%20multi-rubro%20%28boundary%20C,%20barandas,%20topologia%20monorepo%29%20-%20Fase%202.md).

## ADR-092 — Elaborados E1: la plataforma va al core por el 2º consumidor real

**Estado:** Aceptado — E1 ejecutado y mergeado · **Fecha:** 2026-09-23

Nace `apps/elaborados` (heladería, `elaborados-client`) y, con ella, la promoción al core de lo diferido en ADR-091, siempre re-apuntando a Retail sin cambio de comportamiento: `runSeed(db, { permisos, operador })` con `PERMISOS_CORE`; handlers universales (auth, usuario, preferencias, parámetros, geo, cliente, cta cte, caja, backup/restore, exportar) con `registerCoreHandlers`; caja con hook `onCajaCerrada`; registry de exportadores; `@core/preload` (`createBridge`, clave de bridge configurable: Retail `window.ferreteria`, Elaborados `window.elaborados`); en `@core/ui` `bridge()`, `AppProfileProvider`, AppShell/CommandPalette/breadcrumbs por props y las vistas universales (clientes, cta cte, caja, usuarios, backup); `crearNavegacion` en `shared`. Baranda B2 (campos de sync por app) como test.

Detalle completo: [`docs/ADR-092 - Elaborados E1 (plataforma al core por 2º consumidor).md`](ADR-092%20-%20Elaborados%20E1%20%28plataforma%20al%20core%20por%202º%20consumidor%29.md).

## ADR-093 — Elaborados E2: inventario elaborado (stock, producción, catálogo de venta)

**Estado:** Aceptado — implementado y mergeado · **Fecha:** 2026-09-28

Stock de artículos con saldo + libro inmutable (`articulo`/`existencia_articulo`/`movimiento_articulo`) y `bloquea_sin_stock` **por artículo** (la reventa bloquea; el granel puede quedar negativo con aviso); costo promedio ponderado; producción transaccional (`receta_produccion`+`produccion`, anular exige Supervisor); conteo/merma con atajo "Tacho vacío"; catálogo de venta (`categoria_venta`, `producto_venta`+componentes, `grupo_modificador`+opciones, `producto_venta_grupo`) con `calcularConsumo`/`validarStock` puras; `impuesto` promovido a `@core/db`; seed demo de heladería bajo demanda. Permisos nuevos `articulo.gestionar`, `stock.ajustar`, `produccion.registrar` (ambos roles) y `receta.gestionar`, `producto_venta.gestionar` (Supervisor).

Detalle completo: [`docs/ADR-093 - Elaborados E2 (inventario elaborado).md`](ADR-093%20-%20Elaborados%20E2%20%28inventario%20elaborado%29.md).

## ADR-094 — AnulacionModal/AnularProduccionModal reusan SupervisorAuthModal (2 pasos)

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-28

Cierra uno de los 5 follow-ups de bajo riesgo detectados en la revisión holística de ADR-093
(Elaborados E2): `AnulacionModal` (Retail, venta) y `AnularProduccionModal` (Elaborados,
producción) reimplementaban cada uno, desde cero, el mismo formulario de motivo+credenciales de
Supervisor que ya existe en `@core/ui` (`SupervisorAuthModal`, consumido por `CajaCierreView`) —
con mensajes de error de `SUPERVISOR_INVALIDO` divergentes entre los dos (comparación exacta vs
`.includes(...)`).

**Decisión:** ambos modales pasan a una máquina de 2 estados (`motivo` → `auth`) que reusa
`SupervisorAuthModal` **sin modificarlo**, replicando el patrón ya usado por `CajaCierreView`
(recolectar datos propios del dominio → abrir `SupervisorAuthModal` solo para credenciales).
Cancelar/Escape en el paso de credenciales **vuelve** al paso de motivo preservando lo tipeado (no
cierra todo el flujo), igual que `CajaCierreView`; el botón del primer paso pasa a decir
"Continuar" en vez de "Anular ..." porque ese click todavía no ejecuta la acción destructiva —
dejar el label viejo hubiera sido engañoso. Efecto colateral: el mensaje de `SUPERVISOR_INVALIDO`
queda unificado en ambas apps. No se creó un componente compartido para el paso de motivo (copy y
color de botón distintos por dominio, ~15 líneas cada uno): habría repetido el mismo problema de
sobre-parametrizar un componente por 2 usos que se estaba resolviendo.

Brainstorm → spec → plan → TDD vía `superpowers:subagent-driven-development` (implementador + spec
reviewer + code reviewer por task, 2 tasks). Spec:
[`docs/specs/2026-09-28-anulacion-two-step-supervisor-auth-design.md`](specs/2026-09-28-anulacion-two-step-supervisor-auth-design.md),
plan: [`docs/plans/2026-09-28-anulacion-two-step-supervisor-auth.md`](plans/2026-09-28-anulacion-two-step-supervisor-auth.md).
Verificado: typecheck del monorepo limpio; **Retail 140 archivos/1591 tests · Elaborados renderer
68/68 + main 65/65**; navegación manual confirmada por el usuario en ambas apps (Retail y
Elaborados).

## ADR-095 — Elaborados E3a: `confirmarVenta`/`anularVenta` al core

**Estado:** Aceptado — implementado y mergeado (PR #6) · **Fecha:** 2026-10-05

La parte universal de confirmar/anular una venta (sesión y permisos, caja, pagos, límite de cta cte, vuelto, numeración, `venta`/`venta_pago`/`movimiento_caja`/cta cte/`comprobante`) sale de Retail a `@core/main` como **template method con hooks**: `confirmarVenta(db, input, { validarPrevio?, aplicarLineas })` y `anularVenta(db, input, { revertirLineas })`. **El core recibe los totales ya calculados** (en pesos, como las columnas legado) y **crea el correlativo** `venta_correlativo_<terminal>` si falta. Retomar una venta en espera lo soporta el core (`venta_en_espera_id`). Retail queda con wrappers finos; su suite es el oráculo.

Detalle completo: [`docs/ADR-095 - Elaborados E3a (confirmarVenta al core).md`](ADR-095%20-%20Elaborados%20E3a%20%28confirmarVenta%20al%20core%29.md).

## ADR-096 — Elaborados E3b: backend de venta (valorizar, confirmar, anular)

**Estado:** Aceptado — implementado y mergeado (PR #8) · **Fecha:** 2026-10-12

Elaborados valoriza, confirma y anula ventas desde el main: dominio puro `valorizarCarrito` (precio = base + recargos de sabor, descuento de línea y global con el motor de `shared`, IVA incluido prorrateado, redondeo a $1, consumo con `calcularConsumo`), handlers `venta:cotizar/confirmar/anular/get/listByCaja`, política de stock R2 (reventa bloquea; granel avisa y puede quedar negativo) y anulación que invierte los movimientos originales. **El renderer no calcula precios.** Esquema `venta_linea`/`venta_linea_modificador`, cliente Consumidor Final asegurado en cada arranque, y `ventaListByCajaHandler` promovido al core.

Detalle completo: [`docs/ADR-096 - Elaborados E3b (backend de venta).md`](ADR-096%20-%20Elaborados%20E3b%20%28backend%20de%20venta%29.md).

## ADR-097 — Elaborados E3c-1: cobro, ticket (B1) e impresión HTML al core

**Estado:** Aceptado — implementado y mergeado (PR #10) · **Fecha:** 2026-10-13

B1 en `@ferreteria/shared` (`ComprobantePayload`, `ivaPorAlicuota`); `TicketModal` genérico y `buildTicketHtml` en `@core/ui` (slot de anulación, `onImprimir` inyectado); `ConfirmarVentaModal` y los tipos de medios de pago movidos al core; `print:html` universal (`crearImpresorHtml` en `@core/main` + `print.html` en `@core/preload`). Convención aclarada: **`venta.descuento_global` es un porcentaje** en ambas apps (Elaborados lo guardaba como importe; corregido). Retail re-apuntado con un adaptador.

Detalle completo: [`docs/ADR-097 - Elaborados E3c-1 (cobro, ticket B1 e impresion al core).md`](ADR-097%20-%20Elaborados%20E3c-1%20%28cobro,%20ticket%20B1%20e%20impresion%20al%20core%29.md).

## ADR-098 — Elaborados E3c-2: POS de Elaborados

**Estado:** Aceptado — implementado y mergeado (PR #11) · **Fecha:** 2026-10-13

Pantalla `/pos`: categorías → grilla de productos → selector de sabores (chips con `min`/`max` y recargo) → carrito valorizado por `venta:cotizar` (debounce y descarte de respuestas obsoletas) → cobro/ticket/impresión del core. Cliente con búsqueda y cuenta corriente (Supervisor al exceder el límite), caja obligatoria, endpoint `venta:catalogo`, `VentaDetalleModal` en Caja, ruta/NAV/crumb y el POS como inicio de la app.

Detalle completo: [`docs/ADR-098 - Elaborados E3c-2 (POS de Elaborados).md`](ADR-098%20-%20Elaborados%20E3c-2%20%28POS%20de%20Elaborados%29.md).

## ADR-099 — Elaborados: carga inicial de datos (seed base, `seed:dev` y atajo en el POS)

**Estado:** Aceptado — implementado y mergeado (PR #11) · **Fecha:** 2026-10-13

Seed base del rubro **una vez por BD** (categorías de venta y grupo Sabores, flag `sistema.seed_rubro_aplicado`); `pnpm seed:base`/`pnpm seed:dev` (desde la raíz `seed:*:elaborados`) con catálogo demo, clientes de ejemplo (2 con cuenta corriente) y 3 ventas, idempotentes y sin `--force`; atajo "Cargar catálogo demo" en el POS vacío. El CLI usa el `dist` de `@core/*`.

Detalle completo: [`docs/ADR-099 - Elaborados carga inicial de datos (seed base, seed dev y atajo en el POS).md`](ADR-099%20-%20Elaborados%20carga%20inicial%20de%20datos%20%28seed%20base,%20seed%20dev%20y%20atajo%20en%20el%20POS%29.md).

## ADR-100 — Elaborados E3d-1: venta en espera y anulación al core

**Estado:** Aceptado — implementado y mergeado (PR #12) · **Fecha:** 2026-10-13

`AnulacionModal` pasa a `@core/ui` (sobre `bridge()`); el encabezado de la venta en espera pasa a `@core/main` (`pausarVentaEspera` con actualización en el lugar vía `venta_id`, `descartarVentaEspera`, `listarVentasEspera`), con las líneas a cargo de cada app por hook. Retail queda con wrappers finos y su suite como oráculo.

Detalle completo: [`docs/ADR-100 - Elaborados E3d-1 (venta en espera y anulacion al core).md`](ADR-100%20-%20Elaborados%20E3d-1%20%28venta%20en%20espera%20y%20anulacion%20al%20core%29.md).

## ADR-101 — Elaborados E3d-2: pedidos en espera/para llevar y anulación en pantalla

**Estado:** Aceptado — implementado y mergeado (PR #13) · **Fecha:** 2026-10-14

Backend `venta.espera:pausar/listar/retomar/descartar` y `venta:confirmar` con `venta_en_espera_id`; un pedido guarda líneas y sabores **sin tocar stock ni caja** y el stock se descuenta una sola vez al confirmar. POS con Guardar pedido (alias + observaciones), panel de pendientes con vencimiento, retomar con el carrito vinculado al pedido, y anulación desde el ticket y desde el detalle de Caja. Corrección transversal: `SupervisorAuthModal` traduce los errores envueltos de Electron. Deuda: editar sabores tras la primera venta probablemente rompe (`grupoModificadorOpcionSetHandler`).

Detalle completo: [`docs/ADR-101 - Elaborados E3d-2 (pedidos en espera y anulacion en pantalla).md`](ADR-101%20-%20Elaborados%20E3d-2%20%28pedidos%20en%20espera%20y%20anulacion%20en%20pantalla%29.md).

## ADR-102 — Elaborados E4-PR1: edición de sabores con baja lógica y errores de dominio

**Estado:** Aceptado — mergeado a `main` (PR #16) · **Fecha:** 2026-10-14

`grupo_modificador_opcion` gana `activo` (migración 0006). `grupoModificadorOpcionSetHandler` deja de borrar y reinsertar (rompía por FK desde `venta_linea_modificador` tras la primera venta): hace upsert por `articulo_id` conservando el id, reactiva las dadas de baja y da de baja las omitidas. `venta:catalogo`, la validación de `venta:cotizar/confirmar`, `grupo-modificador:get` y el dev-seed filtran `activo=1`; las ventas históricas conservan su opción. `core-ui/lib/errores.ts` muestra el nombre en `STOCK_INSUFICIENTE:<n>` y traduce los códigos de producción/receta (`RECETA_NO_DEFINIDA`, `RINDE_INVALIDO`, `ARTICULO_NO_ELABORADO`, `CANTIDAD_PRODUCIDA_INVALIDA`, `ANULACION_REQUIERE_AUTORIZACION`, `YA_ANULADA`).

## ADR-103 — Elaborados E4-PR2: compras de insumos

**Estado:** Aceptado — mergeado a `main` (PR #17) · **Fecha:** 2026-10-14

Tablas `compra` (`CP-<terminal>-000001`, proveedor opcional, comprobante en texto libre, `total_centavos`, estado `confirmada|anulada`, motivo de anulación) y `compra_item` (snapshot del nombre, cantidad, costo unitario y subtotal en centavos) — migración 0007. Sin IVA discriminado: el costo del artículo es lo que se paga. Confirmar crea una entrada `movimiento_articulo` (`motivo: 'compra'`, `referencia_tipo: 'compra'`) por ítem con costo promedio ponderado (`costoPromedioEntrada`); si un artículo repite, pondera en orden. Anular exige Supervisor (`verificarSupervisor`), revierte con movimientos `compra_anulacion` en una transacción (política de stock R2: la reventa bloquea con `STOCK_INSUFICIENTE:<nombre>`, el granel puede quedar negativo) y no revierte el costo promedio. Permiso nuevo `compra.registrar` (Operador + Supervisor). Alta rápida de proveedor (`proveedor:crear-rapido`, solo razón social, con defaults DNI "0" / Consumidor Final para las columnas obligatorias del core) hasta el CRUD completo (E4-PR5). Pantalla `/compras` con NAV, ruta y crumb (cubiertos por `nav.test.tsx`). Fuera de alcance: OC/recepción parcial.

## ADR-104 — Elaborados E4-PR3: listas de precio (header al core)

**Estado:** Aceptado — mergeado a `main` (PR #18) · **Fecha:** 2026-10-14

Promoción por regla de tres (2º consumidor): `lista_precio` (header completo, tal como lo creó Retail, incluido `modo_calculo`) pasa a `@core/db` (`schema/listas-precio.ts`; el nombre evita la baranda core↛app) y `cliente.lista_precio_id` pasa a FK dura. Retail no cambia su BD (ya tenía el FK en su SQL): solo se mueve la definición TS y su suite queda como oráculo. `resolverListaEfectiva` se mueve a `@core/main` junto a `listaDeCliente` (Retail lo re-exporta). Elaborados: migración 0008 (crea `lista_precio`, `producto_venta_precio` con índice único parcial `WHERE fecha_hasta IS NULL`, y reconstruye `cliente` para agregar el FK — `runMigrations` apaga `foreign_keys`, precedente ADR-050). Precio de un producto en la lista = precio absoluto vigente (SCD2) o, si no hay, el ajuste % de la lista sobre el base (`precioParaLista`, centavos); los recargos de sabor no varían por lista; una lista inactiva se ignora. `venta:cotizar` acepta `cliente_id` y `cargarCatalogo` resuelve los precios por la lista del cliente (`confirmar` y `pausar` ya traían `cliente_id`); el POS manda el cliente en la cotización y re-cotiza al cambiarlo (las tarjetas de la grilla muestran el precio base). Permiso `lista_precio.gestionar` (solo Supervisor). Pantalla Carta → Listas de precio (alta/edición y grilla de precios por producto) y slots `cargarListasPrecio` conectados en `ClienteForm`/`ClienteDetalle`. Fuera de alcance: promociones, recálculo masivo, vigencias y hook `onListaCreada`.

## ADR-105 — Elaborados E4-PR4: reportes y exportación

**Estado:** Aceptado — mergeado a `main` (PR #19) · **Fecha:** 2026-10-14

Sin migración. Pantalla `/reportes` (Supervisor, permiso existente `dashboard.ver`) con filtro de fechas (por defecto el mes en curso) y tres pestañas. **Ventas:** total, neto de IVA, costo y margen por día y del período, más desglose por medio de pago (el efectivo se informa neto de vuelto); el costo sale de los `movimiento_articulo` de venta, que guardan el costo promedio del momento, así que el margen es histórico y exacto (no usa el costo actual). **Productos y sabores:** unidades e importe por producto de venta y ranking de sabores (veces pedido y consumo, desde `venta_linea_modificador`). **Stock:** artículos activos con stock negativo (el reporte que prometió la política R2) y bajo el mínimo. Todas las consultas cuentan **solo ventas `confirmada`** (`en_espera`, `descartada` y `anulada` quedan fuera) y rechazan rangos inválidos (`VALIDATION:desde:TIPO|RANGO`). Cinco exportadores CSV/XLSX (`export.supervisor`) registrados en el registry del core vía `registerCoreHandlers({ exportadores })`; sus definiciones viven en `common/export-reportes.ts` (browser-safe) y el botón es el `ExportarButton` del core (alcance «filtrado» = período en pantalla; «todo» = todo el historial). Fuera de alcance: margen por producto (el costo se registra por artículo y venta, no por línea).

## ADR-106 — Elaborados E4-PR5: CRUD de proveedor al core

**Estado:** Aceptado — mergeado a `main` (PR #20) · **Fecha:** 2026-10-14

Promoción por regla de tres: el CRUD de proveedor (`list/get/upsert/deactivate`, validación SEC-2, código `PROV-NNNN`) pasa de Retail a `@core/main` (`ipc/proveedor.ts`), con canales universales `proveedor:*` registrados por `registerCoreHandlers` y expuestos por `coreCanales` (`bridge().proveedor.*`). Lo que es de cada app entra por el hook `onProveedorActualizado(db, { id, userId, cambioDefaults })` (opción `proveedor` de `registerCoreHandlers`); un error del hook se loguea y no rompe el upsert. El permiso `proveedor.gestionar` pasa a `PERMISOS_CORE` (solo Supervisor). Retail queda con wrappers finos (`ipc/proveedor.ts`) y su hook (`proveedorHooksRetail`: lotes de precio `PROVIDER_COST_UPDATE` cuando cambian los defaults comerciales), su preload re-apunta `compras.proveedor.*` a los canales del core y su suite es el oráculo (main 1598 / renderer 925 sin cambios). Elaborados: pantalla Compras → Proveedores (contacto básico: razón social, documento, condición fiscal, contacto, teléfono, email, domicilio, observaciones; alta, edición y baja lógica; Supervisor), y sus canales de selección/alta rápida del flujo de compras pasan a `compra:proveedor-list` / `compra:proveedor-crear-rapido` (`compra.registrar`) para no chocar con los del core. Sin migración. Fuera de alcance: defaults comerciales en la UI de Elaborados (las columnas existen, sin motor de costos que las use) y mover el formulario de Retail al core. Con esto E4 queda completo.

## ADR-107 — Elaborados E5-PR1: rendimiento del POS e impresión robusta

**Estado:** Aceptado — mergeado a `main` (PR #21) · **Fecha:** 2026-10-15

Primera pieza de cierre de deuda tras E4. (1) Migración 0009 de Elaborados: índices `idx_venta_linea_venta_id` y `idx_venta_linea_modificador_linea_id` (generada con drizzle-kit desde el esquema). (2) `ventaCatalogoHandler` deja las consultas en cascada (una por producto, grupo y opción) y pasa a cinco consultas en bloque con `inArray` agrupadas en memoria; la salida y el orden son idénticos y un test fija que el número de consultas no crece con el tamaño del catálogo. (3) `crearImpresorHtml` (`@core/main`) cierra la ventana oculta si `loadURL` rechaza y propaga el error. Sin cambios de comportamiento visibles ni de contrato IPC.

## ADR-108 — Elaborados E5-PR2: precio por lista en las tarjetas del POS y deuda de UX

**Estado:** Aceptado — mergeado a `main` (PR #22) · **Fecha:** 2026-10-15

(1) `venta:catalogo` acepta `cliente_id` opcional y devuelve `precio_centavos` ya resuelto con `resolverPreciosCliente`, el mismo camino de la cotización: las tarjetas del POS dejan de mostrar el precio base cuando el cliente tiene lista (el renderer sigue sin calcular precios). `usePosCatalogo(clienteId)` recarga el catálogo al cambiar de cliente; el preload pasa el payload. (2) `ClienteSelector` queda totalmente controlado: se elimina el estado interno con el nombre elegido, que podía quedar desfasado del cliente del padre. (3) El alta rápida de proveedor delega en `proveedorUpsertHandler` del core (ADR-106): comparte validación y asigna código `PROV-NNNN`; el documento queda vacío (el core lo admite) en lugar del `"0"` inventado. Sin migración.

## ADR-109 — Retail: el ticket lista todos los medios de pago

**Estado:** Aceptado — mergeado a `main` (PR #23) · **Fecha:** 2026-10-15

El ticket del POS de Retail mostraba un único medio porque `ticketDesdeVentaRetail` armaba `pagos` con `venta.forma_pago` (campo legado: primer medio de `venta_pago`). El adaptador recibe ahora un tercer parámetro opcional con los pagos confirmados y los mapea a `PagoComprobante` (medio, monto, recargo); sin pagos conserva el comportamiento anterior (ventas legado). `PosView` guarda los pagos al confirmar, también en el reintento con autorización de Supervisor por límite de crédito. Solo renderer, sin cambios de main ni de contrato; los tests existentes no se tocaron. Con esto se cierra la deuda de E4 (ADR-107 a 109).

## ADR-110 — Elaborados E5-PR1: datos demo gestionables (Configuración → Datos demo)

**Estado:** Aceptado — mergeado a `main` (PR #24) · **Fecha:** 2026-10-15

Primera pieza de E5 (endurecimiento y release 1.0.0; spec `docs/superpowers/specs/2026-10-15-elaborados-e5-release-design.md`). Equivalente a Datos demo de Retail (ADR-062). Migración 0010: tabla `demo_registro` (`tabla`, `registro_id` + campos de sync). `runDemoHeladeriaSeed` pasa a ser atómico (una transacción) y anota por diferencia de ids antes/después todo lo que crea en 12 tablas (artículos, existencias, movimientos, recetas, producciones, categorías, grupos, opciones, productos de venta y sus vínculos); lo que ya existía del seed base (categorías, grupo Sabores) no se registra. Canales `demo-catalog:estado | seed-heladeria | vaciar` (permiso `usuario.administrar`): `seed` solo carga sobre un catálogo sin productos de venta y devuelve el estado; `vaciar` borra únicamente lo registrado en orden seguro por FKs y, si algo fuera del registro depende de lo demo (ventas, compras, movimientos de stock, producciones o recetas propias), falla con `DEMO_EN_USO:<claves>` sin borrar nada (traducido en `@core/ui`). Vista `ConfigDatosDemo` con confirmación en dos pasos, ruta `/config/datos-demo`, ítem en Sistema y crumb. El atajo "Cargar catálogo demo" del POS vacío sigue usando el mismo canal.

## ADR-111 — Elaborados E5-PR2: instalador 1.0.0 y arranque del paquete

**Estado:** Aceptado — mergeado a `main` (PR #25) · **Fecha:** 2026-10-15

Elaborados pasa a **1.0.0** con instalador NSIS de instalación manual (sin auto-update, sin publicación, sin firma). `pnpm dist` (`scripts/dist.cjs`: electron-forge package → electron-builder `--prepackaged --publish never`) genera `dist/Heladeria-Setup-1.0.0.exe`; `pnpm dist:elaborados` desde la raíz. Ajustes de empaquetado: `productName` unificado en "Heladería"; **`deleteAppDataOnUninstall: false`** (la base de la heladería vive en `userData` y desinstalar no debe borrarla; estaba en `true` por copia de Retail); `custom.nsh` cierra `elaborados.exe` antes de instalar/desinstalar; el **geo-cache pasa a `extraResource` de forge** porque con `--prepackaged` electron-builder ignora `extraResources`; el `better-sqlite3` copiado al paquete se marca `.forge-meta` (ABI de Electron) para que electron-rebuild no intente compilar desde fuente (esta PC no tiene Visual Studio; el humo detecta un binario de ABI equivocado). **Bug crítico encontrado y corregido:** `packages/core-main/src/seed/geo.ts` se autoejecutaba con `require.main === module`, que en el bundle del main de Electron es siempre verdadero: cada arranque empaquetado lanzaba el CLI de descarga, intentaba abrir `%APPDATA%/ferreteria-client/ferreteria.db` (la BD de Retail) y terminaba la app con `process.exit(1)`. Ahora el CLI exige `GEO_SEED_CLI=1` (lo setea `apps/retail/scripts/seed-geo.cjs`) y un test fija que no vuelva el disparador. `pnpm smoke` (`scripts/smoke-packaged.cjs`) extrae el instalador con 7za (sin instalar nada), arranca el `.exe` con un `userData` temporal y exige: geo-cache presente, ningún `.db` en el paquete, 11 migraciones aplicadas, admin, Consumidor Final, impuestos y 4027 localidades. Pendiente (PR4): instalar en PC limpia y probar el desinstalador; ícono propio (hoy es el mismo `.ico` de Retail); firma de código.

## ADR-112 — Elaborados E5-PR4: cierre de release 1.0.0 (runbook y checklists)

**Estado:** Aceptado — implementado en rama `e5-pr4-cierre-release` (pendiente de merge) · **Fecha:** 2026-10-15

Cierre documental de E5 (sin código de producción). Nuevo `docs/RUNBOOK-elaborados-release.md`: ubicación de los datos (`%APPDATA%\elaborados-client`, que sobreviven a reinstalar y desinstalar), construcción del instalador (`pnpm dist:elaborados`) y sus condiciones de entorno (sin Visual Studio; `better-sqlite3` ya compilado para Electron; cerrar `pnpm dev` antes de `rebuild:electron`), humo automático `pnpm smoke`, primera instalación (usuario inicial, cambio de contraseña, carga con Datos demo o directa, caja, backups), procedimiento de actualización manual, checklist de PC limpia y checklist de recorrido funcional E1–E4 para verificación manual. El recorrido guiado no lo pudo automatizar la sesión (la ventana de Electron fue usada a mano en paralelo, así que se frenó para no pisar acciones): queda a cargo del usuario, y lo que encuentre se corrige con test y ADR propios. Deuda registrada: ícono propio, firma de código, prueba en PC limpia y riesgo hermano en Retail (`base-seed/index.ts` con `require.main === module` dentro del bundle, mismo patrón que el bug de `geo.ts`, ADR-111).

---

## ADR-113 — Retail: `base-seed/index.ts` ya no se autoejecuta al bundlearse

**Estado:** Aceptado — implementado en rama `fix/retail-base-seed-cli-guard` · **Fecha:** 2026-10-15

Mismo patrón que el bug de `geo.ts` (ADR-111): `apps/retail/src/main/base-seed/index.ts` terminaba con `if (require.main === module)`, y `startup.ts` lo importa (`runBaseSeed`, `isSeedBaseAplicado`), por lo que queda dentro del bundle del main de Electron, donde `module` es el entry y la condición es verdadera en cada arranque empaquetado (el CLI `seed:base` abriría `%APPDATA%/ferreteria-client/ferreteria.db`, migraría y sembraría, y terminaría la app con `process.exit(1)` si fallaba). No se verificó con un build empaquetado de Retail (se razonó por el mecanismo idéntico al de ADR-111, confirmado allí con el humo del paquete de Elaborados). **Decisión:** el CLI exige `BASE_SEED_CLI=1`, que setea `apps/retail/scripts/seed-base.cjs`; test de guarda `base-seed.cli-guard.test.ts` (no `require.main === module`, exige el flag y que el lanzador lo setee). Sin cambios de comportamiento para `pnpm seed:base`. Mismo tratamiento a `apps/elaborados/src/main/dev-seed/index.ts` (hoy ningún módulo del main lo importa, pero tenía el mismo disparador): ahora exige `DEV_SEED_CLI=1`, que setea `scripts/seed-dev.cjs` (y por extensión `seed-base.cjs`); test de guarda `dev-seed/__tests__/cli-guard.test.ts`. Elaborados main 223.

---

## ADR-114 — Revisión P0 (1/5): guards faltantes en `usuario:desactivar` y en las escrituras de precios

**Estado:** Aceptado — implementado en rama `fix/guards-usuario-y-precios` · **Fecha:** 2026-10-20

La revisión profunda del 2026-10-20 (agentes ECC: arquitectura, TypeScript/React, seguridad, fallos silenciosos) encontró escrituras protegidas solo por sesión, contra la matriz RBAC de CLAUDE.md §8. **Cambios:** (1) `desactivarUsuarioHandler` (`@core/main`) exige sesión y `usuario.administrar` —era el único handler de gestión de usuarios sin guard— y rechaza la auto-desactivación (`AUTO_DESACTIVACION`, evaluada después de `LAST_SUPERVISOR`); (2) los canales `listaPrecioValor:setManual`, `listaPrecioValor:recalcularMasivo`, `cambioProgramado:crear` y `cambioProgramado:cancelar` pasan a `requirePermission('config.fiscal')` **en el registro del canal y no en el handler**, porque el scheduler de cambios programados llama a `recalcularMasivoHandler` sin sesión (`callerUserId`); las lecturas siguen abiertas. La UI ya gateaba estas pantallas con `config.fiscal` (`PrecioPanel`, grupo Precios del NAV), así que un Operador no pierde ningún flujo visible. (3) `ConfigUsuarios` pasa por `traducirError` y el catálogo suma `LAST_SUPERVISOR` y `AUTO_DESACTIVACION` (antes el chequeo `e.message === 'LAST_SUPERVISOR'` no matcheaba el mensaje envuelto de Electron). Test helper nuevo `loginAsOperador`. **Tests:** `precios.guards.test.ts` (4 canales × sin sesión / Operador / Supervisor + lecturas abiertas), 5 casos de `desactivarUsuarioHandler`, `errores.test.ts`. Sigue pendiente de la tanda P0: PR2 `origin_id`, PR3 stock agregado, PR4 stock manual y restore, PR5 jobs. Fuera de alcance (P1): login sin límite de intentos y resto de handlers con solo sesión (`existencias:set-minimos`, CRUD de categoría/marca/unidad).

---

## ADR-115 — Revisión P0 (2/5): el `origin_id` de la terminal se aplica al arrancar

**Estado:** Aceptado — implementado en rama `fix/origin-id-por-terminal` (apilada sobre `fix/guards-usuario-y-precios`) · **Fecha:** 2026-10-20

`loadTerminalConfig()` se llamaba al arrancar Retail y Elaborados pero su valor se descartaba, y `setOriginId` no se invocaba en ningún lado: el `origin_id` de todas las terminales era `'C1'` aunque `config.json` dijera otra cosa. Consecuencias: numeración `V-C1-…` repetida entre terminales (`venta.numero_interno` es UNIQUE) y pérdida del origen en el last-write-wins de R4 (ADR-012). **Decisión:** `aplicarConfigTerminal(config)` en `@core/main` (`context.ts`) valida el código (1–8 caracteres alfanuméricos: sin guiones ni espacios, nunca un UUID) y llama a `setOriginId`; si es inválido **lanza `TERMINAL_INVALIDA` y conserva el anterior** (caer en silencio a `C1` es el bug original). Ambas apps ejecutan `aplicarConfigTerminal(loadTerminalConfig())` antes de `runStartup` y de registrar handlers. **Tests:** `context.test.ts` (core-main, 8 casos), y `arranque.origin-id.test.ts` en cada app (guarda sobre el fuente de `main/index.ts`, que importa `electron` y no corre en el runner; mismo recurso que `base-seed.cli-guard.test.ts`). **Limitaciones:** las filas ya creadas con `C1` no se reescriben; asignar un id real a cada terminal es una tarea de instalación (hoy el default sigue siendo `C1`); la config duplicada en las dos apps (`config.ts`) queda como deuda P2. No verificado en una app empaquetada.

---

## ADR-116 — Revisión P0 (3/5): stock agregado por producto y factor de presentación validado en la venta

**Estado:** Aceptado — implementado en rama `fix/venta-stock-agregado-y-factor` (apilada sobre `fix/origin-id-por-terminal`) · **Fecha:** 2026-10-20

`ventaConfirmarHandler` de Retail validaba el stock línea por línea y aceptaba `factor_a_stock_aplicado` tal como lo mandaba el renderer. Dos fallos contra la regla "sin stock disponible no hay venta (sin excepción)": (a) dos líneas del mismo producto (p. ej. distinta presentación) pasaban cada una sola y `aplicarLineasRetail` restaba ambas dejando `stock_resultante` negativo; (b) `factor_a_stock_aplicado = 0` (o negativo, `NaN`) permitía vender sin descontar stock. **Decisión:** (1) `validarLineasPrevio` acumula el stock pedido **por `producto_id`** y lo compara contra `existencias.stock_fisico` con tolerancia `1e-9` (productos fraccionables); (2) `validarFactorDeLinea`: el factor debe ser finito y > 0; si la línea trae `presentacion_id`, la presentación debe existir, ser del mismo producto y estar activa (`PRESENTACION_INVALIDA`) y su `factor_a_stock` debe coincidir con el recibido (`FACTOR_INVALIDO`); sin presentación el factor debe ser 1; (3) `aplicarLineasRetail` lanza `STOCK_INSUFICIENTE` si `stock_resultante < 0` dentro de la transacción (red de seguridad: la validación previa corre fuera de ella). El catálogo de errores del renderer suma ambos códigos. **Tests:** bloque nuevo en `venta.handlers.test.ts` (suma de líneas repetidas por encima y exactamente igual al stock, factores 0/-1/NaN/Infinity, factor ≠ 1 sin presentación, factor que no coincide, presentación inexistente) más `errores.test.ts`; `venta.caracterizacion`, `venta.validation` y `presentacion.handlers` siguen verdes sin cambios. **Fuera de alcance (ADR propio):** recalcular `subtotal`, `total`, `importe_iva` y `ajuste_redondeo` en el main —Elaborados ya lo hace con `valorizarCarrito`—, y el mismo patrón en `venta-espera.ts`, que además no guarda `presentacion_id`/factor y compara `det.cantidad` contra el stock sin aplicar el factor (hallazgos de la revisión, P1). No verificado: venta real en `pnpm dev` con carrito de presentaciones mixtas.

---

## ADR-117 — Revisión P0 (4/5): se elimina `movimiento-stock:create` y se endurece el swap del restore

**Estado:** Aceptado — implementado en rama `fix/stock-manual-y-restore` (apilada sobre `fix/venta-stock-agregado-y-factor`) · **Fecha:** 2026-10-20

**(A) `movimiento-stock:create`.** El canal aceptaba `tipo`, `motivo` y `cantidad` arbitrarios (incluso negativos o `NaN`) con solo sesión y sumaba al `stock_fisico`, esquivando `stock.ajustar`/`stock.entrada`. Ninguna pantalla lo usaba (el renderer solo llama a `movimientoStock.list`; el stock manual va por `stock:*`, que valida y exige permiso). **Decisión:** se elimina el handler, su registro y la entrada del preload, en vez de endurecerlo; `movimiento-stock:list` queda igual. Test: el registro solo expone `movimiento-stock:list`, el módulo no exporta el handler y el preload no contiene el canal.

**(B) Swap del restore.** En `ejecutarRestoreAtomico` la conexión se cerraba antes del swap; si el `rename` fallaba, el rollback era `catch { /* no se puede revertir */ }` (la BD podía quedar ausente, solo con el `.pre-restore.bak`, sin log), y un `unlink` fallido **después** de un swap exitoso disparaba ese mismo rollback y revertía el restore pisando la BD nueva con la vieja. **Decisión:** el swap se extrae a `backup/swap-bd.ts` (`intercambiarBaseDeDatos`, testeable con `rename`/`unlink` inyectables): (1) falla al apartar la BD actual o al colocar la restaurada → vuelve la original y lanza `RestoreSwapError` `RESTORE_SWAP_FALLIDO`; (2) si además falla el rollback → `RESTORE_ROLLBACK_FALLIDO` con la ruta del `.bak` en el mensaje, registrado con `console.error` y el `.bak` queda en disco; (3) un fallo al borrar el `.bak` tras el swap exitoso solo se loguea y **no** revierte. El handler `restore:ejecutar` captura `RestoreSwapError`: con `RESTORE_SWAP_FALLIDO` programa `app.relaunch()` a los 5 s (la BD original está en su lugar y la conexión cerrada deja la app inoperante; el diferimiento permite que el renderer muestre el error); con `RESTORE_ROLLBACK_FALLIDO` **no** reinicia (abriría una BD vacía) y el mensaje al usuario pide no reiniciar y avisar a soporte. El catálogo de errores del renderer traduce ambos códigos.

**(C) Ruta de la BD (hallazgo adicional).** El handler usaba `userData/ferreteria.db` fijo, pero Elaborados guarda `elaborados.db`: un restore en Elaborados cerraba la conexión y fallaba en el `rename` (ENOENT). Ahora la ruta sale de la propia conexión (`rutaDeBaseDeDatos(db)` → `$client.name`; rechaza `:memory:` con `RESTORE_RUTA_BD`).

**Tests:** `swap-bd.test.ts` (9 casos: camino feliz con el orden cerrar→renombrar, fallo del swap con rollback exitoso, fallo de swap + rollback, fallo al apartar la BD actual, fallo del `unlink` posterior sin revertir, resolución de ruta por conexión y rechazo de `:memory:`), `movimiento-stock.handlers.test.ts`, `errores.test.ts`. **No resuelto / deuda:** el `.fbk` sigue sin firma (el sha256 viaja dentro del mismo archivo; HMAC con clave en `safeStorage` va a un ADR propio); el archivo temporal del restore vive en `os.tmpdir()` y `rename` puede fallar entre volúmenes distintos (EXDEV): ahora falla de forma explícita y recuperable, pero conviene crearlo junto a la BD; la escritura del `restore_log` sigue siendo best-effort con `console.error`. No verificado: un restore real en `pnpm dev` (ni de Retail ni de Elaborados).

---

## ADR-118 — Revisión P0 (5/5): tareas en segundo plano y errores no capturados del main

**Estado:** Aceptado — implementado en rama `fix/jobs-y-errores-no-capturados` (apilada sobre `fix/stock-manual-y-restore`) · **Fecha:** 2026-10-20

En `apps/retail/src/main/index.ts` los jobs del arranque corrían sin protección: `applyPendingCambiosProgramados` y `presupuestoVencerLoteHandler` se llamaban directo, al arrancar y dentro de `setInterval`, sin `try/catch`, de modo que un error de SQLite (`SQLITE_BUSY`, una tabla ausente tras un restore a medias) quedaba como excepción no capturada en el main; el worker de avisos usaba `.catch(() => {})` (fallo sin rastro, a diferencia de su corrida inicial que sí logueaba). Tampoco había handlers de `uncaughtException`/`unhandledRejection`. Consecuencia para el negocio: avisos de agenda, mails de cierre de caja y cambios de precio programados que dejan de ejecutarse sin que nadie lo vea. **Decisión:** módulo `@core/main` `tareas.ts` con `ejecutarSeguro(nombre, fn, log)` (registra con el nombre de la tarea, no propaga; si `fn` es asíncrona devuelve una promesa que nunca rechaza), `programarTareaSegura(nombre, intervaloMs, fn, log, { ejecutarAlInicio })` (un tick que falla no frena los siguientes) y `registrarErroresNoCapturados(proc, log)` (idempotente). Retail programa `avisos-reintentos` (60 s), `cambios-programados` (1 h) y `presupuestos-vencidos` (24 h) con `programarTareaSegura`, y Retail y Elaborados llaman a `registrarErroresNoCapturados()` al inicio de `createWindow`, antes de `runStartup`. **Tests:** `tareas.test.ts` (7 casos con timers falsos y un `EventEmitter` como proceso), y guardas sobre el fuente de `main/index.ts` (`arranque.tareas.test.ts` de Retail y un caso en el `arranque.origin-id.test.ts` de Elaborados; `index.ts` importa `electron` y no corre en el runner). **Limitaciones:** (1) registrar `uncaughtException` quita el diálogo por defecto de Electron y deja seguir al proceso con un estado posiblemente inconsistente: es una decisión consciente para un POS que no debe cerrarse en plena venta, pero hoy el único rastro es `console.error`; (2) los fallos de los jobs solo se loguean: persistir el último error y avisar al Supervisor (tabla o aviso `alerta`), `ultimo_error`/`intentos` en `cambio_programado` y el límite de reintentos del scheduler quedan para P1; (3) `ejecutarCatchUp` conserva su `try/catch` propio y el tope `guard < 1000` del worker no se tocó. No verificado: arranque real de la app con un job que falle.

---

## ADR-119 — Revisión P1 (1/4): los totales de la venta de Retail se verifican en el main

**Estado:** Aceptado — implementado en rama `fix/venta-totales-en-main` (apilada sobre `fix/jobs-y-errores-no-capturados`, #35) · **Fecha:** 2026-10-20

`confirmarVenta` recibe `subtotal`, `importe_iva`, `total` y `ajuste_redondeo` calculados por el renderer (`usePosSession.confirmar`); en Retail el main solo re-verificaba el precio unitario contra la lista (ADR-049 §9) y el saldo de pagos contra el `total` recibido (`SALDO_PENDIENTE`), de modo que un renderer defectuoso o alterado podía cobrar de menos o dejar totales inconsistentes con las líneas. Elaborados ya recalcula todo en el main (`valorizarCarrito`, ADR-096), pero parte del catálogo; en Retail el precio llega resuelto y validado por otro control, así que acá solo se necesita **coherencia aritmética**. **Decisión:** `verificarTotalesVenta` (función pura en `@ferreteria/shared`, `totales-venta.ts`) rehace la cuenta en centavos con la misma fórmula del POS (`resolverPrecio` + `redondearPeso`): subtotal de cada línea = `round(precio_unitario × cantidad)`, subtotal general = suma, total = subtotal con el descuento global redondeado al peso, `ajuste_redondeo` y `importe_iva` (`Σ subtotal × alícuota / (100 + alícuota)`, sin aplicar el descuento global, igual que el renderer). Tolerancia: **exacta en centavos** para subtotales, total y ajuste; **±1 centavo para el IVA** (el renderer lo calcula en pesos con float, sin redondear por línea). Valida además rangos (descuentos 0–100, cantidad finita > 0, precio ≥ 0, alícuota ≥ 0). Se invoca al comienzo de `validarLineasPrevio` de Retail, antes de tocar stock o caja. Errores: `TOTALES_INCONSISTENTES`, `DESCUENTO_INVALIDO`, `CANTIDAD_INVALIDA`, `PRECIO_INVALIDO` (el catálogo del renderer suma los dos que faltaban). **Tests:** `totales-venta.test.ts` (24 casos, incluidos 300 carritos pseudoaleatorios armados con la fórmula del POS para detectar falsos positivos por redondeo) y un bloque nuevo en `venta.handlers.test.ts` (total, subtotal, subtotal de línea, ajuste e IVA adulterados rechazados sin tocar stock ni crear venta; descuento global fuera de rango; descuento global coherente aceptado); `venta.caracterizacion` y `venta.validation` siguen verdes. **Fuera de alcance:** `venta-espera.ts` (pausar/retomar) tiene el mismo patrón y no se toca acá; validar que la lista de precios usada sea la del cliente sigue siendo el control de ADR-049. **Riesgo residual:** una diferencia de redondeo del renderer en un caso no cubierto bloquearía una venta legítima con un mensaje que pide revisar el carrito; no se probó contra el POS real en `pnpm dev`.

---

## ADR-120 — Revisión P1 (2/4): límite de intentos de autenticación y política de contraseña

**Estado:** Aceptado — implementado en rama `fix/login-intentos-y-password` (apilada sobre `fix/venta-totales-en-main`, #36) · **Fecha:** 2026-10-20

La revisión halló que ni el login, ni `auth:verifyPassword`, ni `verificarSupervisor` (la autorización de Supervisor del POS, usada por caja, anulaciones, overrides de precio y compras/producción de Elaborados) limitaban intentos —el costo de scrypt era el único freno—, y que no existía política de contraseña (la UI pedía 4 caracteres y el main no validaba nada). **Decisiones del usuario:** (1) **3 fallos seguidos → bloqueo de 15 minutos**; (2) contraseña nueva con **mínimo 8 caracteres, mayúscula, número y carácter especial, distinta del nombre de usuario**; (3) tolerancias de totales como en ADR-119. **Implementación:** `auth/intentos.ts` en `@core/main` (`crearLimiteIntentos`, instancia compartida `limiteIntentos`; reloj inyectable; clave = nombre de usuario sin distinguir mayúsculas ni espacios de borde). Un fallo durante un bloqueo vigente no lo extiende; al vencer vuelve a cero; un acierto reinicia. Se aplica en `loginHandler` (los usuarios inexistentes también acumulan, para no revelar si existen), `verifyPasswordHandler`, `verificarSupervisor` —comparte clave con el login, de modo que un usuario bloqueado tampoco puede autorizar— y la verificación de contraseña actual en `usuarioChangePasswordHandler`. Error `CUENTA_BLOQUEADA:<segundos>`. La política vive en `@ferreteria/shared` (`password.ts`: `motivosPasswordDebil`, `validarPoliticaPassword`, `mensajePasswordDebil`) y se aplica en `usuarioCreateHandler` y `usuarioChangePasswordHandler` (`PASSWORD_DEBIL:<motivo>`) y, para avisar antes de enviar, en `ConfigUsuarios` y `ConfigMiCuenta`; el login muestra el tiempo restante en vez de "Credenciales inválidas" cuando la cuenta está bloqueada, y el catálogo del renderer traduce ambos códigos. **Tests:** `password.test.ts` (16), `intentos.test.ts` (11, con reloj inyectado), `auth.bloqueo.test.ts` en Retail (bloqueo con timers falsos, reinicio por acierto, usuario inexistente, límite compartido con `verificarSupervisor`, política en alta y cambio), `errores.test.ts`, `Login.test.tsx` y `ConfigMiCuenta.test.tsx`; `setupDb()` reinicia el límite para aislar tests. **Límites asumidos:** (a) el contador vive en **memoria del main** y se reinicia al cerrar la app: aceptable para un equipo local, persistirlo requeriría una migración; (b) el bloqueo permite un ataque de denegación de servicio local (fallar 3 veces deja sin acceso a un usuario 15 minutos): decisión consciente a favor de frenar la fuerza bruta, y el Supervisor no tiene hoy un desbloqueo manual (reiniciar la app lo levanta); (c) la regla "distinta del usuario" solo la aplica el main: en Mi cuenta el perfil de la sesión no expone el nombre de usuario (`profile.nombre_usuario` trae el nombre completo); (d) la política **no** se aplica a contraseñas existentes ni al admin sembrado (`admin1234`), que debe cambiarse en la primera instalación. No verificado: el flujo completo en `pnpm dev` (bloquear y esperar).

