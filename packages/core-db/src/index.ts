// @core/db — esquema universal + runner (runner llega en 1.4).
// Solo re-export flat de las tablas: NO exportar un namespace (`export * as coreSchema`)
// porque el objeto namespace se filtra al `schema` que la app pasa a `drizzle(sqlite,{schema})`
// y drizzle explota al iterarlo (TypeError: reading 'constructor' of null). El que necesite
// el namespace lo importa con `import * as coreSchema from '@core/db'`.
export * from './schema';
export { createDb, runMigrations } from './factory';
export { CAMPOS_SYNC } from './__boundary__/sync-fields';
export { combinarRegistros, registroSyncCore, verificarRegistroSync } from './__boundary__/registro-sync';
export type { EntradaSync, RegistroSync, TipoSync } from './__boundary__/registro-sync';
export { columnasBooleanas, ddlPostgres, traducirIndicePostgres } from './__boundary__/ddl-postgres';
