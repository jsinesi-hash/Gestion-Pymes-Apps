import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { usuario } from './seguridad';
import { proveedor } from './personas';
import { orden_compra } from './compras';
import { producto } from './catalog';

// ADR-047 (Lote 1) — Agenda operativa y outbox de avisos. Modulo NUEVO.
// Tres capas: 1 rutina -> N agenda_evento -> N aviso.

// rutina: generador recurrente OPCIONAL (plantilla: definicion + frecuencia +
// destinatario + canales). Sincronizable (dato de usuario, campos de sync para R4).
export const rutina = sqliteTable('rutina', {
  id:              text('id').primaryKey(),
  nombre:          text('nombre').notNull(),
  descripcion:     text('descripcion'),
  // Frecuencia estructurada; se proyecta a RRULE recien en el borde (.ics, R4).
  frecuencia_tipo: text('frecuencia_tipo', {
    enum: ['unica', 'diaria', 'semanal', 'mensual', 'cada_n_dias'],
  }).notNull(),
  intervalo:       integer('intervalo').notNull().default(1),
  dia_semana:      integer('dia_semana'),   // 0=domingo..6=sabado (semanal)
  dia_mes:         integer('dia_mes'),       // 1..31 (mensual; 31 -> clamp al ultimo dia)
  hora:            text('hora'),             // "HH:MM" 24h, opcional (default 09:00 al calcular)
  fecha_inicio:    integer('fecha_inicio', { mode: 'timestamp' }).notNull(),
  fecha_fin:       integer('fecha_fin', { mode: 'timestamp' }),
  proximo_disparo: integer('proximo_disparo', { mode: 'timestamp' }),   // null = agotada
  destinatario_tipo:       text('destinatario_tipo', { enum: ['usuario', 'rol'] }).notNull(),
  destinatario_usuario_id: text('destinatario_usuario_id').references(() => usuario.id),
  destinatario_rol:        text('destinatario_rol'),
  canal_in_app:    integer('canal_in_app', { mode: 'boolean' }).notNull().default(true),
  canal_email:     integer('canal_email', { mode: 'boolean' }).notNull().default(false),
  activa:          integer('activa', { mode: 'boolean' }).notNull().default(true),   // pausa (distinta de baja logica)
  origen_sistema:  integer('origen_sistema', { mode: 'boolean' }).notNull().default(false),  // rutinas internas (reservado)
  activo:          integer('activo', { mode: 'boolean' }).notNull().default(true),   // baja logica
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  proximoIdx: index('rutina_proximo_idx').on(t.activa, t.proximo_disparo),
}));

// agenda_evento: entidad de primera clase (accionable). Puede nacer de una rutina,
// a mano, o de un modulo de dominio. Sincronizable.
export const agenda_evento = sqliteTable('agenda_evento', {
  id:          text('id').primaryKey(),
  origen:      text('origen', {
    enum: ['rutina', 'manual', 'orden_compra', 'recepcion', 'bajo_minimo', 'cierre_caja'],
  }).notNull(),
  rutina_id:   text('rutina_id').references(() => rutina.id),
  titulo:      text('titulo').notNull(),
  descripcion: text('descripcion'),
  fecha:       integer('fecha', { mode: 'timestamp' }).notNull(),
  estado:      text('estado', {
    enum: ['pendiente', 'completada', 'pospuesta', 'descartada'],
  }).notNull().default('pendiente'),
  completado_at:  integer('completado_at', { mode: 'timestamp' }),
  completado_por: text('completado_por').references(() => usuario.id),
  pospuesto_para: integer('pospuesto_para', { mode: 'timestamp' }),
  nota:           text('nota'),
  // Snapshot del destinatario + canales al materializar (congela la plantilla de la rutina).
  destinatario_tipo:       text('destinatario_tipo', { enum: ['usuario', 'rol'] }).notNull(),
  destinatario_usuario_id: text('destinatario_usuario_id').references(() => usuario.id),
  destinatario_rol:        text('destinatario_rol'),
  canal_in_app: integer('canal_in_app', { mode: 'boolean' }).notNull().default(true),
  canal_email:  integer('canal_email', { mode: 'boolean' }).notNull().default(false),
  // FK explicitas nullable para navegar al dominio sin referencias colgadas (ADR-047 §9).
  proveedor_id:     text('proveedor_id').references(() => proveedor.id),
  orden_compra_id:  text('orden_compra_id').references(() => orden_compra.id),
  producto_id:      text('producto_id').references(() => producto.id),
  activo:      integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  estadoFechaIdx: index('agenda_evento_estado_fecha_idx').on(t.estado, t.fecha),
}));

// aviso: fila de outbox de entrega. NO sincroniza: estado operativo local por
// terminal (ADR-047 §10). origen_id es referencia blanda (sin FK); el payload es el registro.
export const aviso = sqliteTable('aviso', {
  id:               text('id').primaryKey(),
  agenda_evento_id: text('agenda_evento_id').references(() => agenda_evento.id),
  origen_tipo:      text('origen_tipo').notNull(),
  origen_id:        text('origen_id'),              // referencia blanda, sin FK
  canal:            text('canal', { enum: ['in_app', 'email', 'whatsapp'] }).notNull(),
  destinatario_usuario_id: text('destinatario_usuario_id').notNull().references(() => usuario.id),
  destinatario_contacto:   text('destinatario_contacto'),   // email congelado al emitir
  payload:          text('payload').notNull(),      // JSON snapshot { titulo, cuerpo, datos }
  estado:           text('estado', {
    enum: ['pendiente', 'enviado', 'fallido', 'descartado'],
  }).notNull().default('pendiente'),
  severidad:          text('severidad', { enum: ['normal', 'alerta'] }).notNull().default('normal'),
  intentos:           integer('intentos').notNull().default(0),
  ultimo_error:       text('ultimo_error'),
  proximo_intento_at: integer('proximo_intento_at', { mode: 'timestamp' }),   // backoff del worker
  dedupe_clave:       text('dedupe_clave'),          // idempotencia (unique; NULLs no colisionan)
  generado_at:        integer('generado_at', { mode: 'timestamp' }).notNull(),
  enviado_at:         integer('enviado_at', { mode: 'timestamp' }),
}, (t) => ({
  dedupeIdx: uniqueIndex('aviso_dedupe_idx').on(t.dedupe_clave),
  estadoIdx: index('aviso_estado_idx').on(t.estado, t.proximo_intento_at),
}));
