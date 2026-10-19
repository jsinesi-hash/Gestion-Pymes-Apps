# Pack — Seguridad de ventas en Retail: `precio.override` en el main + camino de UI para `PRECIO_DESACTUALIZADO`

> Origen: discovery del diseño de atajos/cantidad del POS (`docs/Pack-A5-A6-atajos-y-cantidad-pos.md`, "Fuera de alcance"). Destino: **Retail** (`apps/retail`), 3 PRs. `@core/*` y Elaborados **no se tocan** en la opción recomendada.
> Sin número de ADR a propósito: lo asigna el usuario a mano. **Estado: Aceptado el 2026-10-19 — las 5 decisiones de §0.6 se aprobaron tal como se recomendaban; pendiente de implementación (3 PRs).**
> Contenido: (0) discovery y opciones, (1) texto de ADR, (2) bloque de `Estado.md`, (3) prompt de implementación para Superpowers.
> Discovery hecho solo por lectura de código (no se ejecutó la app ni los tests): lo marcado *(por lectura)* se confirma con un test de caracterización en el Gate 1 del prompt.

---

## 0. Discovery y opciones

### 0.1 Qué se verificó

**(1) `precio.override` no se controla en el main.** `precio.override` aparece solo en el seed (`PERMISOS_CORE`), en `packages/shared/src/permisos.ts` (etiqueta) y en el renderer (`PosView.tsx:180,188` → `canOverride` de `PosItemsTable` y `PosBottomBar`). Ningún handler lo consulta. Los tres puntos de entrada del POS aceptan descuentos tal cual llegan:

| Camino | Handler | ¿Chequea permiso de descuento? |
|---|---|---|
| Confirmar venta | `venta:confirmar` → `ventaConfirmarHandler` (`venta.ts:165`) → `confirmarVenta` (core) | No. Solo `venta.crear`. |
| Poner en espera | `venta.espera:pausar` (`venta-espera.ts:64`) → `pausarVentaEspera` (core) | No. Persiste `descuento_linea`/`descuento_global` tal cual. |
| Retomar espera → confirmar | `venta.espera:retomar` devuelve `descuento_linea_pct` y `descuento_global`; luego `venta:confirmar` | No (hereda lo guardado). |
| Presupuesto crear/editar/emitir | `presupuesto:*` (`presupuesto.ts:178/245/327`) con `descuento_global_pct`/`descuento_linea_pct` | No: exigen solo sesión. **Ni siquiera `presupuesto.crear/emitir/anular`** (sembrados, nunca consultados). `PresupuestoFormModal` muestra el campo de descuento global **sin** `canOverride`: un Operador puede emitir un presupuesto con descuento desde la UI. |
| Presupuesto → venta | `prepararConversion` → POS → `venta:confirmar` | No. El descuento global viaja como `descuento_global`; el de línea viene ya embebido en el precio (ver 0.1.3). |
| Elaborados | `venta:confirmar`, `venta.espera:pausar` (`parseCarrito`: `descuento_linea_pct`, `descuento_global_pct`) | No, y la UI tampoco lo oculta (`CarritoPanel` sin `canOverride`). Pero el servidor **recalcula** totales con `valorizarCarrito`. |

**Agravante:** en Retail el servidor tampoco recalcula los totales. `confirmarVenta` persiste `subtotal`, `descuento_global`, `importe_iva`, `total` y `ajuste_redondeo` tal como los manda el cliente; `validarLineasPrevio` solo compara el `precio_unitario` de cada línea contra la lista re-resuelta (y lo hace **solo si existe una lista predeterminada**). Es decir: aun con el permiso controlado sobre los campos `descuento_*`, un cliente hostil podría mandar `descuento_global = 0` y un `total` menor. El control de campos cierra el camino honesto (bug, UI desactualizada, retomar una espera con descuento), no el hostil. **Modelo de amenaza real:** app de escritorio offline; el IPC solo lo alcanza el renderer propio (bug/XSS/DevTools), no la red. Prioridad media: es una incoherencia con la matriz RBAC más que un agujero explotable a distancia. El recálculo de totales se deja como ADR aparte (ver 0.5).

