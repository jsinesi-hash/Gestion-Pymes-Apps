# ADR-076 (propuesto) — Política de retención y depuración de backups

> **Brief de diseño / spec.** Surge de brainstorming (2026-09-04). Comportamiento
> aditivo, sin ARCA ni nube. Toca el módulo Backup & Restore (ADR-021/022/023, ya
> implementado). Permiso involucrado: `backup.crear` (sólo Supervisor).

---

## 1. Contexto / problema

La app genera backups automáticos en dos momentos y **ninguna carpeta se depura de
forma sana**:

1. **Backup pre-migración al arrancar** — [`startup.ts:23-44`](../packages/client/src/main/startup.ts).
   Se genera sólo cuando `hasPendingMigrations()` es `true` (en desarrollo es casi
   siempre; en producción, en cada actualización de la app). Va a
   `userData/backups/pre-migration/` y **nunca** se llama a `rotarBackups` sobre esa
   carpeta → **crece sin techo**.
2. **Backup al cerrar caja** — `triggerAutoBackup` en
   [`ipc/backup.ts:68`](../packages/client/src/main/ipc/backup.ts). Va a
   `backup_destino_local` y **sí** se rota, pero la política es **sólo por antigüedad**
   (`backup_retencion_dias`, default 30) en
   [`engine.ts:216`](../packages/client/src/main/backup/engine.ts).

Cada `.fbk` es una copia completa de la base, así que el peso crece con la DB. La
retención "sólo por días" no tiene tope de cantidad ni de tamaño, borra por edad aunque
deje cero backups, y no toca la carpeta pre-migración.

**Riesgos a mediano plazo:** consumo excesivo de disco, backups pre-migración
acumulados indefinidamente, y (a futuro, con DB grande) demoras.

## 2. Objetivo

Reemplazar la rotación silenciosa por días por una **política de retención unificada**
que cubra cantidad + edad + tamaño, aplicada a **todas** las carpetas de backup, en la
que **nada se borra automáticamente**: el sistema calcula candidatos y el **Supervisor
confirma** antes de eliminar.

## 3. Decisiones

| # | Decisión |
|---|----------|
| D1 | Modelo de retención **híbrido con piso**: protege por *(últimos N)* ∪ *(más nuevo que X días)* ∪ *(manual)*, con un **piso** mínimo absoluto por carpeta y un **tope de tamaño** opcional por carpeta. |
| D2 | **Consulta diferida**: nada se borra solo. Se calculan candidatos y el Supervisor confirma. |
| D3 | El aviso/consulta es **exclusivo del Supervisor** (permiso `backup.crear`). |
| D4 | Los backups **manuales están siempre protegidos** — nunca son candidatos de la política automática. |
| D5 | Presentación: **modal una vez al abrir** (si hay candidatos y hay sesión Supervisor) + **banner permanente** en Configuración → Backups. "Ahora no" pospone **por sesión** (flag en memoria; se resetea al reiniciar). |
| D6 | Defaults: `N = 10`, `piso = 3` por carpeta, **tope de tamaño desactivado** (`0`). `backup_retencion_dias` sigue en 30. |

**Fuera de alcance:** reducir *cuántos* backups se **crean** (frecuencia de creación,
distinto de retención). No se toca el gate `hasPendingMigrations()` ni el hook de cierre
de caja.

## 4. Diseño

### 4.1 Modelo de retención — función pura

Nueva función en [`engine.ts`](../packages/client/src/main/backup/engine.ts), sin
efectos secundarios, totalmente testeable:

