import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './hash';

describe('hashPassword / verifyPassword', () => {
  it('hashPassword devuelve string con prefijo scrypt$', () => {
    const hash = hashPassword('mipassword');
    expect(hash).toMatch(/^scrypt\$/);
  });

  it('verifyPassword retorna true con credencial correcta', () => {
    const hash = hashPassword('mipassword');
    expect(verifyPassword('mipassword', hash)).toBe(true);
  });

  it('verifyPassword retorna false con credencial incorrecta', () => {
    const hash = hashPassword('mipassword');
    expect(verifyPassword('otrapassword', hash)).toBe(false);
  });

  it('dos hashes del mismo plain son distintos (sal única)', () => {
    const h1 = hashPassword('igual');
    const h2 = hashPassword('igual');
    expect(h1).not.toBe(h2);
    expect(verifyPassword('igual', h1)).toBe(true);
    expect(verifyPassword('igual', h2)).toBe(true);
  });

  it('verifyPassword retorna false con stored malformado', () => {
    expect(verifyPassword('cualquier', '')).toBe(false);
    expect(verifyPassword('cualquier', 'no-es-formato-valido')).toBe(false);
    expect(verifyPassword('cualquier', 'scrypt$abc$x$y$')).toBe(false);
  });
});
