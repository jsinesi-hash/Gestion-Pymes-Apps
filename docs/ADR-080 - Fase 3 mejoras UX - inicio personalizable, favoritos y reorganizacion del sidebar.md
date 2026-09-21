# ADR-080 — Fase 3 mejoras UX: inicio personalizable, favoritos y reorganización del sidebar

**Estado:** Aceptado — implementado · **Fecha:** 2026-09-08

Primer lote de la **Fase 3** de la auditoría de UX (personalización y pulido; continúa
ADR-077/078/079). Unifica dos ítems del backlog:

- **PERF-1** — pantalla de inicio configurable por usuario + favoritos de navegación.
- **NAV-3** — aligerar el sidebar separando la operatoria de lo propio del sistema y
  llevando las importaciones al hub de Precios.

Los ítems restantes de la Fase 3 (SEC-2 validación de payloads, SRCH-2/3 SearchBox
unificado, PERF-2 vistos recientemente, PERF-3 editor de permisos, BUG-2/PRICE-4 higiene)
**quedan fuera de este ADR**, cada uno con su propio ADR/sesión. La pared de corte es
SEC-2: validar todos los handlers de escritura es un esfuerzo cross-cutting que no debe ir
apurado junto a trabajo de UI.

---

## 1. Contexto

- La ruta raíz redirige fijo a `/productos` para todos
  (`{ index: true, element: <Navigate to="/productos" replace /> }` en
  `renderer/routes/index.tsx`). No hay forma de que un operador arranque en el POS ni un
  supervisor en el Dashboard sin navegar a mano cada vez.
- La única personalización por usuario vive en `usuario_preferencias`
  (tema/acento/fuente/densidad — ADR de apariencia). No hay favoritos ni inicio.
- El sidebar (`renderer/views/shell/AppShell.tsx`) tiene un grupo `configuracion` con ~13
  ítems que mezcla catálogos auxiliares operativos (Categorías, Marcas, Unidades,
  Ubicaciones, Sinónimos, Transportistas, Etiquetas) con importaciones (`Importar costos`,
  `Importar Catálogo del Proveedor`, `Revisión de Costos y Catálogo`, `Importar datos`) y
  `Listas de precios`. Con `hub_precios_habilitado` encendido (ADR-078), tres de esos
  imports y las listas ya se extraen al hub vía `PRECIOS_PATHS`, pero `Importar datos`
  (`/importar`) se queda siempre en `configuracion`.

## 2. Decisión

### 2.1 Feature flag

`inicio_personalizable_habilitado` (bool, **default `false`**), sembrado por migración en
`parametros_sistema`. Por terminar en `_habilitado` aparece automáticamente como toggle en
la pantalla de Funcionalidades (ADR-061) y lo levanta `parametros:listFlags`. Gobierna
**solo PERF-1** (inicio + favoritos). Con el flag apagado, el redirect raíz y el sidebar se
comportan exactamente como hoy.

**NAV-3 (la reorganización del sidebar) va directo, sin flag:** no tiene sentido mantener
dos layouts de sidebar conviviendo, y el cambio no altera rutas ni permisos, solo el
agrupamiento visual.

### 2.2 Modelo de datos (PERF-1)

Migración aditiva sobre `usuario_preferencias`:

- `pantalla_inicio TEXT` (nullable, default `NULL` = "usar el default por rol").
- `favoritos TEXT NOT NULL DEFAULT '[]'` — array JSON de paths de navegación
  (ej. `["/pos","/stock"]`).

Se guardan como columnas en la fila 1:1 existente (no una tabla nueva): es una lista corta
por usuario, se lee entera al login y no se consulta por elemento. Coherente con la
doctrina de `usuario_preferencias` como fila única por usuario.

### 2.3 Backend

- `preferencias.ts`: `SavePreferenciasPayload` suma `pantalla_inicio` y `favoritos`; get y
  save los incluyen. **Validación en el borde del handler** (defensa en profundidad que
  acota el espíritu de SEC-2 a esta superficie, sin traer SEC-2 entero):
  - `pantalla_inicio`: `null` o una ruta que exista en la allowlist de rutas de navegación
    conocidas; cualquier otra cosa → `Error` claro.
  - `favoritos`: array de strings, cada uno de la misma allowlist, **deduplicado**, con
    **tope de 8**; se normaliza antes de persistir. Payload inválido → `Error` (se engancha
    con el traductor de errores de Fase 1 / ADR-077).
- `auth` (`login` y `whoami`): el payload de sesión (`preferencias`) suma `pantalla_inicio`
  y `favoritos`, para que el redirect raíz y el sidebar los lean sin un IPC extra por
  render.

### 2.4 Pantalla de inicio (PERF-1)

El `<Navigate to="/productos">` de la ruta índice se reemplaza por un componente
`InicioRedirect` con esta lógica:

1. Flag **off** → `/productos` (comportamiento actual, intacto).
2. Flag **on**:
   - si `pantalla_inicio` está seteada **y** el rol tiene el permiso que gatea esa ruta →
     ir ahí;
   - si no, **default por rol**: `SUPERVISOR → /dashboard`, `OPERADOR → /pos`;
   - **fallback** a `/productos` si el rol no tiene permiso para el default (ej. un rol sin
     `dashboard.ver`).

### 2.5 Favoritos en el sidebar (PERF-1)

