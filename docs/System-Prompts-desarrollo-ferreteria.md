# System Prompts — Desarrollo escalonado del Software de Ferretería

> Conjunto de prompts estructurados para construir el sistema con **Claude Code + superpowers**, release por release y fase por fase. Cada fase es desplegable y construye sobre la anterior.
>
> Documentos base: PRD v2.0 · Tech Spec v2.0 · ADR Log v1.0 · Acta de Definiciones v1.0.

---

## Cómo usar este documento

1. **El Prompt 0 (Contexto maestro)** se coloca como `CLAUDE.md` en la raíz del repositorio. Es el contexto permanente que todas las fases comparten; no se pega en cada sesión, vive en el proyecto.
2. **Cada fase (P1.0, P1.1, …)** se ejecuta en su propia sesión/branch. Se pega el prompt de la fase y se deja que superpowers haga su ciclo: **brainstorm → plan → implementación TDD → verificación**.
3. **Orden estricto:** no saltear fases; cada una asume que las anteriores están terminadas y verdes.
4. **Definición de hecho (global):** la fase termina cuando compila, los tests pasan, se respetan las restricciones del Prompt 0, y los criterios de aceptación de la fase se cumplen.
5. **Antes de codear**, dejá que superpowers escriba el plan y revisalo. Si el plan contradice un ADR, se corrige el plan, no el ADR.

---

## PROMPT 0 — Contexto maestro del proyecto (`CLAUDE.md`)

