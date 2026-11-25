# Plan: Fase online F3 — operación con varias cajas

**Fecha:** 2026-11-23 · **Fuente:** ADR-150, ADR-151, ADR-155, ADR-158 §4 (`docs/ADR-Log-ferreteria.md`), análisis `docs/Revisiones/2026-11-16-analisis-fase-online.md` §3.8, §3.9, §4 y §5, pendientes anotados al cerrar F2 · **Versión destino:** 2.0.0 · **Complejidad:** Grande (7 PRs)

## Resumen

F3 hace que un local con varias cajas y un hub se pueda **operar sin un técnico al lado**: el Supervisor ve y resuelve los conflictos, cada caja muestra siempre en qué estado está su sincronización, el negocio puede trabajar con **una sola caja compartida** (ADR-155) y la base del hub tiene backup. El modo standalone no cambia: todo lo nuevo se activa solo en una terminal emparejada.

**Lo que ya existe desde F2 y no se rehace:** versiones de protocolo y de esquema en cada pedido, con el hub aceptando N y N-1 (ADR-150 §8, `versionesCompatibles`); el restore en modo distribuido es «Volver a bajar la base del hub» y el restore local está bloqueado (`RESTORE_LOCAL_NO_DISPONIBLE_EN_DISTRIBUIDO`); el log de conflictos en el hub (`hub_conflicto`, con `resuelto`), y las filas rechazadas quedan con `sync_state = 'conflict'` en la terminal de origen.

## Decisiones del usuario (2026-11-23)

1. **Los conflictos se revisan desde cualquier caja emparejada**, con un permiso nuevo `sync.conflictos` (de fábrica, solo el Supervisor). La caja se los pide al hub; el hub no tiene interfaz propia.
2. **Conflicto de unicidad: renombrar o descartar.** El Supervisor edita la fila rechazada y se vuelve a subir, o la da de baja. Fusionar dos filas en una (reasignar referencias) queda fuera de F3.
3. **Linux y macOS: checklist sin verificar.** F3 deja un checklist paso a paso para probar el hub como servicio en un equipo real; F3 cierra con los dos anotados como no verificados.

Se registran como **ADR-159** en el PR1.

## Patrones a imitar

| Categoría | Fuente | Patrón |
|---|---|---|
| Rutas del hub | `packages/core-hub/src/protocolo.ts` (`RUTAS`, tipos `Pedido*`/`Respuesta*`), `servidor.ts` (`atender`) | toda respuesta lleva `hora_hub_ms`; errores con `ErrorHttp(código, 'CODIGO')`; la terminal sale de la credencial |
| Exclusión entre terminales | `packages/core-hub/src/coordinacion.ts` (`pedirCoordinadora`, `hub_coordinadora`) | una fila en el hub decide quién tiene el permiso; la terminal lo pide con conexión |
| Registro de sync | `packages/core-db/src/__boundary__/registro-sync.ts` | `proyectadas` = columnas que no viajan; el pull no las pisa |
| Proyecciones | `apps/retail/src/main/sync/proyecciones.ts`, `packages/core-main/src/ctacte-proyeccion.ts` | `recalcular*` por entidad, llamado por el pull para lo que tocó |
| Alertas de la coordinadora | `apps/retail/src/main/sync/alertas.ts` (`despuesDelPull`) | una sola terminal avisa, con `dedupe_clave` por hecho |
| Canales IPC | `apps/<app>/src/main/ipc/politicas-canales.ts`, `POLITICAS_CANALES_CORE` (ADR-145) | todo canal nuevo declara su política |
| Permisos | `packages/core-main/src/auth/permisos-core.ts` | permiso universal en `PERMISOS_CORE`; actualizar los conteos de `seed.test.ts` y `auth.ipc.test.ts` |
| Pantalla de config | `packages/core-ui/src/views/config/ConfigSincronizacion.tsx` | sección `panel` con filas `etiqueta`/valor; errores con `traducirError` |
| Tests | `packages/core-hub/src/*.db.test.ts`, `packages/core-main/src/sync/*.db.test.ts`, `apps/*/src/main/sync/__tests__/` | hub real en memoria + terminales con las migraciones reales; runner de Electron |

## Orden y PRs

