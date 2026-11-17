# Plan: Fase online F1 — preparación local (sin red)

**Fecha:** 2026-11-16 · **Fuente:** ADR-149 a 156 (`docs/ADR-Log-ferreteria.md`), análisis `docs/Revisiones/2026-11-16-analisis-fase-online.md` §5 · **Versión destino:** 1.x (después de 1.2.0; el fiscal es 1.3.0) · **Complejidad:** Grande (9 PRs + una serie aparte para centavos)

## Resumen

F1 deja cada instalación lista para sincronizar **sin agregar red ni servidor**. Todo lo que entra corre en modo standalone sin cambiar lo que ve el usuario, salvo el formato de número de remitos y presupuestos nuevos (ADR-154). Cada PR es desplegable solo, con TDD y la suite completa en verde (`pnpm -r --workspace-concurrency=1 run test`, en serie: ver memoria del runner).

## Patrones a imitar

| Categoría | Fuente | Patrón |
|---|---|---|
| Barandas de esquema | `packages/core-db/src/__boundary__/sync-fields.ts` | función pura que recorre el esquema compuesto con `getTableConfig` y devuelve incumplimientos; cada app la llama desde un test (`apps/*/…/b2-sync-fields.test.ts`) |
| Barandas por tabla declarativa | `apps/*/src/main/ipc/politicas-canales.ts` + `permisos-canales.test.ts` (ADR-145) | tabla declarada por app sobre una base del núcleo; el arranque falla si falta una entrada; el test lo verifica |
| Migraciones | `apps/retail/src/main/db/migrations/0052_*.sql`, `apps/elaborados/…/0014_*.sql` | SQL escrito a mano por app (drizzle-kit generate de Retail está roto: memoria), mismo cambio en las dos apps cuando la tabla es del núcleo |
| Numeración por terminal | `packages/core-main/src/venta/confirmar-venta.ts:31`, `apps/retail/src/main/ipc/ordenes-compra.ts:23` | `PREFIJO-${terminal}-${correlativo.padStart(6,'0')}`, correlativo por terminal dentro de la transacción |
| Tareas en segundo plano | `packages/core-main/src/tareas.ts` (`programarTareaSegura`) | toda tarea pasa por el wrapper con nombre; errores al registro del sistema |
| Errores de dominio | handlers IPC | `throw new Error('CODIGO')` traducido en el renderer con `traducirError` |
| Tests con BD | `packages/core-main/src/testing/` (`setupCoreDb`), `apps/*/src/main/ipc/__tests__/helpers.ts` (`createTestDb`) | BD en memoria con migraciones reales; runner de Electron |

## Orden y PRs

Cada PR: rama propia desde `main`, TDD (rojo → verde), suite completa, `Estado.md` + ADR-Log al día (cierre documental obligatorio). PR1 y PR2 no dependen entre sí; el resto va en orden.

### PR1 — Registro de sync por app (ADR-150 §3, B2)
- **Qué:** en `@core/db`, un tipo `RegistroSync` = mapa `tabla → { tipo: 'maestro' | 'libro' | 'local', proyectadas?: string[] }` y `verificarRegistroSync(schema, registro)`: toda tabla del esquema está en el registro; las `maestro`/`libro` cumplen B2; las `local` reemplazan a la lista `EXCEPCIONES`; las `proyectadas` existen como columnas.
- Registro del núcleo (`REGISTRO_SYNC_CORE`) + uno por app, combinados como `politicas-canales`.
- Los dos `b2-sync-fields.test.ts` pasan a usar el registro.
- **Valida:** tests de `@core/db` y de B2 en las dos apps.
- **Riesgo:** bajo (solo declaración y test).

### PR2 — Baranda B3 con PGlite (ADR-149)
- **Qué:** generador `ddlPostgres(schema, registro)` en `@core/db` con el mapa de tipos del ADR; test que aplica el DDL de cada app en PGlite, más los índices únicos parciales de las migraciones.
- `@electric-sql/pglite` como devDependency de `@core/db` (justificada en ADR-149). Instalación sin `--filter` (memoria: linker hoisted).
- **Valida:** test nuevo de `@core/db`.
- **Riesgo:** medio — los índices parciales viven en SQL de migraciones; si no se pueden extraer de forma confiable, se declaran a mano en el registro.

