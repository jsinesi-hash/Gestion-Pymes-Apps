# Pack — A22 (medios de pago habilitables por comercio)

> Origen: `mejoras-acumulativas.md` (análisis SICOVESTO, "Preferencias → Ventas y precios"). Destino: **núcleo** (`@core/main`, `@core/ui`, `@ferreteria/shared`) + pantalla en **Retail**. 2 PRs.
> Sin número de ADR a propósito: lo asigna el usuario a mano.
> Contenido: (1) texto de ADR, (2) bloque de `Estado.md`, (3) prompt de implementación para Superpowers.

---

## 1. Texto de ADR (para `docs/ADR-Log-ferreteria.md`)

## ADR-XXX — Medios de pago habilitables por comercio (lista de códigos, Efectivo fijo)

**Estado:** Aceptado — pendiente de implementación (2 PRs) · **Fecha:** 2026-10-19

**Contexto.** SICOVESTO permite activar o desactivar cada método de pago por comercio. El discovery mostró que en este repo **no existe una tabla `medios_pago`**: el medio es una unión cerrada de cinco valores (`efectivo | tarjeta | cuenta_corriente | transferencia | cheque`) escrita en `venta_pago.medio_pago` (`@core/db`), en el tipo `MedioPago` y la lista `MEDIOS` de `ConfirmarVentaModal` (`@core/ui`, compartidos por Retail y Elaborados) y en la validación de `confirmarVenta` (`@core/main`). Los medios tienen **comportamiento**, no solo nombre: `efectivo` sostiene el vuelto, el redondeo a $1 (ADR-010) y el arqueo de caja; `cuenta_corriente` exige cuenta, límite y Supervisor y la revierte `anularVenta`; `tarjeta` lleva un recargo % tipeado a mano por venta (no hay recargo por defecto configurado); `cheque` pide cuatro datos y mapea a `efectivo` en el `forma_pago` legado. No existe ninguna configuración de medios. La pregunta "¿se siembran los 8 métodos y Efectivo entra en `medios_pago`?" proviene del `DECISIONES.md` de otro proyecto y **no aplica** acá. Hallazgos operativos: `parametrosSetHandler` hace `UPDATE` (no `INSERT`), por lo que un parámetro sin fila sembrada no se puede guardar desde la UI; el listado de funcionalidades filtra por `tipo = 'bool'` y clave terminada en `_habilitado`, así que un parámetro `string` no aparece ahí; la escritura de parámetros exige `config.fiscal`. Con A24 el saldo a favor se resolvió como cuenta corriente, por lo que "NC" no hace falta como medio de pago.

**Decisión.**

*A. Parámetro `medios_pago_habilitados`* (`tipo = 'string'`, JSON): lista de **códigos** de los medios configurables habilitados, p. ej. `["tarjeta","transferencia","cuenta_corriente","cheque"]`. **Efectivo es implícito y siempre está habilitado**: no forma parte de la lista ni de la pantalla (vuelto, redondeo y arqueo dependen de él). **Fila ausente = todos habilitados**: Elaborados no cambia de comportamiento. La lista vacía significa "solo efectivo". Un valor ilegible (JSON inválido) o con códigos desconocidos se trata de forma permisiva (los desconocidos se ignoran; si todo es ilegible se habilitan todos): una configuración corrupta nunca bloquea las ventas. Se guardan códigos, no etiquetas.

*B. Parser puro compartido* en `@ferreteria/shared` (browser-safe, sin Electron): constante `MEDIOS_PAGO_CONFIGURABLES` y `parsearMediosPagoHabilitados(valor: string | null)` que devuelve la lista efectiva. Lo usan el main y el renderer, para que ambos lados nunca diverjan. Edición autorizada de `packages/shared` solo para esto; se recompila.

*C. Validación en el main (núcleo).* `confirmarVenta` (`@core/main`) lee el parámetro directamente de la base y, después de `MEDIO_PAGO_DUPLICADO`, rechaza con `MEDIO_PAGO_DESHABILITADO` cualquier pago cuyo medio no esté habilitado (efectivo nunca se rechaza). Cubre también ventas en espera retomadas y presupuestos convertidos porque todas pasan por `confirmarVenta`. No valida en `anularVenta` ni en los cobros de cuenta corriente: lo ya hecho y los saldos existentes no se tocan. Código de error traducido en el catálogo de `@core/ui`.

*D. Modal.* `ConfirmarVentaModal` recibe la prop opcional `mediosHabilitados` (default: todos); `efectivo` siempre se muestra, `cuenta_corriente` sigue exigiendo además `habilitaCcc` del cliente y, si el medio por defecto no está habilitado, el modal arranca en efectivo. Elaborados no pasa la prop: sin cambios.

