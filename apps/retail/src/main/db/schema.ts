// packages/client/src/main/db/schema.ts  (composición core + app)
export * from '@core/db';               // seguridad, personas, geo, credito, config (universal)
export * from './schema/catalog';
export * from './schema/precios';
export * from './schema/ventas';        // se parte en 1.3: por ahora entero (aún tiene tablas core)
export * from './schema/compras';
export * from './schema/remitos';
export * from './schema/presupuestos';
export * from './schema/agenda';
export * from './schema/sinonimos';
