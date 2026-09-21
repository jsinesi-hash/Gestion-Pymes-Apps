# Motor de Precios y Publicación
## Especificación Funcional 

**Version:** 2.0

---

# 1. Objetivo

El Motor de Precios y Publicación es el componente responsable de determinar, versionar, publicar y auditar los precios de venta de todos los productos del sistema.

El objetivo principal es desacoplar completamente:

- Productos
- Costos
- Reglas comerciales
- Listas de precios
- Publicación de precios

El sistema nunca consulta el motor para obtener un precio durante una venta.

El motor solamente calcula y publica precios.

Las ventas siempre consultan precios previamente publicados.

---

# 2. Principios de Diseño

El motor debe cumplir los siguientes principios:

- El Producto nunca almacena precios.
- El Producto puede tener múltiples proveedores.
- Sólo un proveedor puede ser el Preferido.
- El costo utilizado siempre proviene del proveedor preferido.
- Las reglas comerciales nunca modifican el producto.
- El cálculo es reproducible.
- Todo cálculo debe ser auditable.
- Todo cambio genera una nueva versión.
- Los precios publicados son inmutables hasta una nueva publicación.

---

# 3. Arquitectura Conceptual

                    PRODUCT
                       │
                       │
             PRODUCT_SUPPLIER
                       │
                       ▼
          Motor de Precios y Publicación
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
 Price Draft     Simulation      Validation
        │
        ▼
 Approval Workflow
        │
        ▼
 Publish
        │
        ▼
 PRICE_LIST_ITEM
        │
 ┌──────┼───────────┬─────────────┐
 ▼      ▼           ▼             ▼
 POS   Web      Marketplace    Mobile

---

# 4. Modelo de Datos Conceptual

## PRODUCT

Representa únicamente información del artículo.

No contiene precios.

Ejemplo:

- Id
- Código
- Descripción
- Marca
- Rubro
- Categoría
- IVA
- Unidad
- Estado

---

## PRODUCT_SUPPLIER

Relaciona un producto con uno o más proveedores.

Campos principales:

- Producto
- Proveedor
- Código proveedor
- Costo compra
- Bonificación
- Flete
- Otros costos
- Fecha vigencia
- Activo
- EsProveedorPreferido

Un único proveedor puede estar marcado como Preferido.

---

## PRICE_RULE

Contiene únicamente reglas comerciales.

No contiene productos.

Ejemplos:

- Margen por rubro
- Margen por marca
- Margen por cliente
- Precio fijo
- Promociones
- Redondeo
- Márgenes mínimos

---

## PRICE_LIST

Representa la configuración de una lista.

Ejemplos:

- General
- Mayorista
- Web
- Constructoras
- Mercado Libre

Una lista no almacena el precio.

Almacena únicamente su configuración y prioridad.

---

## PRICE_LIST_ITEM

Representa el precio publicado.

Es la única fuente de consulta para todos los canales.

Campos sugeridos:

- Lista
- Producto
- Precio
- Costo utilizado
- Proveedor utilizado
- Regla aplicada
- Fecha publicación
- Versión

---

## PRICE_CALCULATION

Representa un cálculo realizado por el motor.

Puede encontrarse en estado:

- Draft
- Approved
- Published
- Cancelled

Nunca es consultado por el POS.

---

# 5. Flujo General

Cambio de costo

↓

Motor de Precios

↓

Calcular

↓

Guardar Draft

↓

Validar

↓

Aprobación

↓

Publicar

↓

Actualizar PRICE_LIST_ITEM

↓

Fin

---

# 6. Contexto de Entrada

El motor recibe únicamente contexto.

Ejemplo:

- Producto
- Lista
- Cliente
- Canal
- Fecha
- Cantidad
- Usuario

Nunca recibe un margen.

Nunca recibe un precio.

Toda esa información debe resolverse internamente.

---

# 7. Pipeline de Procesamiento

PricingContext

↓

Provider Resolver

↓

Cost Calculator

↓

Price List Resolver

↓

Rule Resolver

↓

Margin Calculator

↓

Rounding Calculator

↓

Motor de Validacion

↓

Draft Generator

↓

Approval Workflow

↓

Publish Service

↓

Audit Service

↓

PricingResult

Cada componente posee una única responsabilidad.

---

# 8. Provider Resolver

Responsabilidades:

- Buscar proveedor preferido.
- Validar proveedor activo.
- Obtener costo vigente.
- Obtener bonificaciones.
- Obtener costos logísticos.
- Obtener costos financieros.

Resultado:

Costo Base.

---

# 9. Cost Calculator

Responsable de obtener el costo real.

Costo Compra

+ Flete

+ Seguro

+ Costo Financiero

- Bonificaciones

= Costo Neto

El Costo Neto será utilizado por el resto del pipeline.

---

# 10. Price List Resolver

Determina qué lista utilizar.

Prioridad configurable.

Ejemplo:

1 Cliente

2 Canal