**(2) `PRECIO_DESACTUALIZADO` sin camino de UI.** `validarLineasPrevio` lo lanza si algún precio no coincide y no vinieron `supervisor_credenciales`. En `PosView.tsx`: `handleConfirmar` solo reconoce `LIMITE_CREDITO_EXCEDIDO` para abrir `LimiteCreditoAuthModal`; el resto va a `mensajeErrorVenta`, que **no** traduce `PRECIO_DESACTUALIZADO` ni `FORBIDDEN`, etc. y cae en `No se pudo confirmar la venta: <código crudo con el envoltorio de Electron>`. Dato clave: el catálogo común `packages/core-ui/src/lib/errores.ts:90` **ya traduce** `PRECIO_DESACTUALIZADO` ("El precio cambió. Requiere autorización del supervisor."), pero `PosView` no usa `traducirError`.

**Defecto colateral en el mismo flujo:** `handleLimiteAuth` atrapa cualquier error, cierra el modal y muestra el banner; por eso `SUPERVISOR_INVALIDO` (contraseña mal tipeada) nunca llega al `catch` del modal, que sí sabe mostrarlo inline y permitir reintento. Hoy una contraseña equivocada tira la autorización y muestra el código crudo.

**(3) Caminos que disparan `PRECIO_DESACTUALIZADO` sin que cambie ninguna lista** *(por lectura, a confirmar con test en el Gate 1)*:
- **Presupuesto → venta con descuento o precio congelado distinto del actual.** `precargarDesdePresupuesto` pone `precioListaCentavos = precio_unitario_centavos` (neto del descuento de línea, snapshot de emisión) y `descuentoLineaPct = 0`. El servidor compara contra `lista_vigente × factor × (1 − 0)`: cualquier línea con descuento, o cuyo precio de lista cambió desde la emisión, da mismatch. Esto contradice ADR-046 §4 ("dentro de validez usa el precio snapshot") y deja la conversión **bloqueada** (no hay modal). Además el descuento de línea del presupuesto no queda como dato en `venta_detalle` (precio ya neto, `descuento_linea = 0`).
- **Retomar una espera.** `retomar` repone `precio_lista_actual_centavos` desde `producto.precio_venta_lista` (columna legado), mientras `addLinea` y el servidor usan `lista_precio_valor` por cliente; y `pausar` no guarda `presentacion_id`/`factor_a_stock_aplicado` (el `venta_detalle` de una espera queda sin presentación), así que una línea con presentación no default vuelve con factor 1. Resultado probable: la venta retomada pide autorización de Supervisor por una diferencia que no existe para el operador. **No se arregla en este ADR** (es repricing de espera, otro tema): se registra como seguimiento y el modal de autorización actúa de red de seguridad mientras tanto.

### 0.2 Opciones — dónde validar el permiso

| | Opción | A favor | En contra |
|---|---|---|---|
| **A (recomendada)** | En Retail, dentro de `validarLineasPrevio`/`ventaConfirmarHandler`: calcular `hayDescuento` (algún `descuento_linea > 0` o `descuento_global > 0`) y exigir `precio.override` **o** `supervisor_credenciales` válidas. Un solo `verificarSupervisor` aunque se junten motivos. | Mismo patrón y mismo lugar que `PRECIO_DESACTUALIZADO` (ADR-049 §9). Cero cambios en `@core/main` (módulo aprobado) ni en Elaborados. Blast radius mínimo. | Si Elaborados decide el mismo control, lo reimplementa (aceptable: hoy no hay decisión de producto para la heladería). |
| B | Seam en el core: `ConfirmarVentaInput.requiere_override?: boolean` (la app calcula el flag; el core exige permiso o credenciales). | Un solo lugar; Elaborados se suma con una línea cuando decida. | Toca `confirmarVenta` (core aprobado, ADR-095) y el contrato de `ConfirmarVentaInput`; exige ADR/gate de core y tests del core; se anticipa una decisión de Elaborados que no existe. |
| C | Recalcular y validar totales en el servidor con `resolverPrecio` (pura, en `@ferreteria/shared`), derivando el descuento de la diferencia. | Cierra también el camino hostil. | Riesgo alto de falsos rechazos (flotantes en pesos de las columnas legado, IVA, redondeo $1); es un rediseño de la validación de ventas. **Otro ADR.** |
| D | Solo UI (status quo). | — | Es el problema. |

