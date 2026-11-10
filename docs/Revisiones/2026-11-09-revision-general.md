# Revisión general — 2026-11-09

Estado de `main` en `494b588` (después de ADR-144). Revisión de código, documentación, trabajo a
medio hacer, lecciones y próximos pasos, con foco en roles y permisos.

---

## 1. Hallazgo principal: los permisos de la matriz no se cumplen en el main

CLAUDE.md §8 y Estado.md ("guard doble: renderer + IPC handler") dicen que cada permiso se verifica
en los dos lados. En la práctica, varios permisos **solo existen en la base y en el renderer**; el
handler del main pide sesión y nada más. Cualquier usuario logueado (Operador incluido) que llame
el canal directamente lo ejecuta.

| Permiso sembrado | ¿Lo verifica el main? | Handlers afectados (solo `requireSession`/`getSession`) |
|---|---|---|
| `producto.crear` / `producto.editar` | No | `ipc/producto.ts` |
| `stock.entrada` / `stock.ajustar` (Retail) | No | `ipc/stock.ts` (solo el menú lo filtra) |
| `caja.operar` | No | `@core/main` `ipc/caja.ts` |
| `remito.crear` / `conformar` / `anular` | No | `ipc/remito.ts` |
| `presupuesto.crear` / `emitir` / `anular` | No | `ipc/presupuesto.ts` |
| `transportista.gestionar` | No | `ipc/transportista.ts` |
| `precio.override` | No (usa "es Supervisor" por nombre de rol) | `verificarSupervisor` |
| `proveedor.pagar` | No hay feature | — (permiso huérfano) |
| — (sin permiso definido) | — | `categoria.ts`, `marca.ts`, `unidad.ts`, `etiquetas.ts`, agenda (`rutina:*`/`agenda:*`/`aviso:*`) |

Hoy el riesgo es acotado (las DevTools solo aparecen en desarrollo), pero tiene dos consecuencias:

1. **La matriz de "Roles y permisos" (ADR-087) muestra algo que el sistema no garantiza.**
2. **Un editor de permisos (PERF-3 opción B) no serviría de nada** para esos permisos: sacarle
   `producto.editar` al Operador ocultaría el botón, pero el canal seguiría respondiendo.

### Otros problemas del modelo actual

- **Permisos usados como "es Supervisor":** `config.fiscal` gatea listas de precios, reglas de
  precio, `PrecioPanel`, SMTP y parámetros; `usuario.administrar` gatea sinónimos, catálogo demo,
  dedup de ubicaciones y baja de clientes. No se puede delegar "precios" sin delegar "configuración
  fiscal".
- **Chequeos por nombre de rol (`'SUPERVISOR'`)** en vez de por permiso: `verificarSupervisor`
  (autorizaciones del POS, anulaciones, cierre de caja), la regla "último Supervisor"
  (`ipc/auth.ts:253`) y `RetailShell.tsx:45`. Con roles personalizados eso se rompe.
- **~10 copias locales del guard** (`requireSupervisor`, `requireAdmin`, `requirePerm`) en
  `lista-precio`, `regla-precio`, `price-batch`, `sinonimo`, `demo-catalog` ×2, y en `@core/main`
  `backup`, `parametros`, `restore`, `sistema`, `smtp`. Dos de ellas se llaman `requireSupervisor`
  pero chequean `config.fiscal` o `backup.restaurar`.
- **Dos formas de error:** `requirePermission` lanza `{ code: 'FORBIDDEN', permiso }`; el resto
  lanza `new Error('FORBIDDEN')`. El renderer recibe dos formatos.
- **Etiquetas faltantes:** los 7 permisos de Elaborados (`articulo.gestionar`, `compra.registrar`,
  `lista_precio.gestionar`, etc.) no tienen entrada en `ETIQUETA_PERMISO`; la matriz de Elaborados
  los muestra con el código crudo. El test de cobertura solo mira los `PERMISOS` de Retail.
