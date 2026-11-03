// Catálogo de canales propios de Elaborados (puro: sin 'electron'). Lo usa el preload y, por
// `typeof`, el renderer para tipar `bridge()` (revisión 2026-10-20, P1).
import type { Invoke, BridgeDeps } from '@core/preload';

// E2 suma los namespaces propios de Elaborados. Cada slice agrega los suyos acá.

export function canalesElaborados(invoke: Invoke, ipcRenderer: BridgeDeps['ipcRenderer']) {
  return {
    impuesto: {
      list: () => invoke('impuesto:list'),
    },
    articulo: {
      list:   () => invoke('articulo:list'),
      get:    (p: { id: string }) => invoke('articulo:get', p),
      create: (p: unknown) => invoke('articulo:create', p),
      update: (p: unknown) => invoke('articulo:update', p),
    },
    movimientoArticulo: {
      list:   (p: { articulo_id: string }) => invoke('movimiento-articulo:list', p),
      create: (p: unknown) => invoke('movimiento-articulo:create', p),
    },
    recetaProduccion: {
      get: (p: { articulo_id: string }) => invoke('receta-produccion:get', p),
      set: (p: unknown) => invoke('receta-produccion:set', p),
    },
    produccion: {
      list:   () => invoke('produccion:list'),
      crear:  (p: unknown) => invoke('produccion:crear', p),
      anular: (p: unknown) => invoke('produccion:anular', p),
    },
    compra: {
      list:   () => invoke('compra:list'),
      get:    (p: { id: string }) => invoke('compra:get', p),
      crear:  (p: unknown) => invoke('compra:crear', p),
      anular: (p: unknown) => invoke('compra:anular', p),
      proveedores:        () => invoke('compra:proveedor-list'),
      proveedorCrearRapido: (p: unknown) => invoke('compra:proveedor-crear-rapido', p),
    },
    listaPrecio: {
      list:      () => invoke('lista-precio:list'),
      precios:   (p: { lista_precio_id: string }) => invoke('lista-precio:precios', p),
      create:    (p: unknown) => invoke('lista-precio:create', p),
      update:    (p: unknown) => invoke('lista-precio:update', p),
      precioSet: (p: unknown) => invoke('lista-precio:precio-set', p),
    },
    reporte: {
      ventasPeriodo: (p: { desde: string; hasta: string }) => invoke('reporte:ventas-periodo', p),
      ventasProducto: (p: { desde: string; hasta: string }) => invoke('reporte:ventas-producto', p),
      stockAlertas: () => invoke('reporte:stock-alertas'),
    },
    categoriaVenta: {
      list:   () => invoke('categoria-venta:list'),
      create: (p: unknown) => invoke('categoria-venta:create', p),
    },
    grupoModificador: {
      list:      () => invoke('grupo-modificador:list'),
      get:       (p: { id: string }) => invoke('grupo-modificador:get', p),
      create:    (p: unknown) => invoke('grupo-modificador:create', p),
      opcionSet: (p: unknown) => invoke('grupo-modificador:opcion-set', p),
    },
    productoVenta: {
      list:   () => invoke('producto-venta:list'),
      get:    (p: { id: string }) => invoke('producto-venta:get', p),
      create: (p: unknown) => invoke('producto-venta:create', p),
    },
    demoCatalog: {
      estado:        () => invoke('demo-catalog:estado'),
      seedHeladeria: () => invoke('demo-catalog:seed-heladeria'),
      vaciar:        () => invoke('demo-catalog:vaciar'),
    },
    venta: {
      cotizar:    (p: unknown) => invoke('venta:cotizar', p),
      confirmar:  (p: unknown) => invoke('venta:confirmar', p),
      anular:     (p: unknown) => invoke('venta:anular', p),
      catalogo:   (p?: unknown) => invoke('venta:catalogo', p),
      get:        (p: { id: string }) => invoke('venta:get', p),
      listByCaja: (p: { caja_id: string }) => invoke('venta:listByCaja', p),
    },
    ventaEspera: {
      pausar:    (p: unknown) => invoke('venta.espera:pausar', p),
      listar:    () => invoke('venta.espera:listar'),
      retomar:   (p: unknown) => invoke('venta.espera:retomar', p),
      descartar: (p: unknown) => invoke('venta.espera:descartar', p),
    },
  };
}
