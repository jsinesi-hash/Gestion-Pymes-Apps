# ADR-089 — Tipografías bundleadas localmente + nuevo set seleccionable

**Estado:** Aceptado
**Fecha:** 2026-09-18

## Contexto

Las 3 tipografías que ofrecía el selector (Hanken Grotesk, Figtree, Onest) eran muy
parecidas entre sí (todas grotescas geométricas) → el cambio no tenía impacto visual.
Además, al revisar la carga se encontró que:

- La app cargaba las fuentes **desde Google Fonts** con un `<link>` en `index.html`
  (`Archivo`, `Hanken Grotesk`, `Spline Sans`, `JetBrains Mono`) — **no estaban
  bundleadas**, contradiciendo el principio offline-first (ADR-001).
- Ese `<link>` **no incluía Figtree ni Onest**, así que esas dos opciones del menú en
  realidad nunca funcionaban (caían a fuente de sistema).
- El CSP habilitaba `fonts.googleapis.com` / `fonts.gstatic.com`.

## Decisión

1. **Nuevo set de 6 tipografías** con carácter bien distinto entre sí:
   Hanken Grotesk, **Inter**, **IBM Plex Sans**, **Atkinson Hyperlegible**, **Nunito**,
   **Barlow Semi Condensed**. Se retiran Figtree y Onest.
2. **Bundle local (offline real):** los `.woff2` (subset **latin**, que cubre español —
   ñ/á/é/í/ó/ú/ü/¿/¡ están en Latin-1) se versionan en
   `src/renderer/styles/fonts/` y se declaran en `src/renderer/styles/fonts.css`
   (`@font-face`, `font-display: swap`), importado desde `index.tsx` antes de `global.css`.
   Se incluye también **JetBrains Mono** (números). Vite empaqueta los assets referenciados
   por `url()`.
3. Se elimina el `<link>` a Google Fonts del `index.html` y se **endurece el CSP**:
   `style-src 'self' 'unsafe-inline'` y `font-src 'self' data:` (sin hosts de Google).
4. El default de `--ui-font` en `global.css` pasa de `'Archivo'` (que ya no se carga) a
   `'Hanken Grotesk'`.

## Implementación

- Migración `0049_adr089_tipografias.sql`: remapea cualquier `ui_font` fuera del nuevo set
  (Figtree/Onest/Archivo/…) a `'Hanken Grotesk'`. `ui_font` es TEXT (el enum vive sólo en
  la capa TS), así que es un UPDATE de datos, retrocompatible.
- Enum `ui_font` actualizado en el schema y en los tipos (`session.ts`, `AuthContext.tsx`,
  `SavePreferenciasPayload`), y la lista del `AppearanceDrawer`.
- Test de CSP (`webSecurity.test.ts`) actualizado: ahora afirma que **no** hay hosts de
  Google y que `font-src 'self' data:`.

## Consecuencias

- La app renderiza sus tipografías **sin internet** (offline-first real para el texto).
- ~29 archivos `.woff2` (~1 MB) versionados en el repo (subset latin, pesos usados por la
  UI; Atkinson sólo trae 400/700, el resto sintetiza).
- Usuarios con Figtree/Onest guardado quedan en Hanken Grotesk tras migrar.
- Verificado: tipos OK, tests (main + renderer) verdes, y render visual de los 6 + mono
  desde los `.woff2` bundleados (acentos español incluidos). La confirmación final en la
  app corriendo queda del lado del usuario.

## Nota

`JetBrains Mono` (números) sigue siendo la fuente monoespaciada fija (no configurable),
ahora también bundleada. Se podrían sumar pesos/subsets (latin-ext) más adelante si hace
falta.
