# Bloque de remediación — Superpowers · AUD-20260723

> Anexo del informe [`AUDIT-20260723.md`](AUDIT-20260723.md). **Paste-ready**: cada lote se puede pegar
> como prompt de arranque en una sesión de Superpowers, independientemente de los demás.
>
> **Reglas de la corrida (aplican a todos los lotes):**
> - Disciplina `CLAUDE.md` §12: brainstorm → plan escrito → TDD (RED-GREEN-REFACTOR) → verificación.
> - Los lotes con **🛑 GATE** se detienen y esperan confirmación humana explícita **antes** de ejecutar
>   el paso marcado. No se auto-aprueban. Un gate abierto sin respuesta = lote bloqueado, no lote saltado.
> - Ningún lote toca `release/1.0.x` salvo el Lote 2, y ahí solo la línea de versión.
> - Verificación de cierre de **todo** lote: `pnpm -r exec tsc --noEmit` + `pnpm test` (raíz).
>   La suite verde sin tipos verdes no cuenta como cierre (es el hallazgo AUD-001).

## Orden sugerido

| Lote | Contenido | Hallazgos | Gates | Riesgo |
|------|-----------|-----------|-------|--------|
| **0** | Corrección documental | 003, 004, 006, 010, 014, 015, 016 | — | Nulo (no toca código ejecutable) |
| **1** | Typecheck en verde | 001, 007, 011 | 🛑 dependencia | Bajo |
| **2** | Alineación de versión | 002 | 🛑 rama estable + distribución | Medio |
| **3** | Limpieza de muerto y tokens | 008, 009 | — | Bajo |
| **4** | Impresión: helper único + márgenes | 005, 013 | 🛑 phase-gate | Medio |
| **5** | Corte de `lista_precio_detalle` | 012 | 🛑🛑 esquema + ADR | Alto |

El Lote 0 es prerrequisito conceptual de todos los demás: mientras el índice del ADR-Log mienta sobre
ADR-038 y `CLAUDE.md` describa columnas inexistentes, cualquier plan que se escriba contra esos
documentos arranca torcido.

---

## LOTE 0 — Corrección documental

**No toca código ejecutable.** Solo `docs/**` y un comentario.