**Qué pasa sin permiso ni credenciales:** error nuevo `DESCUENTO_REQUIERE_AUTORIZACION`. Se prefiere "permiso **o** credenciales" (como límite de crédito y precio desactualizado) a un rechazo duro: la matriz RBAC lo marca como override de Supervisor, y las credenciales dejan que el Operador resuelva un presupuesto o espera con descuento llamando al Supervisor al mostrador, sin cambiar de usuario. Trade-off: rechazo duro es más estricto pero bloquea ventas legítimas sin salida.

**`pausar`:** no se controla. Poner en espera no mueve stock ni caja; el único punto de efecto comercial es `confirmar`, que sí controla. Trade-off: puede quedar guardada una espera con descuento que el Operador no puede confirmar sin Supervisor; el modal de autorización lo resuelve y evita un segundo control que rompería "convertir presupuesto → poner en espera".

### 0.3 Opciones — descuentos que llegan de un presupuesto ya emitido

| | Opción | A favor | En contra |
|---|---|---|---|
| **P1 (recomendada)** | El presupuesto emitido **es** la autorización. (a) Al confirmar con `presupuesto_id`, el servidor carga el presupuesto (`emitido`/`vencido`) y exime del control de descuento si los descuentos del carrito **coinciden exactamente** con los del documento; el precio de esas líneas se valida contra el snapshot (vigente) o contra el repricing de hoy (vencido), no contra la lista actual. (b) Para cerrar el origen, `presupuesto:crear/editar/emitir` exigen `precio.override` cuando hay descuento > 0 y `PresupuestoFormModal` oculta los campos sin el permiso. | Coherente con ADR-046 (precio congelado honrado) y con la matriz. El control vive donde nace el descuento. Arregla además el bloqueo 0.1.3. | Toca `presupuesto.ts` (módulo aprobado → lo autoriza este ADR). **Cambio de producto:** un Operador deja de poder cotizar con descuento (hoy puede). Requiere tu OK (decisión 2). |
| P2 | Sin trato especial: toda conversión con descuento pide Supervisor. | Simple. | El Operador necesita al Supervisor en cada conversión de un presupuesto que ya salió con descuento; sigue sin arreglar el bloqueo por precio congelado. |
| P3 | Confiar en el descuento del presupuesto sin gate de emisión (status quo). | Cero trabajo. | El hueco simplemente se muda a `presupuesto:crear`. |

### 0.4 Opciones — UI para `PRECIO_DESACTUALIZADO` (y descuento sin permiso)

- **U1 — solo autorización de Supervisor:** el error abre el modal de credenciales y reintenta con `supervisor_credenciales`. Mínimo; pero el Supervisor "acepta el precio viejo del carrito" aun cuando lo normal es que el Operador simplemente actualice precios.
- **U2 — solo "actualizar precios":** reprecia las líneas con el motor y avisa. Rompe la conversión de presupuestos (el precio congelado es lo que se quiere honrar) y no cubre el descuento sin permiso.
- **U3 (recomendada) — diálogo con dos salidas:** para `PRECIO_DESACTUALIZADO`: **"Actualizar precios del carrito"** (acción por defecto, cualquier usuario; reutiliza el repricing que `usePosSession` ya hace al cambiar de cliente, extraído a una función) y **"Mantener precios y autorizar"** (Supervisor). Para `DESCUENTO_REQUIERE_AUTORIZACION`: solo autorizar (o cancelar). Con presupuesto cargado, "Actualizar precios" no se ofrece (se conserva el precio emitido).

**Componente:** reutilizar el flujo de `LimiteCreditoAuthModal` generalizándolo (props `titulo`, `mensaje`, `etiquetaConfirmar`, con defaults que preservan el texto actual → sus tests siguen verdes), **en Retail**, en lugar de modificar `SupervisorAuthModal` de `@core/ui`. Motivo: `SupervisorAuthModal` es genérico y ya traduce errores, pero no admite título/mensaje contextual; agregarle props toca `@core/ui` (aprobado) por una necesidad que hoy es de una sola app (regla de tres). La unificación de ambos modales en el core queda como seguimiento. Estado del POS: pasar de `limiteAuth` a un `autorizacion: { motivo: 'precio'|'descuento'|'limite', pagos, vuelto }`; las credenciales ingresadas cubren todos los motivos del mismo intento (el servidor verifica una vez para precio/descuento y el core de nuevo para el límite).

