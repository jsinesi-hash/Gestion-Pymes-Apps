# ADR-082 — Fase 3 mejoras UX: SEC-2 (validación de payloads) + revisión integral de mensajes al usuario

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-10 ·
**Rama:** `feat/adr082-sec2-mensajes-usuario` ·
**Fase:** Auditoría UX/Seguridad — Fase 3, ítem 3 (SEC-2), ampliado a "mensajes más completos".
**Relacionados:** ADR-077 (Fase 1: ToastProvider, `useCallIpc`, `traducirError`), ADR-080/081 (resto de Fase 3).
**Spec y plan:** `docs/superpowers/specs/2026-09-09-adr082-sec2-mensajes-usuario-design.md` ·
`docs/superpowers/plans/2026-09-09-adr082-sec2-mensajes-usuario.md`.

---

## Contexto

La Fase 1 (ADR-077) dejó la infraestructura de feedback del renderer (toasts, `useCallIpc`,
`traducirError`), pero quedaban dos huecos:

1. **SEC-2 (Fase 3, ítem 3):** los handlers del main (272 `ipcMain.handle` en 53 archivos)
   recibían `(p: unknown)` y lo casteaban **sin validar en runtime**. Sin defensa en
   profundidad ni errores tempranos y claros.
2. **Mensajes al usuario incompletos:** `traducirError` tenía solo 4 reglas (patrones de
   SQLite) + un fallback genérico, pero los handlers lanzan **decenas de códigos de dominio**
   (`STOCK_INSUFICIENTE`, `SALDO_PENDIENTE`, `TIENE_PRODUCTOS:n`, `NOT_FOUND`, …) que **caían
   todos al fallback** "No se pudo completar la operación".

## Decisión

Validación **a mano, sin `zod`** (coherente con "no introducir dependencias sin justificar",
CLAUDE.md §12), y revisión integral de mensajes en las tres capas (errores + confirmaciones
de éxito + validación inline en forms). Alcance = **infraestructura + tranche prioritario** de
dominios de mayor tráfico/riesgo, dejando el resto asentado para próxima iteración.

**El seam que une todo:** un contrato de string estable `CÓDIGO:arg1:arg2` (y la variante
`VALIDATION:<campo>:<detalle>`) que ya viaja por el bridge IPC sin cambios; se produce en el
main y se traduce en el renderer, testeado de ambos lados.

### A. Validación estructurada en el main — `main/validation/core.ts` (nuevo)

Módulo puro: `class ValidationError` (mensaje `VALIDATION:<campo>:<detalle>`) + primitivas
`str`, `optStr`, `id`, `optId`, `num`, `int`, `centavos`, `bool`, `oneOf`, `arr`. Se aplican al
**inicio del handler de escritura**, después del chequeo de sesión/permiso (que conserva sus
`UNAUTHENTICATED`/`FORBIDDEN`) y antes de tocar la DB. Detalles estandarizados
(`REQUERIDO`/`TIPO`/`MIN`/`MAX`/`RANGO`/`ENUM`/`NO_ENTERO`/`NEGATIVO`).

**Tranche cubierto:** catálogos (categoría, marca, unidad, ubicación), producto (create/update/
quickCreate), cliente, proveedor, stock (entrada/ajuste/merma), existencias, caja (abrir/
movimiento/cerrar), venta (confirmar) + venta-espera, precios (lista-precio, lista-precio-valor,
price-batch). En **venta** —el handler más crítico— la validación es de **forma/tipos**: corre
por su efecto de `throw` y el handler sigue leyendo el payload original completo; **no se
duplican reglas de negocio** (`PAGOS_REQUERIDOS`, `STOCK_INSUFICIENTE`, `MEDIO_PAGO_DUPLICADO`,
`LIMITE_CREDITO_EXCEDIDO`, …), que quedan intactas.

### B. Catálogo de errores completo — `renderer/lib/errores.ts`

