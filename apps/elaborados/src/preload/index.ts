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
  }),
}, { contextBridge, ipcRenderer });
