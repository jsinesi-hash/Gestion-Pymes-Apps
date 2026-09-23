import { coreCanales, type Invoke } from './coreCanales';

type Ns = Record<string, unknown>;
export type BridgeDeps = {
  contextBridge: { exposeInMainWorld(key: string, api: unknown): void };
  ipcRenderer: { invoke(canal: string, ...args: unknown[]): Promise<unknown>;
    on(canal: string, l: (...a: any[]) => void): void; removeListener(canal: string, l: (...a: any[]) => void): void };
};
export type BridgeOpts = { exposeAs: string; app?: (invoke: Invoke, deps: BridgeDeps) => Ns };

export function mergeNamespaces(core: Ns, app: Ns): Ns {
  const out: Ns = { ...core };
  for (const [k, v] of Object.entries(app)) {
    const base = out[k];
    if (base === undefined) { out[k] = v; continue; }
    if (typeof base !== 'object' || typeof v !== 'object' || base === null || v === null) {
      throw new Error(`BRIDGE_COLISION: ${k}`);
    }
    for (const m of Object.keys(v)) {
      if (m in (base as Ns)) throw new Error(`BRIDGE_COLISION: ${k}.${m}`);
    }
    out[k] = { ...(base as Ns), ...(v as Ns) };
  }
  return out;
}

/** Única llamada a exposeInMainWorld de la app: canales del core + los de la app. */
export function createBridge(opts: BridgeOpts, deps: BridgeDeps): Ns {
  const invoke: Invoke = (canal, ...args) => deps.ipcRenderer.invoke(canal, ...args) as Promise<any>;
  const api = mergeNamespaces(coreCanales(invoke), opts.app?.(invoke, deps) ?? {});
  deps.contextBridge.exposeInMainWorld(opts.exposeAs, api);
  return api;
}
