# Plan: Fase online F2 — hub en la red local

**Fecha:** 2026-11-18 · **Fuente:** ADR-149 a 156 (`docs/ADR-Log-ferreteria.md`), análisis `docs/Revisiones/2026-11-16-analisis-fase-online.md` §4 y §5, pendientes anotados en F1 · **Versión destino:** 2.0.0-beta · **Complejidad:** Grande (7 PRs)

## Resumen

F2 agrega el **hub** y lo conecta con las terminales en la red del local: el protocolo push/pull con cursor (ADR-150), el emparejamiento, el arranque desde una terminal existente, la terminal coordinadora y los bloques de SKU. El modo **standalone no cambia**: todo lo nuevo se activa solo en una terminal emparejada (`modo: distribuido`). La caja sigue siendo por terminal; la caja compartida, el indicador de sync completo y la pantalla de conflictos quedan para F3.

## Decisiones del usuario (2026-11-18)

1. **El hub vive dentro de cada app.** Una librería genérica nueva, `@core/hub` (`packages/core-hub`, solo Node), más un punto de entrada en cada app (`apps/<app>/src/hub/`) que le pasa su esquema compuesto, sus migraciones y su registro de sync. Va en el mismo instalador y corre con el mismo `electron.exe` en modo Node (`ELECTRON_RUN_AS_NODE=1`, el mismo NMV de `better-sqlite3`). Hub y terminales salen de la misma versión.
2. **Multiplataforma:** el hub tiene que poder correr como servicio en **Windows, Linux y macOS**. El proceso del hub no depende del sistema operativo; lo que cambia es cómo se registra el servicio: `systemd` en Linux, `launchd` en macOS y un wrapper de servicio en Windows.
3. **HTTPS con certificado autofirmado** en la red local, como dice ADR-150 §1. El hub lo genera al instalarse y la terminal fija su huella al emparejarse. **Corrección del PR2 (decisión del usuario):** se genera con `node:crypto`, sin la dependencia `selfsigned`.
4. **La caja compartida (ADR-155 §3 a §5) pasa a F3.**

Estas decisiones se registran como **ADR-158** en el PR1.

## Patrones a imitar

| Categoría | Fuente | Patrón |
|---|---|---|
| Funciones genéricas sobre el esquema | `packages/core-db/src/__boundary__/triggers-sync.ts`, `ddl-postgres.ts` | reciben `(schema, registro)` y recorren las tablas con `getTableConfig`; el núcleo no conoce las tablas de ninguna app |
| Registro de sync | `packages/core-db/src/__boundary__/registro-sync.ts`, `apps/*/src/main/db/registro-sync.ts` | `maestro` / `libro` / `local` y columnas `proyectadas`: decide qué viaja y cómo se resuelve |
| Interruptor de captura | `sync_aplicando` + `aplicandoCambiosRecibidos` (`@core/db`) | lo que baja del hub se aplica sin volver a entrar al `sync_outbox` |
| Proyecciones | `apps/*/src/main/catalog/stock-proyeccion.ts`, `packages/core-main/src/ctacte-proyeccion.ts` | `recalcular*` por entidad: el pull las llama para lo que tocó |
| Tareas | `packages/core-main/src/tareas.ts` | `programarTareaSegura({ tipo: 'coordinada' \| 'local' })`; `esTerminalCoordinadora()` |
| Secretos | `packages/core-main/src/backup/clave-firma.ts`, `seguridad/smtp-secret.ts` | `safeStorage` del sistema operativo, fuera de la base y del backup |
| Canales IPC | `apps/<app>/src/main/ipc/politicas-canales.ts` (ADR-145) | todo canal nuevo declara su política; sin política, el arranque falla |
| Tests con BD | `apps/*/src/main/ipc/__tests__/helpers.ts` (`createTestDb`), `packages/core-main/src/testing/` | SQLite en memoria con las migraciones reales; runner de Electron |

## Orden y PRs

Cada PR: rama propia desde `main`, TDD (rojo → verde), suite completa en serie, `Estado.md` + ADR-Log al día. Van en orden: cada uno usa el anterior.

### PR1 — `@core/hub`: almacén y aplicación de cambios (ADR-149 §1 y §2, ADR-150 §4, §5 y §10) — hecho (2026-11-18)
- Paquete nuevo `packages/core-hub` (Node, sin Electron). El núcleo sigue sin depender de ninguna app: el esquema llega por parámetro.
- **Base del hub:** un archivo SQLite con las **mismas tablas de la app**, con sus migraciones (así los índices únicos del hub son los mismos de las terminales), más las tablas propias del hub con su migración aparte (`__drizzle_migrations_hub`):
  - `hub_cambio` (`seq` autoincremental = cursor, tabla, id, versión, `origin_id`, `updated_at`, fila);
  - `hub_conflicto` (tipo `lww` | `unicidad` | `integridad`, la fila que entró y la que había).