*E. Retail.* Migración aditiva que siembra la fila (`INSERT OR IGNORE`) con los cuatro códigos (todos habilitados). Pantalla **Configuración → Sistema → "Medios de pago"** (`/config/medios-de-pago`), gateada por `config.fiscal` (el mismo permiso que exige `parametros:set`): un interruptor por medio configurable, Efectivo mostrado como fijo y un texto que aclara que las ventas ya hechas no cambian. Con las tres piezas de navegación (ruta, NAV con `permiso`, CRUMB) y test de nav. El POS lee el parámetro al abrir el modal de confirmación (`parametros.get`, el caché se invalida al guardar) y se lo pasa al modal.

*F. Sin flag.* La ausencia de la fila equivale a "todos habilitados" y el comportamiento por defecto no cambia; la pantalla es el interruptor.

*Entrega:* **PR1 (núcleo)** parser en `shared`, validación en `confirmarVenta`, prop del modal, error traducido y tests de no regresión de Retail y Elaborados; **PR2 (Retail)** migración de la fila, pantalla de Configuración, cableado del POS y test de nav.

**Espacio reservado (documentado, no implementado).** Catálogo de medios en base de datos (código, nombre, comportamiento, activo, orden) para sumar QR o separar débito de crédito: cada medio nuevo se mapearía a uno de los comportamientos existentes y el parámetro actual (que guarda códigos) seguiría siendo válido; recargo por defecto por medio; vale/saldo a favor para clientes sin cuenta corriente; pantalla de medios en Elaborados.

**Fuera de alcance.** Medios nuevos, recargo de tarjeta por defecto, cambios en reportes de caja o exportadores, la pantalla de Elaborados, y cualquier modificación de ventas ya registradas.

**Consecuencias.** Un comercio puede dejar de aceptar cheques, transferencias, tarjeta o fiado sin tocar código. Cambia el contrato del modal (prop opcional) y `confirmarVenta` suma una lectura de parámetro por venta. Quien deshabilite un medio con ventas en espera ya armadas verá el rechazo recién al confirmar (error claro, se elige otro medio).

---

## 2. Bloque para `Estado.md`

**Cabecera** — anteponer a "Última actualización" (lo previo pasa a "Previo"):

```
2026-10-19 (**Medios de pago habilitables por comercio — ADR-XXX** — decisión aceptada, **pendiente de implementación en 2 PRs**: PR1 núcleo (parser puro en `@ferreteria/shared`, validación `MEDIO_PAGO_DESHABILITADO` en `confirmarVenta`, prop opcional `mediosHabilitados` en `ConfirmarVentaModal`); PR2 Retail (migración que siembra `medios_pago_habilitados`, pantalla Configuración → Medios de pago con `config.fiscal`, cableado del POS). Efectivo siempre habilitado y fuera de la lista; fila ausente = todos (Elaborados sin cambios). La "decisión abierta" de sembrar 8 medios no aplica a este repo (no hay tabla `medios_pago`). Origen: A22 del análisis SICOVESTO. **Previo:** …
```

**Bitácora de decisiones** — agregar:

```
- `2026-10-19` — Núcleo/Retail: aprobado A22 (ADR-XXX). Discovery: no existe tabla `medios_pago` (unión cerrada de 5 medios en 4 lugares); `parametros:set` es solo UPDATE (hay que sembrar la fila); escritura exige `config.fiscal`. Decisiones: parámetro de códigos, Efectivo fijo e implícito, ausente = todos, validación en `confirmarVenta`, pantalla solo en Retail, catálogo en BD y medios nuevos reservados, recargo por defecto fuera de alcance.
```

**Tabla "ADRs de arquitectura"** — fila: `ADR-XXX | Medios de pago habilitables por comercio | Aceptado (pendiente de implementación) | 2026-10-19 | docs/ADR-Log-ferreteria.md`.

**Releases / próximas fases** — en 1.1.x de Retail: "Medios de pago habilitables — ADR-XXX — pendiente".

**Backlog** (`mejoras-acumulativas.md`): A22 ✔ decidido (opción C: lista de códigos). Con esto queda cerrada la tanda priorizada de la sesión de diseño (A2, A3, A23, A5, A6, A8 cubierto, A16, A18 descartado, A22, A24); restan menores a demanda: A1, A4, A7, A9, A10, A13–A15, A17, A19, A21, A25 y, descartados, A11/A12/A20.

---

## 3. Prompt de implementación para Superpowers

