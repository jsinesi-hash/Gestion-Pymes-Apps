-- F3 PR4 (ADR-155 §3 y §4) — El único turno de caja compartida abierto del negocio. Una sola fila: abrir y
-- cerrar un turno compartido pasa por el hub para que no haya dos abiertos ni dos cierres a la vez.
CREATE TABLE `hub_caja_compartida` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `caja_id` text NOT NULL,
  `origin_id` text NOT NULL,
  `abierta_en_ms` integer NOT NULL
);