```
Contexto: auditoría AUD-20260723 (docs/Auditoria/AUDIT-20260723.md), hallazgos 003, 004, 006, 010,
014, 015, 016. Trabajo documental exclusivamente. NO modificar código ejecutable en este lote.

Rama: main (o feature branch desde main). Nada de esto va a release/1.0.x.

TAREAS

1. [AUD-003] docs/ADR-Log-ferreteria.md línea 56 — el índice marca ADR-038 como "Cancelada".
   El cuerpo (:1124-1126) dice "Aceptada" y tiene sección "Implementación (2026-07-14)" (:1180-1193),
   y el código existe: main/ipc/dashboard-caja-rango.ts, dashboard-clientes.ts,
   dashboard-proveedores.ts, migración 0020_adr038_dashboard_fase2.sql, vistas
   renderer/views/dashboard/{caja,proveedores}/.
   → Corregir la fila del índice a "Aceptada — implementada".
   → Revisar de paso la fila 037: el cuerpo la titula "Arquitectura de Dashboard y Reportes; fase 1
     (Ventas y Productos)".

2. [AUD-003 bis] docs/Auditoria/AUDITOR-TECNICO-v1.1.md §4 lista en la allowlist:
   "ADR-038 (Cancelada) — Dashboard fase 2 (Caja/Clientes/Proveedores): no exigir esas vistas."
   → ELIMINAR esa entrada. Es falsa y hace que el auditor suprima hallazgos sobre un módulo en
     producción. Anotar el cambio en la "Bitácora del protocolo" al final de ese archivo.

3. [AUD-006] Erratas de numeración de ADR. Corregir cada cita:
   - ADR-Log:1088, 1128, 1133 — dicen "ADR-036" hablando de los tabs del dashboard → ADR-037.
   - ADR-Log:1086, 1206, 1214 — atribuyen `comprobante_fiscal` a ADR-034 (que es Motor de Precios).
     Lo fiscal es R2 / ADR-013 (Propuesto). Reformular sin inventar un ADR que no existe.
   - ADR-Log:1831 (ADR-047 §13) — "extensión de ADR-030" para el sidebar → ADR-028.
   - ADR-Log:1900 (ADR-048 §6) — "(ADR-029 no lo incluía)" → ADR-027. (La nota de implementación
     del propio ADR-048 ya aclara que la columna `usuario.email` existía desde la migración 0001.)
   - ADR-Log:743, 750 (ADR-025 §4/§5) y :1734 (ADR-046) — "capa de impresión de etiqueta (ADR-027)"
     → ADR-026. ADR-027 es autenticación; nada de impresión vive ahí.
   - packages/client/src/main/ipc/print.ts:14 — comentario "ADR-025 + ADR-027" → "ADR-025 + ADR-026".
     (Único cambio de archivo .ts del lote: es un comentario, no lógica.)
   Los ADR aceptados son inmutables en su DECISIÓN; una errata de numeración es fe de erratas.
   Dejar constancia del conjunto de correcciones en la bitácora del ADR-Log.

4. [AUD-010] ADR-040 fijó `factor_a_stock` como INTEGER en milésimas (default 1000) con descuento
   de stock = cantidad × factor / 1000, y dejó la escala marcada "a confirmar contra cómo se
   persiste la cantidad de stock". La implementación real usa REAL con default 1.0 y multiplica
   sin dividir (db/schema/catalog.ts:165, db/schema/ventas.ts:93, ipc/venta.ts:102,275,384).
   Es coherente consigo misma y con existencias.stock_fisico, que es REAL.
   → NO cambiar el código. Agregar a ADR-040 una sección "### Correcciones de implementación",
     siguiendo el patrón exacto que ya usa ADR-045 (:1615), que fije REAL como escala definitiva
     y explique por qué (stock_fisico es REAL; la escala en milésimas era una precaución para un
     stock entero que no es el caso).

5. [AUD-014] ADR-Log:13 declara los estados posibles: "Propuesto · Aceptado · Rechazado ·
   Superseded · Deprecado". En uso hay además: Aceptada, Cerrado, Diferida, Cancelada,
   Implementado, "Aceptado — implementado", "Aceptada — Lote 1 implementado".
   → Ampliar la enumeración de §0 a los estados realmente en uso y unificar el género
     (elegir "Aceptado" o "Aceptada" y aplicarlo parejo en el índice).

6. [AUD-015] ADR-Log:975 — ADR-035 está como "### ADR-035", anidado dentro del bloque de ADR-034.
   → Promover a "## ADR-035" (nivel de todos los demás).

7. [AUD-016] docs/Sistema-Diseno-ferreteria.md termina en §12 (:325) sin bitácora de cambios,
   que A2 exige poblada si hubo cambios. Y §2 no documenta seis tokens que global.css sí define:
   --pad, --radius, --rowpad, --shadow, --warn, --ui-font.
   → Agregar sección "## Bitácora" y documentar esos seis tokens estructurales en §4
     (Espaciado, radios, sombras) o §2 según corresponda a cada uno.

8. [AUD-004] docs/../CLAUDE.md contradice el esquema real. Regenerar contra la fuente:
   - §4: eliminar `codigo_qr` (ADR-025 lo borró; la columna no existe).
   - §7 Usuario: reemplazar `pin_rapido` (hasheado) por `hash_password` (ADR-027).
   - §7 Venta: estado incluye `en_espera` y `descartada` (ADR-033, ventas.ts:62); documentar
     `venta_pago` (N filas por venta), `vuelto_centavos`, `alias`, `en_espera_desde`,
     `turno_creacion_id`, `presupuesto_id`. Aclarar que `forma_pago` es legado derivado.
   - §7 VentaDetalle: sumar `presentacion_id` y `factor_a_stock_aplicado` (ADR-040).
   - §7 CuentaCorriente: los campos reales son `saldo_centavos` y `limite_credito_centavos`.
   - §7: faltan 13 tablas. Agregarlas leyendo db/schema/*.ts:
     venta_pago, producto_presentacion, unidad, producto_proveedor, lista_precio_valor,
     remito, remito_linea, presupuesto, presupuesto_detalle, rutina, agenda_evento, aviso,
     transportista.
   - §8: la lista de permisos post-R1 no incluye `transportista.gestionar` (ADR-045 it.2) ni
     `presupuesto.crear/emitir/anular` (ADR-046). Fuente de verdad: PERMISOS y OPERADOR_PERMISOS
     en main/auth/seed.ts:9-53. Son 28 permisos, 17 al Operador.
   REGLA: la fuente es el esquema Drizzle + seed.ts, NO la memoria ni el texto anterior. Abrir
   cada archivo de schema antes de escribir la sección correspondiente.

VERIFICACIÓN
- `rg -n "codigo_qr|pin_rapido" CLAUDE.md` → sin resultados (salvo mención histórica explícita).
- Contar tablas de CLAUDE.md §7 contra `rg -c "sqliteTable" packages/client/src/main/db/schema/*.ts`.
- Contar permisos de CLAUDE.md §8 contra PERMISOS en seed.ts → 28.
- `pnpm -r exec tsc --noEmit` (solo por el comentario de print.ts; debe quedar igual que antes).

DONE cuando: los 8 puntos están aplicados y CLAUDE.md §7/§8 se corresponden 1:1 con el esquema y
el seed reales.
```

---

## LOTE 1 — Typecheck en verde

```
Contexto: auditoría AUD-20260723, hallazgos 001, 007, 011. Objetivo: `pnpm -r exec tsc --noEmit`
sale con exit 0. Hoy salen 27 errores en packages/client.

Rama: main (o feature branch desde main).

🛑 GATE 1 — INSTALACIÓN DE DEPENDENCIA. Detenerse acá y pedir confirmación humana ANTES de
ejecutar. Lo que se pide aprobar:
    pnpm --filter ferreteria-client add -D @types/nodemailer
  Justificación (AUD-011): `nodemailer` entró en ADR-048 sin sus tipos. `createTransport` y su
  objeto `auth` quedan como `any` implícito justo en el camino que maneja la credencial SMTP
  leída de safeStorage (main/agenda/canales/email.ts:1, main/ipc/smtp.ts:3). Es un paquete de
  tipos, solo devDependency, sin runtime. NO instalar nada más en este lote.
  Si el gate se rechaza: la alternativa es declarar el módulo a mano en src/types/*.d.ts —
  proponerla y esperar decisión, no elegirla por cuenta propia.

TAREAS (después del gate)

A. Errores en código de producción (5 archivos):

  1. main/ipc/etiquetas.ts:249 — TS2353 `marginsType`.
     → NO tocar en este lote. Es el hallazgo AUD-005 y se corrige en el Lote 4, que incluye
       verificación de impresión física. Acá basta con NO empeorarlo. Si el lote 4 va después,
       dejarlo como único error conocido y anotarlo, o coordinar el orden.

  2. main/ipc/exportar.ts:52-53 — TS2352: cast de VentaDetalleExportRow[] / ReporteVentasRow[]
     a Record<string, unknown>[] que TS marca como probablemente incorrecto.
     → Investigar la firma que consume esos arrays. Preferir ajustar el tipo del consumidor a
       un genérico correcto antes que encadenar `as unknown as`. Si no hay forma limpia,
       `as unknown as` con comentario que explique por qué es seguro.

  3. main/scheduler/precios.ts:37 — TS2375 con exactOptionalPropertyTypes: se pasan
     `base_lista_id`, `alcance_id`, `excluir_manuales_dias` como `X | undefined` a un tipo que
     los declara opcionales sin `| undefined`.
     → Construir el objeto omitiendo las claves ausentes (patrón `...(x ? { k: x } : {})`, que
       ya se usa en ipc/backup.ts:41 y backup/restore-engine.ts:160), no agregando `| undefined`
       al tipo destino.

  4. renderer/views/pos/PosItemsTable.tsx:78 — TS18048: `line.presentaciones` posiblemente
     undefined. ESTE ES EL ÚNICO QUE PUEDE ROMPER EN RUNTIME: es el selector de presentación
     del POS (ADR-040). Mirar usePosSession.ts para ver cuándo `presentaciones` queda sin
     poblar y decidir si es guard (`?.`) o si la línea nunca debería llegar sin presentaciones.
     → TDD: escribir primero el test de renderer que monta PosItemsTable con una línea sin
       `presentaciones` y falla, después el fix.

  5. renderer: DashboardView.tsx:94, AppShell.tsx:191/210/249, PresupuestosView.tsx:61,
     ReporteVentasView.tsx:304 — mismo patrón exactOptionalPropertyTypes + un TS2353
     (`incluir_inactivos` no existe en el tipo del filtro de presupuesto) + un TS2322
     (`to: string | undefined` en AppShell:191).
     → AppShell:191 revisar de verdad: un `to` undefined es un link roto en el sidebar, que es
       exactamente la clase de bug que CLAUDE.md §Navegación advierte.
     → PresupuestosView:61: decidir si `incluir_inactivos` debe existir en el filtro del handler
       (y agregarlo con su test) o si la vista lo manda de más.

B. [AUD-007] Errores en archivos de test — son contratos obsoletos, no ruido:

  6. renderer/views/pos/__tests__/PosClienteSelector.test.tsx:36,49,62,87,120,139,163 —
     los 7 casos pasan la prop `clienteId`, que NO existe en Props del componente. React la
     ignora, el test pasa, y lo que se está verificando no es lo que el componente expone.
     → Leer PosClienteSelector.tsx, entender la firma real, y REESCRIBIR los 7 casos para que
       prueben el comportamiento actual. No borrarlos ni silenciarlos: entender qué querían
       asertar y reexpresarlo.
  7. renderer/views/pos/__tests__/PosBottomBar.test.tsx:14 — falta `cantidadEnEspera` (ADR-033).
  8. renderer/views/caja/__tests__/CajaDashboard.test.tsx:52 — fixture sin `observaciones`.
  9. renderer/views/caja/__tests__/AperturaForm.test.tsx:53 — `.value` sobre HTMLElement;
     castear a HTMLInputElement.
 10. main/ipc/__tests__/presentacion.handlers.test.ts:275,336 — pasan `usuario_id` a
     cajaAbrirHandler, que ya no lo acepta (lo toma de la sesión).
 11. main/ipc/__tests__/venta-espera.handlers.test.ts:53 — payload incompatible con PausarPayload.
 12. renderer/__tests__/etiquetas-layout.test.ts:5 — fixture sin `gtin_barcode`.

C. Gate permanente contra la regresión:
  → Agregar el typecheck al script `test` de la raíz y de packages/client, de modo que
    `pnpm test` no pueda dar verde con tipos rotos. Esto es lo que convierte AUD-001 en
    "no vuelve a pasar" en lugar de "se arregló una vez".

VERIFICACIÓN
- `pnpm -r exec tsc --noEmit` → exit 0 (o exit 0 salvo etiquetas.ts:249 si el Lote 4 va después;
  decirlo explícitamente en el reporte de cierre, no dejarlo implícito).
- `pnpm test` desde la raíz → 872 node + 418 renderer verdes como mínimo. Si el punto 6 cambia
  el conteo de tests, reportar el número nuevo y por qué.

DONE cuando: tipos en verde, suite en verde, y `pnpm test` falla si alguien rompe los tipos.
```

---

## LOTE 2 — Alineación de versión

```
Contexto: auditoría AUD-20260723, hallazgo 002 (Alto). packages/client/package.json:3 dice
"0.1.0" en el tag v1.0.0, en release/1.0.x y en main. Consecuencias verificadas:
  (a) el instalable sale "Ferretería-Setup-0.1.0.exe" (electron-builder.yml:19 usa ${version});
  (b) el manifest.json del .fbk graba app_version: "0.1.0"
      (backup/engine.ts:77 ← startup.ts:36 ← app.getVersion()), rompiendo la trazabilidad
      backup↔release de ADR-021 §2 y la comparación de ADR-022;
  (c) electron-updater compara 0.1.0 contra el release v1.0.0 de GitHub (ADR-043 §5): toda
      instalación queda permanentemente en "hay actualización disponible".

🛑 GATE 1 — DIAGNÓSTICO ANTES DE TOCAR NADA. Detenerse y reportar, sin escribir:
   1. ¿Se distribuyó efectivamente algún .exe desde el tag v1.0.0 o desde release/1.0.x?
      (mirar docs/RUNBOOK-release-e-instalacion.md, GitHub Releases si hay remoto, y
      docs/README-BUILD.md). De esto depende si el salto 0.1.0 → 1.0.1 es transparente o si
      hay instalaciones en campo que van a ver un cambio de versión raro.
   2. ¿Hay backups .fbk existentes con app_version "0.1.0"? El restore compara
      last_migration_hash, no app_version (restore-engine.ts), así que en principio no rompe
      restores — CONFIRMARLO leyendo el código antes de afirmarlo.
   3. Los tres package.json del monorepo (raíz, packages/client, packages/shared) están en
      0.1.0. Definir cuáles se bumpean: el que manda para el instalable y app.getVersion() es
      packages/client. Proponer criterio, no asumirlo.
   Esperar decisión humana sobre el número exacto antes de seguir.

🛑 GATE 2 — ESCRITURA EN LA RAMA ESTABLE. release/1.0.x recibe SOLO hotfixes (ADR-042 §2 y §7).
   Un bump de versión que corrige el nombre del instalable y el feed de updates califica como
   hotfix, pero la decisión es humana. Pedir confirmación explícita antes de commitear ahí.
   Recordar la regla de flujo de ADR-042 §4: los fixes van release/1.0.x → main por cherry-pick
   unidireccional, NUNCA main → release/1.0.x.

TAREAS (después de ambos gates)

1. En release/1.0.x: fijar la versión de la línea estable (1.0.0 o 1.0.1 según lo decidido en
   el Gate 1) en packages/client/package.json, y en raíz/shared según el criterio acordado.
2. Cherry-pick a main.
3. En main: fijar la versión de la línea de desarrollo. Por ADR-044 el próximo corte es 1.1.0
   (Remitos + Presupuestos + Agenda Lote 1), así que corresponde 1.1.0 o 1.1.0-dev. La elección
   entre las dos formas tiene consecuencias en electron-updater — plantearla, no resolverla sola.
4. Actualizar docs/RUNBOOK-release-e-instalacion.md: agregar al checklist de release el paso
   "verificar que package.json coincide con el tag que se va a crear". Es el control que faltaba.
5. Si en el Gate 1 se determinó que hubo distribución previa con 0.1.0, documentar el salto en
   el RUNBOOK para que la próxima persona entienda el hueco en el historial.

NO HACER en este lote: crear tags, publicar releases, correr `pnpm make` ni `pnpm build`.
Este lote deja el número correcto en el repo; el corte de release es una operación aparte,
con su propia decisión humana.

VERIFICACIÓN
- `git show release/1.0.x:packages/client/package.json | rg '"version"'` → versión estable.
- `git show main:packages/client/package.json | rg '"version"'` → versión de desarrollo.
- `pnpm -r exec tsc --noEmit` + `pnpm test` en ambas ramas.

DONE cuando: las tres ramas relevantes tienen una versión coherente con ADR-042/043/044, el
RUNBOOK tiene el control de verificación, y no se creó ningún tag ni release.
```

---

## LOTE 3 — Limpieza de muerto y tokens de color

```
Contexto: auditoría AUD-20260723, hallazgos 008 y 009. Rama: main (o feature branch).

PARTE A — [AUD-008] Código muerto. Cuatro módulos sin ninguna referencia en packages/client/src
(verificado con búsqueda del basename sobre todos los .ts/.tsx del paquete):

  1. renderer/views/config/ConfigShell.tsx — YA está documentado como trampa conocida en
     CLAUDE.md §Navegación: parece el menú de Configuración, no lo importa nadie, y ADR-048
     perdió un ciclo editándolo. Documentarlo evitó la repetición pero no eliminó la causa.
     → Borrar. Si el componente describe una intención de navegación anidada que se quiere
       conservar como idea, moverla a un comentario en AppShell.tsx y borrar igual el archivo.
     → Al borrarlo, actualizar la advertencia de CLAUDE.md §Navegación: la trampa deja de
       existir, pero la REGLA GENERAL que la acompaña ("antes de editar un componente para que
       algo aparezca, confirmá que está montado") vale igual y se conserva.

  2. main/dev-seed/_diagPV2.ts — script de diagnóstico one-off de la migración de precios v2.
     No es un módulo inerte: su cuerpo son sentencias de nivel superior con console.log que
     se ejecutan al importarse. Nadie lo importa.
     → Borrar.

  3. renderer/hooks/useListaPrecioDetalle.ts — hook del modelo de precios anterior a ADR-034.
     → Borrar. OJO: es el único consumidor del namespace `listaPrecioDetalle` del preload, que
       es materia del Lote 5 (AUD-012). Borrar el hook acá es seguro y NO decide nada sobre la
       tabla; simplemente deja el namespace sin consumidores, que es información útil para el
       Lote 5. No tocar preload/index.ts:53-55 ni ipc/lista-precio-detalle.ts en este lote.

  4. renderer/views/placeholders/PlaceholderView.tsx — sin referencias.
     → Verificar que routes/index.tsx no lo use para ninguna ruta "próximamente" antes de
       borrar. Si alguna ruta lo necesita, no es huérfano y el hallazgo se cierra como falso
       positivo — decirlo explícitamente.

  Verificación de la parte A: `pnpm -r exec tsc --noEmit` y `pnpm test` siguen verdes, y
  `rg -n "ConfigShell|_diagPV2|useListaPrecioDetalle|PlaceholderView" packages/client/src`
  no devuelve nada.

PARTE B — [AUD-009] Tokens de color. renderer/styles/global.css es el ÚNICO css del renderer y
declara 18 custom properties:
  --accent --accent-soft --accent-strong --bg --danger --ink --ink-2 --ink-3 --line --ok --pad
  --radius --rowpad --shadow --surface --surface-2 --ui-font --warn
El renderer consume 19 nombres que NADIE declara (~40 usos, todos con fallback hex, por eso es
invisible: el fallback es lo que pinta siempre):
  --border (8) --success (8) --color-success (4) --color-warning (2) --error (2) y uno cada uno:
  --accent-subtle --bg-1 --bg-2 --bg-hover --color-danger-bg --color-info-bg --color-warning-bg
  --color-warning-text --error-subtle --font-mono --ink-1 --row-selected-bg --warn-bg --warn-text

Efecto real: ~40 puntos de la UI quedan fuera del cambio de tema claro/oscuro y del selector de
acento, y hay tres vocabularios paralelos (--ok / --success / --color-success) para lo mismo.

Regla: Sistema-Diseno-ferreteria.md §12 ("nada de colores hardcodeados en componentes") y §2,
que fija la paleta canónica: --ok y --danger, NO --success ni --error.

  → Mapear cada uno de los 19 alias al token canónico de §2 que le corresponda. Para los que no
    tengan equivalente (--font-mono, --row-selected-bg, --bg-hover), decidir: o se declaran en
    global.css como tokens de primera clase y se documentan en el Sistema de Diseño, o se
    reemplazan por uno existente. Proponer el mapeo COMPLETO antes de aplicarlo.
  → Eliminar los hex sin token: dashboard/stock/StockPanel.tsx:38 ('#c62828' / '#e65100') y
    los `color: '#fff'` de pos/PosItemsTable.tsx:53,62.
  → EXCEPCIÓN legítima, no tocar: los charts de Recharts
    (dashboard/ventas/EvolucionChart.tsx:18-24, DiaMesChart.tsx:8-10,
    productos/MargenCategoriaChart.tsx:8-13) leen el token con getComputedStyle y usan el hex
    solo como valor inicial de useState. Ese patrón SÍ respeta el tema — es el workaround
    correcto para una librería que no acepta CSS vars, y ADR-037 §Alternativas lo previó al
    descartar Chart.js justamente por eso.
  → Si el mapeo cambia colores visibles, verificar en la app real (pnpm dev) en tema claro Y
    oscuro, con al menos dos acentos distintos. Los tests de renderer no ven color.

VERIFICACIÓN
- Script o comando que compare tokens declarados en global.css contra `var(--x` usados en tsx;
  el conjunto "usados y no declarados" debe quedar vacío.
- `rg -n "#[0-9A-Fa-f]{6}" packages/client/src/renderer --glob '*.tsx'` → solo los valores
  iniciales de los tres charts.
- pnpm test verde + verificación visual en la app.

DONE cuando: cero módulos huérfanos de la lista, cero tokens sin declarar, y los únicos hex del
renderer son los defaults de Recharts.
```

---

## LOTE 4 — Impresión: helper único + márgenes de etiqueta

```
Contexto: auditoría AUD-20260723, hallazgos 005 y 013. Van juntos porque el bug de márgenes es
consecuencia directa de la triplicación: de las tres copias de generarPdfConWindow, solo una
pasa opciones de márgenes, y es la que las pasa mal.

Rama: main (o feature branch).

🛑 GATE — PHASE-GATE. Este lote toca tres módulos con ADR aceptado: etiquetas (ADR-026),
   presupuesto (ADR-046) y remito (ADR-045). Detenerse y confirmar con el humano el encuadre
   antes de escribir código:
   - Postura sugerida: es corrección de defecto + refactor sin cambio de comportamiento
     observable, no feature nueva, por lo que NO requiere ADR de excepción. Pero la decisión
     es del PO, no del agente.
   - Si el PO considera que sí lo requiere, el lote se detiene hasta que exista el ADR.
   - En cualquier caso, este lote NO cambia el contenido de ninguna etiqueta, remito ni
     presupuesto, ni la geometría de los perfiles de parametros_sistema.

TAREAS (después del gate)

1. [AUD-005] main/ipc/etiquetas.ts:249 pasa `{ marginsType: 1, printBackground: true }` a
   printToPDF. `marginsType` era la API de Electron <=20; en Electron 32 se reemplazó por
   `margins: { marginType: 'none' }`. Una opción desconocida se descarta EN SILENCIO: el PDF
   de la plancha sale con los márgenes por defecto del motor, no sin márgenes.
   Confirmado por tsc: TS2353 "'marginsType' does not exist in type 'PrintToPDFOptions'".
   Impacto: desalinea la grilla de etiquetas contra la hoja Avery — justo el punto que ADR-026
   §Negativas marca como el riesgo del módulo ("calibración de márgenes dependiente de
   impresora/driver").
   → Migrar a la API actual. Verificar contra la firma real de PrintToPDFOptions en la versión
     de Electron instalada (no de memoria).

2. [AUD-013] Extraer UN helper de generación de PDF. Hoy hay tres implementaciones casi
   idénticas (temp file + BrowserWindow oculta + loadFile + printToPDF + cleanup):
     - main/ipc/etiquetas.ts:238-257
     - main/ipc/presupuesto.ts:581-594
     - main/ipc/remito.ts:~467-480
   Y en paralelo existe src/print/{types.ts, ElectronPrintService.ts} con la interfaz
   IPrintService, que es donde ADR-015 dice que vive la abstracción de salida de impresión.
   → Extraer a src/print/ detrás de IPrintService, con las opciones de página (incluidos
     márgenes) como parámetro, y hacer que los tres consumidores lo usen.
   → TDD: primero un test del helper que verifique que las opciones de página llegan a
     printToPDF (con el servicio mockeado, como ya hace ipc/print.ts al recibir el service por
     parámetro), después el refactor.
   → Los tres call sites deben seguir produciendo el mismo PDF que hoy, salvo etiquetas, que
     ahora sí aplica márgenes cero.

3. Cerrar el error de tipos correspondiente (es uno de los 27 de AUD-001).

VERIFICACIÓN — esta parte NO la cubren los tests
- `pnpm -r exec tsc --noEmit` + `pnpm test` verdes.
- OBLIGATORIO: abrir la app (pnpm dev), imprimir una plancha A4 real con un perfil de grilla
  (tipo Avery) y verificar la alineación contra la hoja física. CLAUDE.md §12 es explícito:
  "todo cambio con superficie de UI se cierra abriendo la app". Acá además el driver de Windows
  es parte del camino y ningún test unitario lo toca.
- Verificar también un remito y un presupuesto en PDF: deben salir igual que antes del refactor.

DONE cuando: un solo helper, tres consumidores, márgenes correctos, y una plancha impresa de
verdad que alinea.
```

---

## LOTE 5 — Corte de `lista_precio_detalle`

```
Contexto: auditoría AUD-20260723, hallazgo 012. ESTE LOTE TOCA ESQUEMA Y REQUIERE DECISIÓN
FORMAL. No arrancar sin haber pasado los dos gates.

Situación (verificada):
  - Tabla `lista_precio_detalle` viva en db/schema/precios.ts:28.
  - Handlers de ESCRITURA completos en ipc/lista-precio-detalle.ts: listByProducto, upsert, remove.
  - Expuestos al renderer en preload/index.ts:53-55 (namespace `listaPrecioDetalle`).
  - Único consumidor del renderer: hooks/useListaPrecioDetalle.ts, huérfano (se borra en Lote 3).
  - ipc/lista-precio.ts:177 la marca "deprecated".
  - dev-seed/precios-v2.ts:178 imprime literalmente "lista_precio_detalle conservada — confirmar
    el DROP después de verificar". Esa confirmación nunca se cerró.
  - ADR-034 (Cerrado) estableció lista_precio_valor como el motor. ADR-040 insiste en no tener
    una segunda fuente de verdad de precio.

Por qué importa: queda una superficie de ESCRITURA completa (IPC + puente de preload) sobre el
modelo de precios anterior, alcanzable desde el renderer aunque ninguna pantalla la use. Es la
definición de segunda fuente de verdad latente.

🛑 GATE 1 — DIAGNÓSTICO, SIN ESCRIBIR NADA. Reportar y esperar:
   1. ¿La tabla tiene filas en bases reales? Distinguir: base de desarrollo local vs. la base
      del comercio. dev-seed/catalog.ts:86 y personas.ts:52 la borran en cada seed, así que
      en dev estará vacía — eso NO dice nada sobre producción.
   2. ¿La migración a lista_precio_valor (dev-seed/precios-v2.ts) se corrió efectivamente sobre
      la base productiva? El script leía los overrides de lista_precio_detalle y los volcaba a
      lista_precio_valor. Si no se corrió, la tabla tiene datos que NO están en el motor nuevo
      y borrarla sería pérdida de datos.
   3. ¿Algún camino de lectura vivo la consulta todavía? Rastrear ipc/lista-precio.ts:177 y
      alrededores.
   NO PROPONER EL DROP hasta tener estas tres respuestas.

🛑 GATE 2 — DECISIÓN + ADR. Con el diagnóstico en mano, presentar las opciones al PO. El
   protocolo de auditoría (§9) es claro: el auditor no re-abre decisiones cerradas, y esto es
   una decisión nueva sobre el alcance de ADR-034. Opciones a plantear, con su costo:
     A) Retirar el namespace `listaPrecioDetalle` de preload/index.ts:53-55 y los handlers de
        escritura (upsert/remove), dejando la tabla y el read como histórico solo-lectura.
        Cierra la superficie de escritura sin tocar esquema. Reversible.
     B) Drop de la tabla con migración aditiva-compatible (ADR-042 §Feature flags exige
        migraciones aditivas/retrocompatibles; un DROP de tabla en uso está PROHIBIDO
        explícitamente ahí — si la tabla no está en uso hay que demostrarlo, no asumirlo).
        Irreversible sin restore.
     C) Statu quo documentado: dejarla, pero registrar la deuda en el ADR-Log para que la
        próxima auditoría la suprima como deuda aceptada en vez de reportarla.
   → El PO elige. Si elige A o B, hace falta un ADR breve (contexto/decisión/consecuencias/
     alternativas, formato del ADR-Log) porque cambia el alcance de un ADR Cerrado.
   → Si elige B, SEGUNDO gate explícito antes de escribir la migración, y backup .fbk previo.

TAREAS (solo después de que exista el ADR aprobado)
  - Implementar lo que el ADR decida, con TDD.
  - Si hay migración: aditiva, numerada correlativa (siguiente a 0027), con entrada en
    meta/_journal.json, y verificada contra meta/*_snapshot.json para descartar drift.
  - Actualizar CLAUDE.md §7 si el modelo de datos cambia.
  - Registrar la implementación en el ADR nuevo (patrón "### Implementación (fecha)" que ya usan
    ADR-036, 038, 041, 045, 046).

NO HACER NUNCA en este lote: `pnpm rebuild`, `pnpm build`, `pnpm make`, correr migraciones
contra una base real, ni instalar dependencias.

VERIFICACIÓN
- `pnpm -r exec tsc --noEmit` + `pnpm test` verdes.
- Si hubo migración: aplicarla sobre una base de prueba desechable y verificar que
  __drizzle_migrations quedó al día; NO sobre la base del comercio.
- El namespace `listaPrecioDetalle` ya no aparece en preload/index.ts (si se eligió A o B).

DONE cuando: existe un ADR aprobado que cierra la pregunta abierta desde precios-v2.ts:178, y el
código refleja esa decisión.
```

---

## Resumen de gates

| Gate | Lote | Qué se detiene | Por qué |
|------|------|----------------|---------|
| 🛑 Dependencia | 1 | `pnpm add -D @types/nodemailer` | `CLAUDE.md` §12 — no introducir dependencias sin justificar |
| 🛑 Diagnóstico | 2 | Cualquier escritura | Saber si hubo distribución con `0.1.0` cambia el plan |
| 🛑 Rama estable | 2 | Commit en `release/1.0.x` | ADR-042 §2/§7 — solo hotfixes, decisión humana |
| 🛑 Phase-gate | 4 | Tocar etiquetas/remito/presupuesto | ADR-026/045/046 aceptados; el encuadre lo define el PO |
| 🛑 Diagnóstico | 5 | Cualquier propuesta de DROP | Sin saber si la migración de precios v2 corrió, un DROP es pérdida de datos |
| 🛑 Decisión + ADR | 5 | Todo el lote | Cambia el alcance de ADR-034 (Cerrado) |
| 🛑 Migración | 5 | Escribir la migración | ADR-042 exige aditivas; backup previo obligatorio |

## Prohibido en toda la corrida de remediación

`pnpm rebuild` · `pnpm build` · `pnpm make` · correr migraciones o seeds contra la base del
comercio · crear tags · publicar releases · instalar dependencias fuera del Gate del Lote 1 ·
escribir en `parametros_sistema` de una base real.