3 Promoción

4 Marca

5 Rubro

6 General

La primera coincidencia finaliza la búsqueda.

---

# 11. Rule Resolver

Obtiene la regla correspondiente.

Ejemplos:

Margen por Marca

Margen por Rubro

Margen por Cliente

Precio Fijo

Cantidad

Promoción

Nunca deben combinarse reglas incompatibles.

---

# 12. Margin Calculator

Aplica el margen correspondiente.

Produce un Precio Bruto.

Todavía no aplica redondeo.

---

# 13. Rounding Calculator

Aplica políticas de redondeo.

Ejemplos:

Finalizar en 90

Finalizar en 99

Múltiplos de 100

Múltiplos de 500

El redondeo siempre ocurre después del margen.

---

# 14. Motor de Validación

Debe validar:

- Precio menor al costo
- Margen mínimo
- Margen máximo
- Producto inactivo
- Lista vencida
- Regla inválida
- Proveedor inactivo

Si alguna validación falla:

Cancelar cálculo.

---

# 15. Draft Generator

El resultado del cálculo nunca se publica inmediatamente.

Se genera un Draft.

Campos:

- Precio
- Regla
- Lista
- Versión
- Usuario
- Fecha

Los Drafts permiten:

- Comparar versiones
- Aprobar cambios
- Ejecutar simulaciones

---

# 16. Approval Workflow

Todo Draft puede pasar por un flujo de aprobación.

Ejemplo:

Calculado

↓

Revisión Comercial

↓

Revisión Gerencia

↓

Publicado

o

↓

Rechazado

---

# 17. Publish Service

Al publicar:

Actualizar PRICE_LIST_ITEM.

El resto del sistema nunca consulta Drafts.

Consulta únicamente PRICE_LIST_ITEM.

---

# 18. Consulta de Precio

Todos los consumidores consultan exclusivamente PRICE_LIST_ITEM.

Ejemplo:

POS

↓

PRICE_LIST_ITEM

↓

Precio

Fin

No existe cálculo durante una venta.

Esto garantiza:

- rapidez
- consistencia
- disponibilidad

---

# 19. Eventos que Disparan un Recalculo

- Cambio de costo.
- Cambio de proveedor preferido.
- Nueva regla.
- Nueva promoción.
- Cambio de margen.
- Nuevo producto.
- Nueva lista.
- Importación masiva.

Cada evento genera un nuevo Draft.

---

# 20. Simulación

El sistema debe soportar simulaciones.

Ejemplos:

¿Qué ocurre si Bosch aumenta 8%?

¿Qué ocurre si cambio el proveedor preferido?

¿Qué ocurre si modifico el margen de Herramientas?

¿Qué productos perderán margen?

Las simulaciones nunca modifican datos publicados.

---

# 21. Auditoría

Cada cálculo debe registrar:

- Producto
- Lista
- Regla
- Proveedor
- Costo utilizado
- Margen
- Precio bruto
- Redondeo
- Precio final
- Usuario
- Fecha
- Versión

Todo precio debe ser completamente reproducible.

---

# 22. Estados del Precio

Draft

↓

Approved

↓

Published

↓

Archived

Los precios publicados nunca se modifican.

Siempre se genera una nueva versión.

---

# 23. Responsabilidad de los Componentes

Provider Resolver
→ Obtiene el proveedor.

Cost Calculator
→ Calcula costo neto.

Price List Resolver
→ Determina la lista.

Rule Resolver
→ Determina la regla.

Margin Calculator
→ Calcula el precio bruto.

Rounding Calculator
→ Redondea.

Motor de Validación
→ Valida.

Draft Generator
→ Genera una propuesta.

Approval Workflow
→ Gestiona aprobaciones.

Publish Service
→ Publica.

Audit Service
→ Registra trazabilidad.

---

# 24. Principio Fundamental

El motor de precios nunca responde consultas de precio.

Su única responsabilidad es producir precios publicados.

Todo consumidor del sistema (POS, e-commerce, API, caja, marketplace o aplicación móvil) consulta exclusivamente `PRICE_LIST_ITEM`.

Esta separación garantiza:

- Alto rendimiento.
- Escalabilidad.
- Consistencia entre canales.
- Trazabilidad completa.
- Posibilidad de aprobación antes de publicar.
- Reversión sencilla mediante versionado.

---

# 25. Price Publication Batch

## Objetivo

Un Price Publication Batch representa un conjunto de precios calculados que serán publicados como una única unidad de negocio.

Su objetivo es garantizar consistencia durante actualizaciones masivas.

Ejemplo:

Una lista de proveedor actualiza 5.000 productos.

El sistema no debe publicar:

- 2.000 productos actualizados
- 3.000 productos pendientes

Debe publicar el lote completo o no publicar nada.

---

# 26. Flujo con Publication Batch


Importación de costos

↓

Generación de cálculos

↓

PRICE_CALCULATION

↓

Crear Publication Batch

