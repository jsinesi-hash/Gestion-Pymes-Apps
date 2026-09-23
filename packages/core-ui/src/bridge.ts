let clave: string | null = null;
/** La app lo llama UNA vez al arrancar el renderer (y en su test-setup). */
export function configurarBridge(exposeAs: string): void { clave = exposeAs; }
/** API expuesta por @core/preload (createBridge). `any` a propósito: el catálogo lo tipa cada app. */
export function bridge(): any {
  if (!clave) throw new Error('BRIDGE_NO_CONFIGURADO');
  return (globalThis as any)[clave] ?? {};
}
