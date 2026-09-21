# RUNBOOK — Release, instalación y actualización en el cliente

> App: Ferretería (Electron + React + better-sqlite3 + Drizzle). Windows 10, NSIS via
> electron-builder. Complementa al ADR-042 (branching y versiones). Generado 2026-07-16.

---

## 0. Concepto que hace que todo funcione: datos fuera del binario

La base SQLite vive en `app.getPath('userData')`
(ej. `C:\Users\<user>\AppData\Roaming\Ferreteria\ferreteria.db`), **nunca** dentro de la
carpeta de instalación. Consecuencia directa:

- Reinstalar o actualizar el `.exe` **no toca los datos** del cliente.
- El esquema se evoluciona corriendo las migraciones de Drizzle **sobre la DB existente**
  en cada arranque (idempotente).
- El instalable **no lleva ninguna DB adentro** → la primera instalación arranca limpia.

---

## 1. Primera instalación limpia (v1.0.0)

Objetivo: el día 1 el cliente arranca con **solo datos base**, sin basura de desarrollo.

### 1.1 Seed partido en dos (no negociable)
- **`seed:base`** — datos maestros imprescindibles: catálogo geográfico (ADR-024),
  `parametros_sistema` con defaults, unidades de medida base, usuario admin inicial,
  categorías/marcas mínimas si aplican. Es idempotente y **sí** se distribuye.
- **`seed:demo`** — productos y ventas de prueba. **Solo desarrollo. Nunca se compila
  ni se empaqueta.**

### 1.2 First-run guard (lógica de arranque)
1. La app detecta DB inexistente o vacía.
2. Corre migraciones de Drizzle (crea el esquema).
3. Corre `seed:base` una sola vez (guardado por un flag en `parametros_sistema`,
   ej. `sistema.seed_base_aplicado = true`).
4. Resultado: base limpia, esquema al día, cero registros de prueba.

### 1.3 Build del instalable
```bash
pnpm build
electron-builder --win nsis          # → Ferreteria-Setup-1.0.0.exe
```
- `better-sqlite3`: `asarUnpack` + `@electron/rebuild` (ABI de Electron).
- El instalable NO incluye `ferreteria.db` ni archivos `-wal`/`-shm`.

### 1.4 Verificación (obligatoria)
Probar el `.exe` en una **VM/PC limpia**, jamás en la máquina de desarrollo. Confirmar:
- Se instala y abre sin errores.
- La DB se crea en `userData` con esquema al día.
- Están los datos de `seed:base` y **nada** de `seed:demo`.
- No hay DB ni WAL de desarrollo arrastrados.

---

## 2. Instalar una mejora en el cliente

Nota offline-first: la app **opera** sin nube, pero para **actualizarse** necesita un
canal — internet ocasional (Vía 1) o un pendrive (Vía 2).

### Vía 1 — Auto-update (si la PC tiene internet aunque sea a veces)
Requiere `electron-updater` + feed de releases (GitHub Releases o bucket propio).
1. Cerrar iteración y mergear a la rama que corresponde: feature → `main` (sale 1.1.0);
   hotfix → `release/1.0.x` (sale 1.0.1). Ver ADR-042.
2. Subir versión en `package.json`.
3. `electron-builder --win nsis --publish always` → genera `.exe` + `latest.yml` +
   `.blockmap` (updates diferenciales: baja solo el delta).
4. En el cliente: la app chequea el feed, descarga en background, avisa "reiniciar para
   actualizar". Al reiniciar, NSIS aplica la nueva versión.

### Vía 2 — Manual con `.exe` (PC aislada)
1–2. Igual que arriba (merge + bump de versión).
3. `electron-builder --win nsis` → `Ferreteria-Setup-1.1.0.exe`.
4. Llevar el `.exe` al cliente y correrlo. NSIS actualiza **in-place**: reemplaza
   binarios; **los datos quedan intactos** (viven en `userData`).

### 2.1 Arranque post-update (ambas vías)
La app detecta migraciones de Drizzle pendientes y las corre sobre la DB **existente**.
Como las migraciones son **aditivas** (regla del ADR-042), el update es seguro.

---

## 3. Reglas que no se saltean

- **Backup antes de migrar.** Generar `.fbk` automático (ADR-021/022) antes de correr
  migraciones. Si una migración falla, hay punto de retorno.
- **Feature flags.** Una mejora detrás de flag llega **apagada**. Se enciende en
  `parametros_sistema` cuando se quiere, sin reinstalar. Se puede instalar 1.1.0 con la
  feature off y activarla después.
