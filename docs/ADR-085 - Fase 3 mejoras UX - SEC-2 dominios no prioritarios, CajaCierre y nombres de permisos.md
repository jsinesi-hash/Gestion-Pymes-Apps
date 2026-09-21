# ADR-085 — Fase 3 mejoras UX: SEC-2 en dominios no prioritarios + ruteo por-campo en CajaCierreView + mapa de nombres amigables de permisos

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-13 ·
**Rama:** `feat/adr085-sec2-resto-cajacierre-nombres` ·
**Fase:** Auditoría UX/Seguridad — Fase 3. Cierra los puntos 1 y 2 del "Fuera de alcance" de ADR-082.
**Relacionados:** ADR-077 (Fase 1: ToastProvider, `useCallIpc`, `traducirError`, `useFormErrors`,
`rutearCampoError`), ADR-082 (SEC-2 infra + tranche prioritario), ADR-008 (roles), ADR-049
(`precio.aprobar`).
**Spec y plan:** `docs/superpowers/specs/2026-09-10-adr085-sec2-resto-cajacierre-nombres-design.md` ·
`docs/superpowers/plans/2026-09-10-adr085-sec2-resto-cajacierre-nombres.md`.

> **Nota de numeración:** este trabajo se planificó como "ADR-084", pero **ADR-083 y ADR-084 los
> tomaron sesiones concurrentes** (083 = ajustes varios; 084 = alta de productos como pantalla
> completa). Se renumeró a **ADR-085**. Por ese solapamiento, el primer commit del mapa de permisos
> (`2aa641c`) quedó con "(ADR-084)" en su mensaje; su contenido se reetiquetó a ADR-085 en `bfc61b1`.
> **CLAUDE.md §8 sigue diciendo 28 permisos: son 29** (`precio.aprobar` de ADR-049 se sumó después).

---

## Contexto

ADR-082 dejó tres cosas asentadas para la próxima iteración; este ADR cierra dos y siembra la
groundwork de una tercera:

1. **SEC-2 sin cubrir en dominios no prioritarios.** Los validadores de `main/validation/core.ts`
   (ADR-082) sólo se aplicaban al tranche prioritario. Verificado (2026-09-10): **ninguno** de los
   12 dominios de este ADR importaba `validation/core` — recibían `(p: unknown)` y casteaban sin
   validar en runtime.
2. **`CajaCierreView` sin ruteo por-campo.** El handler `caja:cerrar` ya validaba
   (`monto_contado`, `observaciones`) pero la vista no tenía superficie de error: en el camino sin
   autorización, un rechazo se perdía en silencio; en el camino con autorización, el error aparecía
   dentro de `SupervisorAuthModal`, el lugar equivocado para un error sobre el monto.
3. **Permisos mostrados como códigos crudos.** No había mapa único `código → etiqueta amigable`
   para que el futuro ADR de permisos (y cualquier vista) muestre "Vender (POS)" en vez de
   `venta.crear`.

## Decisión

Se aplicó el **patrón vetado de ADR-082** sin novedad de arquitectura, dominio por dominio, con
TDD (RED→GREEN) y doble revisión (spec + calidad) por tarea, en un **worktree aislado** (había una
sesión concurrente sobre el mismo checkout).

### A. SEC-2 en Tandas 1 y 2 (12 dominios)

En cada handler de escritura: `(db, payload: unknown)` → `const p = (payload ?? {}) as
Record<string, unknown>` → validación de forma/tipos con las primitivas de
`main/validation/core.ts` (`str`/`optStr`/`id`/`optId`/`num`/`int`/`centavos`/`bool`/`oneOf`/`arr`)
en locales `v_`, **después** del chequeo de sesión/permiso y **antes** de tocar la DB. Las reglas
de negocio existentes quedaron intactas (no se duplican); los errores de dominio ya los traduce el
catálogo B de ADR-082.

- **Tanda 1 (mostrador/compras):** transportista, sinónimos, equivalencias, presentaciones,
  recepción de compra, órdenes de compra, presupuestos, remitos.
- **Tanda 2 (precios/costos):** producto-proveedor, reglas de precio, cambios programados, cuenta
  corriente (ctacte).

**Capa C/D** donde el dominio tiene formulario: `useCallIpc` + `Set` de campos ruteables +
`r.traducido.campo/.mensaje` + `getElementById(campo).focus()` + error inline, más toasts de éxito
con género correcto. Cada dominio sumó su test de validación (main) y su test de ruteo (renderer).

**Regla mantenida (ADR-082):** no introducir requeridos nuevos — todo campo que el handler
aceptaba vacío/omitido va como `opt*`. Contrato confirmado: un campo **omitido** lanza `:TIPO`;
sólo el string vacío `''` lanza `:REQUERIDO`.