Cada PR: rama propia desde `main`, TDD (rojo → verde), suite completa en serie, `Estado.md` + ADR-Log + este plan al día. Van en orden.

### PR1 — Menos ruido y conflictos que se pueden consultar (ADR-150 §5, ADR-159) — hecho (2026-11-23)

> **Hallazgos del PR1 (bugs de F2, corregidos):** una alta rechazada por unicidad frenaba el push de la caja (el hub
> rechazaba entero el lote que la referenciaba) y el pull de la otra (choque `UNIQUE` al bajar). El hub (`hub_en_espera`)
> y la caja (`sync_recibido_en_espera`) apartan lo que no pueden aplicar y lo aplican solos cuando llega lo que falta.
> «Recuperar» quedó hecho en este PR (lógica de la caja); el PR2 es solo la pantalla.

- **`usuario.ultimo_acceso` deja de viajar.** Entrar con el mismo usuario en dos cajas hoy genera conflictos `lww` (hallazgo de F2 PR7). Nuevo tipo de columna en el registro, `locales` (no viaja y el pull no la pisa, sin recálculo), con su baranda en `verificarRegistroSync`. Se revisa si alguna otra columna de un maestro cambia sola al operar y produce el mismo ruido.
- **Hub:** rutas `GET /v1/conflictos` (paginado; filtros `pendientes`/`todos` y `tipo`) y `POST /v1/conflictos/resolver` (`id`, `resolucion`: `revisado` | `recuperado` | `descartado`, quién y cuándo). Migración del hub: `resuelto_por`, `resuelto_en`, `resolucion`. Un conflicto `unicidad` se marca resuelto solo cuando un cambio posterior de esa misma fila se aplica.
- **Hub:** `GET /v1/terminales`: nombre, `origin_id`, último contacto y versiones de cada terminal (lo usan el indicador y el cierre de caja compartida).
- **Terminal:** `sync.conflictos.listar/resolver` y `sync.terminales` en `@core/main` + `@core/preload`, con política `permiso:sync.conflictos`. Permiso nuevo en `PERMISOS_CORE`, no al Operador.
- **ADR-159** con las decisiones de arriba.
- **Tests:** dos terminales con el mismo usuario entran y no hay conflicto; listar y resolver en el hub; la unicidad se resuelve sola al aplicarse la corrección; política del canal.

### PR2 — Pantalla de conflictos (ADR-012, ADR-150 §5) — hecho (2026-11-24)

> **Desvío:** «Editar» no navega a la pantalla de la entidad (el núcleo no conoce las rutas de cada app); el detalle dice
> qué columna chocó y en qué caja corregirla. «Descartar» le da baja lógica y libera el valor único (`descartarAlta`).

- **Configuración → Sincronización → Conflictos** (ruta, NAV y crumb en las dos apps; el test `nav.test.tsx` de Elaborados lo cubre y Retail suma el suyo, como pide CLAUDE.md). Visible con `sync.conflictos`.
- Lista: tipo, tabla en lenguaje del negocio («Producto», «Cliente»…), qué fila, de qué caja vino y cuándo. Detalle: las dos versiones lado a lado, con las columnas que difieren resaltadas.
- **Acciones:**
  - `lww`: «Marcar como revisado» o «Recuperar esta versión». Recuperar escribe la versión perdida como un cambio nuevo desde esta caja, que vuelve a pasar por last-write-wins con la hora actual.
  - `unicidad`: «Editar» lleva a la pantalla de esa entidad en la caja de origen (si la fila no está en esta caja, explica en qué caja corregirla); «Descartar» la da de baja lógica.
  - `integridad`: solo «Marcar como revisado», con el texto del error (es un bug, no una decisión del negocio).
- Sin conexión con el hub, la pantalla lo dice y no muestra datos viejos.
- **Tests:** componente con el bridge simulado; resolver de punta a punta contra un hub en memoria (`recuperado` deja la versión perdida en las dos terminales).

### PR3 — Indicador de sync (análisis §4) — hecho (2026-11-24)

> **Desvío:** el indicador lo dibuja `AppShell` (la sincronización es universal) en vez de recibirlo por prop de cada
> shell; así no puede quedar sin conectar en una app. Suma el estado «N cambios en espera» (recibidos apartados en la caja).