- **Firma de código.** Sin firmar, Windows dispara SmartScreen ("Windows protegió tu
  PC"). Para cliente real conviene certificado de firma; si no, avisar al cliente.
- **Correspondencia versión ↔ rama.** 1.0.x sale de `release/1.0.x`; 1.1.0 de `main`.
  El nombre del instalable lleva la versión: `Ferreteria-Setup-<version>.exe`.

---

## 4. Bloque para Superpowers — Empaquetado y distribución

> PASTE-READY. Objetivo: dejar el pipeline de build, first-run e updates. Castellano
> rioplatense. Respetar los GATES.

```
TAREA: Configurar empaquetado, primera instalación limpia y actualización del cliente.

CONTEXTO
- Electron + React + TS, monorepo pnpm (packages/client, packages/shared).
- better-sqlite3 + Drizzle. DB en app.getPath('userData'), NUNCA en la carpeta de install.
- Target: Windows 10, NSIS via electron-builder. Versión leída de package.json.

ALCANCE (implementar)
1. SEED PARTIDO
   - Script seed:base (idempotente): geo (ADR-024), parametros_sistema defaults, unidades
     base, usuario admin inicial, categorias/marcas minimas. Usar INSERT ... ON CONFLICT
     DO NOTHING o chequeo por conteo.
   - Script seed:demo: SOLO dev. NO se compila ni se referencia en el build de producción.
2. FIRST-RUN GUARD (en el arranque del proceso main)
   - Correr migraciones Drizzle (idempotente) siempre.
   - Si es primera vez (flag sistema.seed_base_aplicado ausente/false en parametros_sistema)
     → correr seed:base → setear el flag en true. Nunca correr seed:demo.
3. MIGRACIÓN EN ARRANQUE (updates)
   - Antes de aplicar migraciones pendientes: generar backup .fbk (ADR-021/022).
   - Aplicar migraciones dentro de try/catch atómico; si falla, no arrancar en estado
     inconsistente y dejar log claro apuntando al .fbk.
4. ELECTRON-BUILDER (config en package.json "build" o electron-builder.yml)
   - win.target = nsis; nsis.artifactName = "${productName}-Setup-${version}.${ext}".
   - asarUnpack incluye better-sqlite3.
   - NO incluir ninguna DB (.db/.db-wal/.db-shm) en files ni extraResources.
   - extraResources: solo la carpeta de migraciones Drizzle (si no queda dentro del asar).
   - Scripts npm: "dist" (build + electron-builder --win nsis) y "release"
     (electron-builder --win nsis --publish always).
5. AUTO-UPDATE (electron-updater)
   - Integrar autoUpdater: checkForUpdatesAndNotify al ready; manejar update-available,
     download-progress, update-downloaded → quitAndInstall tras confirmación del usuario.
   - Config publish: provider = github (GitHub Releases). Verificar que el build genere
     latest.yml y .blockmap.
   - Si no hay red, degradar silencioso (no bloquear el arranque).
6. FIRMA DE CÓDIGO: NINGUNA en esta etapa (ship unsigned). No configurar certificados.
   El aviso de SmartScreen es esperado; se documenta para el cliente. Decisión diferida
   (ADR-043).

GATES — PARÁ Y PEDÍ CONFIRMACIÓN ANTES DE:
- Instalar dependencias nuevas (electron-updater, @electron/rebuild, etc.): listalas y esperá OK.
- Generar o aplicar migraciones de esquema (mostrá drizzle-kit generate). Deben ser ADITIVAS.
- Escribir en parametros_sistema (incluye el flag seed_base_aplicado).
- Tocar cualquier módulo R1/R2/R3 ya aprobado.

CRITERIOS DE ACEPTACIÓN (verificar en VM/PC LIMPIA, no en la de desarrollo)
- El .exe instala y abre sin errores.
- DB creada en userData con esquema al día; datos de seed:base presentes; CERO seed:demo;
  sin DB/WAL de desarrollo arrastrados.
- Reinstalar/actualizar el .exe conserva los datos del cliente.
- Un update con migración pendiente: genera .fbk previo y aplica la migración sobre la DB
  existente sin pérdida.
- Nombre del artefacto: Ferreteria-Setup-<version>.exe con la versión de package.json.

ENTREGABLE: pipeline funcionando + un README-BUILD.md corto con los comandos (dist/release)
y la checklist de verificación en VM limpia.
```
