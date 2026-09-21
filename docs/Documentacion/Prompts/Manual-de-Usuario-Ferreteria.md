<!--
Manual de Usuario — Ferretería-app
Documento 1 del set de documentación. Orientado a tareas, por rol.
Convención de reutilización: cada capítulo declara `implementa:` los UC que documenta.
Ruta destino en el repo: docs/documentacion/manual-usuario/
Reemplazar los marcadores [CAPTURA: ...] por imágenes en docs/documentacion/manual-usuario/assets/.
-->

# Manual de Usuario — Ferretería-app

**Versión del sistema documentada:** v1.0.0
**Última actualización:** _[fecha]_
**Público:** cajero/vendedor · encargado de depósito · supervisor

---

## Índice

1. Introducción
2. Roles y qué puede hacer cada uno
3. Primeros pasos
4. Punto de venta (POS)
5. Catálogo de productos
6. Caja: apertura y cierre
7. Copias de seguridad
8. Facturación AFIP/ARCA *(R2)*
9. Compras, proveedores y cuenta corriente *(R3)*
10. Preguntas frecuentes
11. Glosario para el usuario

---

## 1. Introducción

Ferretería-app es el sistema de gestión de tu ferretería: registra las ventas, controla el stock y el catálogo de productos, maneja la caja y genera las copias de seguridad de tu información.

**Funciona sin internet.** Toda la información se guarda en la computadora del local, así que el sistema sigue vendiendo aunque se corte la conexión. La conexión solo hace falta para la facturación electrónica con AFIP/ARCA (módulo fiscal).

**Qué hace hoy (v1.0.0):**

- Registrar ventas con distintos medios de pago, incluso combinados
- Administrar el catálogo de productos, categorías y marcas
- Imprimir etiquetas con código de barras y QR
- Abrir y cerrar la caja por turno
- Hacer y restaurar copias de seguridad

**Qué se agrega más adelante:** facturación electrónica AFIP/ARCA (R2), compras a proveedores y cuenta corriente de clientes (R3), y sincronización entre varias terminales (R4).

> [CAPTURA: pantalla principal con el sidebar y una venta en curso]

---

## 2. Roles y qué puede hacer cada uno

Cada persona entra con su **usuario y contraseña**. Según el rol, ve y puede hacer distintas cosas.

| Rol | Se ocupa de | Accede principalmente a |
|---|---|---|
| **Cajero / Vendedor** | Vender y manejar la caja de su turno | Punto de venta, Caja |
| **Encargado de depósito** | Cargar y mantener productos, stock y etiquetas | Catálogo, Ubicaciones, Etiquetas |
| **Supervisor** | Configuración, reportes, compras y clientes | Todo, incluida Configuración |

El menú de la izquierda (sidebar) está agrupado en secciones plegables: **Catálogo**, **Abastecimiento**, **Clientes**, **Reportes** y **Configuración**. Vas a ver solo lo que tu rol permite.

> [CAPTURA: sidebar con los grupos plegables]

---

## 3. Primeros pasos

### 3.1 Instalar el sistema

El sistema se instala en Windows 10 con un instalador guiado (asistente "siguiente-siguiente"). Al terminar, queda un acceso directo en el escritorio.
*(El detalle técnico de instalación está en la Guía de Instalación y Operación.)*

### 3.2 Iniciar sesión

1. Abrí el sistema desde el acceso directo.
2. Ingresá tu **usuario** y **contraseña**.
3. Presioná **Entrar**.

Si te olvidaste la contraseña, tiene que reiniciártela un supervisor desde Configuración.

> [CAPTURA: pantalla de login]

### 3.3 Conocer la pantalla

- **Sidebar (izquierda):** navegación por secciones.
- **Área central:** la pantalla en la que estás trabajando.
- **Encabezado:** usuario conectado y estado de la caja/turno.

> [DIAGRAMA: NAV-1 — mapa de navegación de pantallas]

---

## 4. Punto de venta (POS)

> implementa: UC-POS-01 (Registrar venta), UC-POS-02 (Pago mixto), UC-POS-03 (Venta en espera)

La pantalla de venta tiene **tres zonas**: búsqueda/carga de productos, detalle de la venta en curso, y totales/acciones. **Nada se guarda hasta que confirmás la venta** en el modal final: podés armar y deshacer sin miedo.

### 4.1 Registrar una venta

1. Buscá el producto por nombre o escaneá su código de barras.
2. Agregalo a la venta; repetí para cada ítem. Ajustá cantidades si hace falta.
3. Cuando esté completo, presioná **CONFIRMAR VENTA**.
4. En el modal, elegí el **medio de pago** e indicá el monto recibido.
5. Confirmá. Recién ahí la venta queda registrada y se descuenta el stock.

