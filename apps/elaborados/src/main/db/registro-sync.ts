import { combinarRegistros, registroSyncCore, type RegistroSync } from '@core/db';

/**
 * Tipo de sync de cada tabla propia de Elaborados (ADR-150 §3). Las del núcleo vienen de
 * `registroSyncCore()`. El test `__tests__/b2-sync-fields.test.ts` exige que toda tabla del
 * esquema compuesto esté acá o en el núcleo.
 */
export const REGISTRO_SYNC_ELABORADOS: RegistroSync = {
  // stock — el stock y el costo promedio ponderado se recalculan desde movimiento_articulo (ADR-151)
  articulo: { tipo: 'maestro', proyectadas: ['costo_promedio_centavos'] },
  existencia_articulo: { tipo: 'maestro', proyectadas: ['stock', 'ultima_fecha_movimiento'] },
  movimiento_articulo: { tipo: 'libro' },
  // compras y producción (la producción cambia de estado al anularse: es maestro)
  compra: { tipo: 'maestro' },
  compra_item: { tipo: 'maestro' },
  receta_produccion: { tipo: 'maestro' },
  receta_produccion_item: { tipo: 'maestro' },
  produccion: { tipo: 'maestro' },
  // catálogo de venta y precios
  categoria_venta: { tipo: 'maestro' },
  producto_venta: { tipo: 'maestro' },
  producto_venta_componente: { tipo: 'maestro' },
  producto_venta_grupo: { tipo: 'maestro' },
  producto_venta_precio: { tipo: 'maestro' },
  grupo_modificador: { tipo: 'maestro' },
  grupo_modificador_opcion: { tipo: 'maestro' },
  // venta (líneas editables mientras el pedido está abierto)
  venta_linea: { tipo: 'maestro' },
  venta_linea_modificador: { tipo: 'maestro' },
  // registro de lo sembrado como demo, para poder quitarlo (ADR-110)
  demo_registro: { tipo: 'maestro' },
};

/** Registro completo de Elaborados: núcleo + app. */
export function registroSyncElaborados(): RegistroSync {
  return combinarRegistros(registroSyncCore(), REGISTRO_SYNC_ELABORADOS);
}