**Correcciones obligadas en el mismo cambio:** (i) el `onAutorizar` debe **relanzar** el error para que el modal muestre `SUPERVISOR_INVALIDO` inline y permita reintentar; (ii) `mensajeErrorVenta` pasa a delegar en `traducirError` (`@core/ui`, exportado) para todo código que no tenga texto propio, manteniendo los textos locales actuales.

### 0.5 Impacto en Elaborados y fuera de alcance

- **En la opción A/P1/U3 no se toca `@core/*` ni Elaborados.** `confirmarVenta`/`pausarVentaEspera` quedan idénticos; los tests de Elaborados y del core no cambian. La diferencia ya existe hoy: Elaborados recalcula totales en el servidor y no controla `precio.override`.
- **Decisión pendiente de producto para Elaborados** (no se resuelve acá): ¿los operadores de la heladería pueden dar descuento libremente? Hoy sí (UI y main). Si la respuesta es "no", se extrae el control al core (opción B) con su propio ADR.
- **Seguimientos que este ADR deja registrados, sin hacerlos:** (a) recálculo y validación de totales en el servidor de Retail (opción C; ADR aparte); (b) repricing/presentación de `retomar`/`pausar` (0.1.3); (c) **auditoría de la autorización**: hoy no se guarda qué Supervisor autorizó (`verificarSupervisor` devuelve el id y se descarta) aunque CLAUDE.md §6 dice "autorizaciones registradas"; requiere columna → migración → ADR aparte; (d) permisos `presupuesto.crear/emitir/anular` sembrados y nunca controlados en el main (el ADR cubre solo el descuento); (e) unificar `LimiteCreditoAuthModal` con `SupervisorAuthModal` en el core.

### 0.6 Decisiones (aprobadas el 2026-10-19 tal como se recomendaban)

1. **Permiso o credenciales** (recomendado) vs rechazo duro para el descuento sin `precio.override` en `venta:confirmar`.
2. **Presupuestos (P1):** ¿un Operador deja de poder emitir presupuestos con descuento (requiere `precio.override`)? Hoy puede; la matriz RBAC dice que no debería, pero ADR-046 declaró los presupuestos operaciones de mostrador.
3. **UX de `PRECIO_DESACTUALIZADO`:** U3 (dos salidas, recomendado) o U1 (solo Supervisor, más barato).
4. **Elaborados:** confirmar que queda fuera y que el control de descuento allá es una decisión de producto aparte.
5. **Totales en el servidor (opción C):** confirmar que va como ADR aparte y no en este.

---

## 1. Texto de ADR (para `docs/ADR-Log-ferreteria.md`)

## ADR-XXX — Retail: `precio.override` exigido en el main y camino de UI para `PRECIO_DESACTUALIZADO`

**Estado:** Aceptado — decisiones 1–5 de 0.6 aprobadas como se recomendaban; pendiente de implementación (3 PRs) · **Fecha:** 2026-10-19

**Contexto.** La matriz RBAC reserva el override de precio al Supervisor (`precio.override`, también sembrado en `PERMISOS_CORE`), pero hoy solo el renderer lo respeta: `PosItemsTable` y `PosBottomBar` ocultan Desc. % de línea y Desc. global (`can('precio.override')`) y ningún handler del main lo consulta. `venta:confirmar`, `venta.espera:pausar` y los `presupuesto:*` aceptan `descuento_linea`/`descuento_global` sin chequeo (y `presupuesto:*` ni siquiera chequea los permisos `presupuesto.*`). Por otro lado `validarLineasPrevio` (ADR-049 §9) lanza `PRECIO_DESACTUALIZADO` si el precio recibido difiere del re-resuelto salvo que lleguen `supervisor_credenciales`, pero `PosView` no tiene camino para ese código: `mensajeErrorVenta` no lo traduce y no hay modal de credenciales; la venta queda bloqueada con el código crudo. El mismo bloqueo afecta, por lectura de código, a la conversión de presupuestos con descuento o con precio congelado distinto del vigente (ADR-046 §4 prometía honrar el snapshot). Además `handleLimiteAuth` traga `SUPERVISOR_INVALIDO` y cierra el modal. Decisión de producto ya cerrada (pack A5/A6): en el POS **no se edita el precio por línea, solo se otorga descuento**.