```
# Proyecto: Sistema de Gestión de Ferretería

Sos el asistente de desarrollo de este proyecto. Respetá SIEMPRE este contexto y no
reintroduzcas decisiones ya tomadas (están registradas como ADR). Ante una duda de
arquitectura, preguntá antes de improvisar.

## Objetivo
Sistema de gestión integral para una ferretería que opera OFFLINE-FIRST: vender,
controlar stock, localizar mercadería por QR, facturar (AFIP/ARCA), gestionar compras,
cuentas corrientes y caja. La operación NUNCA se detiene por falta de internet.

## Stack (fijo — ADR-002)
- Lenguaje: TypeScript de punta a punta.
- Cliente de escritorio: Electron + React.
- Base local: SQLite (FUENTE DE VERDAD local — ADR-001).
- Backend nube (desde R4): Node.js + PostgreSQL.
- Monorepo TypeScript. (ORM y herramienta de monorepo: ver ADR-016, pendiente —
  si no está decidido, proponé y esperá confirmación antes de fijarlo.)

## Principios de arquitectura (no negociables)
1. Offline-first: toda operación se escribe primero en SQLite local; la nube consolida
   pero no bloquea. (ADR-001)
2. IDs UUID generados en el cliente. (ADR-003)
3. Toda tabla sincronizable lleva: version (int), origin_id (terminal), sync_state
   (pending|synced|conflict), updated_at. (ADR-003)
4. Sincronización por OUTBOX + idempotencia: reaplicar la misma operación por su id no
   duplica efectos. (ADR-003) — el motor de sync real recién se implementa en R4, pero
   el esquema (campos de sync, outbox) se respeta desde R1.
5. Patrón SALDO + LIBRO DE MOVIMIENTOS INMUTABLE para stock, caja y cuentas corrientes:
   los movimientos NUNCA se editan, solo se agregan; cada movimiento guarda el
   *_resultante (saldo tras el movimiento). (ADR-006)
6. SNAPSHOTS en líneas de venta y compra: descripción, precio/costo y alícuota se copian
   al momento de la operación (no referencia viva al producto).
7. Baja lógica (campo `activo`) en entidades maestras; no borrado físico.
8. Auditoría: usuario_creacion_id/fecha_creacion y, en editables, usuario_modificacion/
   fecha_actualizacion.

## Identificación de productos (ADR-005)
- gtin_barcode (EAN/UPC del fabricante): OPCIONAL, uno solo por producto, se usa en la
  ENTRADA (alta y recepción).
- codigo_qr: ÚNICO por producto, generado por el sistema, identifica y localiza.
- ubicacion_id: atributo del producto (FK a catálogo Ubicacion). UNA sola ubicación por
  producto. Los estantes tienen cartelería pre-impresa fija (no se imprime ni escanea
  la ubicación).
- Periférico: lector inalámbrico 1D/2D como HID (lee EAN/UPC y QR). NO hay captura móvil
  ni PWA. (ADR-004)

## Roles (ADR-008)
Dos roles de sistema: OPERADOR (mostrador + depósito) y SUPERVISOR (administración,
autorizaciones, configuración fiscal, pagos a proveedor, reportes, importación masiva,
anulaciones, override de precio). Un rol por usuario. Permisos como datos (codigo, ej.
`venta.crear`). Toda acción se autoriza contra la matriz RBAC.

## Reglas de negocio clave
- Precio: base (precio_venta_lista, IVA INCLUIDO) → % de lista (el % por producto pisa al
  general, ambos con signo) → descuento de línea → descuento global. (ADR-009)
- Redondeo a $1 sobre el TOTAL de la venta; la diferencia va en Venta.ajuste_redondeo;
  las líneas conservan centavos. (ADR-010)
- SIN STOCK DISPONIBLE NO HAY VENTA (sin excepción).
- Productos inactivos no se venden.
- El stock SIEMPRE cambia vía un MovimientoStock (nunca hay stock sin movimiento).
- Costo promedio ponderado en cada entrada con costo:
  nuevo = (stock*costo_actual + cantidad*costo_entra) / (stock + cantidad)
- Solo IVA como impuesto. (ADR-009/PRD)
- Numeración interna: prefijo + terminal + correlativo (ej. V-C1-000001), asignada al
  confirmar; visible en ticket. La numeración fiscal es de ARCA y recién aplica en R2.
- Caja: registra TODOS los medios de pago; el arqueo cuenta solo el efectivo;
  diferencia > umbral parametrizable requiere autorización del Supervisor.

## Releases (ADR-011) — construir en este orden
- R1: núcleo local (catálogo, stock, ubicaciones/QR, POS, caja, RBAC, importación masiva,
  reposición sugerida, localización, dashboard local). Comprobante interno NO fiscal.
- R2: fiscal (AFIP/ARCA, CAE, NC/ND).
- R3: compras, recepciones, cuentas corrientes (cliente y proveedor), listas de precios.
- R4: nube + motor de sincronización offline-first.
- R5: reportes consolidados, KPIs, preparación multi-sucursal.

## Disciplina de trabajo
- Flujo superpowers: brainstorm → plan (escrito y revisado) → TDD (RED-GREEN-REFACTOR)
  → verificación. No escribir producción sin test que la cubra.
- No introducir dependencias pesadas sin justificar.
- No implementar nada marcado como "fuera de alcance" (e-commerce, móvil, multi-sucursal
  operativo, controlador fiscal, comprobante de compra, reposición automática).
- Ante decisiones abiertas (ADR-012 a 016), proponé opciones y esperá confirmación; no
  las cierres unilateralmente.
```

---

## RELEASE 1 — Núcleo operativo local (MVP)

### P1.0 — Bootstrap del proyecto

```
Objetivo: inicializar el monorepo y el esqueleto del cliente Electron + React + SQLite,
con la convención de sincronización lista, sin lógica de negocio todavía.

Tareas:
- Crear el monorepo TypeScript con **pnpm workspaces** y configurar **Drizzle** como ORM
  (SQLite local; preparado para PostgreSQL en R4). (ADR-016)
- App Electron + React que abre una ventana vacía con navegación base.
- Configurar SQLite local y el sistema de migraciones.
- Definir un tipo/base común para entidades sincronizables (id UUID, version, origin_id,
  sync_state, updated_at) y un helper para generar UUID en cliente.
- Configurar el framework de testing y un test de humo que pase.
- Definir el `origin_id` de la terminal (config local).

Criterios de aceptación:
- `npm test` y el build pasan en verde.
- La app levanta y muestra la ventana base.
- Existe una migración inicial vacía aplicable/reversible.
- La convención de campos de sync está documentada y tipada.

Restricciones: sin tablas de negocio aún; sin nube. Respetar Prompt 0.
```

