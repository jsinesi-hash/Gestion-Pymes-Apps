import { describe, it, expect } from 'vitest';
import { NAV_GROUPS } from '../../shell/navRetail';

describe('ADR-083 — nav: Importar datos en Configuración', () => {
  const grupo = (k: string) => NAV_GROUPS.find(g => g.key === k)!;

  it('Importar datos es el primer ítem del grupo Configuración', () => {
    expect(grupo('configuracion').items[0]).toMatchObject({ label: 'Importar datos', to: '/importar' });
  });

  it('Importar datos ya no está en el grupo Sistema', () => {
    expect(grupo('sistema').items.some(i => i.to === '/importar')).toBe(false);
  });
});