> [CAPTURA: las tres zonas del POS]
> [CAPTURA: modal "CONFIRMAR VENTA"]

### 4.2 Pagos combinados (mixtos)

Podés cobrar una misma venta con **varios medios de pago** (por ejemplo, una parte en efectivo y otra con tarjeta).

1. En el modal de confirmación, agregá una línea de pago por cada medio.
2. Indicá el monto de cada una hasta cubrir el total.
3. Si un medio tiene recargo, se muestra en su línea; **el total de la venta no cambia** por el recargo.
4. Si pagan en efectivo de más, el sistema calcula el **vuelto**.

> El redondeo a $1 se aplica únicamente sobre la parte en efectivo.

### 4.3 Dejar una venta en espera

Si un cliente deja la compra para más tarde:

1. Con la venta armada, elegí **Dejar en espera**.
2. La venta queda guardada como pendiente, sin afectar stock ni caja.
3. Cuando vuelve el cliente, la retomás y la confirmás, o la **descartás** si no se concreta.

> [CAPTURA: listado de ventas en espera]

---

## 5. Catálogo de productos

> implementa: UC-CAT-01 (Alta de producto), UC-CAT-02 (Categorías y marcas), UC-CAT-03 (Etiquetas)

### 5.1 Dar de alta un producto

_[Paso a paso: datos del producto, asignación de categoría y marca, código de barras opcional. El sistema asigna un SKU automático con formato `P-0000042-7`.]_

> [CAPTURA: formulario de alta de producto]

### 5.2 Categorías y marcas

_[Paso a paso: ABM de categorías y marcas desde Configuración. No se puede eliminar una categoría/marca si tiene productos activos que la usan.]_

### 5.3 Imprimir etiquetas

_[Paso a paso: selección de productos, formato A4 u rollo térmico, impresión con código de barras (Code128) y QR.]_

> [CAPTURA: pantalla de impresión de etiquetas]

---

## 6. Caja: apertura y cierre

> implementa: UC-CAJA-01 (Apertura de turno), UC-CAJA-02 (Cierre de turno)

_[Paso a paso: abrir turno al empezar la jornada, registrar ventas del turno, cerrar caja con arqueo al finalizar.]_

> [CAPTURA: apertura de caja]
> [CAPTURA: cierre de caja / arqueo]

---

## 7. Copias de seguridad

> implementa: UC-BKP-01 (Crear backup), UC-BKP-02 (Restaurar)

El sistema genera copias de seguridad de toda tu información en un archivo `.fbk`.

_[Paso a paso: crear copia manual, dónde se guarda, cómo restaurar, y qué política de retención rige. Nota: los certificados fiscales no se incluyen en la copia por seguridad.]_

> [CAPTURA: pantalla de backup/restore]

---

## 8. Facturación AFIP/ARCA *(R2 — en desarrollo)*

> implementa: UC-FISC-01 (Emitir comprobante), UC-FISC-02 (Nota de crédito)

_[Pendiente hasta cerrar el módulo. Cubrirá: configuración fiscal (CUIT, punto de venta, condición IVA), emisión de comprobante desde una venta, facturación manual vs. automática, y notas de crédito.]_

---

## 9. Compras, proveedores y cuenta corriente *(R3)*

> implementa: UC-COMP-*, UC-CLI-*

_[Pendiente. Cubrirá compras a proveedores, gestión de proveedores y cuentas corrientes de clientes.]_

---

## 10. Preguntas frecuentes

- **¿Puedo vender sin internet?** Sí. Solo la facturación electrónica necesita conexión.
- **Me equivoqué armando una venta.** Mientras no confirmes en el modal, nada se guardó: sacá el ítem o cancelá.
- **¿Se puede borrar un producto?** No se elimina físicamente: queda inactivo. Así no se pierde el historial.
- **Olvidé mi contraseña.** Un supervisor te la reinicia desde Configuración.

---

## 11. Glosario para el usuario

> Subconjunto en lenguaje llano del glosario general (`docs/documentacion/glosario.md`). Los términos técnicos completos viven allí.

- **SKU:** código interno único de cada producto (ej. `P-0000042-7`).
- **Turno / Caja:** período de trabajo de un cajero, con su apertura y cierre.
- **Venta en espera:** compra guardada sin confirmar, que no afecta stock ni caja.
- **Comprobante:** factura o nota de crédito emitida ante AFIP/ARCA.
- **Backup (`.fbk`):** archivo con la copia de seguridad de toda tu información.