### PR3 — Captura de cambios: `sync_outbox` + triggers (ADR-150 §4 y §6)
- **Qué:** tabla `sync_outbox` en el esquema del núcleo (local; migración en cada app). Generador de triggers `AFTER INSERT/UPDATE` desde el registro para `maestro`/`libro`, que excluye las columnas proyectadas y pone `sync_state='pending'`; si el handler no subió `version`, la sube.
- **Decisión de diseño:** los triggers **se instalan solo en modo distribuido** (PR8). En standalone nadie consume el outbox y crecería sin fin; el arranque de una terminal distribuida usa snapshot, no outbox (ADR-150 §10). En F1 se prueban en tests, inactivos en producción.
- Interruptor de "aplicando cambios recibidos" (tabla temporal) para no re-encolar lo que baja del hub.
- **Valida:** tests del generador y de un insert/update real en BD en memoria; test que exige trigger para toda tabla `maestro`/`libro`.
- **Riesgo:** medio — performance de escritura en importaciones masivas (medir con la importación de catálogo).

### PR4 — Sin borrados físicos en tablas que sincronizan (ADR-150 §7)
- **Qué:** las ~12 operaciones con `.delete(` (líneas de borradores de venta y presupuesto, `item_oc`, `producto_presentacion`, `sinonimo`, `rol_permiso`, importaciones de costos, líneas de remito, `receta_produccion_item`, líneas de venta de Elaborados). Decisión por caso: baja lógica, lápida (`deleted_at`) o clasificar la tabla como `local` si es un borrador que nunca sale de la terminal.
- **Baranda:** en los tests, un trigger `BEFORE DELETE … RAISE(ABORT)` en toda tabla `maestro`/`libro`: cualquier handler que borre rompe su propio test.
- **Valida:** suites de main de las dos apps.
- **Riesgo:** medio-alto — cada lectura de esas tablas tiene que filtrar lo dado de baja. Revisar uso por uso; es el PR con más superficie.
- **División (2026-11-17):** PR4a = baranda + `rol_permiso`, `sinonimo`, presentaciones e importaciones; PR4b = líneas de venta, presupuesto, remito y OC de Retail (lápida `deleted_at` + filtrar ~30 lecturas); PR4c = receta y líneas de pedido de Elaborados. La baranda entra en PR4a con una lista de excepciones por app que PR4b y PR4c vacían.

### PR5 — Numeración por terminal en remito y presupuesto; SKU por bloques (ADR-154)
- **Qué:** `RE-<terminal>-NNNNNN` y `PR-<terminal>-NNNNNN` con correlativo por terminal, como la OC. Se retiran `remito_proximo_secuencial` y `presupuesto_proximo_secuencial` (migración que no toca números emitidos). SKU: abstracción `reservarSku(tx)` sobre un bloque local; en standalone el bloque es todo el rango (comportamiento igual).
- **Valida:** tests de handlers de remito, presupuesto y producto; **verificación en la app real** (`pnpm dev` con `GESTION_USER_DATA_DIR`, memoria ADR-130): emitir un remito y un presupuesto y ver el número nuevo en pantalla y en el PDF.
- **Riesgo:** bajo-medio — búsquedas o reportes que parseen el formato viejo.