```ts
export interface PoliticaRetencion {
  cantidad: number;    // N: últimos N 'auto' protegidos
  dias: number;        // X: 'auto' más nuevos que X días protegidos
  piso: number;        // mínimo absoluto de 'auto' por carpeta
  sizeMb: number;      // tope de tamaño por carpeta; 0 = desactivado
}

export interface ResumenDepuracion {
  candidatos: BackupListItem[];   // a proponer para borrar
  protegidos: BackupListItem[];
  bytesALiberar: number;
  porCarpeta: Record<string, { candidatos: number; bytes: number }>;
}

export function calcularCandidatosDepuracion(
  backups: BackupListItem[],   // de una o varias carpetas; cada item trae `ruta` y carpeta derivable
  politica: PoliticaRetencion,
): ResumenDepuracion;
```

**Algoritmo, por carpeta** (backups ordenados de nuevo → viejo):

1. Separar `manual` (siempre protegido, se ignora para candidatos) de `auto`.
2. Sobre los `auto`, `protegido` = está en los **últimos N** ∪ es **más nuevo que X
   días** ∪ está en los **primeros `piso`** (piso absoluto, gana siempre).
3. `candidatos` = `auto` que no quedaron protegidos.
4. **Tope de tamaño** (si `sizeMb > 0`): si el tamaño total de la carpeta (protegidos +
   manuales + lo que sobrevive) sigue por encima del tope, agregar como candidatos los
   `auto` **protegidos más viejos**, uno a uno, **sin bajar del `piso`** y **sin tocar
   manuales**, hasta quedar bajo el tope (o hasta no poder más).
5. Agregar los resultados de todas las carpetas en `ResumenDepuracion`.

La carpeta de cada backup se deriva de `path.dirname(ruta)`.

### 4.2 Alcance: dos carpetas, misma política

Carpetas evaluadas (misma `PoliticaRetencion`, **piso por-carpeta** para que ninguna
quede vacía):

- `userData/backups/pre-migration/`
- `backup_destino_local` (si está configurado y existe)

El `listarBackups` existente ya lee manifest, tamaño, tipo y fecha por archivo; se
reutiliza para poblar la entrada de cada carpeta.

### 4.3 IPC — nada se borra solo

Se **quitan** las llamadas automáticas a `rotarBackups` de `backupEjecutarHandler` y
`triggerAutoBackup`. `rotarBackups` queda obsoleta y se elimina (o se mantiene sólo si
algún test la referencia; preferido: eliminar y migrar sus tests).

Nuevos handlers en [`ipc/backup.ts`](../packages/client/src/main/ipc/backup.ts):

- **`backup:evaluarDepuracion`** → `ResumenDepuracion`.
  - Requiere permiso `backup.crear`.
  - Lee política de `parametros_sistema`, lista las carpetas conocidas, llama a
    `calcularCandidatosDepuracion`.
- **`backup:depurar`** (payload: `{ rutas: string[] }`) → `{ eliminados: number; bytesLiberados: number }`.
  - Requiere permiso `backup.crear`.
  - **Re-valida server-side cada ruta**: termina en `.fbk`; está bajo una carpeta de
    backup conocida (pre-migration o `backup_destino_local`); su manifest dice
    `tipo === 'auto'`. Cualquier ruta que no cumpla se ignora (no se borra) y se
    reporta. Así un `manual` jamás se elimina, incluso ante un bug de UI.
  - Borra las rutas válidas, acumula bytes liberados.

### 4.4 Presentación (renderer)

- **Al abrir la app**, con sesión Supervisor establecida: llamar
  `backup:evaluarDepuracion`; si `candidatos.length > 0` y no está el flag de "posponer
  por sesión", mostrar `DepuracionBackupsModal`.
  - Punto de montaje: efecto de arranque en el shell autenticado (ver §5, verificar
    contra el árbol real — probable `AppShell.tsx`). Corre **una vez por sesión**.
  - Botones: **"Depurar ahora"** (llama `backup:depurar` con las rutas candidatas y
    muestra el resultado) · **"Ahora no"** (setea flag en memoria de sesión; no vuelve a
    aparecer hasta el próximo arranque).
- **Banner permanente** en Configuración → Backups
  ([`ConfigBackupRestore.tsx`](../packages/client/src/renderer/views/config/ConfigBackupRestore.tsx)):
  "N backups depurables · X MB · Depurar" cuando hay candidatos. Abre el mismo modal.