`traducirError` gana un mapa `CODIGOS` con **~64 códigos de dominio** del inventario
traducidos a español; parseo `CÓDIGO:arg` con formateadores (montos en centavos → pesos);
tier `VALIDATION:<campo>:<detalle>` → `{ mensaje, campo }`; guard `Object.hasOwn` contra
tokens del prototipo; se conservan las reglas de SQLite y el fallback como tiers finales.
`ErrorTraducido` gana `campo?`. **Esto mejora los mensajes en toda la app desde ya, no solo en
el tranche** (traducir es central; validar es por-handler y se prioriza).

### C. Validación inline en forms

- Hook `useFormErrors` (`{ errors, onBlur, setErrorBackend, validarTodo }`) que generaliza el
  patrón PROD-1 de `ProductoForm`.
- `useCallIpc` expone en el fallo `{ ok:false, error, traducido }` para rutear el `campo` al
  form.
- Helper `renderer/lib/rutearCampoError.ts` (mapa `campo → id de control`, foco + mensaje
  inline).
- Ruteo backend→campo + foco en ProductoForm, ClienteForm, ProveedorForm, y las vistas de
  Categoría/Marca/Unidad/Ubicación y modales de Stock/Caja. **Cliente y Proveedor pasaron de
  fallar en silencio a mostrar el error** (antes el `await upsert()` tragaba el rechazo).

### D. Confirmaciones de éxito

Toasts de éxito estandarizados en las vistas del tranche (catálogos, stock, caja) — Producto/
Cliente/Proveedor ya los tenían. Redacción con género correcto ("Categoría guardada",
"Ubicación dada de baja", "Entrada registrada", "Caja cerrada", …).

### Higiene asociada

Se retiran dos ramas muertas que comparaban contra el literal `'OBSERVACIONES_REQUERIDAS'` en
`StockAjusteModal`/`StockMermaModal` (los handlers ahora lanzan `VALIDATION:observaciones:
REQUERIDO`).

## Consecuencias

- Defensa en profundidad: ningún handler de escritura del tranche confía en el payload sin
  type-check; un payload malformado se rechaza en el borde con un mensaje claro y por-campo.
- Los mensajes del usuario dejan de ser genéricos en toda la app.
- **Deuda de forma vs. dominio:** algunos campos NOT NULL que el form deja vacíos
  (`numero_documento`) se validan como **opcionales** normalizados a `''` — se descubrió y
  corrigió que hacerlos requeridos rompía el alta (regresión evitada). Regla adoptada: **no
  introducir requeridos nuevos más allá de lo que el handler ya exigía** (p. ej.
  `existencias.stock_minimo` quedó present-only).
- Verde en ambos runners: **main 1320**, **renderer 852**, `tsc` limpio.

## Fuera de alcance — asentado para próxima iteración

1. **Validación (A) + inline (C) + éxito (D) en dominios no prioritarios:** agenda, remitos,
   presupuestos, órdenes de compra, recepción, importaciones (costos/catálogo), sinónimos,
   equivalencias, transportista, SMTP, backup/restore, geo, reglas/cambios de precio,
   producto-proveedor. **El catálogo de errores (B) ya los cubre.**
2. **`CajaCierreView` (cierre de caja):** ruteo backend→campo diferido (su flujo de re-throw
   hacia `SupervisorAuthModal` requiere primero una superficie de error). El toast de éxito
   "Caja cerrada" sí se agregó.
3. **PERF-3** (Fase 3, ítem 5): editor de permisos por rol desde la UI. **Decisión de producto
   abierta** (2 roles de sistema; riesgo de romper invariantes RBAC) — opciones A (solo lectura
   de la matriz), B (edición acotada con guardas), C (no hacerlo). No se cierra sin
   confirmación.
4. **`AccionError` "abrir el registro existente"** (deep-link desde el error de duplicado): el
   tipo existe en `errores.ts` pero queda sin cablear.

## Verificación manual pendiente (CLAUDE.md §12)

Abrir `pnpm dev` (Operador + Supervisor) y, navegando como el usuario: forzar un EAN duplicado
→ mensaje específico; submit de ProductoForm con campos vacíos → foco al primer inválido;
enviar un valor que el backend rechaza → el campo se resalta con el mensaje traducido; venta
sin stock, caja requerida, límite de crédito → mensajes de dominio; guardado de producto/
cliente/marca → toast de éxito.