**Decisión (propuesta).**

*A. Enforcement en el main, en Retail.* `ventaConfirmarHandler`/`validarLineasPrevio` calcula `hayDescuento` (algún `descuento_linea > 0` o `descuento_global > 0`). Si lo hay y la sesión no tiene `precio.override`, exige `supervisor_credenciales` válidas (`verificarSupervisor`); sin ellas lanza `DESCUENTO_REQUIERE_AUTORIZACION`. Si además hay `PRECIO_DESACTUALIZADO`, un único `verificarSupervisor` cubre ambos motivos. `pausar` no se controla: el efecto comercial ocurre al confirmar, que sí controla. `@core/main` (`confirmarVenta`, `pausarVentaEspera`) y Elaborados no cambian.

*B. El presupuesto emitido es la autorización.* Al confirmar con `presupuesto_id`, el servidor carga el presupuesto (`emitido`/`vencido`); si los descuentos del carrito coinciden exactamente con los del documento, no exige override, y el precio de esas líneas se valida contra el snapshot (vigente) o el repricing de hoy (vencido), no contra la lista actual. En origen, `presupuesto:crear/editar/emitir` exigen `precio.override` cuando hay descuento > 0 y `PresupuestoFormModal` oculta los campos sin el permiso. *(Sujeto a la decisión 2: cambia lo que puede hacer el Operador.)*

*C. UI.* `PosView` maneja `PRECIO_DESACTUALIZADO` y `DESCUENTO_REQUIERE_AUTORIZACION` además de `LIMITE_CREDITO_EXCEDIDO` con un único estado `autorizacion` y el modal de credenciales generalizado en Retail (no se toca `@core/ui`). Para precio desactualizado el diálogo ofrece "Actualizar precios del carrito" (por defecto; repricing extraído de `usePosSession`, no se ofrece con presupuesto cargado) y "Mantener precios y autorizar" (Supervisor). Las credenciales ingresadas cubren todos los motivos del intento. `onAutorizar` relanza el error para que el modal muestre `SUPERVISOR_INVALIDO` y permita reintentar. `mensajeErrorVenta` delega en `traducirError` para los códigos sin texto local; se agrega `DESCUENTO_REQUIERE_AUTORIZACION` al catálogo común de errores (una entrada, aditiva).

**Alternativas descartadas.** Seam en el core (`requiere_override` en `ConfirmarVentaInput`): tocar `confirmarVenta` aprobado por una decisión que Elaborados aún no tomó (regla de tres, se reevalúa cuando la tome). Recalcular totales en el servidor: rediseño de la validación de ventas con riesgo de falsos rechazos, ADR aparte. Rechazo duro sin credenciales: bloquea ventas legítimas sin salida. Solo "actualizar precios": rompe la conversión de presupuestos. Controlar también `pausar`: rompería poner en espera un presupuesto convertido.

**Fuera de alcance (seguimientos registrados).** Recálculo de totales en el servidor (el control de campos no frena a un cliente hostil que mande `descuento_global = 0` y un `total` menor; modelo de amenaza: app offline sin exposición de red). Repricing/presentación de las ventas en espera retomadas. Registro de qué Supervisor autorizó (requiere columna). Control en el main de los permisos `presupuesto.*`. Unificar los modales de autorización en `@core/ui`. Política de descuentos de Elaborados.

**Consecuencias.** El main pasa a respetar la matriz RBAC para descuentos en ventas (y, con B, en presupuestos); un Operador con una espera o presupuesto con descuento resuelve el caso con un Supervisor al mostrador. La conversión de presupuestos deja de bloquearse por el precio congelado. Una contraseña de Supervisor errónea se puede reintentar. Los clientes del IPC que hoy mandan descuentos sin ser Supervisor reciben `DESCUENTO_REQUIERE_AUTORIZACION` (cambio de comportamiento intencional). Sin migraciones, parámetros ni flags.

---

## 2. Bloque para `Estado.md`

