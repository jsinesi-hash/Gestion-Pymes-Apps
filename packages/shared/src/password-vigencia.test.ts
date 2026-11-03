import { describe, it, expect } from 'vitest';
import {
  PASSWORD_VIGENCIA_DIAS,
  passwordVencida,
  diasRestantesPassword,
  emailValido,
  normalizarEmail,
} from './password-vigencia.js';

const DIA = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-03T12:00:00.000Z');
const despues = (ms: number) => new Date(T0.getTime() + ms);

describe('PASSWORD_VIGENCIA_DIAS', () => {
  it('son 30 días (pedido de producto, ADR-136)', () => {
    expect(PASSWORD_VIGENCIA_DIAS).toBe(30);
  });
});

describe('passwordVencida', () => {
  it('no vence antes de los 30 días', () => {
    expect(passwordVencida(T0, despues(0))).toBe(false);
    expect(passwordVencida(T0, despues(29 * DIA))).toBe(false);
    expect(passwordVencida(T0, despues(30 * DIA - 1))).toBe(false);
  });

  it('vence al cumplirse los 30 días exactos', () => {
    expect(passwordVencida(T0, despues(30 * DIA))).toBe(true);
    expect(passwordVencida(T0, despues(90 * DIA))).toBe(true);
  });

  it('sin fecha de último cambio cuenta como vencida', () => {
    expect(passwordVencida(null, T0)).toBe(true);
    expect(passwordVencida(undefined, T0)).toBe(true);
  });

  it('una fecha inválida cuenta como vencida (falla del lado seguro)', () => {
    expect(passwordVencida(new Date('no es una fecha'), T0)).toBe(true);
  });

  it('un reloj atrasado (fecha de cambio en el futuro) no vence ni extiende más de la vigencia', () => {
    expect(passwordVencida(despues(10 * DIA), T0)).toBe(false);
  });
});

describe('diasRestantesPassword', () => {
  it('30 el mismo día y baja de a uno', () => {
    expect(diasRestantesPassword(T0, despues(0))).toBe(30);
    expect(diasRestantesPassword(T0, despues(1 * DIA))).toBe(29);
    expect(diasRestantesPassword(T0, despues(29 * DIA))).toBe(1);
  });

  it('redondea hacia arriba: quedando medio día todavía es 1', () => {
    expect(diasRestantesPassword(T0, despues(29 * DIA + DIA / 2))).toBe(1);
  });

  it('0 cuando venció o no hay fecha', () => {
    expect(diasRestantesPassword(T0, despues(30 * DIA))).toBe(0);
    expect(diasRestantesPassword(T0, despues(100 * DIA))).toBe(0);
    expect(diasRestantesPassword(null, T0)).toBe(0);
  });

  it('nunca supera la vigencia aunque el reloj esté atrasado', () => {
    expect(diasRestantesPassword(despues(10 * DIA), T0)).toBe(30);
  });
});

describe('normalizarEmail', () => {
  it('recorta espacios y pasa a minúsculas', () => {
    expect(normalizarEmail('  Ana.Perez@Ejemplo.COM ')).toBe('ana.perez@ejemplo.com');
  });
  it('un valor vacío o ausente queda como cadena vacía', () => {
    expect(normalizarEmail('')).toBe('');
    expect(normalizarEmail('   ')).toBe('');
    expect(normalizarEmail(null)).toBe('');
    expect(normalizarEmail(undefined)).toBe('');
  });
});

describe('emailValido', () => {
  it('acepta direcciones comunes', () => {
    for (const e of ['ana@ejemplo.com', 'ana.perez+caja@mi-negocio.com.ar', 'a@b.co', ' Ana@Ejemplo.com ']) {
      expect(emailValido(e)).toBe(true);
    }
  });

  it('rechaza lo que no es una dirección', () => {
    for (const e of ['', '   ', 'ana', 'ana@', '@ejemplo.com', 'ana@ejemplo', 'ana@@ejemplo.com', 'ana perez@ejemplo.com', 'ana@ejem plo.com']) {
      expect(emailValido(e)).toBe(false);
    }
  });

  it('rechaza valores que no son texto', () => {
    expect(emailValido(null)).toBe(false);
    expect(emailValido(undefined)).toBe(false);
  });

  it('rechaza direcciones de más de 254 caracteres', () => {
    expect(emailValido('a'.repeat(250) + '@b.co')).toBe(false);
  });
});