### P1.1 — Modelo de datos local (migraciones R1)

```
Objetivo: crear el esquema completo de las tablas necesarias para R1 con sus migraciones.

Tablas (ver Tech Spec §2 para campos exactos):
Producto, Ubicacion, Existencias, MovimientoStock, Categoria (autorreferenciada), Marca,
Impuesto, Cliente, Proveedor, Venta, VentaDetalle, Comprobante, Caja, MovimientoCaja,
ListaPrecio, ListaPrecioDetalle, Usuario, Rol, Permiso, RolPermiso, UsuarioPreferencias.

Tareas:
- Migraciones para todas las tablas, con FKs, índices y restricciones de unicidad
  (ej. Ubicacion: unique en codigo y en (sector,estante,posicion); Producto.codigo_qr
  unique; gtin_barcode nullable; Existencias.producto_id unique).
- Todos los campos de sync y auditoría según Prompt 0.
- NO incluir stock en Producto; el stock vive en Existencias. limite_credito NO va en
  Cliente (irá en CuentaCorriente en R3).
- Producto incluye `unidad_venta` (stock/venta), `unidad_compra` y `factor_conversion`
  (default 1) para soportar compra por caja y venta por unidad (ADR-014).
- Stock_reservado y stock_en_transito en Existencias: nullable (uso futuro).
- Enums según Tech Spec (tipo/motivo de MovimientoStock y MovimientoCaja, estados, etc.).
- Tests de migración (aplicar/revertir) y de integridad referencial.

Criterios de aceptación:
- Migraciones aplican y revierten limpio.
- Restricciones de unicidad y FKs verificadas por test.
- Sin lógica de negocio todavía (solo esquema + acceso a datos tipado).

Restricciones: no crear tablas de R2+ (sin Comprobante fiscal completo más allá del
ticket interno; sin OrdenCompra/Recepcion; sin CuentaCorriente). Respetar Prompt 0.
```

### P1.2 — Seguridad y RBAC

```
Objetivo: autenticación de usuarios y autorización por rol, con seed de los dos roles.

Tareas:
- Login con usuario + hash de contraseña; soporte de pin_rapido (hasheado) para cambio
  rápido de operador.
- Catálogo de permisos (codigo, modulo) y relación RolPermiso.
- Seed inicial: roles Operador y Supervisor (es_sistema=true) con su set de permisos
  según la matriz RBAC del Tech Spec §5.
- Middleware/guard que verifica el permiso requerido en cada caso de uso.
- Regla: no se puede desactivar el último Supervisor activo.
- Cargar las preferencias de apariencia del usuario (UsuarioPreferencias: tema, acento,
  ui_font, densidad) al iniciar sesión y aplicarlas; valores por defecto si no existen
  (tema claro, acento amber, Hanken Grotesk, densidad comfortable). Ver Sistema de Diseño §8.

Criterios de aceptación:
- Login y cambio rápido por pin funcionan; contraseñas y pin nunca en texto plano.
- Un Operador no puede ejecutar acciones exclusivas de Supervisor (test).
- Seed reproducible; matriz RBAC cubierta por tests.

Restricciones: respetar Prompt 0 (dos roles, permisos como datos).
```

### P1.3 — Catálogo de productos

