# Análisis de arquitectura — Fase online (multi-terminal en red y SaaS)

**Fecha:** 2026-11-16 · **Estado:** análisis, sin decisiones cerradas · **Release objetivo:** R4 / `2.0.0` (ADR-011, ADR-044)
**Amplía:** TechSpec §3.12 (Sincronización offline-first). **Marco:** ADR-001, ADR-003, ADR-006, ADR-012.

Objetivo pedido: que quien instala la app elija entre **modo standalone (offline, una PC)** y
**modo distribuido** (varias terminales en una red local y, más adelante, un SaaS).

---

## 1. Recomendación en una línea

**No conectar Electron a una base remota.** Todas las terminales siguen con su SQLite local
(ADR-001 intacto) y se agrega un **motor de sincronización contra un "hub"**. El modo
distribuido no cambia *dónde se escribe* sino *con quién se sincroniza*:

| Modo | Dónde está el hub | Qué cambia en la terminal |
|------|-------------------|---------------------------|
| Standalone (hoy) | no hay | nada |
| Red local | un servicio en una PC del local (o mini-servidor) | sync activado, URL del hub en LAN |
| SaaS | el mismo servicio, en la nube, multi-tenant | sync activado, URL pública + tenant |

Un solo protocolo y un solo servidor, desplegado en dos lugares. La LAN es el primer paso
del SaaS, no un camino aparte.

### Por qué no "todas las terminales contra un Postgres/servidor central"

- **Rompe offline-first:** si cae la PC servidor o internet, se detiene la venta. Es la
  alternativa que ADR-001 descartó.
- **Costo de reescritura enorme:** el main usa `better-sqlite3`, que es **síncrono**. Hay
  ~2.180 llamadas `.run()/.get()/.all()/transaction(tx => …)` síncronas en `apps/*/src/main`
  y `packages/core-main/src`. Pasar a un driver de red (Postgres, HTTP) obliga a volverlas
  `async` una por una, junto con las transacciones de venta, stock y caja.
- El esquema ya se diseñó para sync (UUID en cliente, `version`, `origin_id`, `sync_state`,
  `updated_at`, libros inmutables): conviene cobrar esa inversión.

---

## 2. Lo que ya está a favor

- **IDs UUID generados en el cliente** (ADR-003): no hay colisiones de PK entre terminales.
- **Libros de movimientos inmutables** (ADR-006) para stock, caja y cuenta corriente: se
  sincronizan por inserción, casi sin conflictos.
- **Política de conflictos decidida** (ADR-012): last-write-wins para maestros + log revisable.
- **Identidad de terminal real**: `origin_id` sale de `config.json` y se valida al arrancar
  (`packages/core-main/src/terminal.ts`, `context.ts`); la venta ya numera por terminal
  (`V-<terminal>-NNNNNN`, `confirmar-venta.ts:31`).
- **Patrón outbox ya usado** en avisos (ADR-047): la regla "se encola en la misma transacción
  del hecho" es exactamente la que necesita el sync.
- **Core vs app separados** (ADR-091/092): el motor de sync va una sola vez en `@core/*` y
  sirve a Retail y Elaborados.

---

## 3. Lo que hay que cambiar (por área)

### 3.1 Captura de cambios (outbox de sync)

**Hoy:** `version` y `sync_state` se mantienen a mano en los handlers (~270 lugares). No hay
tabla de outbox de sync ni triggers. Un handler que olvide subir `version` no se sincroniza
bien, y nada lo detecta.

**Cambio:** una tabla `sync_outbox` (local, no sincroniza) poblada por **triggers SQLite**
`AFTER INSERT/UPDATE` en cada tabla sincronizable, que además suben `version`, ponen
`sync_state='pending'` y `updated_at`. Captura las ~2.180 escrituras sin tocar los handlers,
y queda en la misma transacción (garantía ADR-003).