- Estrella inline a la derecha de cada `NavItem` con destino, visible al hover (y siempre
  visible si el ítem ya es favorito). Toggle → `preferencias.save` + refresco de la sesión
  en caliente (sin recargar).
- Grupo **"Favoritos"** fijo al tope del sidebar, renderizado **solo** si el flag está on y
  hay ≥1 favorito. Respeta permisos: un favorito cuyo permiso el rol ya no tiene no se
  muestra (mismo filtro `can()` que el resto).
- Con el flag **off**: sin estrellas y sin grupo Favoritos — sidebar idéntico a hoy.

### 2.6 Reorganización del sidebar (NAV-3)

El grupo `configuracion` se **aligera** y se mantiene la separación operatoria / sistema en
**dos grupos distintos** (no se fusionan: uno es operatoria, el otro es propio del sistema):

- **"Configuración"** (operatoria, aligerada): Etiquetas, Categorías, Marcas, Unidades,
  Ubicaciones, Sinónimos, Transportistas.
- **"Sistema"** (propio del software, sin cambios estructurales): Mi cuenta, Usuarios,
  Funcionalidades, Backup/Restore, Email/SMTP, Datos demo.

**Importaciones + Listas de precios:**

- Con `hub_precios_habilitado` **on** → viven en el hub de Precios. Se corrige que
  `Importar datos` (`/importar`), que hoy se quedaba en `configuracion`, también se
  incorpore al hub (se suma a `PRECIOS_PATHS` o al filtrado equivalente).
- Con el hub **off** → caen en el grupo **"Sistema"** como fallback (son operaciones
  `import.masiva` / administrativas), nunca quedan huérfanas.

## 3. Consecuencias

- Migración aditiva y retrocompatible; instalaciones existentes toman `pantalla_inicio =
  NULL` y `favoritos = '[]'`, con el flag apagado → cero cambio de comportamiento hasta
  prenderlo.
- Se toca el payload de sesión (`login`/`whoami`): los tests que afirman su forma se
  actualizan. No cambian permisos ni su conteo por rol.
- El sidebar reorganizado (NAV-3) sí cambia para todos de inmediato, pero sin tocar rutas
  ni permisos: es solo reagrupamiento. Se respeta la regla de navegación de CLAUDE.md
  (ruta + ítem en NAV + entrada en CRUMBS) — acá no hay pantallas nuevas, solo movimiento
  de ítems existentes, así que CRUMBS no cambia.
- La validación en el borde de `preferencias.save` establece un patrón que SEC-2 podrá
  generalizar después.

## 4. Alternativas evaluadas

- **Tabla `usuario_favorito` (N filas).** Descartada: sobre-ingeniería para una lista corta
  1:1 que se lee entera al login; el JSON en la fila existente es más simple y coherente.
- **Inicio = primer favorito.** Descartada como default: acopla dos conceptos; el default
  por rol es más predecible y no depende de que el usuario haya cargado favoritos.
- **Fusionar "Sistema" dentro de un único grupo "Administración".** Descartada por decisión
  de producto (2026-09-08): la operatoria (catálogos) y lo propio del sistema son dos ejes
  distintos y deben quedar en grupos separados.
- **NAV-3 detrás de flag.** Descartada: mantener dos layouts de sidebar conviviendo agrega
  complejidad sin beneficio; el cambio es de bajo riesgo (no toca rutas ni permisos).
- **Traer SEC-2 completo en esta tanda.** Descartada por tamaño: ~50 archivos IPC / 100+
  handlers de escritura; merece su propio ADR. Acá se valida solo el handler nuevo.

---

### Implementación (2026-09-08)

Implementado con flujo TDD en la rama `feat/adr080-inicio-favoritos-nav3`.

- **Datos:** migración `0046_adr080_inicio_favoritos.sql` — columnas `usuario_preferencias.pantalla_inicio`
  (nullable) y `.favoritos` (text NOT NULL default `'[]'`), + seed del flag
  `inicio_personalizable_habilitado = 'false'`. Schema Drizzle actualizado.
- **Shared:** `packages/shared/src/navegacion.ts` — allowlist `RUTAS_NAVEGABLES`, `esRutaNavegable`,
  `permisoDeRuta`, `resolverPantallaInicio`, `normalizarFavoritos`/`normalizarPantallaInicio`
  (validación en el borde), `MAX_FAVORITOS = 8`.
- **Main:** `preferencias:save` pasa a merge parcial con validación en el borde y refresco de la
  sesión en memoria; `login`/`whoami` transportan `pantalla_inicio`/`favoritos`.
- **Renderer:** hook `useInicioPersonalizable`; `InicioRedirect` en la ruta índice;
  `AuthContext.actualizarPreferencias`; `usePreferencias.toggleFavorito`/`guardarInicio`;
  estrella de favorito + grupo "Favoritos" en `AppShell`; selector de inicio en Mi cuenta.
- **NAV-3:** `AppShell` reescribe `buildNavGroups` — "Configuración" queda con catálogos
  operativos; "Importar datos" pasa a "Sistema"; los ítems de precios van al hub / grupo Precios
  o a "Sistema" como fallback; se eliminó `PRECIOS_PATHS` (código muerto).
- **Tests:** verdes en ambos runners — renderer 123 archivos / 793 tests, main 106 / 1232.
  `tsc --noEmit` limpio.

**Pendiente:** verificación manual en la app (`pnpm dev`) navegando como Operador y Supervisor,
con el flag `inicio_personalizable_habilitado` on y off (regla §12 de CLAUDE.md).
