import { contextBridge, ipcRenderer } from 'electron';
import { createBridge } from '@core/preload';

// E1: solo canales universales del core. Los namespaces propios de Elaborados (articulo,
// produccion, producto_venta, …) se suman vía `app:` en E2+.
createBridge({ exposeAs: 'elaborados' }, { contextBridge, ipcRenderer });
