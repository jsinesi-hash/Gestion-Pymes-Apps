# DECISIONES.md — Decisiones de diseño y arquitectura

> Complementa CLAUDE.md. Registra decisiones de diseño UI/UX, routing y otras elecciones
> que no alcanzan el nivel de ADR pero que deben ser trazables.

---

## D-001 — Ubicación de `/stock/reabastecimiento`

**Estado:** Cerrada · **Fase:** P1.10 · **Fecha:** 2026-06-12

**Decisión:** El reporte de reposición vive en una ruta propia `/stock/reabastecimiento`,
con ítem de nav visible únicamente para Supervisor (guard `dashboard.ver`).

**Razón:** Es un flujo accionable (antesala de órdenes de compra en R3), no una vista
alternativa de existencias — por eso no va como tab de `/stock`. La ruta propia le da
URL directa, espacio completo y separación clara lectura vs. operación.

**Acceso rápido:** El stat card "Bajo mínimo" de `StockListado` enlaza a esta ruta;
el card es visible para ambos roles pero el destino requiere Supervisor.

**Revisión pendiente (R3):** Al definir el módulo de Compras/OC revisar si esta ruta
se mueve a una sección "Compras" del nav en lugar de "Catálogo".

---

## D-002 — Alineación de tooling a Node 22 (Electron 32)

**Estado:** Cerrada · **Fecha:** 2026-06-17

**Contexto:** Electron 32.3.3 embebe Node 20.18.1. El sistema tenía Node 24.15.0 pineado
en `.nvmrc`, y pnpm 11 (versión en uso: 11.5.0) requiere Node >=22.13.0; esto generaba
incompatibilidad de tooling. Adicionalmente, la ABI de Electron (128) difiere de la ABI
de Node puro en cualquier versión (Node 20 → 115, Node 22 → 127, Node 24 → 137), por lo
que el `rebuild:electron` es siempre necesario independientemente del Node del sistema.

**Decisión:** Pinear el tooling a **Node 22** (versión instalada: 22.22.3) mediante
`.nvmrc` y la clave `engines` del `package.json` raíz (`"node": ">=22.13.0 <23"`). Es la
línea mínima compatible con pnpm 11. El binario de Electron no se toca; solo cambia el
Node del sistema usado para compilar y testear.

El rebuild de módulos nativos contra los headers de Electron sigue siendo necesario porque
la ABI de Electron difiere de la de Node puro. Se mantienen los scripts `rebuild:electron`
y `rebuild:node` en `packages/client/package.json` y se agrega `pnpm rebuild` en la raíz
como atajo de `rebuild:electron`.

**Conflicto .npmrc / pnpm-workspace.yaml:** `.npmrc` contenía `onlyBuiltDependencies[]=esbuild`
que solo autorizaba el build script de esbuild, bloqueando implícitamente a
`better-sqlite3`, `electron`, `@electron/node-gyp` y `@electron/rebuild`. Se eliminó esa
línea. **`pnpm-workspace.yaml` es la única fuente de verdad** para permisos de build
(`onlyBuiltDependencies` y `allowBuilds`). `.npmrc` solo gestiona el linker
(`node-linker=hoisted`).

**Consecuencias:**
- Build determinístico: tooling y runtime comparten la misma línea de Node.
- Tras `pnpm install` correr `pnpm rebuild` (o `pnpm --filter ferreteria-client rebuild:electron`) para recompilar `better-sqlite3` contra Electron.
- Al subir versión de Electron: verificar el Node embebido (`electron --version` + changelog), actualizar `.nvmrc` y `engines` si cambia la línea mayor, y correr `pnpm rebuild`.

---

## ADR-EXP-01 — Arquitectura del módulo de exportación

**Estado:** Cerrada · **Fase:** P1.11-Export · **Fecha:** 2026-06-18

**Contexto:** El sistema necesita exportar datos (productos, stock, ubicaciones, proveedores,
clientes, ventas, caja) en CSV y XLSX, con perfiles distintos por entidad (p.ej. productos
tiene perfil "reimportable" y "control de stock") y control de acceso por permiso.

**Decisión:** Tres capas limpias:
1. **`@ferreteria/shared/export/`** — tipos (`DefinicionExport`, `PerfilExport`,
   `ColumnaExport`), helpers de formato (`ars`, `fecha`, etc.) y descriptores por entidad.
   Vive en `shared` para que el renderer pueda renderizar la UI sin depender del main process.
2. **`packages/client/src/main/export/`** — escritores puros (`buildCsv`, `buildXlsx`),
   sin IPC ni Electron. Testeables en Node puro.
3. **`packages/client/src/main/ipc/exportar.ts`** — función `exportarEjecutar` (testeable,
   recibe `filePath`) + handler IPC que llama a `dialog.showSaveDialog` y delega a la función.

**Razón:** Separar la lógica de negocio (qué columnas exportar, cómo formatear) de la
infraestructura (cómo escribir el archivo, cómo abrir el diálogo) facilita las pruebas y
permite evolucionar los formatos sin tocar el IPC.

