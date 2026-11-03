// packages/shared/src/index.ts
export type { SyncState, SyncableEntity } from './sync/types.js';
export { generateId } from './sync/id.js';
export type { TerminalConfig } from './config/terminal.js';
export { resolveTerminalConfig } from './config/terminal.js';
export type {
  LineaPrecioInput,
  VentaPrecioInput,
  LineaPrecioResult,
  VentaPrecioResult,
  RedondeoResult,
} from './precio.js';
export { ajusteEfectivo, resolverPrecio, redondearPeso, redondearComercial } from './precio.js';
export type { RedondeoComercialModo } from './precio.js';
export type { ReglaPrecio, ReglaPrecioTipo, ContextoProducto } from './regla.js';
export { resolverRegla, precioConMargen, margenRealPct } from './regla.js';
export type {
  OverrideComercialProducto,
  DefaultsComercialProveedor,
  ComponentesComerciales,
  CostoNetoResult,
} from './costo.js';
export { resolverComponentesComerciales, calcularCostoNeto, costoNeto } from './costo.js';
export * from './export/index.js';
export { checkDigit, formatSku, parseSku, SkuParseError } from './sku.js';
export type { UbicacionCanonica } from './ubicacion.js';
export { canonicalizarUbicacion, canonicalizarCodigoUbicacion } from './ubicacion.js';
export type { BooleanoParse } from './booleano.js';
export { parseBooleanoImport } from './booleano.js';
export { normalizar } from './texto.js';
export { tokenizar, canonizarTokens, coeficienteDice, similitudNombres } from './similitud.js';
export type { ClienteNombre } from './persona.js';
export { nombreCompletoCliente } from './persona.js';
export { inicioDelDia, finDelDia, ymdLocal, ymdHmLocal, hoyYmd } from './fecha.js';
export type {
  BackupManifest,
  BackupListItem,
  RestoreCompatibilidad,
  RestoreValidationResult,
  RestoreLogEntry,
  PoliticaRetencion,
  ResumenDepuracion,
} from './backup/types.js';
export type { BarcodeTipo, PerfilEtiqueta, EtiquetaItem, CeldaLayout } from './etiquetas/index.js';
export { generarLayoutHoja } from './etiquetas/index.js';
export * from './navegacion.js';
export { ETIQUETA_PERMISO, etiquetaPermiso } from './permisos.js';
export type { ItemComprobante, CondicionFiscalComprobante, ReceptorComprobante, IvaAlicuota, PagoComprobante, ComprobantePayload } from './comprobante.js';
export { ivaPorAlicuota } from './comprobante.js';
export { verificarTotalesVenta } from './totales-venta.js';
export type { LineaTotalesVenta, TotalesVentaInput } from './totales-venta.js';
export { PASSWORD_MIN_LARGO, motivosPasswordDebil, validarPoliticaPassword, mensajePasswordDebil } from './password.js';
export type { MotivoPasswordDebil } from './password.js';
