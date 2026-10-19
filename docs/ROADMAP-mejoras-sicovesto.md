# Roadmap de ejecución — mejoras del análisis SICOVESTO (6 packs, 16 PRs)

> Fecha: 2026-10-19. Estado de partida: `main` limpio; los 6 packs están en `docs/` sin commitear; la última migración de Retail es la `0049` y el último ADR escrito es el 113 (verificar antes de numerar).
> Este documento **ordena y coordina** los packs; no los reemplaza. Cada pack sigue siendo la fuente de verdad de su diseño y de su prompt de implementación.

## 1. Los packs y sus PRs

| Sigla | Pack | PRs | Migración Retail | Toca el núcleo (`@core/*`/`shared`) |
|---|---|---|---|---|
| **INV** | `Pack-A2-A3-A23-inventario-bajo-minimo.md` | INV-1 función única de bajo mínimo · INV-2 panel Inventario · INV-3 digest en Agenda | INV-2 (3 umbrales), INV-3 (3 parámetros) | No |
| **POS** | `Pack-A5-A6-atajos-y-cantidad-pos.md` | POS-1 hook de atajos · POS-2 multiplicador `N*` | No | No |
| **CST** | `Pack-A16-visibilidad-de-costos.md` | CST (1 PR) | No | `shared`: una etiqueta de permiso |
| **SEC** | `Pack-Seguridad-Venta-precio-override-y-precio-desactualizado.md` | SEC-1 UI de autorización · SEC-2 control en el main · SEC-3 presupuestos | No | `core-ui`: 1 entrada de catálogo de errores |
| **MED** | `Pack-A22-medios-de-pago-configurables.md` | MED-1 núcleo · MED-2 Retail | MED-2 (1 parámetro) | Sí: `shared` (parser), `core-main` (`confirmar-venta`), `core-ui` (modal, errores) |
| **NC** | `Pack-A24-notas-de-credito-internas.md` | NC-1 backend · NC-2 interfaz · NC-3 reportes | NC-1 (tablas + flag) | `shared`: una etiqueta de permiso |

## 2. Dependencias

**Duras (no se puede invertir el orden):**
- INV-1 → INV-3 (el digest usa la función única).
- POS-1 → POS-2 (el contrato de Esc del multiplicador vive en el hook).
- SEC-1 → SEC-2 → SEC-3 (orden interno del pack: sin la UI de autorización, el control en el main bloquearía ventas).
- MED-1 → MED-2.
- NC-1 → NC-2 → NC-3.
- POS-1 y POS-2 → SEC-1: ambos packs tocan `PosView.tsx` y `usePosSession.ts`, y el pack SEC lo exige en su Gate 0 (no trabajar en paralelo sobre los mismos archivos).

**Blandas (conviene respetarlas para evitar conflictos o retrabajo):**
- CST → NC-1: los dos agregan un permiso (`seed.ts`, etiqueta en `shared`, tests de conteo, `CLAUDE.md` §8).
- INV-1 → NC-3: `dashboard.ts` lo modifican INV-1 (bajo mínimo) y NC-3 (ventas netas).
- SEC-1 → NC-2: NC-2 reutiliza el modal de credenciales de Supervisor generalizado por SEC-1.
- SEC-1 → MED-2: ambos tocan `PosView.tsx`.
- SEC-2 → NC-1: ambos tocan `ipc/venta.ts` (funciones distintas: `validarLineasPrevio` y el wrapper de anulación).
- MED-1 → NC-2 (solo si se decide que la devolución de dinero respete los medios habilitados; ver §6).

**Independientes entre sí:** INV ↔ POS ↔ CST ↔ MED-1 casi no comparten archivos (ver §4).

## 3. Orden de ejecución propuesto

Máximo **2 carriles en paralelo** (ver §5). Cada carril en su propia rama (y, si querés, su propio worktree).

| Ola | Carril A | Carril B | Qué la justifica |
|---|---|---|---|
| **1** | INV-1 (bajo mínimo único) | POS-1 (atajos) | Archivos disjuntos; ambos destraban a otros |
| **2** | INV-2 (panel Inventario) `[migr. 0050]` | POS-2 (`N*`) | POS-2 cierra los archivos de POS antes de SEC |
| **3** | INV-3 (digest) `[migr. 0051]` | CST (`costo.ver`) | CST abre el camino a NC-1; INV-3 usa INV-1 |
| **4** | NC-1 (backend notas) `[migr. 0052]` | SEC-1 (UI de autorización) | NC-1 es el palo largo de la tanda; SEC-1 sigue a POS |
| **5** | NC-2 (interfaz notas) | SEC-2 (control en el main) | NC-2 reutiliza el modal de SEC-1 |
| **6** | NC-3 (reportes) | SEC-3 (presupuestos) | NC-3 necesita INV-1 y NC-1/NC-2 |
| **7** | MED-1 (núcleo) | — | Independiente; puede adelantarse a cualquier ola con carril libre |
| **8** | MED-2 (Retail) `[migr. 0053]` | — | Tras SEC-1 (PosView) |

