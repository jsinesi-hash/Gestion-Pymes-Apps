import { contextBridge, ipcRenderer } from 'electron';
import { createBridge } from '@core/preload';

// E2 suma los namespaces propios de Elaborados. Cada slice agrega los suyos acá.
createBridge({
  exposeAs: 'elaborados',
  app: (invoke) => ({
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
      seedHeladeria: () => invoke('demo-catalog:seed-heladeria'),
    },
  }),
}, { contextBridge, ipcRenderer });
