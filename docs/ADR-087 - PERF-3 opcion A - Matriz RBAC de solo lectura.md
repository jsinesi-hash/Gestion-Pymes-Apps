# ADR-087 — PERF-3 (opción A): pantalla de Roles y permisos (matriz RBAC de solo lectura)

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-16 ·
**Rama:** `feat/adr087-permisos-matriz-lectura` ·
**Fase:** Auditoría UX/Seguridad — Fase 3, ítem 5 (PERF-3), **opción A**.
**Relacionados:** ADR-085 (dejó el mapa `ETIQUETA_PERMISO` como groundwork; difirió PERF-3),
ADR-008 (roles y permisos como datos). Insumos de diseño: `docs/perf3-permisos-analisis.md`
(opciones A/B/C) y `docs/perf3-permisos-mockup-opcion-B.html`.

---

## Contexto

Los permisos por rol son datos (`rol_permiso`) pero se administran desde código (`PERMISOS`/
`OPERADOR_PERMISOS` en `src/main/auth/seed.ts`); no había forma de verlos en la app. PERF-3
proponía una pantalla de permisos, con tres opciones (ADR-085 §PERF-3 / `perf3-permisos-analisis.md`):
**A** solo lectura, **B** edición con guardas, **C** no hacerla. El usuario eligió **A** primero:
barata, aditiva, sin migración y sin riesgo sobre los invariantes RBAC (no escribe).

ADR-085 ya había dejado listo el mapa `ETIQUETA_PERMISO`/`etiquetaPermiso` en `@ferreteria/shared`
(nombres amigables tipo "Vender (POS)"), como groundwork sin consumidor de UI. Este ADR es su
primer consumidor.

## Decisión

Pantalla nueva **"Roles y permisos"** en el grupo **Sistema** de Configuración, gateada por
`usuario.administrar` (solo Supervisor). Muestra una matriz roles × permisos leída en vivo, de
**solo lectura**.

- **Main — handler de lectura** `permisoMatrizHandler(db)` en `ipc/auth.ts` (canal
  `permiso:matriz`), guard `usuario.administrar`. Devuelve `{ roles, permisos, porRol }`: roles
  activos, todos los permisos (con `codigo`/`descripcion`/`modulo`, ordenados por módulo) y, por
  rol, los códigos asignados (join `rol_permiso × permiso`). Sin escritura.
- **Preload** — namespace `permisos: { matriz() }`.
- **Renderer** — `views/config/RolesPermisosView.tsx`: tarjetas de resumen por rol (N/total),
  tabla agrupada por módulo con columnas por rol y celdas ✓/—, badge "Solo lectura" y nota al pie.
  Usa `etiquetaPermiso(codigo)` para los nombres amigables (el `codigo` crudo queda en el
  `title`). Ruta `config/roles-permisos` (`routes/index.tsx`), ítem en el array `NAV` de
  `AppShell` (grupo Sistema, permiso `usuario.administrar`) y entrada en el mapa de breadcrumb
  (`lib/breadcrumb.ts`) — las **tres** cosas que exige §Navegación de CLAUDE.md.
- **Higiene:** se exporta `OPERADOR_PERMISOS` en `seed.ts` (para el test de conteo del handler);
  `PERMISOS` ya estaba exportado (ADR-085).

**No hace edición** (eso es la opción B, que sigue abierta): choca con que `runSeed` es aditivo y
requeriría tabla de overrides + refactor de seed + guardas de invariante (ver
`perf3-permisos-analisis.md`).

## Consecuencias

- El Supervisor ve quién puede qué sin depender del doc. Primer consumidor real del mapa de
  nombres de ADR-085.
- Sin migración, sin flags, sin escritura → cero riesgo sobre invariantes RBAC.
- TDD: test del handler (roles/permisos/porRol + guard `FORBIDDEN`) y test de la vista (nombres
  amigables, columnas por rol, ✓/—, conteos, error). Verde en ambos runners + `tsc` limpio.

## Fuera de alcance

- **PERF-3 opción B** (edición de permisos por rol): sigue abierta como decisión de producto; su
  propio ADR (tabla de overrides + `runSeed` que la respete + guardas + tests de invariantes).

## Verificación manual pendiente (CLAUDE.md §12)

Abrir `pnpm dev` como Supervisor → Configuración → Sistema → **Roles y permisos**: se ve la matriz
con ✓/— por rol y los nombres amigables; como Operador el ítem no aparece (gate `usuario.administrar`).
