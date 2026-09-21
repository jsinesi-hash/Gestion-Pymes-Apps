-- ADR-089 — Tipografías bundleadas localmente + nuevo set seleccionable.
-- El set de fuentes de la UI pasa a: Hanken Grotesk, Inter, IBM Plex Sans,
-- Atkinson Hyperlegible, Nunito, Barlow Semi Condensed (se retiran Figtree y Onest, que
-- además nunca se cargaban en el index.html). Remapear cualquier valor fuera del nuevo set
-- (Figtree/Onest/Archivo/Spline Sans/etc.) al default 'Hanken Grotesk'. Aditiva y
-- retrocompatible: `ui_font` es TEXT (el enum sólo vive en la capa TS), así que esto es un
-- UPDATE de datos, sin cambio de esquema.
UPDATE `usuario_preferencias`
SET `ui_font` = 'Hanken Grotesk'
WHERE `ui_font` NOT IN (
  'Hanken Grotesk', 'Inter', 'IBM Plex Sans', 'Atkinson Hyperlegible', 'Nunito', 'Barlow Semi Condensed'
);
