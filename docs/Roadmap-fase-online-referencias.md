# Roadmap fase online (multi-POS, BD distribuida, SaaS): índice de referencias

**Fecha:** 2026-11-16 · **Origen:** relevamiento hecho desde el repo `Ferreteria-app` (congelado en v1.1.1)
**Propósito:** que este proyecto sepa **dónde quedó registrado** todo lo ya decidido o planificado
sobre la evolución a varias terminales en red, base distribuida y SaaS, antes de abrir la fase F0.

> Todas las rutas son relativas a la raíz de **Gestion-Pymes-Apps** (los documentos de la
> ferretería se copiaron a `docs/` en el corte multi-rubro, ADR-091).

---

## 1. Ubicación en el roadmap

| Release | Versión | Contenido |
|---|---|---|
| **R4** | `2.0.0` | Nube + sincronización, multi-terminal (ADR-011, ADR-042, ADR-044) |
| **R5** | `2.x` | Reportes consolidados y preparación multi-sucursal |

Fuera de alcance vigente (CLAUDE.md §10): **multi-sucursal operativo**. El hub en la nube lo
acerca, pero sigue sin decidirse si entra.

---

## 2. Documento principal: el análisis de la fase online

**`docs/Revisiones/2026-11-16-analisis-fase-online.md`**. Estado: *análisis, sin decisiones cerradas*.
Amplía la TechSpec §3.12.

**Recomendación central:** **no** conectar Electron a una base remota. Cada terminal mantiene su
SQLite local (ADR-001) y se agrega un **motor de sync contra un "hub"**. El modo distribuido no
cambia *dónde se escribe*, sino *con quién se sincroniza*:

| Modo | Hub | Cambio en la terminal |
|---|---|---|
| Standalone (hoy) | no hay | nada |
| Red local | servicio en una PC del local | sync activado, URL del hub en la LAN |
| SaaS | el mismo servicio en la nube, multi-tenant | sync activado, URL pública + tenant |

Por qué no "todas las terminales contra un Postgres central":
- **Rompe offline-first:** si cae el servidor o internet, se frena la venta.
- **Reescritura enorme:** ~2.180 llamadas síncronas de `better-sqlite3` en `apps/*/src/main` y
  `packages/core-main/src`.

**Plan por fases (§5)** — cada fase detrás de un flag, sin romper el modo standalone:

| Fase | Contenido | Red | Versión |
|---|---|:-:|---|
| **F0 · Decisiones** | ADRs nuevos: stock/crédito offline, numeración por documento, saldos como proyección, hub y su base (con verificación de B3), protocolo con cursor del hub, schedulers; reescribir P4.1/P4.2 | no | — |
| **F1 · Preparación local** | triggers + `sync_outbox` generados desde el registro B2 (test B2 extendido), baranda de paridad B3, `recalcularSaldo` + test de integridad, numeración por terminal (remito/presupuesto/producción), rangos de SKU, config global vs local, `modo` en `config.json` | no | 1.x |
| **F2 · Hub en LAN** | servicio Node (`packages/sync-server` o `apps/hub`), push/pull con cursor, emparejamiento, bootstrap, schedulers en el hub, servicio Windows | LAN | 2.0.0-beta |
| **F3 · Operación** | indicador de sync, log de conflictos, restore desde el hub, convivencia de versiones | LAN | 2.0.0 |
| **F4 · SaaS** | multi-tenant (`tenant_id` solo en el hub), Postgres, alta de negocios, TLS público, monitoreo, costos | Internet | 2.x |

**Riesgos (§6):** vender stock inexistente entre terminales offline · saldos corruptos si se
sincronizan como filas · dos terminales con el mismo `origin_id` · un restore que resucita datos ·
esfuerzo del SaaS subestimado (es un producto aparte del sync).

**Preguntas abiertas para el PO (§7), que bloquean F0:**
1. ¿Se tolera stock negativo transitorio entre terminales (con alerta), o una venta sin hub se limita?
2. ¿Las terminales de un local comparten caja o cada una tiene la suya?
3. ¿Entran varias sucursales en este alcance?
4. ¿El hub de LAN lo instala el cliente en una de sus PCs o se entrega un equipo?
5. ¿Qué significa el "acceso remoto" del PRD para R4 (navegador fuera del local, celular)? Ver §3.14 del análisis.

---

## 3. ADRs que ya condicionan la fase (en `docs/ADR-Log-ferreteria.md`)