- **Los permisos se leen solo al iniciar sesión.** Si se edita un rol, el usuario conectado sigue
  con los permisos viejos hasta volver a entrar (relevante para la opción B).

---

## 2. Documentación inconsistente

| Dónde | Qué dice | Realidad |
|---|---|---|
| CLAUDE.md §8 | 28 permisos, 12 del core | Retail tiene 29 (`precio.aprobar`), el core 13 (`proveedor.gestionar`) |
| CLAUDE.md §8 | Agenda sin permiso es "decisión pendiente" | Sigue igual; además hay ~10 handlers más sin permiso (ver §1) |
| CLAUDE.md §Navegación | Shell de Retail en `shell/nav.ts`, `crumbs.ts`, `comandos.ts`; "Retail no tiene test de nav" | Archivos `navRetail.tsx`, `crumbsRetail.ts`, `comandosRetail.ts`; `RetailShell` vive en `views/shell/`. Sigue sin el test `matchRoutes` de Elaborados |
| CLAUDE.md §7 | `ui_font` = Hanken/Figtree/Onest; "51 tablas en 12 archivos" de `src/main/db/schema` | ADR-089 cambió las fuentes; el esquema está partido entre `@core/db` y cada app; falta `usuario.password_changed_at` |
| CLAUDE.md comandos | `pnpm rebuild:electron` | El script se llama `pnpm rebuild` |
| Estado.md "Stack" | `packages/client`, `packages/shared` | Monorepo `apps/*` + `packages/core-*` |
| Estado.md "Estado actual" | Al 2026-10-14, E4 pendiente | E4 cerrado; faltan ADR-107…144 |
| Estado.md "En curso / próximo" | ADR-069 pendiente de merge | Mergeado hace meses |
| Estado.md "ADR cerrados" | "ADR-040 a ADR-101" | Llega a ADR-144 |
| Estado.md "Convenciones" | Última migración Retail 0049, Elaborados 0005 | 0051 y 0013 |
| Estado.md cabecera | Cada entrada acumula "**Previo:** … **Previo:** …" | Un solo párrafo de >10 000 caracteres (línea 51); ilegible |
| ADR-Log | ADR-061 aparece entre 078 y 079 | Orden roto |
| `docs/` | Prompts sueltos (`Prompt-1.x.txt`), `.tgz`, `.PNG`, CSV de prueba | Ruido; mover a `docs/archivo/` o borrar los no versionados |

---

## 3. Trabajo a medio hacer

- **Verificación manual en la app (§12) pendiente en ~20 ADRs** (de ADR-049 a ADR-143, incluidos
  todos los de seguridad de noviembre: vigencia de contraseña, recuperación por mail, bloqueo
  persistente, firma de backups). Es la deuda más grande: hay mucho verde en tests y poco recorrido
  real. Con `GESTION_USER_DATA_DIR` (ADR-130) ya se puede hacer sin tocar la BD real.
- **PERF-3 opción B** (edición de permisos) — abierta desde ADR-087.
- **Corte multi-rubro, Fases 3 y 4** (perfiles de rubro y guía "cómo nace una app") — sin empezar.
- **Feature flags que solo gatean la UI** (`remitos_habilitado` y otros): el IPC responde igual con
  el flag apagado. Decisión abierta en Estado.md.
- **Pantalla de Parámetros del sistema** — fuera del sidebar desde ADR-030, sin ADR.
- **`proveedor.pagar`** sembrado sin feature (cta. cte. de proveedores diferida, ADR-019).
- **Comprobantes de compra:** tabla sin UI.
- **Agenda:** leído/no leído, retención, grilla mensual (ADR-047), plantilla HTML (ADR-048).
- **Elaborados:** delivery estructurado y reserva de stock para pedidos en espera (diferidos).
- **R2 fiscal (ADR-013)** — sigue como la única decisión de arquitectura abierta.
- **Retail `drizzle-kit generate` roto** (snapshot chain desactualizado) — se trabaja a mano.