- **Chip en la barra superior** del `AppShell`, solo en modo distribuido. `AppShell` sigue siendo por props: recibe un `indicadorSync` opcional que arma el núcleo (`@core/ui`), y cada shell de app lo pasa.
- **Estados, de más grave a menos:** versión incompatible con el hub («Actualizá esta caja»); sin conexión (desde cuándo); reloj desfasado; conflictos sin revisar (solo para quien tiene `sync.conflictos`); N cambios sin subir; al día. Un clic lleva a Configuración → Sincronización.
- La pantalla de Sincronización suma la lista de cajas del hub (`/v1/terminales`): último contacto y versión de cada una.
- Se actualiza con el estado que ya expone el cliente de sync (sin consultar al hub más seguido).
- **Tests:** un caso por estado y la prioridad entre ellos; en standalone el chip no aparece.

### PR4 — Caja compartida: configuración y turno único (ADR-155 §1, §3, §4 y §6) — hecho (2026-11-24)

> **Desvíos:** (1) el esperado **no** pasa a proyectado: §5 dice que la diferencia no se recalcula sola, y un esperado
> proyectado cambiaría con cada movimiento tardío; queda como foto del cierre, que ya suma todas las cajas. (2) El modo se
> elige en Configuración → Sincronización («Caja del negocio»), no en una pantalla aparte.

- **Configuración del modo de caja** (Configuración → Caja), con `usuario.administrar`: `por_terminal` / `compartida`. Solo en modo distribuido (§6), solo sin cajas abiertas en todo el negocio, y el cambio exige conexión con el hub. `caja_modo` ya vive en `configuracion_negocio` (F1 PR7).
- **Hub:** `POST /v1/caja/abrir` y `POST /v1/caja/cerrar`. Una fila en el hub guarda el turno compartido abierto (como `hub_coordinadora`): abrir falla con `CAJA_COMPARTIDA_YA_ABIERTA` si hay otra; cerrar libera solo el turno que corresponde.
- **Terminal:**
  - en `compartida`, la caja activa es el turno abierto del negocio, no el del usuario (`cajaGetActivaHandler`, `confirmarVenta`, ventas en espera);
  - abrir y cerrar llaman al hub antes de escribir (sin conexión: `CAJA_COMPARTIDA_SIN_CONEXION`);
  - vender, retirar y aportar siguen funcionando sin conexión contra el turno conocido.
- **El esperado pasa a proyectado** (§3): `caja.monto_esperado_centavos` se declara proyectada y el pull la recalcula desde `movimiento_caja` de todas las terminales. En `por_terminal` el resultado es el mismo de hoy, porque cada turno tiene un solo escritor.
- **Tests:** dos terminales, una abre y la otra ve el turno; la segunda no puede abrir otro; las dos venden contra el mismo turno y el esperado suma las dos; sin conexión se vende pero no se abre ni se cierra; `por_terminal` sin cambios.

### PR5 — Caja compartida: cierre y movimientos tardíos (ADR-155 §4 y §5) — hecho (2026-11-24)

> **Precisión:** un movimiento tardío se detecta comparando el esperado de hoy con la foto del cierre (además de la
> fecha): así se ve también el hecho sin conexión antes del cierre que llegó después. Elaborados no tiene avisos.

- **Al cerrar**, la pantalla avisa qué cajas no se comunican con el hub desde hace más de unos segundos (`/v1/terminales`): sus movimientos todavía no llegaron. Cerrar igual es decisión de quien cierra.
- **Movimientos que llegan después del cierre:** se aceptan y quedan en ese turno. Se detectan por comparación (movimiento con `fecha` posterior a `fecha_cierre`, o recibido después del cierre), sin columna nueva. La coordinadora avisa una sola vez por movimiento al Supervisor (`dedupe_clave`, como las alertas de stock). La diferencia del arqueo **no** se recalcula.
- **Arqueos:** el turno muestra «con movimientos posteriores al cierre» y su detalle los marca.
- **Tests:** un movimiento sin conexión que llega después del cierre queda en el turno, genera un solo aviso y no cambia la diferencia; el aviso de cajas sin contacto.