**Cabecera** — anteponer a "Última actualización" (lo previo pasa a "Previo"):

```
2026-10-19 (**Retail — seguridad de ventas: `precio.override` en el main y UI de `PRECIO_DESACTUALIZADO` — ADR-XXX** — **aceptado (decisiones aprobadas), pendiente de implementación en 3 PRs**: PR1 UI (diálogo/modal de autorización para `PRECIO_DESACTUALIZADO` y descuento sin permiso, `mensajeErrorVenta` vía `traducirError`, `SUPERVISOR_INVALIDO` reintentable); PR2 main (`venta:confirmar` exige `precio.override` o credenciales de Supervisor si hay descuento; presupuesto emitido como autorización; validación de precio contra el snapshot); PR3 presupuestos (descuento exige `precio.override` al crear/editar/emitir). Sin migraciones; **`@core/*` y Elaborados no se tocan**. **Decisión de producto vigente:** en el POS no se edita el precio por línea, solo descuento. **Seguimientos registrados:** recálculo de totales en el servidor, repricing de esperas retomadas, auditoría de quién autorizó, permisos `presupuesto.*` sin control en el main. **Previo:** …
```

**Bitácora de decisiones** — agregar:

```
- `2026-10-19` — Retail: discovery de seguridad de ventas (ADR-XXX, aceptado). Confirmado por lectura: `precio.override` solo lo respeta la UI (ningún handler del main lo consulta, tampoco `presupuesto:*`); `PRECIO_DESACTUALIZADO` no tiene camino en `PosView` (el catálogo común sí lo traduce) y, por lectura, bloquea la conversión de presupuestos con descuento o precio congelado distinto. Recomendación: control en el main dentro de Retail (permiso o credenciales), presupuesto emitido como autorización, diálogo con dos salidas en la UI; sin tocar core ni Elaborados. 5 decisiones aprobadas como se recomendaban (ver el pack).
```

**Tabla "ADRs de arquitectura"** — fila: `ADR-XXX | Retail: precio.override en el main y UI de PRECIO_DESACTUALIZADO | Aceptado (pendiente de implementación) | 2026-10-19 | docs/ADR-Log-ferreteria.md`.

**Releases / próximas fases** — en 1.1.x de Retail: "Seguridad de ventas: override de precio en el main + autorización en el POS — ADR-XXX — propuesto".

---

## 3. Prompt de implementación para Superpowers

```
# CONTEXTO
Monorepo pnpm `Gestion-Pymes-Apps` (Electron 32 + React + TypeScript). Trabajás en `apps/retail` (`ferreteria-client`). Leé `CLAUDE.md` antes de empezar: rige.
Castellano rioplatense. Offline-first. Phase-gate: el ADR-XXX (seguridad de ventas) autoriza tocar SOLO lo listado abajo. Fuente de verdad del diseño: `docs/Pack-Seguridad-Venta-precio-override-y-precio-desactualizado.md` §0 y §1. Si algo no está ahí, NO lo inventes: frená y preguntá.
Flujo: TDD (RED-GREEN-REFACTOR), un PR por fase. Tests del renderer: `cd apps/retail && pnpm exec vitest run --config vitest.config.ts <archivo>`. Tests del main: bajo Electron (`node scripts/test-node.cjs` o el comando por archivo de CLAUDE.md), EN SERIE (el runner es flaky en paralelo). Los comandos largos (suite completa, pnpm dev) los lanzás vos, no un subagente. Cualquier cambio con UI se cierra con `pnpm dev` (rebuild para Electron antes) navegando como lo haría el usuario, con un Operador Y con un Supervisor.

# DECISIONES CERRADAS (no reabrir)
- En el POS NO se edita el precio de una línea: solo descuento.
- `@core/*`, Elaborados y el esquema NO se tocan.
- Decisiones 1–5 de §0.6: NO reabrir (ya aprobadas el 2026-10-19 tal como se recomendaban; la Fase 3 queda habilitada).

# GATE 0 — GIT LIMPIO
1. `git status` y `git branch --show-current`. Debés estar en `main` actualizado y con el árbol limpio; los únicos untracked admitidos son los `docs/Pack-*.md`. Si no: STOP y avisá.
2. Antes de empezar, verificá si el pack A5/A6 (atajos/`N*`) está en curso o mergeado: ambos tocan `PosView.tsx` y `usePosSession.ts`. No trabajes en paralelo sobre los mismos archivos; si hay una rama abierta de ese pack, STOP y preguntá el orden.
3. Ramas: `feat/retail-venta-autorizacion-ui` (PR1), `feat/retail-venta-override-main` (PR2), `feat/retail-presupuesto-descuento-gate` (PR3). PR2 y PR3 parten de `main` con la anterior mergeada.

# GATE 1 — DISCOVERY CON TESTS DE CARACTERIZACIÓN (solo lectura + tests que no cambian producción)
Confirmá con tests (RED esperado = documentan el comportamiento actual) lo que el discovery solo leyó:
 a. Operador (hay que crear un helper `loginAsOperador` análogo a `loginAsAdmin` en `ipc/__tests__/helpers.ts`; está permitido tocar ESE helper) confirma una venta con `descuento_linea` > 0 y con `descuento_global` > 0: hoy pasa (prueba el hueco).
 b. Presupuesto emitido con descuento de línea → `prepararConversion` → confirmar con el payload que arma `precargarDesdePresupuesto` (precio neto del snapshot, `descuento_linea = 0`, `presupuesto_id`): ¿lanza `PRECIO_DESACTUALIZADO`? Idem con un presupuesto sin descuento pero con precio de lista cambiado.
 c. Espera pausada y retomada con un producto cuyo `lista_precio_valor` ≠ `producto.precio_venta_lista`: ¿el payload de confirmar coincide con el re-resuelto?
Reportá los resultados. STOP-AND-CONFIRM: si (b) o (c) NO se comportan como dice el pack, o hay más caminos que acepten descuentos de los listados en §0.1, frená y mostrámelo antes de seguir.

# FASE 1 — PR1: UI de autorización (renderer + 1 entrada de catálogo)
Archivos autorizados: `views/pos/PosView.tsx`, `views/pos/LimiteCreditoAuthModal.tsx` (generalizar con props `titulo`/`mensaje`/`etiquetaConfirmar`, defaults = textos actuales), `hooks/usePosSession.ts` (solo: extraer el repricing de líneas ya existente a una función reutilizable y exponerla; sin cambiar el comportamiento del cambio de cliente), `packages/core-ui/src/lib/errores.ts` (SOLO agregar `DESCUENTO_REQUIERE_AUTORIZACION` al catálogo — STOP-AND-CONFIRM antes de tocar este archivo, es @core).
1. RED: tests de `PosView`: `PRECIO_DESACTUALIZADO` abre el diálogo (no el banner crudo); "Actualizar precios" reprecia y no confirma solo; con presupuesto cargado esa opción no se ofrece; "Mantener y autorizar" pide credenciales y reintenta `confirmar` con `supervisor_credenciales`; `DESCUENTO_REQUIERE_AUTORIZACION` abre el modal solo con la acción de autorizar; `SUPERVISOR_INVALIDO` se muestra DENTRO del modal y permite reintentar (hoy el modal se cierra: test de regresión del defecto previo, también para `LIMITE_CREDITO_EXCEDIDO`); `LIMITE_CREDITO_EXCEDIDO` sigue funcionando igual; `mensajeErrorVenta` traduce vía catálogo los códigos sin texto local. Regla del repo: todo handleSubmit de modal necesita catch + traducirError.
2. GREEN: estado `autorizacion { motivo, pagos, vuelto }` que reemplaza a `limiteAuth`; `onAutorizar` relanza; `mensajeErrorVenta` delega en `traducirError` conservando los textos locales.
3. Cierre de fase: typecheck, renderer completo, `pnpm dev`: con un Operador forzar un precio desactualizado (cambiar el precio de lista en otra sesión/pantalla entre agregar y confirmar) y verificar ambas salidas del diálogo; verificar contraseña de Supervisor errónea y reintento. Si algo no se pudo verificar en la app, decilo.
STOP-AND-CONFIRM: diff + resultados antes de commitear.

# FASE 2 — PR2: enforcement en el main
Archivos autorizados: `apps/retail/src/main/ipc/venta.ts` (SOLO `validarLineasPrevio`/`ventaConfirmarHandler`), `ipc/__tests__/venta.handlers.test.ts` (+ el helper de Gate 1), y lo mínimo de `ipc/presupuesto.ts` para leer el presupuesto en la validación (sin cambiar sus handlers: eso es la Fase 3).
1. RED: Operador + `descuento_linea > 0` ⇒ `DESCUENTO_REQUIERE_AUTORIZACION`; idem `descuento_global > 0`; con `supervisor_credenciales` válidas ⇒ confirma; con credenciales inválidas ⇒ `SUPERVISOR_INVALIDO`; Supervisor (sesión) ⇒ confirma sin credenciales; sin descuento ⇒ sin cambios; precio desactualizado + descuento en el mismo intento ⇒ un solo `verificarSupervisor`; `pausar` NO controla; con `presupuesto_id` válido y descuentos idénticos a los del documento ⇒ confirma sin override y sin `PRECIO_DESACTUALIZADO` por precio congelado (snapshot si vigente, repricing si vencido); con `presupuesto_id` y descuentos distintos de los del documento ⇒ exige override; el test existente de `PRECIO_DESACTUALIZADO` (línea ~286) sigue verde. Un presupuesto en estado no convertible mantiene el error actual (`PRESUPUESTO_NO_CONVERTIBLE`).
2. GREEN en `validarLineasPrevio`: calcular `hayDescuento`, motivos, y un único `verificarSupervisor` cuando corresponda. NO tocar `confirmarVenta` del core.
3. Cierre de fase: suite del main en SERIE, typecheck, `pnpm dev` con Operador (venta normal sigue igual; espera con descuento → pide autorización) y Supervisor (sin pedidos).
STOP-AND-CONFIRM: diff + resultados antes de commitear.

# FASE 3 — PR3: descuento en presupuestos (solo si el usuario aprobó P1 — decisión 2)
Archivos autorizados: `ipc/presupuesto.ts` (handlers crear/editar/emitir: exigir `precio.override` si hay `descuento_global_pct` > 0 o algún `descuento_linea_pct` > 0; NO agregar controles de los permisos `presupuesto.*`, es otro seguimiento), `views/presupuestos/PresupuestoFormModal.tsx` (ocultar/deshabilitar los campos de descuento sin el permiso, `can('precio.override')`), sus tests.
1. RED: Operador crea/edita/emite presupuesto con descuento ⇒ FORBIDDEN (o el código que ya use la app para permisos; verificá la convención y reportala); sin descuento ⇒ igual que hoy; Supervisor ⇒ ok; el modal oculta los campos sin permiso. Comprobá que un presupuesto YA emitido con descuento sigue siendo convertible (Fase 2).
2. GREEN, cierre: typecheck, tests del main (en serie) y renderer, `pnpm dev` navegando a Presupuestos con ambos roles.
STOP-AND-CONFIRM: diff + resultados antes de commitear.

# CONDICIONES DE STOP (todas las fases)
- Cualquier edición del precio unitario de una línea ⇒ STOP.
- Cambios en `packages/*` fuera de la única entrada de catálogo autorizada, en `@core/*`, Elaborados, esquema o migraciones ⇒ STOP y consultá.
- Recalcular o validar totales en el servidor, arreglar `retomar`/`pausar` (repricing, presentación), registrar quién autorizó, controlar `presupuesto.*`, o unificar modales en el core ⇒ FUERA de alcance: no lo toques aunque lo veas.
- Una dependencia nueva ⇒ STOP.
- Tests rotos que no son tuyos ⇒ no los arregles en silencio: reportalos.
- Si Gate 1 contradice el discovery ⇒ STOP.

# CIERRE DOCUMENTAL (en el PR de la última fase)
Actualizá `Estado.md` (cabecera + Bitácora + tabla de ADRs + releases) y `docs/ADR-Log-ferreteria.md` (ADR → Implementado, fecha, gates de tests, decisiones tomadas y los seguimientos). Un paso no está cerrado hasta que ambos estén al día.

# ENTREGA DE CADA FASE
Resumen de qué cambió, diff completo, salida de typecheck y de los tests, qué verificaste en la app y qué NO pudiste verificar. No hagas merge: lo decido yo.
```
