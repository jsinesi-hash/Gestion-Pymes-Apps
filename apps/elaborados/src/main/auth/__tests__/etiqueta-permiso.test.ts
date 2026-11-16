import { describe, it, expect } from 'vitest';
import { ETIQUETA_PERMISO } from '@ferreteria/shared';
import { PERMISOS_CORE } from '@core/main';
import { PERMISOS_ELABORADOS } from '../seed';

// ADR-145: la matriz de Roles y permisos de Elaborados mostraba sus 7 permisos con el código crudo.
describe('ETIQUETA_PERMISO en Elaborados', () => {
  it('cubre todos los permisos de la app (núcleo + propios)', () => {
    const faltantes = [...PERMISOS_CORE, ...PERMISOS_ELABORADOS]
      .map(p => p.codigo)
      .filter(c => !Object.hasOwn(ETIQUETA_PERMISO, c));
    expect(faltantes).toEqual([]);
  });
});
