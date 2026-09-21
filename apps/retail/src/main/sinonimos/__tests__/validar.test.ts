import { describe, it, expect } from 'vitest';
import { validarSinonimos } from '../validar';
import { SINONIMO_GRUPOS } from '../dataset';

describe('validarSinonimos (ADR-067)', () => {
  it('el dataset base placeholder es válido (sin errores)', () => {
    const r = validarSinonimos(SINONIMO_GRUPOS);
    expect(r.ok).toBe(true);
    expect(r.errores).toEqual([]);
  });

  it('marca canónico vacío como error', () => {
    const r = validarSinonimos([{ canonico: '  ', sinonimos: ['x'] }]);
    expect(r.ok).toBe(false);
    expect(r.errores.some(e => /Canónico vacío/i.test(e.mensaje))).toBe(true);
  });

  it('advierte grupo de un solo término', () => {
    const r = validarSinonimos([{ canonico: 'martillo', sinonimos: [] }]);
    expect(r.ok).toBe(true); // advertencia, no bloquea
    expect(r.advertencias.some(a => /un solo término/i.test(a.mensaje))).toBe(true);
  });

  it('advierte término duplicado dentro del grupo', () => {
    const r = validarSinonimos([{ canonico: 'alicate', sinonimos: ['pinza', 'Pinza'] }]);
    expect(r.advertencias.some(a => /duplicado dentro del grupo/i.test(a.mensaje))).toBe(true);
  });

  it('advierte el mismo término en dos grupos distintos', () => {
    const r = validarSinonimos([
      { canonico: 'alicate', sinonimos: ['pinza'] },
      { canonico: 'tenaza', sinonimos: ['pinza'] },
    ]);
    expect(r.advertencias.some(a => /aparece en 2 grupos/i.test(a.mensaje))).toBe(true);
  });

  it('normaliza acentos al comparar (mismo término)', () => {
    const r = validarSinonimos([
      { canonico: 'caño', sinonimos: ['tubo'] },
      { canonico: 'conexión', sinonimos: ['cano'] }, // "cano" == "caño" normalizado
    ]);
    expect(r.advertencias.some(a => /aparece en 2 grupos/i.test(a.mensaje))).toBe(true);
  });
});
