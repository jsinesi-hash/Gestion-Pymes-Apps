import { combinarRegistros, registroSyncCore, type RegistroSync } from '@core/db';

/**
 * Tipo de sync de cada tabla propia de Retail (ADR-150 §3). Las del núcleo vienen de
 * `registroSyncCore()`. El test `db/__tests__/b2-sync-fields.test.ts` exige que toda tabla del
 * esquema compuesto esté acá o en el núcleo.
 */
export const REGISTRO_SYNC_RETAIL: RegistroSync = {
  // agenda — `aviso` es el outbox local de entrega (ADR-047 §10, ADR-152 §4)
  rutina: { tipo: 'maestro' },
  agenda_evento: { tipo: 'maestro' },
  aviso: { tipo: 'local' },
  // catálogo — el costo promedio ponderado y el stock se recalculan desde movimiento_stock (ADR-151)
  unidad: { tipo: 'maestro' },
  categoria: { tipo: 'maestro' },
  marca: { tipo: 'maestro' },
  ubicacion: { tipo: 'maestro' },
  producto: { tipo: 'maestro', proyectadas: ['precio_costo_promedio_centavos'] },
  producto_presentacion: { tipo: 'maestro' },
  producto_equivalencia: { tipo: 'maestro' },
  existencias: { tipo: 'maestro', proyectadas: ['stock_fisico', 'ultima_fecha_movimiento'] },
  movimiento_stock: { tipo: 'libro' },
  // compras
  producto_proveedor: { tipo: 'maestro' },
  orden_compra: { tipo: 'maestro' },
  item_oc: { tipo: 'maestro' },
  recepcion: { tipo: 'maestro' },
  recepcion_detalle: { tipo: 'libro' },
  comprobante_compra: { tipo: 'maestro' },
  importacion_costo_proveedor: { tipo: 'maestro' },
  importacion_costo_proveedor_detalle: { tipo: 'maestro' },
  proveedor_importacion_config: { tipo: 'maestro' },
  importacion_catalogo_proveedor: { tipo: 'maestro' },
  importacion_catalogo_proveedor_detalle: { tipo: 'maestro' },
  // precios — `recalculo_masivo` es el registro inmutable de cada ejecución
  lista_precio_detalle: { tipo: 'maestro' },
  lista_precio_valor: { tipo: 'maestro' },
  regla_precio: { tipo: 'maestro' },
  price_batch: { tipo: 'maestro' },
  price_batch_detalle: { tipo: 'maestro' },
  recalculo_masivo: { tipo: 'libro' },
  promocion: { tipo: 'maestro' },
  cambio_programado: { tipo: 'maestro' },
  // presupuestos, remitos, sinónimos, ventas
  presupuesto: { tipo: 'maestro' },
  presupuesto_detalle: { tipo: 'maestro' },
  transportista: { tipo: 'maestro' },
  remito: { tipo: 'maestro' },
  remito_linea: { tipo: 'maestro' },
  sinonimo: { tipo: 'maestro' },
  venta_detalle: { tipo: 'maestro' },
};

/** Registro completo de Retail: núcleo + app. */
export function registroSyncRetail(): RegistroSync {
  return combinarRegistros(registroSyncCore(), REGISTRO_SYNC_RETAIL);
}
