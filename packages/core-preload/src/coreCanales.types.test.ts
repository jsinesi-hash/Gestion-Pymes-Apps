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

describe('CoreBridgeApi', () => {
  it('es el tipo de lo que devuelve coreCanales', () => {
    const invocados: string[] = [];
    const real = coreCanales(async (canal) => { invocados.push(canal); });
    const tipado: CoreBridgeApi = real;
    void tipado.auth.whoami();
    expect(invocados).toEqual(['auth:whoami']);
  });
});