```
Objetivo: ABM de catálogo (Producto, Categoria, Marca, Impuesto, Ubicacion) y alta de
producto completa.

Tareas:
- ABM de Categoria (autorreferenciada, N niveles), Marca, Impuesto (solo IVA, con
  predeterminado 21%), Ubicacion (catálogo controlado, 3 niveles obligatorios).
- Alta de producto (proceso Tech Spec 3.1): EAN opcional con validación de duplicados
  (exacto por gtin_barcode; sin EAN, advertencia por nombre similar), SKU autogenerado
  correlativo (editable), codigo_qr único autogenerado, ubicacion_id del catálogo,
  unidad de medida, permite_fraccion, costo, precio (IVA incluido). Crea Existencias en 0.
- Edición/baja lógica; reubicar = cambiar ubicacion_id (sin reimprimir).
- Impresión de etiqueta SOLO-QR en tamaños 5×5 / 10×10 / 15×15 cm. **Soportar ambas
  salidas (ADR-015): impresora de etiquetas/rollo y plancha A4 en impresora común**,
  detrás de una interfaz de impresión configurable; el contenido (QR + tamaño) es
  independiente del medio.
- Datos de unidad: `unidad_venta`, `unidad_compra`, `factor_conversion` (ADR-014).

Criterios de aceptación:
- Alta genera QR y SKU; Existencias nace en 0; validación de duplicados funciona.
- Categorías de N niveles; ubicaciones validadas contra catálogo.
- Tests de los flujos y de las reglas de unicidad.

Restricciones: stock NO se carga en el alta (entra por movimiento, fase 1.4).
```

### P1.4 — Stock y movimientos

```
Objetivo: gestión de existencias con libro de movimientos inmutable y costo promedio.

Tareas:
- Entrada de stock (Tech Spec 3.2): genera MovimientoStock (entrada), incrementa
  Existencias, recalcula costo promedio ponderado (fórmula del Prompt 0).
- Ajuste de inventario (motivo ajuste_conteo) con stock_resultante.
- Merma/rotura (salida) registrada.
- Todo cambio de stock pasa por un MovimientoStock con su *_resultante.
- Consulta de existencias y de kardex (historial) por producto.

Criterios de aceptación:
- Nunca hay stock sin movimiento que lo justifique (test).
- Costo promedio ponderado correcto ante múltiples entradas (test con casos).
- stock_resultante coincide con el saldo recomputado.

Restricciones: la recepción contra OC es R3; acá la entrada es manual/carga.
```

### P1.5 — Localización por QR

```
Objetivo: localizar productos con el lector 2D, 100% offline (Tech Spec 3.9).

Tareas:
- Por producto: ingresar/escanear codigo_qr (o EAN, o buscar) → mostrar ubicación
  (sector/estante/posicion + codigo) y stock disponible.
- Consulta inversa por ubicación: elegir ubicación → listar productos con stock.
- El lector entra como HID (texto): resolver el código a producto/ubicación; distinguir
  por formato si es QR de producto vs EAN.

Criterios de aceptación:
- Resolución correcta por QR y por EAN; consulta inversa lista los productos.
- Funciona sin red (sin llamadas a la nube).

Restricciones: es consulta, no modifica datos. Sin móvil/PWA.
```

### P1.6 — Listas de precios y resolución de precio

```
Objetivo: listas de precios por porcentaje y el motor de resolución de precio.

Tareas:
- ABM de ListaPrecio (ajuste_porcentual con signo, predeterminada) y ListaPrecioDetalle
  (% por producto que reemplaza al general).
- Motor de precio (Tech Spec 3.4): base → % de lista (detalle pisa general) → descuento
  de línea → descuento global; IVA incluido (discriminable); función pura y testeable.
- Redondeo a $1 sobre el total con cálculo del ajuste_redondeo.

Criterios de aceptación:
- Casos de prueba de la cadena de precio (con/sin lista, con/sin % por producto, con
  descuentos) dan el resultado esperado.
- El redondeo produce total entero y ajuste_redondeo entre -0,99 y +0,99.

Restricciones: el override de precio es solo Supervisor; el Operador solo descuenta.
```