**Encaje con la baranda B2 (ADR-091/092, spec multi-rubro §5.5):** el motor de sync es del
core y lo dirige un **registro de tablas por app**: el core no conoce las tablas de dominio.
Hoy B2 ya existe como test en ambas apps (`apps/retail/src/main/db/__tests__/b2-sync-fields.test.ts`,
`apps/elaborados/src/main/__tests__/b2-sync-fields.test.ts`, vía `verificarCamposSync` de
`@core/db`), con las excepciones `provincia`, `departamento`, `localidad`,
`parametros_sistema`, `aviso` y `recuperacion_password`. Entonces:
- los triggers se **generan desde ese registro** (core + lo que registra cada app), no a
  mano por tabla;
- la verificación de cobertura de triggers es una **extensión del test B2**, no un test
  nuevo: toda tabla con campos de sync que no esté en las excepciones debe tener trigger;
- la lista de excepciones de B2 es la misma que define qué **no** sincroniza (estado
  operativo local), así que hay una sola fuente de verdad.

### 3.2 Saldos: dejan de sincronizarse como filas

**Hoy:** `existencias.stock_fisico`, `caja.monto_esperado`, `cuenta_corriente_cliente.saldo_centavos`
son filas mutables que cada terminal actualiza leyendo el valor local (`venta.ts:189`:
`stock_fisico - cantidad`). Con dos terminales, last-write-wins sobre un saldo **pierde
movimientos**: es incorrecto, no solo un conflicto.

**Cambio:** se sincronizan **solo los movimientos**; el saldo pasa a ser una **proyección**
que cada nodo recalcula al aplicar movimientos recibidos. `*_resultante` queda como dato
informativo de la terminal que lo generó (no se reescribe). Hace falta una función
`recalcularSaldo(producto|caja|cuenta)` en el core + test de integridad saldo = Σ movimientos.

### 3.3 Invariantes globales que el offline no puede garantizar

Son **decisiones de negocio**, requieren ADR antes de codificar:

| Regla actual | Problema distribuido | Opciones |
|---|---|---|
| "Sin stock no hay venta" (sin excepción) | dos terminales offline venden la última unidad | (a) validar solo contra stock local y aceptar negativo al consolidar, con alerta; (b) exigir hub online para vender por debajo de un umbral; (c) cupos de stock por terminal |
| Límite de crédito de cta. cte. | dos cajas fían al mismo cliente a la vez | ídem: tolerancia + alerta, o exigir online para cta. cte. |
| Unicidades (`marca.nombre`, `ubicacion.codigo`, `gtin_barcode`, `usuario.nombre_usuario`, SKU) | dos altas offline con el mismo valor | merge en el hub → conflicto al log del Supervisor (ADR-012), renombre/fusión manual |

En red local con el hub casi siempre alcanzable, (a) con alerta suele bastar; en SaaS con
locales de internet inestable, el tema pesa más.

### 3.4 Numeraciones correlativas

**Hoy:** la venta, la orden de compra y la producción de Elaborados ya numeran por terminal.
**SKU, remito y presupuesto** usan contadores globales en `parametros_sistema`
(`sku_proximo_secuencial`, `remito_proximo_secuencial`, `presupuesto_proximo_secuencial`).
*(Corregido el 2026-11-16: la primera versión incluía a producción entre los globales. Ver ADR-154.)* ADR-025 y ADR-045 ya
dejaron anotada esta deuda "para R4".

**Cambio:** decidir por documento:
- **Con terminal en el número** (como la venta): `RE-C2-000123`. Simple, totalmente offline.
- **Rangos por terminal** asignados por el hub (ej. SKU 1.000.000–1.099.999 a C2). Conserva
  el formato `P-NNNNNNN-D` sin cambios.
- **Número provisorio y definitivo al sincronizar.** Descartado para todo lo que se imprime
  en el momento (tickets, remitos, etiquetas).

Recomendación: terminal en el número para documentos y rangos para SKU. La **numeración
fiscal** (punto de venta ARCA) depende de **ADR-013, que sigue abierto**: no se cierra acá.