Nota: MED es el pack de menor urgencia y el más independiente. Sirve de **relleno**: MED-1 puede ocupar el carril libre de cualquier ola (no depende de nada salvo agregar una línea a `errores.ts` y exportar un parser desde `shared`, ambos aditivos). MED-2 debe ir después de SEC-1.

Si querés priorizar notas de crédito, la ruta mínima es: CST → NC-1 → (SEC-1 si querés reutilizar el modal) → NC-2 → INV-1 → NC-3. Es posible mover INV-1 y CST a la ola 1 y arrancar NC-1 en la ola 2, a costa de posponer POS.

## 4. Choques de archivos

Los que realmente exigen orden (el resto son agregados en líneas distintas y se resuelven al rebasar):

| Archivo | PRs que lo tocan | Orden / regla |
|---|---|---|
| `renderer/views/pos/PosView.tsx` | POS-1, SEC-1, MED-2 | POS-1 → SEC-1 → MED-2; nunca en paralelo |
| `renderer/hooks/usePosSession.ts` | POS-2, SEC-1 | POS-2 → SEC-1 |
| `PosScanBar.tsx`, `PosBottomBar.tsx`, `PosItemsTable.tsx`, `PosTopBar.tsx`, `main/menu/appMenu.ts` | POS-1, POS-2 (algunos) | Solo el pack POS |
| `main/ipc/dashboard.ts` | INV-1, INV-2 (registro del handler), NC-3 | INV-1 → INV-2 → NC-3 |
| `dashboard-rango.ts`, `dashboard-caja-rango.ts`, `dashboard-clientes.ts`, `reportes.ts` | NC-3 | Solo NC |
| `main/ipc/caja-cierre-aviso.ts` | INV-1 | Solo INV |
| `main/ipc/venta.ts` | SEC-2, NC-1 (wrapper de anulación) | SEC-2 y NC-1 en funciones distintas; el segundo en mergear rebasa |
| `main/ipc/presupuesto.ts` | SEC-2 (lectura), SEC-3 | SEC-2 → SEC-3 |
| `main/auth/seed.ts`, `shared/src/permisos.ts` y los tests de conteo de permisos | CST, NC-1 | CST → NC-1; el segundo recalcula los conteos |
| `ipc/__tests__/helpers.ts` (`loginAsOperador`) | SEC-2 (lo crea en su Gate 1), CST (necesita loguear un Operador) | El primero que lo necesite lo crea; el segundo lo reutiliza |
| `packages/shared/src/index.ts` y `permisos.ts` | CST, NC-1, MED-1 | Agregados; recompilar `shared` en cada rebase |
| `packages/core-ui/src/lib/errores.ts` | SEC-1, MED-1 | Una línea cada uno; sin orden obligado |
| `routes/index.tsx`, `shell/navRetail.tsx`, `shell/crumbsRetail.ts` | NC-2, MED-2 | Agregados; el test de nav de Retail (lo crea NC-2) cubre ambos |
| `main/index.ts`, `preload/index.ts` | INV-2 (preload), INV-3 (timer), NC-1 (registro y bridge) | Agregados |
| `main/db/migrations/meta/_journal.json` | INV-2, INV-3, NC-1, MED-2 | Ver §5 |
| `CLAUDE.md` | CST (§8), NC-1 (§7 y §8) | CST → NC-1 |
| `Estado.md` y `docs/ADR-Log-ferreteria.md` | todos | Ver §5 |

Archivos de un solo pack (sin riesgo): `Kardex.tsx`, `ProductoDetalle.tsx`, `producto.ts`, `movimiento-stock.ts`, `stock.ts` (CST); `confirmar-venta.ts` y `ConfirmarVentaModal.tsx` (MED-1); `DashboardView.tsx` (INV-2); el módulo nuevo `main/notas/` y las tablas `nota`/`nota_linea` (NC).

## 5. Reglas de coordinación

