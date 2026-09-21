# ADR-088 — Contraste en modo Oscuro y tokens de color semánticos

**Estado:** Aceptado
**Fecha:** 2026-09-17

## Contexto

En modo Oscuro había texto ilegible en varias "cajas de mensaje" (p. ej. el recuadro
"Se van a actualizar N productos" de `RecalcularModal`) y en resaltados de listados. La
causa raíz: varios componentes usan `var(--color-*, <fallback>)` (por ejemplo
`var(--color-info-bg, #dbeafe)`, `var(--color-danger-bg, #fee2e2)`,
`var(--color-warning-bg, #fef3c7)`), pero esos tokens **nunca estaban definidos** →
siempre caían al **fallback claro**. Con fondo claro fijo y texto `--ink` (que en Oscuro
es claro), el texto quedaba invisible. Además el resaltado de búsqueda usa `<mark>` **sin
estilo propio** → tomaba el default del navegador, ilegible en Oscuro; y `--accent-soft`
no tenía variante Oscuro (quedaba un chip claro), afectando el nav activo y el hover de
fila del modo Maximizar (ADR-086).

## Decisión

Definir los tokens semánticos en `global.css` para **ambos temas**, de modo que todo uso
de `var(--color-*)` sea theme-aware **sin editar cada componente**:

- `--color-success` / `--color-warning` / `--color-danger` / `--color-info` (texto)
- `--color-success-bg` / `--color-warning-bg` / `--color-danger-bg` / `--color-info-bg`
  (fondos suaves)
- `--color-warning-text` / `--color-info-text` (texto sobre esos fondos)
- `--info` (color base, usado como borde de `.alert-info`)

En Oscuro los `*-bg` son **veladuras translúcidas** sobre superficie oscura (no chips
claros). Además:

- `.alert-warn` (estaba hardcodeada `#fff3cd`/`#856404`) pasa a usar tokens; se agregan
  `.alert-ok` y `.alert-info` (esta última faltaba y `.alert-ok` se referenciaba sin
  existir).
- `<mark>` y `::selection` reciben estilo theme-aware.
- `--accent-soft` gana una variante Oscuro (`color-mix` del acento) vía
  `:root[data-theme="oscuro"]` (mayor especificidad que los bloques `[data-accent]`), lo
  que arregla el nav activo y el hover de fila de Maximizar.

## Detalle crítico de implementación

Los `--color-*` se definen con **valores literales por tema**, NO como
`--color-x: var(--otro-token)`. Un alias `--a: var(--b)` declarado en `:root` resuelve
`--b` en el scope de `:root` (claro) y **hereda el valor ya resuelto**: el override de
`--b` en el bloque `[data-theme="oscuro"]` no fluye. Con literales, el bloque Oscuro gana
por cascada normal en el punto de uso. (Verificado por computed styles: con la versión con
indirección, `--info-soft` valía la veladura oscura pero `--color-info-bg` computaba
`#DBEAFE`.)

## Consecuencias

- Todos los usos existentes de `var(--color-*, fallback)` quedan legibles en Oscuro sin
  tocar componentes.
- Los fallbacks hardcodeados en los componentes quedan como red de seguridad (ya nunca se
  usan); pueden limpiarse en un follow-up.
- Verificado visualmente con un harness (no se pudo abrir Electron GUI en la sesión); la
  confirmación final en la app corriendo queda del lado del usuario.

## Fuera de este ADR

- La captura del listado de **Importar Costos** (`ImportarCostosView`) corresponde a trabajo
  en curso de otra sesión (rama `feat/adr087-...` con cambios sin commitear en esos
  archivos); en `origin/main` esas filas usan tokens de tema. Revisar tras rebuild.
- Ampliar la variedad de **tipografías** (pedido aparte) queda pendiente de definición.
