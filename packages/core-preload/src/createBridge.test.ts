import { describe, it, expect, vi } from 'vitest';
import { createBridge, type BridgeDeps } from './createBridge';

function deps() {
  const expuesto: Record<string, unknown> = {};
  const d: BridgeDeps = {
    contextBridge: { exposeInMainWorld: vi.fn((k: string, v: unknown) => { expuesto[k] = v; }) },
    ipcRenderer: { invoke: vi.fn(async (canal: string, ...a: unknown[]) => ({ canal, a })),
                   on: vi.fn(), removeListener: vi.fn() },
  };
  return { d, expuesto };
}

describe('createBridge', () => {
  it('expone core + app bajo la clave pedida, una sola vez', async () => {
    const { d, expuesto } = deps();
    createBridge({ exposeAs: 'elaborados', app: (inv) => ({ articulo: { list: () => inv('articulo:list') } }) }, d);
    expect(d.contextBridge.exposeInMainWorld).toHaveBeenCalledOnce();
    const api = expuesto['elaborados'] as any;
    expect(await api.auth.whoami()).toEqual({ canal: 'auth:whoami', a: [] });
    expect(await api.articulo.list()).toEqual({ canal: 'articulo:list', a: [] });
  });
  it('la app puede EXTENDER un namespace del core', async () => {
    const { d, expuesto } = deps();
    createBridge({ exposeAs: 'x', app: (inv) => ({ dialog: { importCosto: () => inv('dialog:importCosto') } }) }, d);
    const api = expuesto['x'] as any;
    expect(typeof api.dialog.seleccionarCarpeta).toBe('function');
    expect(typeof api.dialog.importCosto).toBe('function');
  });
  it('la app NO puede pisar un método del core', () => {
    const { d } = deps();
    expect(() => createBridge({ exposeAs: 'x', app: () => ({ auth: { login: () => 1 } }) }, d))
      .toThrow('BRIDGE_COLISION: auth.login');
  });
  it('geo.localidades pasa sus dos argumentos', async () => {
    const { d, expuesto } = deps();
    createBridge({ exposeAs: 'x' }, d);
    expect(await (expuesto['x'] as any).geo.localidades('p1', 'ro')).toEqual({ canal: 'geo:localidades', a: ['p1', 'ro'] });
  });
  it('expone print.html sobre el canal print:html', async () => {
    const { d, expuesto } = deps();
    createBridge({ exposeAs: 'x' }, d);
    expect(await (expuesto['x'] as any).print.html('<p>x</p>')).toEqual({ canal: 'print:html', a: ['<p>x</p>'] });
  });
  it('print de primer nivel del core no colisiona con catalogo.print de la app (anidado)', () => {
    const { d, expuesto } = deps();
    expect(() => createBridge({ exposeAs: 'x', app: (inv) => ({ catalogo: { print: { html: (h: string) => inv('print:html', h) } } }) }, d)).not.toThrow();
    expect(typeof (expuesto['x'] as any).catalogo.print.html).toBe('function');
    expect(typeof (expuesto['x'] as any).print.html).toBe('function');
  });
});
