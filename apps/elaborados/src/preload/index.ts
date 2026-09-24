import { contextBridge, ipcRenderer } from 'electron';
import { createBridge } from '@core/preload';

// E2 suma los namespaces propios de Elaborados. Cada slice agrega los suyos acá.
createBridge({
  exposeAs: 'elaborados',
  app: (invoke) => ({
    impuesto: {
      list: () => invoke('impuesto:list'),
    },
  }),
}, { contextBridge, ipcRenderer });