### PR6 — Saldos como proyección (ADR-151, ADR-155 §3)
- **Qué:** `recalcularSaldo` en el núcleo para cuenta corriente y en cada app para stock (`existencias` en Retail, `existencia_articulo` en Elaborados). El stock proyecta desde el último `ajuste_conteo`: su `stock_resultante` ya es la cantidad contada, así que **no hace falta columna nueva ni backfill** (simplifica la consecuencia (−) de ADR-151). Monto esperado de caja proyectado desde `movimiento_caja`.
- **Elaborados es distinto:** su ajuste con motivo `conteo` (`movimiento-articulo.ts`) recibe una **diferencia** que tipea el usuario, no la cantidad contada, y `stock_resultante` es stock local + diferencia. Para que el conteo sea un punto de corte real hay que pasar esa pantalla a "cantidad contada", como Retail. Se decide en este PR, con verificación en la app real si cambia la pantalla. Además, Elaborados ya admite stock negativo en artículos sin `bloquea_sin_stock`: la proyección tiene que tolerarlo.
- Test de integridad: para cada entidad, saldo guardado = proyección. Se corre además sobre una copia de una base real antes de mergear.
- Las columnas proyectadas quedan marcadas en el registro (PR1).
- Cierre documental: corrección en ADR-151 (Retail no necesita columna nueva; la pantalla de conteo de Elaborados cambia o no, según lo que se decida).
- **Valida:** tests nuevos; script de integridad sobre una copia de la base real.
- **Riesgo:** medio — si una base real tiene saldos que no cuadran con su libro, aparece acá (es un hallazgo, no un error del PR).

### PR7 — Configuración del negocio vs. de la terminal (análisis §3.5, ADR-155 §1)
- **Qué:** clasificar cada clave de `parametros_sistema` como `negocio` (sincroniza) o `terminal` (local). Opción a decidir en el PR con prueba: columna `ambito` + campos de sync en `parametros_sistema` con clave natural, o tabla nueva para lo del negocio. Agrega `caja_modo` (`por_terminal`, sin UI todavía: en standalone no se ofrece `compartida`).
- **Valida:** tests de `parametros`; baranda: toda clave sembrada declara su ámbito.
- **Riesgo:** medio — `parametros_sistema` es leída desde muchos lugares; no cambiar la API de lectura.

### PR8 — Tareas registradas y modo de la terminal (ADR-152, ADR-156)
- **Qué:** `programarTareaSegura` recibe `tipo: 'coordinada' | 'local'`; baranda de que toda tarea lo declare. En standalone la terminal es siempre coordinadora. `id` determinista (UUID v5) para eventos de agenda generados por rutina y para las filas de precio de un cambio programado. `config.json` de la terminal suma `modo` (siempre `standalone` en F1; `iniciarTerminal` lo valida).
- **Valida:** tests de agenda, scheduler de precios y `terminal.test.ts`.
- **Riesgo:** bajo.

### Serie aparte — Dinero en pesos `REAL` → centavos
- Tablas: `venta`, `venta_detalle`, `caja`, `movimiento_caja`, `comprobante`, `producto` (`precio_*`, `margen_ganancia`). Unos 43 archivos de Retail y `shared` usan esos campos.
- **No entra en estos 9 PRs:** necesita su propio diseño (estrategia de migración con convivencia, motor de precios en `shared`, tickets, exportaciones, reportes) y su ADR. Se planifica cuando PR1–PR8 estén mergeados, y debe cerrar antes de F2.

## Validación

```bash
pnpm -r --workspace-concurrency=1 run test
```

```bash
cd packages/core-db && pnpm exec vitest run
```

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Lecturas que no filtran filas dadas de baja tras PR4 | Media | Revisar cada consulta de las tablas tocadas; tests de listado por tabla |
| Saldos reales que no cuadran con su libro (PR6) | Media | Correr la integridad sobre una copia real antes de mergear; corregir datos con un ajuste, no con código |
| Triggers lentos en importaciones masivas (PR3) | Baja | Inactivos en standalone; medir en tests con la importación de catálogo |
| Índices parciales difíciles de llevar a Postgres (PR2) | Media | Declararlos en el registro si no se extraen de las migraciones |
| Cambio de formato visible en remito/presupuesto (PR5) | Baja | Verificación en la app real; números viejos intactos |
| Serie de centavos subestimada | Alta | Plan y ADR propios; no mezclar con PR1–PR8 |

## Aceptación

- [ ] PR1–PR8 mergeados, cada uno con su suite completa en verde y su cierre documental.
- [ ] Barandas nuevas activas: registro de sync, B3 en PGlite, triggers por tabla, sin borrados físicos, ámbito de parámetros, tipo de tarea.
- [ ] Modo standalone sin cambios visibles salvo el formato de número de remito y presupuesto (verificado en la app real).
- [ ] Plan y ADR de la serie de centavos escritos.
