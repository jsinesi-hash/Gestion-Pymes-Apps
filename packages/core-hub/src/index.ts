// @core/hub — almacén y (desde el PR2) servidor del hub de sincronización (ADR-149, ADR-150, ADR-158).
// Solo Node: lo arranca cada app con su esquema, sus migraciones y su registro de sync.
export { abrirAlmacenHub } from './almacen';
export type {
  AlmacenHub, OpcionesAlmacen, CambioEntrante, ResultadoCambio, EstadoCambio,
  CambioRegistrado, PaginaCambios, Snapshot, ConflictoHub,
} from './almacen';
export { hub_cambio, hub_recibido, hub_conflicto } from './schema';