### PR6 — Backup del hub y convivencia de versiones (análisis §3.8 y §3.9) — hecho (2026-11-25)

> **Desvío:** en vez de un test con una terminal N-1 armada a mano (su código sería el de hoy), la convivencia queda
> garantizada por una baranda: toda migración desde la fase con hub es aditiva (`problemasDeConvivencia`), más el test
> del hub con una fila sin la columna nueva y el de la caja que ya ignoraba lo que no conoce.

- **Backup del hub:** copia periódica de su base con la API de backup de SQLite, en su carpeta de datos (`backups/`), con retención de N copias (parámetro con valor por defecto). Comandos del hub `backup` y `restaurar-backup <archivo>` (este último con el servicio detenido; deja una copia de la base actual antes de pisarla). En modo distribuido la pantalla de Backup de la caja lo explica: el backup completo está en el hub.
- **Convivencia de versiones:** test de contrato con un hub de la versión N y una terminal N-1 (migraciones reales de esta versión menos la última): sincronizan, y una terminal N+1 queda rechazada con el aviso y sigue vendiendo. Si aparece una migración no aditiva, se documenta como regla en ADR-042.
- **Tests:** backup y restauración del hub con datos; retención; convivencia N/N-1.

### PR7 — Prueba de punta a punta, checklist de Linux y macOS, y 2.0.0

- **Prueba de punta a punta en este equipo**, como en F2 PR7: Retail con dos cajas y un hub; conflicto `lww` resuelto con «Recuperar esta versión»; unicidad renombrada; indicador en cada estado (cortando el hub); caja compartida abierta en una caja, ventas en las dos, una sin conexión que vende y llega después del cierre con su aviso; backup y restauración del hub. Elaborados en versión corta (indicador y caja compartida).
- **Checklist de Linux y macOS** (`docs/hub-linux-macos-checklist.md`): instalar, arrancar con el equipo, emparejar una caja, desinstalar. Queda sin verificar.
- **Versión:** Retail pasa a `2.0.0` con su changelog. El tag y la publicación se deciden aparte, porque el número del fiscal ARCA sigue abierto.
- **Cierre de la fase online en la red local** en `Estado.md` y en el ADR-Log.

## Validación

```bash
pnpm -r --workspace-concurrency=1 --no-bail run test
```

```bash
cd packages/core-hub && pnpm build && pnpm exec vitest run
```

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Dos turnos compartidos abiertos si una caja abre sin conexión | Media | Abrir exige la respuesta del hub antes de escribir; la fila del hub es la única fuente; test con dos terminales que abren a la vez |
| El esperado proyectado cambia el cierre de `por_terminal` | Media | Test de regresión: mismos números que hoy sobre los casos de `caja.hook.db.test.ts` |
| «Recuperar esta versión» con una fila cuyo esquema cambió entre versiones | Baja | Solo se ofrece si las columnas de la versión perdida existen hoy; si no, solo «revisado» |
| `AppShell` es por props: el indicador puede quedar huérfano en una app | Media | Lo pasan los dos shells; un test de cada shell verifica que se renderiza en modo distribuido |
| Restaurar el backup del hub con el servicio corriendo | Media | El comando se niega si el puerto del hub responde; deja la base actual copiada |
| Conteos exactos de permisos en tests | Alta | Actualizar `seed.test.ts`, `auth.ipc.test.ts` y la tabla de CLAUDE.md §8 en el PR1 |
| Linux y macOS sin verificar | Alta | Checklist y anotado en el cierre |

## Aceptación

- [ ] PR1–PR7 mergeados, cada uno con la suite completa en verde y su cierre documental.
- [ ] Entrar con el mismo usuario en dos cajas no genera conflictos.
- [ ] El Supervisor ve y resuelve los conflictos desde cualquier caja; un Operador no los ve.
- [ ] Cada caja muestra su estado de sync sin entrar a Configuración.
- [ ] Con caja compartida hay un solo turno abierto en el negocio, todas las cajas venden contra él y el esperado suma todas.
- [ ] Un movimiento que llega después del cierre queda visible y avisa una sola vez.
- [ ] La base del hub tiene backup y se puede restaurar.
- [ ] Standalone sin cambios.