### P1.7 — Caja

```
Objetivo: apertura, cierre y arqueo de caja (Tech Spec 3.6).

Tareas:
- Apertura con monto_inicial; impedir abrir si el usuario ya tiene una caja abierta.
- MovimientoCaja (ingreso/egreso) con motivo y forma_pago; retiros y gastos por el
  Operador (auditados).
- Cierre: calcular esperado POR FORMA DE PAGO; contar efectivo; diferencia SOLO sobre
  efectivo; diferencia > umbral parametrizable exige autorización del Supervisor.
- Reporte de cierre (Z) con desglose por forma de pago.

Criterios de aceptación:
- Esperado por forma de pago correcto; diferencia solo de efectivo.
- Autorización del Supervisor requerida sobre el umbral (test).

Restricciones: la caja registra TODOS los medios de pago.
```

### P1.8 — POS / Venta (núcleo)

```
Objetivo: el proceso de venta completo offline con comprobante interno (Tech Spec 3.5).

Tareas:
- Venta con cliente Consumidor Final por defecto; alta de líneas por QR/EAN/búsqueda con
  snapshots (descripcion, precio_unitario, alicuota_iva); cantidades decimales si fracción.
- Resolución de precio (usa el motor de 1.6); descuento de línea y global; total
  redondeado a $1 con ajuste_redondeo.
- SIN STOCK DISPONIBLE NO HAY VENTA; productos inactivos no se venden.
- Forma de pago: efectivo/transferencia/tarjeta → MovimientoCaja; cuenta corriente queda
  para R3 (en R1, deshabilitada o solo Consumidor Final al contado).
- Confirmar: Venta + VentaDetalle, MovimientoStock (salida/venta), numeración interna
  (prefijo+terminal+correlativo), Comprobante tipo ticket_interno; impresión del ticket.
- Anulación (3.5b): solo Supervisor, por movimientos inversos; permitir anular ventas de
  cajas cerradas impactando la caja actual.
- Obliga a tener caja abierta para vender.

Criterios de aceptación:
- Venta descuenta stock y registra caja; ticket con numero_interno.
- Bloqueo por stock y por producto inactivo (tests).
- Anulación revierte stock y caja por movimientos inversos (no borra).

Restricciones: sin fiscal (eso es R2); cuenta corriente real es R3.
```

### P1.9 — Importación masiva (Excel/CSV)

```
Objetivo: alta/actualización masiva por planilla (Tech Spec 3.10), solo Supervisor.

Tareas:
- Plantillas por entidad: Producto, Cliente, Proveedor, Ubicacion, stock inicial, Lista
  de precios (detalle). Columnas fijas con obligatorias marcadas.
- Flujo: subir → validar fila por fila (tipos, obligatorios, duplicados, referencias
  existentes) → previsualización (OK / error con motivo / actualización) → confirmar →
  resumen descargable.
- Crear + actualizar (match por SKU/EAN en productos; por documento en personas).
- Productos importados autogeneran QR y SKU y nacen con Existencias 0; el stock inicial
  entra por su propia planilla generando MovimientoStock.

Criterios de aceptación:
- Importa las filas válidas aunque otras fallen; resumen correcto.
- Actualización por match funciona; productos generan QR/SKU/Existencias.

Restricciones: solo Supervisor; auditada.
```

### P1.10 — Reposición sugerida

```
Objetivo: alerta y reporte de reposición (Tech Spec 4.2), informativo.

Tareas:
- Disparador: stock_disponible <= stock_minimo (un solo umbral).
- Cantidad sugerida = stock_maximo - stock_disponible (si hay máximo; si no, alerta sin
  cantidad). Calcular en `unidad_venta`; opcional mostrar equivalente en `unidad_compra`
  (cajas) vía `factor_conversion`.
- Indicador de cantidad de productos bajo mínimo + reporte de reposición (Supervisor).

Criterios de aceptación:
- Lista correcta de productos a reponer y cantidad sugerida (tests).
- Solo lectura; no genera compras ni movimientos.

Restricciones: informativo; no ejecuta reposición.
```