### 3.5 Configuración: global vs local

`parametros_sistema` no tiene campos de sync y mezcla cosas de distinta naturaleza:
- **Del negocio** (umbrales, flags, config SMTP, IVA): deben sincronizar → agregar sync o
  moverlos a una tabla nueva sincronizable.
- **De la terminal** (contadores locales, impresora, `origin_id`): no sincronizan.
- **Contraseña SMTP / certificados ARCA** (`safeStorage`): en modo distribuido el envío de
  correo y el fiscal probablemente se mudan al hub → pasan a ser secretos del servidor.

Se agrega a `config.json` de la terminal: `modo` (`standalone` | `distribuido`), `hub_url` y
la credencial de emparejamiento.

### 3.6 Usuarios, sesión y seguridad

- `usuario`, `rol`, `permiso`, `rol_permiso`, `rol_permiso_override` sincronizan (un
  usuario debe poder loguearse en cualquier caja). El bloqueo por intentos fallidos y la
  sesión siguen locales.
- La sesión es un singleton del proceso main (`auth/session`), correcto para escritorio.
  **No hay que cambiarlo** mientras los clientes sigan siendo Electron.
- **Nuevo:** autenticación **terminal ↔ hub** (emparejamiento con token de un solo uso,
  TLS, revocación de terminal). En SaaS además: `tenant_id` en el hub y aislamiento por
  tenant. Las tablas locales **no** necesitan `tenant_id`: cada SQLite pertenece a un solo
  negocio.

### 3.7 Procesos que deben correr en un solo lugar

Hoy cada instalación corre su scheduler: cambios de precio programados
(`scheduler/precios.ts`), motor de rutinas de agenda, worker de reintentos de avisos. Con N
terminales se ejecutarían N veces. Opciones: moverlos al hub (ADR-047 §10 ya lo prevé
para el despachador de avisos) o hacerlos idempotentes con una clave por ejecución. Las
dos sirven; mover al hub es más limpio.

### 3.8 Backup y restore

En modo distribuido, restaurar una terminal desde un `.db` viejo **resucita datos** y
genera conflictos masivos. El restore pasa a ser "re-inicializar la terminal desde el hub"
(snapshot + cursor). El backup completo se hace en el hub. El backup local queda solo para
el modo standalone.

### 3.9 Migraciones y versiones mezcladas

Con varias terminales, en algún momento habrá versiones distintas de la app al mismo
tiempo. Hace falta:
- versión de esquema y de protocolo en cada lote de sync; el hub acepta N y N-1;
- migraciones solo aditivas en el período de convivencia (ya es la regla de ADR-042);
- una terminal desactualizada **sigue vendiendo** y queda en cola hasta actualizarse.

### 3.10 Base del hub

ADR-002/016 dicen PostgreSQL + el mismo esquema Drizzle. Ojo: Drizzle usa `sqlite-core` y
`pg-core` como definiciones **distintas**: no es el mismo archivo. Además el esquema local
tiene pesos en `REAL` (deuda legacy), timestamps `INTEGER` y booleanos como enteros.
Dos caminos:
- **Hub con SQLite** (un archivo por negocio) para la red local: reusa el esquema tal cual,
  y es instalable como servicio de Windows sin DBA.
- **Hub con Postgres** para el SaaS: requiere generar el esquema pg desde el sqlite (o
  mantener los dos con un test de paridad).

Se puede empezar con SQLite en el hub detrás de una interfaz de repositorio y pasar a
Postgres cuando llegue el SaaS. Esto **no contradice B3**: B3 exige que el esquema compile
también a Postgres para la nube, y el hub de red local con SQLite no es la nube.

