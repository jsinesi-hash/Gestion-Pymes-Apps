import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { lista_precio } from './precios';
import { localidad } from './geo';

const TIPO_DOC = ['DNI', 'CUIT', 'CUIL'] as const;
const COND_FISCAL = ['Responsable Inscripto', 'Monotributo', 'Consumidor Final', 'Exento'] as const;

export const cliente = sqliteTable('cliente', {
  id:                       text('id').primaryKey(),
  tipo_documento:           text('tipo_documento', { enum: TIPO_DOC }).notNull(),
  numero_documento:         text('numero_documento').notNull(),
  // ADR-050 — reemplaza a razon_social: nombre y apellido separados, ambos NOT NULL.
  nombre:                   text('nombre').notNull(),
  apellido:                 text('apellido').notNull(),
  nombre_fantasia:          text('nombre_fantasia'),
  condicion_fiscal:         text('condicion_fiscal', { enum: COND_FISCAL }).notNull(),
  domicilio:                text('domicilio'),
  localidad_id:             text('localidad_id').references(() => localidad.id),
  localidad:                text('localidad'),
  provincia:                text('provincia'),
  codigo_postal:            text('codigo_postal'),
  calle:                    text('calle'),
  numero:                   text('numero'),
  aclaracion:               text('aclaracion'),
  telefono_adicional:       text('telefono_adicional'),
  telefono:                 text('telefono'),
  email:                    text('email'),
  habilita_cuenta_corriente: integer('habilita_cuenta_corriente', { mode: 'boolean' }).notNull().default(false),
  lista_precio_id:          text('lista_precio_id').references(() => lista_precio.id),
  activo:                   integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const proveedor = sqliteTable('proveedor', {
  id:               text('id').primaryKey(),
  tipo_documento:   text('tipo_documento', { enum: TIPO_DOC }).notNull(),
  numero_documento: text('numero_documento').notNull(),
  razon_social:     text('razon_social').notNull(),
  nombre_fantasia:  text('nombre_fantasia'),
  condicion_fiscal: text('condicion_fiscal', { enum: COND_FISCAL }).notNull(),
  domicilio:        text('domicilio'),
  localidad_id:     text('localidad_id').references(() => localidad.id),
  localidad:        text('localidad'),
  provincia:        text('provincia'),
  codigo_postal:    text('codigo_postal'),
  calle:            text('calle'),
  numero:           text('numero'),
  aclaracion:       text('aclaracion'),
  telefono_adicional: text('telefono_adicional'),
  telefono:         text('telefono'),
  email:            text('email'),
  persona_contacto: text('persona_contacto'),
  observaciones:    text('observaciones'),
  codigo:           text('codigo').unique(),
  // ADR-049 §1 — defaults comerciales del proveedor para el costo neto.
  // Overridables por producto en producto_proveedor. Todos default 0 => costo neto = bruto.
  bonificacion_pct_default:      real('bonificacion_pct_default').notNull().default(0),
  costo_financiero_pct_default:  real('costo_financiero_pct_default').notNull().default(0),
  flete_pct_default:             real('flete_pct_default').notNull().default(0),
  // ADR-063 Lote 4 — umbral opt-in de pre-selección por similitud (0-100). null = desactivado.
  // Sólo cambia el estado inicial del preview (pre-marca aciertos altos); nunca escribe sin confirmar.
  match_umbral_preseleccion: integer('match_umbral_preseleccion'),
  activo:           integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