### P1.11 — Dashboard local

```
Objetivo: dashboard local de R1 (Tech Spec 3.11), solo Supervisor.

Tareas:
- Ventas: del día, ticket promedio, productos más vendidos, ventas por forma de pago.
- Stock: productos bajo mínimo, valor de inventario a costo, productos sin movimiento.
- Caja: ingresos vs egresos del día, estado de la caja actual, diferencias de arqueo.
- Todo a partir de datos locales; solo lectura.

Criterios de aceptación:
- Métricas correctas contra datos de prueba; performante con catálogo grande.

Restricciones: Compras y Cuentas Corrientes NO (entran en R3); consolidado multi-terminal
es R4/R5.
```

---

## RELEASE 2 — Fiscal (AFIP/ARCA)

### P2.0 — Especificación previa (bloqueante)

```
NOTA: el proceso fiscal completo NO está especificado todavía (ADR-013 y RFC-001 §8.6
pendientes). Antes de implementar R2:
- Definir si la integración fiscal corre en cliente o nube (ADR-013).
- Especificar el proceso completo: WSAA (token) → WSFEv1 (CAE) → numeración fiscal por
  (tipo + punto de venta); manejo offline (comprobante en pendiente_cae + reintento);
  notas de crédito/débito; tipos de comprobante según condición fiscal emisor/receptor.
NO implementar hasta cerrar esta especificación.
```

### P2.1 — Integración fiscal y emisión con CAE

```
Objetivo: emitir comprobantes fiscales con CAE (tras cerrar P2.0).

Tareas (resumen, a detallar en la spec de R2):
- Cliente WSAA (autenticación/token) y WSFEv1 (solicitud de CAE).
- Completar Comprobante (punto_venta, numero, cae, cae_vencimiento, estado) sobre la venta.
- Determinar tipo de comprobante por condicion_fiscal del emisor y receptor (A/B/C).
- Comportamiento offline: venta confirmada + comprobante en pendiente_cae; reintento al
  recuperar conexión; pasar a autorizado/rechazado según respuesta.
- Notas de crédito/débito referenciando el comprobante original; anulación fiscal vía NC.

Criterios de aceptación:
- Comprobante con CAE válido y numeración correlativa por (tipo + punto de venta).
- Sin conexión: la venta no se bloquea; el CAE se obtiene luego.

Restricciones: respetar normativa ARCA vigente (verificar documentación oficial).
```

---

## RELEASE 3 — Abastecimiento y crédito

### P3.1 — Cuentas corrientes (modelo)

```
Objetivo: agregar cuentas corrientes de clientes y proveedores.

Tareas:
- Tablas CuentaCorriente + MovimientoCtaCte (cliente) y CuentaCorrienteProveedor +
  MovimientoCtaCteProveedor (proveedor), patrón saldo + libro inmutable con saldo_resultante.
- Mover limite_credito a CuentaCorriente (sacarlo de Cliente).
- Migraciones + integridad.

Criterios de aceptación: saldos reconstruibles desde los movimientos; tests.
```

### P3.2 — Compras y recepciones

```
Objetivo: órdenes de compra y recepciones que actualizan stock, costo y deuda (Tech Spec 3.3).

Tareas:
- Tablas OrdenCompra, OrdenCompraDetalle, Recepcion, RecepcionDetalle.
- Proveedores y OC; recepciones parciales (acumular cantidad_recibida; estados de OC).
- Recepción genera MovimientoStock (entrada/recepcion_compra), recalcula costo (gana el
  costo real), y genera el cargo en CuentaCorrienteProveedor (= cantidad recibida × costo real).
- Sobre-recepción permitida con autorización del Supervisor.
- Si la recepción se registra en `unidad_compra`, convertir a `unidad_venta` con
  `factor_conversion` para el stock; `costo_unitario_venta = costo_compra / factor` (ADR-014).

Criterios de aceptación: recepción parcial y total correctas; costo real aplicado; cargo
al proveedor correcto (tests).
```