- Interfaz `AlmacenHub` (aplicar un lote, cambios desde un cursor, snapshot) e implementación SQLite. Postgres queda para F4 detrás de la misma interfaz.
- **Aplicación:**
  - `maestro`: gana el `updated_at` más reciente y, a igual hora, el `origin_id` menor; la versión que pierde va al log.
  - `libro`: se inserta si no existe; si existe con otro contenido es un error de integridad.
  - Choque con un índice único: rechazo a conflicto `unicidad`.
  - Idempotente por `(tabla, id, versión, origin_id)`.
  - Las columnas proyectadas no se guardan como dato.
  - El lote se aplica en una transacción, con las FK diferidas.
- Tests de contrato contra los esquemas reales de Retail y de Elaborados.
- Docs: ADR-158 (decisiones de arriba).

### PR2 — Servidor HTTPS del hub (ADR-150 §1, §2, §8 y §9) — hecho (2026-11-18)
- Servidor con `node:https`, sin framework. Endpoints versionados:
  - `POST /v1/emparejar`, `POST /v1/push`, `GET /v1/pull?desde=N`, `GET /v1/snapshot` y `GET /v1/estado`.
- **Certificado:** autofirmado, generado con `selfsigned` en el primer arranque y guardado en la carpeta de datos del hub. La huella SHA-256 se muestra para emparejar.
- **Emparejamiento:**
  - un comando del hub genera un código de un solo uso con vencimiento;
  - la terminal lo canjea y recibe su `origin_id`, asignado por el hub, y una credencial propia;
  - tabla `hub_terminal`: hash de la credencial, revocada, último contacto y versiones.
- **Seguridad:** cada pedido va autenticado con la credencial (`Authorization: Bearer`); una terminal revocada recibe 401.
- **Versiones y reloj:** cada pedido lleva la versión de protocolo y de esquema, y el hub acepta la suya y la anterior. Cada respuesta incluye la hora del hub.
- **Arranque por app:**
  - `apps/<app>/src/hub/index.ts` arma el hub con el esquema, las migraciones y el registro de la app;
  - `pnpm hub` lo levanta en desarrollo con el `electron.exe` en modo Node;
  - la carpeta de datos se aísla con una variable de entorno, como `GESTION_USER_DATA_DIR`.
- Tests: servidor en un puerto libre dentro del proceso; emparejar, autenticar, revocar y la compatibilidad de versiones.

### PR3 — Cliente de sync en la terminal (ADR-150 §4, §6 y §9; ADR-151 §2) — hecho (2026-11-19)
- `@core/main`, inyectado por la app.
- **Push:**
  - lotes del `sync_outbox` en orden local;
  - con la respuesta, marca `enviado_en` y pasa las filas a `synced`;
  - un rechazo por unicidad deja la fila en `conflict`.
- **Pull:**
  - pide páginas desde el cursor;
  - aplica cada página en una transacción dentro de `aplicandoCambiosRecibidos` y avanza el cursor, que se guarda en `parametros_sistema` (local);
  - las filas que bajan pisan por `id` (el hub ya resolvió).
- **Proyecciones incrementales:** después de aplicar una página, `recalcular*` de los productos, cuentas y artículos que tocaron los libros recibidos. Es un seam de la app, porque cada una tiene su libro de stock.
- **HTTPS:** fija la huella del certificado guardada al emparejar y rechaza cualquier otra.
- **Reloj:** guarda el desfasaje contra la hora del hub y avisa si pasa un umbral.
- **Frecuencia:**
  - push agrupado unos segundos después de cada transacción, y además periódico;
  - pull periódico, con intervalo parametrizable;
  - las dos son tareas `local`.
- **Sin conexión:** la terminal sigue operando y la cola crece.
- **Test de convergencia:** un hub en el proceso y dos terminales en memoria.
  - Venden y cargan stock las dos.
  - Al sincronizar, las dos y el hub tienen las mismas filas.
  - El stock proyectado es el mismo en las tres bases.
  - Una edición concurrente del mismo producto termina en un ganador y una entrada en el log.

### PR4 — Emparejar la terminal, arranque y modo distribuido (ADR-150 §2 y §10, ADR-156, análisis §4) — hecho (2026-11-19)
- **Emparejar:** la terminal recibe la URL del hub, el código y la confirmación de la huella. Guarda `origin_id` y `modo: distribuido` en `config.json`, y la credencial en `safeStorage`.
- **Activación:** `aplicarConfigTerminal` acepta `distribuido`; al arrancar en ese modo se instalan los triggers de sync y empieza el cliente.
- **Arranque:**
  - la **primera** terminal sube su base al hub como semilla (de standalone a distribuido), después de pasar la integridad de saldos;
  - las **siguientes** bajan el snapshot y el cursor **antes** de correr `runSeed`. Esto resuelve el hallazgo de F1: el seed crea filas con UUID aleatorio y duplicaría roles, permisos, impuestos y Consumidor Final.