- El modal **lista qué se borraría** (carpeta, fecha, tamaño, tipo) antes de confirmar.

El flag "posponer por sesión" es estado **en memoria** del renderer (context/ref o
módulo), no persiste; se resetea al reiniciar la app. No se agrega tabla ni parámetro
para esto.

### 4.5 Parámetros nuevos

Migración **aditiva** siguiendo el patrón de `0006_backup.sql` (INSERT en
`parametros_sistema`; idempotente / `INSERT OR IGNORE`):

| Clave | Tipo | Default | Qué hace |
|-------|------|:------:|----------|
| `backup_retencion_cantidad` | number | `10` | últimos N `auto` protegidos por carpeta |
| `backup_retencion_piso` | number | `3` | mínimo absoluto de `auto` por carpeta |
| `backup_retencion_size_mb` | number | `0` | tope de tamaño por carpeta; `0` = desactivado |
| `backup_retencion_dias` | number | `30` | *(ya existe)* protege por edad |

Todos editables desde Configuración → Backups (agregar campos en
`ConfigBackupRestore.tsx`). Lectura robusta con default si el valor es inválido (patrón
de `leerRetencionDias`).

## 5. Puntos de integración a verificar antes de codear

- **Montaje del efecto de arranque**: confirmar cuál es el componente montado tras el
  login (probable `views/shell/AppShell.tsx`) — no `ConfigShell.tsx` (código muerto,
  ver CLAUDE.md §Navegación). Un efecto puesto en el lugar equivocado pasa tests y no se
  ejecuta.
- **Preload**: exponer los dos IPC nuevos bajo `window.ferreteria.backup.*` en
  `src/preload/index.ts`.
- **Hook renderer**: extender el hook de backup existente (o crear
  `useDepuracionBackups`) para `evaluarDepuracion` / `depurar`.
- **`sucursalId` / `appVersion`**: no aplican a evaluar/depurar (no crean backup), pero
  confirmar que el resumen no necesita datos que sólo tiene `index.ts`.

## 6. Estrategia de tests (TDD)

Todo lo de `main/backup` corre bajo `scripts/test-node.cjs` (Electron, NMV 128).

1. **`calcularCandidatosDepuracion`** (unitarios, sin DB):
   - Unión de reglas: un backup protegido por días pero fuera de los últimos N sigue
     protegido, y viceversa.
   - **Piso**: con N y días agresivos, nunca baja de `piso` por carpeta.
   - **Manuales**: nunca son candidatos, aunque sean viejos y excedan N.
   - **Tope de tamaño**: con `sizeMb > 0` agrega los `auto` protegidos más viejos sin
     violar el piso; con `sizeMb = 0` no aplica.
   - **Dos carpetas**: piso e independencia por carpeta; agregación correcta de totales.
2. **`backup:depurar`** (con DB de test + sesión):
   - Ignora rutas que no terminan en `.fbk`, fuera de carpetas conocidas, o de manifest
     `manual`; borra sólo las `auto` válidas; cuenta bytes.
   - Sin permiso `backup.crear` → `FORBIDDEN`.
3. **`backup:evaluarDepuracion`**: permiso; resumen coherente con archivos en disco
   (usar tmpdir con `.fbk` de prueba).
4. **Regresión**: `backupEjecutarHandler` y `triggerAutoBackup` ya **no** borran nada
   (verificar que no llaman a rotación).

## 7. Riesgos y mitigaciones

- **Borrar de más**: mitigado por confirmación del Supervisor + re-validación
  server-side (`tipo auto`, carpeta conocida) + piso por carpeta.
- **Efecto huérfano** (modal que nunca se muestra): mitigado verificando el punto de
  montaje real y cerrando con `pnpm dev` navegando como Supervisor.
- **Parámetros inválidos**: lectura con default de seguridad.
