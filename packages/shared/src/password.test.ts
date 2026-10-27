import { describe, it, expect } from 'vitest';
import { motivosPasswordDebil, validarPoliticaPassword, mensajePasswordDebil, PASSWORD_MIN_LARGO } from './password.js';

// Revisión 2026-10-20 (P1): no había política de contraseña (la UI pedía 4 caracteres y el main
// no validaba nada). Decisión del usuario: mínimo 8, mayúscula, número y carácter especial, y
// distinta del nombre de usuario. La misma función la usan el main (borde del handler) y la UI.
describe('motivosPasswordDebil', () => {
  it('una contraseña que cumple todo no tiene motivos', () => {
    expect(motivosPasswordDebil('Clave#2026')).toEqual([]);
  });

  it('el mínimo es 8 caracteres', () => {
    expect(PASSWORD_MIN_LARGO).toBe(8);
    expect(motivosPasswordDebil('Ab1#xyz')).toEqual(['LARGO']);
    expect(motivosPasswordDebil('Ab1#xyz9')).toEqual([]);
  });

  it('exige mayúscula', () => {
    expect(motivosPasswordDebil('clave#2026')).toEqual(['MAYUSCULA']);
  });

  it('acepta mayúsculas con acento y eñe', () => {
    expect(motivosPasswordDebil('Ñandú#2026')).toEqual([]);
    expect(motivosPasswordDebil('clave#Á2026')).toEqual([]);
  });

  it('exige número', () => {
    expect(motivosPasswordDebil('Clave#Segura')).toEqual(['NUMERO']);
  });

  it('exige carácter especial (un espacio o una letra con acento no cuentan)', () => {
    expect(motivosPasswordDebil('Clave2026x')).toEqual(['ESPECIAL']);
    expect(motivosPasswordDebil('Clave 2026')).toEqual(['ESPECIAL']);
    expect(motivosPasswordDebil('Contraseña2026')).toEqual(['ESPECIAL']);
    expect(motivosPasswordDebil('Clave-2026')).toEqual([]);
    expect(motivosPasswordDebil('Clave_2026')).toEqual([]);
    expect(motivosPasswordDebil('Clave$2026')).toEqual([]);
  });

  it('informa todos los motivos juntos, en orden estable', () => {
    expect(motivosPasswordDebil('abc')).toEqual(['LARGO', 'MAYUSCULA', 'NUMERO', 'ESPECIAL']);
  });

  it('no puede ser igual al nombre de usuario (sin distinguir mayúsculas ni espacios de borde)', () => {
    expect(motivosPasswordDebil('Admin#2026', ' admin#2026 ')).toEqual(['USUARIO']);
    expect(motivosPasswordDebil('Admin#2026', 'otro')).toEqual([]);
  });

  it('tolera entradas no string sin lanzar', () => {
    expect(motivosPasswordDebil(undefined as unknown as string)).toEqual(['LARGO', 'MAYUSCULA', 'NUMERO', 'ESPECIAL']);
  });
});

describe('validarPoliticaPassword', () => {
  it('no lanza si cumple', () => {
    expect(() => validarPoliticaPassword('Clave#2026', 'pepe')).not.toThrow();
  });

  it('lanza PASSWORD_DEBIL:<primer motivo> (formato CÓDIGO:arg del catálogo de errores)', () => {
    expect(() => validarPoliticaPassword('abc', 'pepe')).toThrow('PASSWORD_DEBIL:LARGO');
    expect(() => validarPoliticaPassword('abcdefg1#', 'pepe')).toThrow('PASSWORD_DEBIL:MAYUSCULA');
    expect(() => validarPoliticaPassword('Admin#2026', 'admin#2026')).toThrow('PASSWORD_DEBIL:USUARIO');
  });
});

describe('mensajePasswordDebil', () => {
  it.each(['LARGO', 'MAYUSCULA', 'NUMERO', 'ESPECIAL', 'USUARIO'] as const)('hay mensaje humano para %s', (m) => {
    expect(mensajePasswordDebil(m).length).toBeGreaterThan(10);
  });
});