| ADR | Estado | Qué fija |
|---|---|---|
| **ADR-001** | Aceptado | Offline-first: SQLite local es la fuente de verdad; la nube consolida pero no bloquea |
| **ADR-003** | Aceptado | Sync por outbox + idempotencia; UUID generado en el cliente |
| **ADR-006** | Aceptado | Saldo + libro de movimientos inmutable (stock, caja, cta. cte.): se sincroniza por inserción |
| **ADR-011** | Aceptado | Cinco releases; R4 = nube y sync, R5 = escala |
| **ADR-012** | Cerrado | Conflictos: last-write-wins por registro en maestros + log revisable por el Supervisor |
| **ADR-013** | **Abierto** | Dónde va la integración fiscal (cliente o nube). Condiciona el diseño del hub; no cerrarlo de forma unilateral |
| **ADR-016** | Cerrado | Drizzle + pnpm; el mismo esquema para SQLite y PostgreSQL |
| **ADR-023** | Diferido | Google Drive nativo, a R4 (requiere backend con tokens del lado del servidor) |
| **ADR-025** | Aceptado | SKU correlativo de una sola terminal; el caso multinodo queda para R4 (rango por nodo o generado en el servidor) |
| **ADR-042** | Aceptado | Mapa de versiones: `2.0.0` = online / nube / multi-terminal; features nuevas detrás de flag |
| **ADR-044** | Aceptado | Corrige el mapa; `2.0.0` = R4 sin cambios |
| **ADR-045** | Aceptado | Numeración de remitos de una sola terminal; el caso multinodo queda para R4 |
| **ADR-047** | Aceptado | Outbox de avisos (el mismo patrón que el sync); en R4 el dispatcher pasa al backend; `aviso` no sincroniza |
| **ADR-091** | Aceptado | Corte multi-rubro. **B2:** el motor de sync es del core y se dirige por un registro de tablas por app. **B3:** esquema agnóstico de dialecto (SQLite local / Postgres nube) — **hoy sin verificación automática**: todos los esquemas usan solo `sqlite-core` (análisis §3.10) |
| **ADR-092** | Aceptado | Test de baranda B2 por app (`b2-sync-fields.test.ts` en Retail y Elaborados, vía `verificarCamposSync`); el motor real sigue diferido. Los triggers de F1 se generan desde ese registro (análisis §3.1) |

---

## 4. Documentos de producto y técnicos de origen (`docs/`)

- **`PRD-ferreteria.md`** — fila "R4 — Nube y sincronización": backend cloud, motor de sync, backup, acceso remoto. El **acceso remoto** no está cubierto por el análisis: pendiente de definición del PO (pregunta 5).
- **`TechSpec-ferreteria.md` §3.12** — sincronización offline-first; componente "Motor de sync (cliente)": outbox + reconciliación.
- **`RFC-001-ferreteria.md`** — propuesta de arquitectura original con la nube y el sync.
- **`Acta-Definiciones-ferreteria.md`** — multi-sucursal operativo diferido; consolidado multi-terminal en R4/R5.
- **`System-Prompts-desarrollo-ferreteria.md`** (≈líneas 480–512) — prompts P4.1 (backend) y P4.2 (motor de sync en el cliente). **Desactualizados, no ejecutar tal cual:** bajan cambios "desde `updated_at`" (falla con relojes distintos entre terminales), autentican terminales solo por `origin_id` y no cubren saldos como proyección, numeración por terminal ni B2. Se reescriben al cerrar F0 (análisis §3.12–3.13).
- **`superpowers/specs/2026-09-21-esqueleto-multi-rubro-design.md`** — barandas B2/B3 (§5.5) y e-commerce/acceso web futuro (B4) como frontend web + API sobre el Postgres de R4. Copiado a este repo (verificado 2026-11-16).
- **`Estado.md`** (raíz, ≈línea 187) — "2.0.0 — R4 nube + sync: backend Node + PostgreSQL, outbox, conflictos (ADR-012)".

---

## 5. Lo que ya está a favor en el código

- Campos de sync en toda tabla sincronizable: `version`, `origin_id`, `sync_state`, `updated_at`.
- Identidad de terminal: `origin_id` sale de `config.json` y se valida al arrancar (`packages/core-main/src/terminal.ts`, `context.ts`).
- La venta ya numera por terminal (`V-<terminal>-NNNNNN`, `confirmar-venta.ts`).
- Patrón outbox en uso en los avisos (ADR-047): se encola en la misma transacción del hecho.

**Deuda a resolver en F1:** hoy `version` y `sync_state` se mantienen a mano en ~270 handlers.
No existen la tabla `sync_outbox` ni los triggers, y los contadores (SKU, remito, presupuesto)
son globales, de una sola terminal.

---

## 6. Próximo paso

**F0 en curso (2026-11-16).** Aceptados (2026-11-16) en `docs/ADR-Log-ferreteria.md`:
- **ADR-149** — base del hub: SQLite en la red local, Postgres en la nube; B3 verificada con un test en PGlite.
- **ADR-150** — protocolo de sync: cursor asignado por el hub, emparejamiento con credencial, tablas `maestro`/`libro`/columnas proyectadas, sin borrados físicos.
- **ADR-151** — saldos de stock y cuenta corriente como proyección de sus libros; el conteo de stock como punto de corte.
- **ADR-152** — tareas programadas en una terminal coordinadora; los avisos siguen locales.

Con las respuestas del PO, aceptados (2026-11-16) — **F0 completa**:
- **ADR-153** — stock y crédito sin conexión: permitir y alertar (solo en modo distribuido).
- **ADR-154** — remito y presupuesto numeran por terminal; SKU por bloques asignados por el hub.
- **ADR-155** — caja por terminal o compartida, configurable por negocio.
- **ADR-156** — hub de red local en PC del cliente o equipo entregado; acceso remoto = app de escritorio vía hub en la nube; sin sucursales.

Abrir **F0**: responder las 5 preguntas del PO (§2) y redactar los ADRs de decisión: política de
stock/crédito offline, numeración por documento, saldos como proyección, ubicación y base del hub
y schedulers. ADR-013 sigue abierto y no se cierra en este paso.
