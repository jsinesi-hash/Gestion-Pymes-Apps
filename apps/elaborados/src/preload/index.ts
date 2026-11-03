import { contextBridge, ipcRenderer } from 'electron';
import { createBridge } from '@core/preload';
import { canalesElaborados } from './canales';

// El catálogo de canales propios vive en ./canales (módulo puro, tipable desde el renderer).
// `createBridge` mezcla estos namespaces con los universales de @core/preload y hace la única
// llamada a `exposeInMainWorld`.
createBridge({
  exposeAs: 'elaborados',
  app: (invoke, deps) => canalesElaborados(invoke, deps.ipcRenderer),
}, { contextBridge, ipcRenderer });
