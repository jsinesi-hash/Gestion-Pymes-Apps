-- ADR-061/078 — Encender de fábrica los flags que faltaban.
-- busqueda_similares / sinonimos / sustitutos estaban sembrados en 'false' (0036/0037/0041).
-- Se flipan a 'true' para que las features vengan encendidas. Sus filas ya existen, así que
-- un UPDATE alcanza. Aditiva y retrocompatible: sólo toca datos de parametros_sistema.
UPDATE `parametros_sistema` SET `valor` = 'true'
WHERE `clave` IN (
  'busqueda_similares_habilitado',
  'sinonimos_habilitado',
  'sustitutos_habilitado'
);
