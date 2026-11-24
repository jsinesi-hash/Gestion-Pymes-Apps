import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Cola de cambios locales para subir al hub (ADR-150 §4). La llenan los triggers que genera
 * `triggersSync` (solo en modo distribuido); la vacía el push de F2. Tabla `local`: no sincroniza.
 * `fila` es la fila completa en JSON, sin las columnas proyectadas (ADR-151), tal como quedó
 * después del cambio; `seq` da el orden local en que se envían.
 */
export const sync_outbox = sqliteTable('sync_outbox', {
  seq:        integer('seq').primaryKey({ autoIncrement: true }),
  tabla:      text('tabla').notNull(),
  fila_id:    text('fila_id').notNull(),
  operacion:  text('operacion', { enum: ['insert', 'update'] }).notNull(),
  version:    integer('version').notNull(),
  fila:       text('fila').notNull(),
  fecha:      integer('fecha').notNull(), // Unix (segundos)
  enviado_en: integer('enviado_en'),      // null = pendiente de push
});

/**
 * Interruptor "aplicando cambios recibidos" (ADR-150 §6). Mientras tiene una fila, los triggers
 * no encolan: lo que baja del hub no vuelve a subir. Se llena y se vacía dentro de la misma
 * transacción que aplica la página del pull (`aplicandoCambiosRecibidos`), así que un corte a
 * mitad de camino lo deja vacío.
 */
export const sync_aplicando = sqliteTable('sync_aplicando', {
  id: integer('id').primaryKey(),
});

/**
 * Cambios recibidos del hub que esta terminal todavía no puede aplicar (F3 PR1, ADR-159): chocan con un
 * índice único (una fila local que el hub rechazó por unicidad tiene el mismo valor) o apuntan a una fila
 * que todavía espera. El pull los aparta y avanza el cursor, en vez de cortarse; se reintentan después de
 * cada pull y entran solos cuando se corrige la fila local. Tabla `local`: no sincroniza.
 */
export const sync_recibido_en_espera = sqliteTable('sync_recibido_en_espera', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  seq:         integer('seq').notNull(), // número de secuencia del hub (para no apartarlo dos veces)
  tabla:       text('tabla').notNull(),
  fila_id:     text('fila_id').notNull(),
  cambio:      text('cambio').notNull(), // el cambio registrado del hub, en JSON
  motivo:      text('motivo', { enum: ['unicidad', 'referencia'] }).notNull(),
  recibido_en: integer('recibido_en').notNull(),
});