**B3 hoy no se verifica.** La baranda B3 (spec multi-rubro: "todo compila a SQLite (local) y
Postgres (nube)", sin trucos solo-SQLite) es una intención: todos los esquemas de
`packages/core-db/src/schema` y `apps/*/src/main/db/schema` importan solo
`drizzle-orm/sqlite-core`, y ningún test comprueba compatibilidad con Postgres. El ADR de F0
sobre la base del hub tiene que fijar:
- cómo se obtiene el esquema Postgres (generado desde las tablas Drizzle o definido en
  paralelo);
- una **baranda automática de paridad** (por ejemplo: generar el DDL Postgres y aplicarlo
  en un test, o comparar columnas/tipos tabla por tabla), igual que B2 ya es un test;
- el tratamiento de lo heredado: pesos en `REAL`, booleanos como enteros, timestamps Unix
  `INTEGER`, índices únicos parciales escritos solo en migraciones SQL.

### 3.11 Comprar el motor en vez de construirlo (evaluar)

Hay productos de sync Postgres ↔ SQLite (por ejemplo PowerSync, ElectricSQL, libSQL/Turso
con réplicas embebidas, cr-sqlite con CRDTs). Pueden ahorrar el protocolo de pull, pero
ninguno resuelve los puntos 3.2–3.4 (saldos, invariantes, numeración), que son de dominio.
Además agregan una dependencia pesada (§12 del CLAUDE.md pide justificarla). Conviene una
prueba de concepto corta antes de decidir; el outbox propio (ADR-003) es viable con el
esquema actual.

### 3.12 Protocolo: cursor del hub, no `updated_at`

Para bajar cambios no sirve pedir "todo lo posterior a mi último `updated_at`": cada
terminal pone la hora con su propio reloj, y una terminal atrasada escribe filas con
`updated_at` en el pasado que las demás nunca bajan. El hub asigna un **número de secuencia
propio** a cada cambio que acepta; cada terminal guarda el último número recibido y pide
"lo posterior a N". `updated_at` sigue sirviendo solo para desempatar last-write-wins
(ADR-012). Además, una terminal no se identifica solo con su `origin_id` (es texto que
cualquiera puede configurar): se **empareja** con el hub y recibe una credencial propia,
revocable (ver 3.6).

### 3.13 Prompts de fase heredados (P4.1 / P4.2)

`docs/System-Prompts-desarrollo-ferreteria.md` (≈líneas 480–512) tiene los prompts de R4
redactados antes de este análisis. **No ejecutarlos tal cual:**
- P4.1 baja cambios "desde `updated_at`" (ver 3.12) y autentica terminales "por
  origin_id" (ver 3.6);
- P4.2 no contempla los saldos como proyección (3.2), la numeración por terminal (3.4) ni
  la baranda B2 (3.1);
- ninguno contempla el modo elegible al instalar ni el hub en red local.

Se reescriben al cerrar F0, a partir de los ADRs nuevos.

### 3.14 Acceso remoto (PRD, fila R4)

El PRD incluye en R4 el **acceso remoto**: consultar el sistema desde fuera del local. Este
análisis no lo cubre. Si significa consultar desde un navegador o el celular, es otra capa:
la spec multi-rubro (B4) la ubica como **frontend web + API sobre el Postgres de la nube**,
sin reutilizar el shell de Electron. Choca con §10 del CLAUDE.md ("aplicación o captura
móvil" fuera de alcance) si incluye el celular. Necesita definición del PO (ver §7) y, si
entra, va después de F4, porque depende de que exista el hub en la nube.

---

## 4. Elección del modo al instalar

- **Primer arranque:** asistente "¿Esta es la única PC del negocio o hay varias?".
  - *Única* → standalone (comportamiento actual, sin sync).
  - *Varias / Nube* → pide URL del hub + código de emparejamiento; el hub asigna `origin_id`
    (hoy se elige a mano en `config.json`, y dos terminales con el mismo código romperían
    todo).
- **Pasar de standalone a distribuido** (el caso más común: un cliente crece):
  la primera terminal **sube su base** al hub como semilla; las siguientes se emparejan y
  bajan un snapshot. Necesita un comando explícito y una verificación de integridad.
- **Volver de distribuido a standalone:** desemparejar y quedarse con la copia local. Es
  posible pero con pérdida de lo no sincronizado; debe pedir confirmación del Supervisor.
- En la UI: indicador de estado de sync (pendientes, último contacto con el hub, conflictos
  sin revisar) y pantalla de **log de conflictos** para el Supervisor (ADR-012).

---

## 5. Plan por fases sugerido

Cada fase queda desplegable y sin romper el modo standalone (ADR-042: detrás de flag).

| Fase | Contenido | Toca la red | Versión |
|---|---|:-:|---|
| **F0 · Decisiones** | ADRs nuevos: política de stock/crédito offline (3.3), numeración por documento (3.4), saldos como proyección (3.2), dónde corre el hub, qué base usa y cómo se verifica B3 (3.10), protocolo con cursor del hub (3.12), schedulers (3.7). Reescribir P4.1/P4.2 (3.13). ADR-013 sigue abierto | no | — |
| **F1 · Preparación local** | triggers + `sync_outbox` generados desde el registro B2, con el test B2 extendido; baranda de paridad B3; `recalcularSaldo` + test de integridad; numeración por terminal en remito/presupuesto/producción, rangos de SKU; separar config global/local; `modo` en `config.json` (siempre `standalone`) | no | 1.x |
| **F2 · Hub en red local** | servicio Node (`packages/sync-server` o `apps/hub`), protocolo push/pull con cursor, emparejamiento, bootstrap desde una terminal existente, schedulers en el hub; instalable como servicio Windows | LAN | 2.0.0-beta |
| **F3 · Operación** | indicador de sync, log de conflictos, restore desde hub, convivencia de versiones | LAN | 2.0.0 |
| **F4 · SaaS** | multi-tenant, Postgres, alta de negocios, TLS público, monitoreo, costos de infraestructura | Internet | 2.x |

F1 es la que más rinde: no necesita servidor, ordena deuda que hoy existe (contadores
globales, `version` a mano) y deja todo listo para enchufar el hub.

---

## 6. Riesgos principales

1. **Vender stock que no existe** entre terminales offline (3.3): es la decisión de negocio
   más sensible y cambia una regla hoy "sin excepción".
2. **Saldos corruptos** si se sincronizan como filas en vez de proyectarse (3.2).
3. **Dos terminales con el mismo `origin_id`**: hoy es posible por configuración manual.
4. **Restore de una terminal** que resucita datos (3.8).
5. **Esfuerzo del SaaS** subestimado: multi-tenant, seguridad pública, operación 24/7 y
   soporte son un producto aparte del sync.

## 7. Preguntas abiertas para el PO

> **Respondidas el 2026-11-16** (ver ADR-153 a 156):
> 1. Stock entre terminales sin conexión: **permitir y alertar** (ADR-153).
> 2. Caja: **configurable por negocio**, por terminal o compartida (ADR-155).
> 3. Sucursales: **no por ahora**, quedan para R5 (ADR-156).
> 4. Hub de red local: **ambas modalidades**, en una PC del cliente o en un equipo entregado (ADR-156).
> 5. Acceso remoto: **la app de escritorio desde otra PC** fuera del local, vía el hub en la nube (ADR-156).
> Además: crédito con el mismo criterio que stock (ADR-153).

- ¿Se tolera stock negativo transitorio entre terminales (con alerta), o una venta sin hub
  debe limitarse?
- ¿Las terminales de un mismo local comparten caja o cada una tiene la suya (hoy: una por
  usuario/turno)?
- ¿Varias sucursales entran en este alcance? (§10 deja fuera el multi-sucursal *operativo*;
  el hub en la nube lo acerca).
- ¿El hub de red local lo instala el cliente en una de sus PCs o se entrega un equipo?
- ¿Qué significa el "acceso remoto" del PRD para R4: consultar reportes desde un navegador
  fuera del local, o algo más? ¿Incluye el celular? (3.14)
