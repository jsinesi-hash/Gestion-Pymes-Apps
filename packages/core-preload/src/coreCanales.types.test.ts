import { describe, it, expect } from 'vitest';
import { coreCanales, type CoreBridgeApi } from './coreCanales';

// Revisión 2026-10-20 (P1): `bridge()` devolvía `any`: un canal renombrado en el preload rompía en
// ejecución sin que fallara `tsc`. `CoreBridgeApi` es el tipo del catálogo real y se verifica en
// COMPILACIÓN (este archivo entra en `tsc --noEmit`/`tsc`): las líneas `@ts-expect-error` fallan
// la compilación si dejan de ser errores.
declare const api: CoreBridgeApi;

// Se referencian dentro de una función que nunca se ejecuta: solo importa que compile.
export function _verificacionDeTipos(): void {
  void api.auth.login({ nombreUsuario: 'x', password: 'y' });
  void api.caja.abrir({ monto_inicial: 0 });
  void api.usuario.desactivar({ userId: 'u' });
  void api.getVersion();

  // @ts-expect-error — el namespace no existe
  void api.namespaceInexistente.algo();
  // @ts-expect-error — el método no existe en el namespace
  void api.auth.metodoInexistente();
  // @ts-expect-error — `login` no es una propiedad numérica
  const _n: number = api.auth.login;
}

describe('coreCanales — impuesto (movido al núcleo, P2 2026-10-20)', () => {
  it('impuesto.list invoca el canal impuesto:list', async () => {
    const invocados: string[] = [];
    const api = coreCanales(async (canal) => { invocados.push(canal); return []; });
    await api.impuesto.list();
    expect(invocados).toEqual(['impuesto:list']);
  });
});

describe('coreCanales — venta.listByCaja y menu.rebuild (movidos al núcleo, P2 2026-10-20)', () => {
  it('invocan venta:listByCaja y menu:rebuild', async () => {
    const invocados: unknown[][] = [];
    const api = coreCanales(async (...a) => { invocados.push(a); return []; });
    await api.venta.listByCaja({ caja_id: 'c1' });
    await api.menu.rebuild();
    expect(invocados).toEqual([['venta:listByCaja', { caja_id: 'c1' }], ['menu:rebuild']]);
  });
});

describe('CoreBridgeApi', () => {
  it('es el tipo de lo que devuelve coreCanales', () => {
    const invocados: string[] = [];
    const real = coreCanales(async (canal) => { invocados.push(canal); });
    const tipado: CoreBridgeApi = real;
    void tipado.auth.whoami();
    expect(invocados).toEqual(['auth:whoami']);
  });
});

describe('coreCanales — sync (F2 PR4)', () => {
  it('cada método invoca su canal sync:* con el payload', async () => {
    const invocados: unknown[][] = [];
    const api = coreCanales(async (...a) => { invocados.push(a); return null; });
    await api.sync.estado();
    await api.sync.sondear({ url: 'hub.local' });
    await api.sync.emparejar({ url: 'hub.local', codigo: 'ABCD-EFGH', huella: 'AA' });
    await api.sync.sincronizar();
    await api.sync.desemparejar({ forzar: true });
    await api.sync.rebajarSnapshot();
    await api.sync.conflictos({ pendientes: true });
    await api.sync.resolverConflicto({ id: 3, resolucion: 'recuperado' });
    await api.sync.descartarAlta({ id: 4 });
    await api.sync.terminales();
    expect(invocados).toEqual([
      ['sync:estado'], ['sync:sondear', { url: 'hub.local' }],
      ['sync:emparejar', { url: 'hub.local', codigo: 'ABCD-EFGH', huella: 'AA' }], ['sync:sincronizar'],
      ['sync:desemparejar', { forzar: true }], ['sync:rebajarSnapshot', undefined],
      ['sync:conflictos', { pendientes: true }], ['sync:resolverConflicto', { id: 3, resolucion: 'recuperado' }],
      ['sync:descartarAlta', { id: 4 }], ['sync:terminales'],
    ]);
  });

  it('hubLocal (F2 PR6): estado, instalar, desinstalar y código invocan sus canales', async () => {
    const invocados: unknown[][] = [];
    const api = coreCanales(async (...a) => { invocados.push(a); return null; });
    await api.hubLocal.estado();
    await api.hubLocal.instalar();
    await api.hubLocal.desinstalar();
    await api.hubLocal.codigo();
    expect(invocados).toEqual([['hubLocal:estado'], ['hubLocal:instalar'], ['hubLocal:desinstalar'], ['hubLocal:codigo']]);
  });
});
