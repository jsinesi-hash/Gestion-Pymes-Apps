# ADR-086 — Modos de la app (skin)

**Estado:** Aceptado
**Fecha:** 2026-09-14

## Contexto

El panel de Apariencia ofrecía Tema (claro/oscuro), Acento, Tipografía y Densidad
(comfortable/compact). El cambio de tipografía casi no se percibía (sólo cambia
`--ui-font`; tamaños, espaciados y formas quedaban iguales) y la Densidad daba una
diferencia estética menor. Se pidió que la app ofreciera "Modos" que produzcan una
diferencia estética real, manteniendo Claro/Oscuro (que sí tiene gran impacto).

Además, el control de selección de apariencia tenía un bug: al cambiar Tema/Fuente/
Densidad el DOM cambiaba pero el botón no quedaba seleccionado. Causa: `AppearanceDrawer`
reenviaba la fila completa de preferencias a `preferencias:save`, incluyendo `favoritos`
como string JSON; el handler corría `normalizarFavoritos()` sobre un string, lanzaba, el
`await` rechazaba y `setPreferencias` nunca corría (mientras `applyToDOM` ya había
aplicado el cambio). Se corrigió enviando sólo los campos de apariencia.

## Decisión

Se agrega un eje **Modo** (`skin`) con tres valores: `actual` (baseline), `maximizar`
(denso, plano, orientado a datos) y `confortable` (espacioso, moderno, redondeado).

Principio: **el Tema manda el color; el Modo, la geometría** (espaciado, radios, sombra,
ancho de sidebar, tratamiento de nav y tabla). Esto evita la explosión combinatoria de
paletas y mantiene los dos ejes ortogonales y componibles.

El Modo **reemplaza** al control de Densidad en la UI (Opción A). El panel queda:
**Tema · Modo · Acento · Tipografía**. La columna `densidad` se conserva (aditividad, no
se dropea) pero pasa a **derivarse** del modo al aplicar al DOM
(`maximizar`→`compact`, resto→`comfortable`). La tipografía sigue siendo un control
independiente (no la fuerza el modo).

## Implementación

- **Esquema/migración:** columna `skin` en `usuario_preferencias`
  (`text notNull default 'actual'`), migración `0048_adr086_skin_modo.sql` (aditiva y
  retrocompatible; default `actual` = cero cambio visual para usuarios existentes).
- **Tipos + handlers:** `SessionData.preferencias.skin` (renderer y main),
  `DEFAULT_PREFS`, `SavePreferenciasPayload`, `DEFAULTS`, merge y `setSessionData` del
  handler de preferencias, y el armado de preferencias en `loginHandler`.
- **Aplicación al DOM:** `AuthContext.applyPreferences` (arranque/login) y
  `AppearanceDrawer.applyToDOM` (cambio en caliente) setean `data-skin` y derivan
  `data-density` desde el modo (`densidadDeSkin`).
- **UI:** el drawer muestra Modo (3 tarjetas) en lugar de Densidad; `handleChange` envía
  sólo `{ tema, acento, ui_font, skin }` (arregla el bug del botón).
- **CSS:** bloques `[data-skin="maximizar"]` y `[data-skin="confortable"]` al final de
  `global.css`; `actual` = base sin overrides. Sólo geometría (la tipografía la gobierna
  su propio control). El bloque `[data-density="compact"]` preexistente refuerza a
  `maximizar` sin conflicto (mayor orden de fuente gana).

## Consecuencias

- Usuarios existentes: `skin = 'actual'` por default → su densidad previa (columna
  `densidad`) deja de aplicarse al DOM; si tenían `compact`, deben elegir "Maximizar".
  Se consideró aceptable por ser el comportamiento buscado (el Modo reemplaza a Densidad).
- La columna `densidad` queda como espejo derivado; no se ofrece más como control directo.
- El cambio de tamaño de fuente por modo es parcial: muchos componentes fijan `font-size`
  en px; la diferencia dominante entre modos es espaciado/forma/sombra/sidebar/tabla, no
  el cuerpo del texto.