↓

Validaciones

↓

Aprobación

↓

Publicación atómica

↓

PRICE_LIST_ITEM actualizado

↓

Cerrar Batch


---

# 27. Entidad PRICE_PUBLICATION_BATCH


Representa una ejecución completa de actualización de precios.


Campos sugeridos:


Batch Id

Fecha creación

Usuario creador

Origen del cambio

Estado

Cantidad productos

Lista afectada

Versión destino

Fecha publicación

Usuario aprobador



Estados:


Created

↓

Processing

↓

Validation Failed

↓

Pending Approval

↓

Approved

↓

Published

↓

Cancelled


---

# 28. Origen de un Batch


Todo Batch debe registrar el motivo que generó la actualización.


Ejemplos:


PROVIDER_COST_UPDATE

Cambio de lista de proveedor.


MARGIN_UPDATE

Cambio de reglas comerciales.


PRODUCT_CREATED

Nuevo producto.


PROMOTION_CREATED

Nueva promoción.


MANUAL_RECALCULATION

Recalculo solicitado por usuario.


SUPPLIER_CHANGE

Cambio de proveedor preferido.


---

# 29. Relación entre Batch y Calculations


Un Batch contiene múltiples cálculos.


Ejemplo:


PRICE_PUBLICATION_BATCH

Batch #000125


Contiene:


PRICE_CALCULATION

Producto A

Lista General

Precio anterior

$18.500

Precio nuevo

$19.900



PRICE_CALCULATION

Producto B

Lista General

Precio anterior

$25.000

Precio nuevo

$27.500



PRICE_CALCULATION

Producto C

Lista General

Precio anterior

$9.900

Precio nuevo

$10.900



---

# 30. Validación del Batch


Antes de publicar se debe validar el lote completo.


Validaciones:


Cantidad de productos procesados esperada.


Ejemplo:


Archivo proveedor

10.000 productos


Resultado cálculo

9.950 productos


Estado:

Validation Failed



---

Validaciones adicionales:


Productos sin costo.

Productos sin regla.

Productos con margen negativo.

Variaciones superiores al límite permitido.

Duplicados.

Precios inferiores al costo.


---

# 31. Control de Impacto


Antes de aprobar un Batch se debe generar un reporte.


Ejemplo:


Batch #000125


Productos afectados:

8.500


Aumento promedio:

7,8%


Margen promedio anterior:

38%


Margen promedio nuevo:

39,5%


Productos con aumento superior al 30%:

120


Productos con margen crítico:

15


---

# 32. Aprobación del Batch


La aprobación se realiza sobre el lote completo.


Ejemplo:


Usuario:

Gerente Comercial


Acción:

Approve Batch #000125



Resultado:


Todos los productos quedan habilitados para publicación.



---

# 33. Publicación Atómica


La publicación debe garantizar consistencia.


Proceso:


Inicio Transacción


↓

Archivar precios anteriores


↓

Actualizar PRICE_LIST_ITEM


↓

Actualizar versión lista


↓

Marcar Batch como Published


↓

Commit


Si ocurre un error:


Rollback completo



Resultado:


Nunca debe existir una lista parcialmente publicada.



---

# 34. Versionado de Listas


Cada publicación genera una nueva versión.


Ejemplo:


Lista General


Versión 15

01/07/2026


↓

Batch #000125


↓

Versión 16

15/07/2026



La versión anterior permanece disponible para:


- auditoría
- comparación
- rollback
- análisis histórico



---

# 35. Rollback de Precios


El sistema debe permitir volver a una versión anterior.


Ejemplo:


Lista General v16


Problema detectado


↓

Rollback


↓

Restaurar Lista General v15



El rollback debe generar un nuevo Batch.


Nunca modificar historia existente.



---

# 36. Consulta de Precio con Versionamiento


Los consumidores consultan:


PRICE_LIST_ITEM


filtrado por:


Lista activa

Versión publicada


Ejemplo:


POS


↓

Lista General


↓

Versión activa


↓

Precio vigente



---

# 37. Beneficios del Publication Batch


Esta arquitectura permite:


- Actualizaciones masivas seguras.
- Aprobación previa.
- Auditoría completa.
- Reversión rápida.
- Comparación entre versiones.
- Control del impacto económico.
- Evitar inconsistencias entre canales.
- Integración futura con IA para recomendaciones de precio.


---

# 38. Arquitectura Final


                 PRODUCT
                    |
                    |
          PRODUCT_SUPPLIER
                    |
                    |
                    v
          Motor de cálculo de precios
                    |
                    v
          PRICE_CALCULATION
                    |
                    v
       PRICE_PUBLICATION_BATCH
                    |
          +---------+---------+
          |                   |
          v                   v
     Approval            Validation
          |
          v
     Publish Service
          |
          v
     PRICE_LIST_ITEM
          |
    +-----+-----+-----+
    |     |     |     |
   POS   WEB  API  Marketplaces