**Higiene asociada:** se renombraron locales `id`/`p` que ensombrecían las primitivas importadas
(`nuevoId`/`idArg`/`v_id`/`pend`); se retiraron tipos de payload nominales que quedaron muertos al
pasar los handlers a `unknown` (`ReglaPrecioUpsertPayload`, `TransportistaUpsertPayload`, y los 4 de
producto-proveedor). Se agregaron al catálogo `errores.ts` los códigos de dominio que pasaban a
mostrarse vía `useCallIpc` (presentaciones: `GTIN_DUPLICADO`/`NO_DESACTIVAR_DEFAULT`/
`NO_ELIMINAR_DEFAULT`/`INACTIVO`; caja: `CAJA_NOT_FOUND`/`CAJA_CERRADA`/
`DIFERENCIA_REQUIERE_AUTORIZACION`).

### B. Ruteo por-campo en `CajaCierreView` (el nudo que ADR-082 difirió)

Dos superficies de error, cada mensaje en su lugar:
- **Validación de cliente antes de abrir el modal:** monto inválido enfoca `#monto-declarado` y no
  abre `SupervisorAuthModal` ni llama a `cerrar`.
- **Superficie propia en la vista:** `errorMonto` (inline) + `errorCierre` (banner `role="alert"`).
  El camino sin autorización pasa por `useCallIpc` + `rutearCampoError`: `monto_contado` → inline,
  el resto (p. ej. `CAJA_CERRADA`) → banner.
- **Discriminador credencial-vs-dominio:** vive en `handleAuthConfirm` de la vista (primer punto
  que ve el rechazo). `SUPERVISOR_INVALIDO` se re-lanza para que `SupervisorAuthModal` (sin cambios)
  lo muestre adentro; cualquier otro error cierra el modal y se rutea a la vista, con el mismo toast
  que el camino sin auth (feedback unificado).

### C. Mapa de nombres amigables de permisos

`ETIQUETA_PERMISO: Record<string,string>` + `etiquetaPermiso(codigo)` (fallback al código, guard
`Object.hasOwn`) en `packages/shared/src/permisos.ts`, con las 29 etiquetas estilo opción de menú.
La fuente de códigos sigue siendo `PERMISOS` en `src/main/auth/seed.ts` (ahora exportado). Un
**test de cobertura** en el cliente afirma que el mapa cubre exactamente esos códigos (falla si se
agrega un permiso sin etiqueta). **Groundwork:** hoy sin consumidor de UI; lo usará el futuro ADR
de permisos. No se creó pantalla ni ruta (se evitó el anti-patrón del componente huérfano).

## Consecuencias

- Defensa en profundidad: ningún handler de escritura de los 12 dominios confía en el payload sin
  type-check; un payload malformado se rechaza en el borde con mensaje claro y por-campo.
- El cierre de caja muestra el error correcto en el lugar correcto (inline/banner/modal).
- Verde en ambos runners: **main 1549** (135 archivos), **renderer 912** (140 archivos), `tsc`
  limpio, build de `shared` OK. Sin migraciones (este ADR no toca esquema).

## Fuera de alcance — asentado para próxima iteración

1. **SEC-2 Tanda 3 (validación-only infra):** smtp, backup/restore, parámetros, importaciones
   (costo/catálogo/importar). **El catálogo de errores de ADR-082 ya traduce sus códigos.**
2. **Agenda** (detrás de `agenda_habilitado`, sin código de permiso definido — ADR-047 pendiente),
   geo (solo lectura), dashboards/export/print/dialog/actualizacion (lectura o infra sin payload de
   usuario).
3. **Formularios de `upsert`/`asociar` de producto-proveedor no cableados a capa C/D** en
   `OcSugeridaView` y `ProveedorAgregarProductosModal` (la validación del backend igual los
   protege; sólo falta el ruteo de campo en esas superficies).
4. **PERF-3** (editor de permisos por rol desde la UI): **decisión de producto abierta**, diferida
   a un ADR dedicado. Insumos ya producidos: `docs/perf3-permisos-analisis.md` (opciones A/B/C, la
   trampa del `runSeed` aditivo, guardas) y `docs/perf3-permisos-mockup-opcion-B.html`.

## Verificación manual pendiente (CLAUDE.md §12)

No se puede automatizar (app Electron). Abrir `pnpm dev` (Operador + Supervisor) y, navegando como
el usuario: emitir presupuesto/remito/OC con un campo inválido → foco + mensaje; con datos válidos
→ toast; cierre de caja con monto inválido → no abre modal, enfoca el campo; diferencia > umbral →
modal, credencial mala → error en el modal, autorizar OK → "Caja cerrada"; un cobro de cuenta
corriente / costo de proveedor / regla de precio inválidos → mensaje por-campo.
