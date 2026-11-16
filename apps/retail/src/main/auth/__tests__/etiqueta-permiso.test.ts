import { describe, it, expect } from 'vitest';
import { ETIQUETA_PERMISO, etiquetaPermiso } from '@ferreteria/shared';
import { PERMISOS } from '../seed';

// El mapa es compartido por todas las apps (ADR-145): puede tener códigos de otras apps, pero
// tiene que cubrir todos los de Retail.
describe('ETIQUETA_PERMISO', () => {
  it('cubre todos los códigos de PERMISOS', () => {
    const faltantes = PERMISOS.map(p => p.codigo).filter(c => !Object.hasOwn(ETIQUETA_PERMISO, c));
    expect(faltantes).toEqual([]);
  });
  it('etiquetaPermiso cae al código si falta', () => {
    expect(etiquetaPermiso('inexistente.x')).toBe('inexistente.x');
    expect(etiquetaPermiso('venta.crear')).toBe('Vender (POS)');
  });
});