### P3.3 — Cobros, pagos y venta a crédito

```
Objetivo: completar el circuito de crédito.

Tareas:
- Venta a cuenta corriente en el POS: exige cliente habilitado; exceso de límite advierte
  y bloquea salvo autorización del Supervisor; genera MovimientoCtaCte (cargo/venta_credito).
- Cobro de cuenta corriente (3.7): pago + MovimientoCaja (ingreso/cobro_cta_cte); sobrepago
  deja saldo a favor.
- Pago a proveedor (3.8): SOLO Supervisor; pago + MovimientoCaja (egreso/pago_proveedor);
  sobrepago deja saldo a favor.
- Dashboard suma Compras y Cuentas Corrientes.

Criterios de aceptación: circuito venta-crédito → cobro y recepción → pago, con caja
conciliada; autorizaciones aplicadas (tests).
```

---

## RELEASE 4 — Nube y sincronización

### P4.1 — Backend nube y esquema PostgreSQL

```
Objetivo: backend Node.js + PostgreSQL que consolida y expone la API de sync.

Tareas:
- Esquema PostgreSQL espejo del modelo, preparado para consolidación multi-origen.
- Endpoints: auth, sync/push (idempotente por id), sync/pull (cambios desde updated_at),
  consultas de reportes consolidados.
- Autenticación de terminales por origin_id.

Criterios de aceptación: push idempotente (reenviar no duplica); pull trae deltas; tests
de integración.
```

### P4.2 — Motor de sincronización (cliente) y conflictos

```
Objetivo: motor de sync offline-first en el cliente (Tech Spec 3.12).

Tareas:
- Outbox: encolar operaciones pending, enviarlas en orden, marcarlas synced al confirmar.
- Bajada de cambios remotos y aplicación local.
- Reanudación tras corte (idempotencia).
- Resolución de conflictos según ADR-012: **last-write-wins por registro** en entidades
  maestras + **log de conflictos** revisable por el Supervisor.

Criterios de aceptación: sin pérdida ni duplicación; corte a mitad reanuda correcto;
conflictos detectados y registrados (tests).
```

---

## RELEASE 5 — Inteligencia y escala

### P5.1 — Reportes consolidados y preparación multi-sucursal

```
Objetivo: reportes/dashboard consolidados (multi-terminal) y dejar el sistema preparado
para multi-sucursal (sin implementar la operación multi-sucursal aún).

Tareas:
- Dashboard consolidado en la nube (ventas, stock, caja, compras, cuentas corrientes,
  comparativos e históricos).
- KPIs y reportes para decisión.
- Revisar el modelo para soportar a futuro múltiples sucursales (campo/estrategia de
  sucursal) sin habilitar la operación todavía.

Criterios de aceptación: reportes consolidados correctos contra datos multi-terminal.

Restricciones: la operación multi-sucursal sigue FUERA de alcance (solo preparación).
```

---

## Apéndice — Checklist de fin de cada fase

- [ ] El plan fue escrito y revisado antes de codear.
- [ ] Tests en verde; cobertura de las reglas de negocio de la fase.
- [ ] Respeta los principios y restricciones del Prompt 0.
- [ ] No reintrodujo decisiones cerradas ni implementó cosas fuera de alcance.
- [ ] Campos de sync y auditoría presentes donde corresponde.
- [ ] La fase es desplegable y no rompe las anteriores.
- [ ] Decisiones abiertas (ADR-012 a 016) no se cerraron sin confirmación.
```