- **Restaurar en modo distribuido** = volver a bajar el snapshot. El restore local y «quitar catálogo demo» se ocultan en ese modo.
- **Desemparejar** pide el permiso de administración y avisa si quedan cambios sin subir.
- **UI mínima:** Configuración → «Sincronización» (estado, último contacto, pendientes, emparejar y desemparejar), con ruta, NAV y crumb en las dos apps, y política IPC para cada canal nuevo.

### PR5 — Coordinadora, bloques de SKU y alertas (ADR-152 §2, ADR-154 §2, ADR-153 §4) — hecho (2026-11-19)
- **Coordinadora:**
  - el hub otorga un permiso con vencimiento de pocos minutos (`hub_permiso_coordinadora`);
  - la terminal lo renueva mientras está conectada y, si se desconecta, lo toma otra al vencer;
  - `esTerminalCoordinadora()` pasa a leerlo en modo distribuido.
- **Bloques de SKU:**
  - el hub asigna rangos (`hub_bloque_sku`) y la terminal pide uno nuevo cuando le queda poco;
  - `sku_bloque_hasta` ya existe en la terminal (F1) y `SKU_SIN_BLOQUE` ya corta el alta.
- **Alertas:** una tarea coordinada detecta stock negativo y clientes sobre el límite después del pull, y genera un aviso deduplicado por producto o cliente. Los destinatarios van por permiso (ADR-146).
- **Stock negativo visible:** el POS no vende un producto con stock negativo (ADR-153 §5).

### PR6 — El hub como servicio en Windows, Linux y macOS (ADR-156 §1, decisión 2) — hecho (2026-11-23)
- Comando del hub `instalar-servicio` / `desinstalar-servicio`, que genera la definición del sistema operativo desde una plantilla:
  - **Linux:** unidad de `systemd`;
  - **macOS:** `LaunchDaemon` de `launchd`;
  - **Windows:** un wrapper de servicio. La propuesta es WinSW, un `.exe` con licencia MIT, que **hay que descargar con permiso del usuario**; la alternativa sin descarga es una tarea programada.
- **Empaquetado:** `forge.config.ts` de las dos apps suma makers para Linux y macOS (hoy solo hay `MakerZIP` para `win32`).
- **Instalador:** ofrece «esta PC también es el servidor» (ADR-156 §1).
- **Verificación:** en Windows, en este equipo. En Linux y macOS **no se puede verificar acá**: queda escrito qué probar en un equipo real.

### PR7 — Prueba de punta a punta y 2.0.0-beta
- Un hub y dos instancias de Retail en este equipo, con carpetas de datos aisladas:
  - emparejar las dos;
  - vender en una y ver el stock en la otra;
  - cortar el hub, vender en las dos y reconectar: el stock converge, y si quedó negativo, hay alerta;
  - editar el mismo producto en las dos y ver el log de conflictos;
  - alta de producto con bloque de SKU.
- Lo mismo, más corto, en Elaborados.
- Entrada de `2.0.0-beta` en `changelog.ts` y mapa de versiones al día.

## Validación

```bash
pnpm -r --workspace-concurrency=1 run test
```

```bash
cd packages/core-hub && pnpm exec vitest run
```

```bash
pnpm integridad:saldos <copia de la base>
```

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Orden de aplicación entre tablas con FK en un lote (PR1) | Alta | FK diferidas dentro de la transacción del lote; el test de convergencia mezcla altas y movimientos |
| Unicidades sembradas distinto en cada terminal | Alta | Las terminales nuevas bajan el snapshot antes del seed (PR4); test con dos seeds |
| Desfasaje de reloj que desordena el libro de stock (ADR-151) | Media | Medir el desfasaje contra el hub y avisar (PR3); el test de convergencia usa relojes corridos |
| `electron.exe` en modo Node en un Linux sin entorno gráfico: Electron enlaza bibliotecas de GTK aunque no abra ventanas | Media | Probarlo en PR6; si falla, el hub corre también con el Node del sistema y `better-sqlite3` compilado para ese Node |
| Empaquetado de Linux y macOS no verificable en este equipo | Alta | Dejarlo explícito en cada PR y en el cierre; checklist para probar en un equipo real |
| Descarga de WinSW | Baja | Pedir permiso al llegar al PR6; alternativa sin descarga: tarea programada |
| La credencial de la terminal en `safeStorage` no está disponible en algún Linux sin llavero | Media | Mismo tratamiento que la contraseña SMTP; error claro y sin guardar en texto plano |

## Aceptación

- [ ] PR1–PR7 mergeados, cada uno con la suite completa en verde y su cierre documental.
- [ ] Dos terminales y un hub convergen en las mismas filas y en los mismos saldos proyectados, también después de un corte.
- [ ] Una terminal no se puede hacer pasar por otra: credencial propia, revocable, con huella fijada.
- [ ] Standalone sin cambios: misma suite y misma app sin emparejar.
- [ ] El hub se registra como servicio en Windows (verificado acá) y tiene la definición para Linux y macOS (sin verificar acá, anotado).