## 4. Higiene de código

- No hay `TODO`/`FIXME` reales (las 8 coincidencias son la palabra "todo" en comentarios).
- Artefactos de build dentro de `src` (`*.d.ts.map`, `*.js.map` en `packages/core-db/src`,
  `packages/shared/src`). Están ignorados por git, pero confunden búsquedas; conviene que `tsc`
  emita en `dist/` y no al lado del fuente.

---

## 5. Lecciones aprendidas (de las memorias y la bitácora)

1. **Verde ≠ alcanzable.** ConfigShell huérfano, el ítem SMTP invisible, y en ADR-143 un test de
   navegación que pasaba para cualquier ítem porque `/` siempre coincide. Los tests de integración
   del shell valen más que los del componente.
2. **El guard tiene que estar en el main, no solo en la UI.** ADR-114 y ADR-131 cerraron dos casos
   puntuales; esta revisión encuentra la misma clase de error en una docena de handlers. Falta una
   **baranda automática** (test que recorra los canales registrados y exija permiso o lista blanca).
3. **Revisión holística del diff completo** antes de mergear encontró bugs que la revisión por
   tarea no vio (E2, P0).
4. **El cierre documental se olvida.** Se convirtió en regla, pero las secciones que no son la
   cabecera (Stack, Estado actual, En curso, Convenciones) quedan viejas. El cierre debería tocar
   una lista corta y fija, no "todo Estado.md".
5. **Tooling:** runner del main se cuelga en paralelo (correr en serie); `pnpm --filter` rompe
   `node_modules` con linker hoisted; `pnpm dev` usa la BD real sin `GESTION_USER_DATA_DIR`;
   jsdom necesita 20 s de timeout bajo carga.

---

## 6. Próximos pasos propuestos (orden sugerido)

1. **RBAC Fase 0 — hacer cumplir lo que ya existe** (ADR nuevo, sin migración) — **hecho en
   ADR-145** con una tabla de políticas por canal aplicada al registrar, en vez de guards sueltos:
   - Un único guard en `@core/main` (`requirePermission` / `assertPermiso`) con un solo formato de
     error; borrar las ~10 copias locales.
   - Agregar el permiso que corresponde a cada handler de escritura de §1.
   - Baranda: test que recorra los `ipcMain.handle` registrados por cada app y falle si un canal
     de escritura no declara permiso (o no está en una lista blanca explícita).
   - Etiquetas para los permisos de Elaborados y test de cobertura sobre el conjunto completo
     (core + cada app).
2. **RBAC Fase 1 — permisos con significado propio** (migración aditiva vía seed) — **hecho en
   ADR-146**; de paso se corrigió que el último Supervisor se podía pasar a Operador: separar
   `precio.gestionar` de `config.fiscal`, `catalogo.gestionar` (categorías/marcas/unidades/
   sinónimos) de `usuario.administrar`, `agenda.*`, `cliente.desactivar`; autorizaciones del POS
   por permiso (`verificarAutorizacion(db, creds, 'venta.anular')`) en vez de por nombre de rol;
   regla "último administrador" por permiso `usuario.administrar`.
3. **RBAC Fase 2 — PERF-3 opción B** (editor con guardas, ver `docs/perf3-permisos-analisis.md`) — **hecho en
   ADR-147** (solo Operador y Supervisor, por decisión del usuario):
   tabla de overrides, `runSeed` = base + overrides, permisos intocables, refresco de la sesión al
   cambiar el rol propio. Opcional: roles personalizados.
4. **Tanda de verificación manual** de los ADRs de seguridad de noviembre (login, vencimiento,
   recuperación, bloqueo, restore firmado) en ambas apps.
5. **Limpieza documental:** corregir la tabla de §2, partir la cabecera de Estado.md, ordenar el
   ADR-Log.
6. Después: flags que gateen el IPC, Fases 3/4 multi-rubro, R2 fiscal.