---

## ADR-EXP-02 — Permisos de exportación: dos niveles

**Estado:** Cerrada · **Fase:** P1.11-Export · **Fecha:** 2026-06-18

**Decisión:** Dos permisos: `export.basico` (Operador y Supervisor) y `export.supervisor`
(solo Supervisor). Cada `DefinicionExport` declara su permiso de acceso mínimo al botón;
cada `PerfilExport` dentro declara el permiso mínimo para ser visible en el dropdown.

**Razón:** Permite que el Operador acceda a exportaciones operativas (stock, ubicaciones) sin
ver reportes sensibles (arqueosde caja completos, margen de ventas). Los perfiles sensibles
dentro de un descriptor visible también pueden ser restringidos individualmente.

---

## ADR-EXP-03 — CSV con BOM UTF-8 y separador `;`

**Estado:** Cerrada · **Fase:** P1.11-Export · **Fecha:** 2026-06-18

**Decisión:** Los archivos CSV llevan BOM UTF-8 (`﻿`) y usan `;` como separador. CRLF
como salto de línea. Celdas con `;`, `"` o saltos de línea se escapan con comillas RFC 4180.

**Razón:** Excel en Windows detecta el BOM y abre el archivo con codificación correcta (sin
asistente de importación). El separador `;` es el estándar regional para locales `es-AR`
donde la coma decimal colisiona con el separador de columnas de Excel con locale inglés.
Los CSVs reimportables deben poder abrirse directamente con doble clic.

---

## ADR-EXP-04 — XLSX con ExcelJS; `formatoXlsx` para celdas numéricas

**Estado:** Cerrada · **Fase:** P1.11-Export · **Fecha:** 2026-06-18

**Decisión:** Se usa `exceljs` (ya en el proyecto para importación) para generar XLSX.
El tipo `ColumnaExport<T>` tiene dos callbacks opcionales: `formato` (devuelve `string`,
usado en CSV y como fallback en XLSX) y `formatoXlsx` (devuelve `string|number|Date`,
preferido en XLSX para que las celdas queden como número o fecha nativos, no como texto).

**Razón:** En CSV todo es texto. En XLSX, columnas de precio o cantidad deben ser numéricas
para que Excel permita fórmulas y ordenamiento numérico. Sin `formatoXlsx`, el precio
formateado como `"$ 1.234,56"` quedaría como texto en la celda. El perfil "reimportable"
usa solo `formato` (strings puros) para máxima compatibilidad con el importador.

**Consecuencia:** El perfil `reimportable` de productos tiene `soloFormatos: ['csv']` para
evitar que el usuario exporte XLSX pensando que es reimportable cuando en realidad el
importador solo acepta CSV con encabezados exactos.

---

## ADR-082 — SEC-2: validación de payloads a mano + mensajes al usuario

**Estado:** Cerrada · **Fase:** Fase 3 (ítem 3) · **Fecha:** 2026-09-10

**Decisión:** La validación runtime de los payloads en el borde de los handlers de escritura
se hace **a mano** con primitivas puras en `main/validation/core.ts` (`str`, `id`, `centavos`,
`oneOf`, `arr`, …), **sin `zod`**. El contrato de error es un string `VALIDATION:<campo>:
<detalle>` que el renderer traduce (junto con ~64 códigos de dominio ya existentes) en
`lib/errores.ts`. Alcance de esta iteración = infraestructura + **tranche prioritario**
(catálogos, producto, cliente, proveedor, stock/caja, venta, precios).

**Razón:** Con payloads chatos, los validadores a mano son 3-5 líneas por handler y evitan
sumar una dependencia al proceso main; el mensaje en español se controla y se enchufa al
traductor de Fase 1. Regla adoptada: **no introducir requeridos nuevos** más allá de lo que el
handler ya exigía (se evitó una regresión con `numero_documento`, opcional en el form).

**Consecuencia — pendiente para próxima iteración (no cerrado):**
- Validación (A), inline por-campo (C) y confirmación de éxito (D) en los **dominios no
  prioritarios**: agenda, remitos, presupuestos, órdenes de compra, recepción, importaciones,
  sinónimos, equivalencias, transportista, SMTP, backup, geo, reglas/cambios de precio,
  producto-proveedor. El **catálogo de errores (B) ya los cubre** desde ya.
- Ruteo backend→campo en **`CajaCierreView`** (requiere primero una superficie de error por su
  flujo de re-throw hacia `SupervisorAuthModal`).
- **PERF-3** (Fase 3, ítem 5): editor de permisos por rol desde la UI. **Decisión de producto
  abierta** — opciones A (solo lectura de la matriz RBAC), B (edición acotada con guardas),
  C (no hacerlo). No cerrar sin confirmación.
- Deep-link `AccionError` "abrir el registro existente" desde el error de duplicado (el tipo
  ya existe en `errores.ts`, sin cablear).
