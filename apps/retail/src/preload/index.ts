import { contextBridge, ipcRenderer } from 'electron';
import { createBridge } from '@core/preload';
import { canalesRetail } from './canales';

// El catálogo de canales propios vive en ./canales (módulo puro, tipable desde el renderer).
// `createBridge` mezcla estos namespaces con los universales de @core/preload y hace la única
// llamada a `exposeInMainWorld`.
createBridge({
  exposeAs: 'ferreteria',
  app: (invoke, deps) => canalesRetail(invoke, deps.ipcRenderer),
}, { contextBridge, ipcRenderer });
