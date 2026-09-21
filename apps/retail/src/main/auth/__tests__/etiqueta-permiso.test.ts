import { describe, it, expect } from 'vitest';
import { ETIQUETA_PERMISO, etiquetaPermiso } from '@ferreteria/shared';
import { PERMISOS } from '../seed';

describe('ETIQUETA_PERMISO', () => {
  it('cubre todos los códigos de PERMISOS', () => {
    const faltantes = PERMISOS.map(p => p.codigo).filter(c => !Object.hasOwn(ETIQUETA_PERMISO, c));
    expect(faltantes).toEqual([]);
  });
  it('no tiene etiquetas huérfanas', () => {
    const codigos = new Set<string>(PERMISOS.map(p => p.codigo));
    const huerfanas = Object.keys(ETIQUETA_PERMISO).filter(c => !codigos.has(c));
    expect(huerfanas).toEqual([]);
  });
  it('etiquetaPermiso cae al código si falta', () => {
    expect(etiquetaPermiso('inexistente.x')).toBe('inexistente.x');
    expect(etiquetaPermiso('venta.crear')).toBe('Vender (POS)');
  });
});