```
# CONTEXTO
Monorepo pnpm `Gestion-Pymes-Apps` (Electron 32 + React + TypeScript + SQLite/Drizzle). Esta mejora toca el núcleo (`packages/shared`, `packages/core-main`, `packages/core-ui`) y `apps/retail`. Leé `CLAUDE.md` antes de empezar (arquitectura core vs apps, "Rutas", "Navegación", dos runners de test): rige. Elaborados comparte `confirmarVenta` y `ConfirmarVentaModal`: NO debe cambiar su comportamiento.
Castellano rioplatense. Dinero en centavos. Offline-first. Phase-gate: el ADR-XXX autoriza lo descripto abajo y nada más.
Fuente de verdad del diseño: `docs/Pack-A22-medios-de-pago-configurables.md` §1 (ADR-XXX). Si algo no está ahí, NO lo inventes: frená y preguntá.
Flujo: TDD (RED-GREEN-REFACTOR), un PR por fase. Tests: renderer con vitest; main de Retail/Elaborados bajo Electron (`node scripts/test-node.cjs`) en SERIE; los paquetes del core con sus propios runners. Si tocás `packages/*/src`, recompilá (`pnpm -r build`) antes de correr las apps. Los comandos largos (suite completa, pnpm dev) los lanzás vos, no un subagente.

# DECISIONES CERRADAS (no reabrir)
- Parámetro `medios_pago_habilitados` (string/JSON) con CÓDIGOS de los medios configurables: `tarjeta`, `transferencia`, `cuenta_corriente`, `cheque`. Efectivo implícito y siempre habilitado, fuera de la lista y de la pantalla.
- Fila ausente = todos habilitados; lista vacía = solo efectivo; valor ilegible o códigos desconocidos ⇒ permisivo (nunca bloquear ventas).
- Validación solo en `confirmarVenta` (error `MEDIO_PAGO_DESHABILITADO`); NO en `anularVenta` ni en cobros de cuenta corriente.
- Pantalla solo en Retail, gateada por `config.fiscal`. NO se crea tabla de medios, NO se agregan medios nuevos, NO se agrega recargo por defecto.

# GATE 0 — GIT LIMPIO
1. `git status` y `git branch --show-current`. Si el árbol no está limpio o no estás en `main` actualizado: STOP y avisá.
2. Ramas: `feat/core-medios-pago-habilitados` y luego `feat/retail-config-medios-pago` (parte de `main` con la anterior mergeada).

# FASE 1 — PR1: núcleo
1. Discovery (solo lectura): `packages/core-main/src/venta/confirmar-venta.ts` (validación de pagos, MEDIO_PAGO_DUPLICADO), `venta/types.ts`, `packages/core-ui/src/views/venta/{ConfirmarVentaModal,tipos}.tsx|ts`, `packages/core-ui/src/lib/errores.ts`, `packages/shared/src/index.ts` (cómo se exporta), `core-main/src/ipc/parametros.ts` y `parametros-cache.ts`, y los usos de `ConfirmarVentaModal` en `apps/retail/src/renderer/views/pos/PosView.tsx` y `apps/elaborados/src/renderer/views/pos/PosView.tsx`. Reportá dónde está el tipo `MedioPago` y si `core-main` puede importarlo de `@ferreteria/shared` o de `@core/ui` (el core-main NO debe depender de core-ui): proponé dónde vive `MEDIOS_PAGO_CONFIGURABLES`.
2. STOP-AND-CONFIRM: mostrame (a) la firma exacta de `parsearMediosPagoHabilitados` y la constante, y en qué archivo de `@ferreteria/shared` van; (b) la prop nueva del modal; (c) el texto/código del error. No escribas hasta mi OK. Sin dependencias nuevas.
3. RED → GREEN en `@ferreteria/shared`: parser puro. Tests: `null`/ausente ⇒ todos; lista válida; lista vacía ⇒ solo efectivo; JSON inválido ⇒ todos; códigos desconocidos ignorados; no incluye `efectivo` en el resultado configurable pero lo trata como siempre permitido; duplicados. Recompilar shared.
4. RED → GREEN en `confirmarVenta`: leer el parámetro con una consulta directa a `parametros_sistema` (no por el caché de IPC) y rechazar `MEDIO_PAGO_DESHABILITADO` luego de `MEDIO_PAGO_DUPLICADO`, antes de cualquier escritura. Tests en el core: fila ausente ⇒ todo se acepta (regresión); medio deshabilitado ⇒ rechazo sin persistir nada; efectivo siempre aceptado incluso con lista vacía; `cuenta_corriente` deshabilitada rechaza aunque el cliente la habilite; venta mixta con un medio deshabilitado ⇒ rechazo total; JSON inválido ⇒ todo aceptado; `anularVenta` de una venta cuyo medio hoy está deshabilitado funciona.
5. RED → GREEN en `ConfirmarVentaModal`: prop opcional `mediosHabilitados?: readonly MedioPago[]` (default todos), efectivo siempre presente, `cuenta_corriente` sigue exigiendo `habilitaCcc`, fila inicial = `formaPagoDefault` si está habilitado, si no efectivo; no se puede agregar un medio deshabilitado. Traducción de `MEDIO_PAGO_DESHABILITADO` en `errores.ts`. Tests del modal.
6. Regresión: corré las suites completas de Retail (main en serie y renderer) y de Elaborados (main y renderer) y del core. Elaborados NO debe requerir ningún cambio. Si alguna suite existente falla por el cambio, STOP y reportá.
7. Cierre de fase: typecheck del monorepo y builds de `@core/*`/shared. No hay UI nueva: no hace falta `pnpm dev` salvo que quieras confirmar el modal en un POS; si no lo verificás en la app, decilo.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# FASE 2 — PR2: Retail
1. Discovery de schema (solo lectura, ANTES de la migración): últimas migraciones y journal de `apps/retail/src/main/db/migrations` (la última conocida es 0049; verificá el número real, puede haber otras ramas), cómo se siembran parámetros en migraciones previas (p. ej. `0026_adr047_agenda.sql`) y las columnas de `parametros_sistema`. Recordá que `drizzle-kit generate` está roto en Retail: migración SQL a mano consistente con el journal.
2. STOP-AND-CONFIRM: antes de escribir en `parametros_sistema`, mostrame la fila exacta: `medios_pago_habilitados`, valor `["tarjeta","transferencia","cuenta_corriente","cheque"]`, tipo `string`, descripción, con `INSERT OR IGNORE`. Esperá mi OK.
3. Migración aditiva e idempotente + test de migración/seed si el repo lo acostumbra.
4. Pantalla `ConfigMediosPago.tsx` en `renderer/views/config/`: un interruptor por medio configurable, Efectivo mostrado como fijo/no editable, aclaración "las ventas ya hechas no cambian", guardado con `parametros.set` serializando la lista, errores con el patrón existente (`useCallIpc`, catálogo de errores; TODO submit necesita catch + traducción), confirmación de éxito estandarizada. Gate de ruta y de NAV con `config.fiscal`.
5. Las TRES piezas de navegación: ruta `config/medios-de-pago` en `routes/index.tsx`, ítem en `NAV` (grupo Sistema, con `permiso: 'config.fiscal'`) y entrada en `CRUMBS`; agregá el test de nav de Retail (cada ítem con `to` tiene ruta real y breadcrumb distinto del fallback). Confirmá con `grep` que el componente está efectivamente montado.
6. POS: leer `parametros.get('medios_pago_habilitados')` al abrir el modal de confirmación (no al montar), parsear con `parsearMediosPagoHabilitados` y pasar `mediosHabilitados` al modal. Test del POS.
7. Cierre de fase: typecheck, tests del renderer completos, main en serie. Con `pnpm dev` (rebuild para Electron antes), navegando como Supervisor: Configuración → Medios de pago, deshabilitar Cheque y Cuenta Corriente, ir al POS y confirmar que el modal no los ofrece; forzar por consola/IPC un pago con cheque y ver el rechazo; reactivar y verificar. Probar también con un Operador (no ve la pantalla). Si no podés verificarlo en la app, decilo explícitamente.
STOP-AND-CONFIRM: diff completo + resultados antes de commitear.

# CONDICIONES DE STOP (todas las fases)
- Cambios de comportamiento en Elaborados, tablas nuevas, medios nuevos, recargo por defecto o cambios en reportes de caja/exportadores ⇒ STOP.
- Una dependencia nueva, una migración distinta de la aprobada o un parámetro no listado ⇒ STOP.
- Tocar `precio.override`, `PRECIO_DESACTUALIZADO` o notas de crédito ⇒ fuera de alcance.
- Tests rotos que no son tuyos ⇒ no los arregles en silencio: reportalos.

# CIERRE DOCUMENTAL (en el PR de la última fase)
Actualizá `Estado.md` (cabecera + Bitácora + tabla de ADRs + releases) y `docs/ADR-Log-ferreteria.md` (ADR → Implementado, fechas, gates de tests). Un paso no está cerrado hasta que ambos estén al día.

# ENTREGA DE CADA FASE
Resumen de qué cambió, diff completo, salida de typecheck y de las suites (main en serie, renderer, core y Elaborados), qué verificaste en la app y qué NO pudiste verificar. No hagas merge: lo decido yo.
```
