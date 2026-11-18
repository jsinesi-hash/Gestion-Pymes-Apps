// @core/hub — hub de sincronización de la fase online (ADR-149, ADR-150, ADR-158). Solo Node: lo
// arranca cada app con su esquema, sus migraciones y su registro de sync.
export { abrirAlmacenHub } from './almacen';
export type {
  AlmacenHub, OpcionesAlmacen, CambioEntrante, ResultadoCambio, EstadoCambio,
  CambioRegistrado, PaginaCambios, Snapshot, ConflictoHub,
} from './almacen';
export { abrirTerminales } from './terminales';
export type { RegistroTerminales, TerminalHub } from './terminales';
export { generarCertificado, huellaDe } from './certificado';
export type { CertificadoHub, OpcionesCertificado } from './certificado';
export { crearServidorHub } from './servidor';
export type { OpcionesServidor } from './servidor';
export * from './protocolo';
export { ejecutarComandoHub, carpetaDatosPorDefecto, PUERTO_POR_DEFECTO } from './arranque';
export type { OpcionesHub, HubEnMarcha } from './arranque';
export { hub_cambio, hub_recibido, hub_conflicto, hub_terminal, hub_codigo } from './schema';