**Migraciones de Retail (4 en total).** Orden de números según la tabla de olas: INV-2 → `0050`, INV-3 → `0051`, NC-1 → `0052`, MED-2 → `0053`. Reglas:
1. El número real es el **siguiente libre al mergear**, no el planeado: cada PR con migración verifica el journal en su discovery de schema (ya lo exige cada prompt).
2. Las migraciones de Retail son SQL escrito a mano y el journal (`meta/_journal.json`) tiene entradas con `when` creciente (la `0049` tiene `when: 1794787200000`). Drizzle aplica por `when`: si una migración llega con un `when` **menor** que el de otra que una instalación ya aplicó, **esa instalación la saltea en silencio**. Al rebasar, el `when` de cada migración nueva debe quedar **mayor que el de todas las ya mergeadas** y el `idx` correlativo.
3. Nunca dos PRs con migración abiertos a la vez sobre el mismo número: el segundo rebasa y renumera.
4. Ningún pack agrega migraciones a Elaborados.

**Documentación (`Estado.md`, `ADR-Log`).** Todos los PRs prependen texto a la misma línea gigante "Última actualización", así que **siempre habrá conflicto ahí**. Regla: el cierre documental de un pack lo hace el **último PR del pack, después de rebasar sobre `main`** (como ya piden los prompts), y en caso de conflicto se conservan ambos bloques, el nuevo primero.
- **Numeración de ADR:** los packs dicen `ADR-XXX`. Asignarlos **al mergear el primer PR de cada pack**, en orden de olas, empezando por el siguiente libre (hoy el 114). Sugerencia de orden: INV, POS, CST, NC, SEC, MED. El `XXX` se reemplaza en el pack, en el texto del ADR y en el bloque de `Estado.md`.

**Permisos.** CST suma `costo.ver` (solo Supervisor); NC-1 suma `nota.emitir` (ambos roles). Los tests que afirman el conteo exacto de permisos por rol (`auth/__tests__/seed.test.ts`, `ipc/__tests__/auth.ipc.test.ts`) los actualiza el segundo en mergear.

**Tests y entorno.** `better-sqlite3` se compila para un solo runtime a la vez (NMV): no correr a la vez `pnpm dev` y los tests del main; la suite del main va **en serie** (el runner es flaky en paralelo). Con dos carriles en paralelo: dos worktrees, **una sola corrida del runner del main por vez** (vos o el controlador de la sesión), y recompilar `packages/*` (`pnpm -r build`) tras cada rebase que toque `shared` o `@core/*`. Los comandos largos no se delegan a subagentes.

**Antes de empezar.** Commitear los 6 packs y este roadmap en un PR solo de documentación (hoy están sin versionar): así todas las ramas los comparten y los prompts pueden apuntar a archivos que existen en `main`.

## 6. Ajustes sugeridos a los packs (no aplicados, para que los decidas)

1. **SEC-2, Gate 1:** crea `loginAsOperador`; CST también necesita loguear un Operador. Pedirle a quien vaya segundo que lo **reutilice si ya existe** (mismo texto en ambos prompts).
2. **NC-2:** decidir si el medio de devolución (efectivo/transferencia/tarjeta) respeta `medios_pago_habilitados`. Hoy el pack A24 ofrece los tres y el pack A22 valida solo en `confirmarVenta`. Si preferís coherencia, NC-2 filtra la lista con el mismo parser (requiere MED-1 antes) y no se valida en el main.
3. **NC-2:** reutilizar el modal de credenciales generalizado por SEC-1 en lugar de crear uno propio (agregarlo como paso de discovery).
4. **POS-1 (F6) ↔ SEC-1:** F6 enfoca "Desc. %" solo con `precio.override`. Tras SEC-1 verificar que sigue valiendo la misma regla (SEC-1 agrega un camino de autorización cuando un descuento llega sin permiso); si cambia el criterio, ajustar F6 en el mismo PR.
5. **Flags:** `notas_credito_habilitado` y `agenda_bajo_minimo_habilitado` nacen en `false`. Activar notas en producción solo después de NC-3; el digest cuando quieras recibirlo.

## 7. Fuera de este roadmap

Seguimientos registrados por los packs, cada uno con su ADR propio y sin fecha: recálculo y validación de totales en el servidor (SEC), repricing de esperas retomadas (SEC), auditoría de quién autorizó (migración, SEC), permisos `presupuesto.*` sin control en el main (SEC), `dias_hasta_agotar` ignora `factor_a_stock_aplicado` (INV), posible `FORBIDDEN` en la recepción de compra del Operador (CST), nota de débito y NC fiscal (NC, atada a ADR-013), catálogo de medios en base de datos (MED), remito valorizado (A8, no se hará salvo demanda). Candidatos menores sin pack: A1, A4, A7, A9, A10, A13–A15, A17, A19, A21, A25; descartados por ahora: A11, A12, A20; A18 descartado por decisión de producto.
