import { describe, it, expect } from 'vitest';
import { crearLimiteIntentos, MAX_FALLOS, BLOQUEO_MS, limiteIntentos } from './intentos';

// Revisión 2026-10-20 (P1): ni el login ni la autorización de Supervisor limitaban intentos
// (el costo de scrypt era el único freno). Decisión del usuario: 3 fallos seguidos → 15 minutos.
function conReloj() {
  let t = 1_000_000;
  const limite = crearLimiteIntentos({ ahora: () => t });
  return { limite, avanzar: (ms: number) => { t += ms; } };
}

describe('crearLimiteIntentos', () => {
  it('los valores por defecto son 3 intentos y 15 minutos', () => {
    expect(MAX_FALLOS).toBe(3);
    expect(BLOQUEO_MS).toBe(15 * 60 * 1000);
  });

  it('sin historial no bloquea', () => {
    const { limite } = conReloj();
    expect(() => limite.verificar('pepe')).not.toThrow();
  });

  it('2 fallos no bloquean; el 3º sí, con los segundos restantes en el error', () => {
    const { limite } = conReloj();
    limite.registrarFallo('pepe');
    limite.registrarFallo('pepe');
    expect(() => limite.verificar('pepe')).not.toThrow();
    limite.registrarFallo('pepe');
    expect(() => limite.verificar('pepe')).toThrow('CUENTA_BLOQUEADA:900');
  });

  it('los segundos restantes bajan con el reloj y se redondean hacia arriba', () => {
    const { limite, avanzar } = conReloj();
    for (let i = 0; i < 3; i++) limite.registrarFallo('pepe');
    avanzar(60_000);
    expect(() => limite.verificar('pepe')).toThrow('CUENTA_BLOQUEADA:840');
    avanzar(839_500);
    expect(() => limite.verificar('pepe')).toThrow('CUENTA_BLOQUEADA:1');
  });

  it('al cumplirse los 15 minutos se desbloquea y el contador vuelve a cero', () => {
    const { limite, avanzar } = conReloj();
    for (let i = 0; i < 3; i++) limite.registrarFallo('pepe');
    avanzar(BLOQUEO_MS);
    expect(() => limite.verificar('pepe')).not.toThrow();
    limite.registrarFallo('pepe');
    limite.registrarFallo('pepe');
    expect(() => limite.verificar('pepe')).not.toThrow(); // 2 de 3: todavía no
    limite.registrarFallo('pepe');
    expect(() => limite.verificar('pepe')).toThrow('CUENTA_BLOQUEADA');
  });

  it('un intento fallido durante el bloqueo no lo extiende', () => {
    const { limite, avanzar } = conReloj();
    for (let i = 0; i < 3; i++) limite.registrarFallo('pepe');
    avanzar(300_000);
    limite.registrarFallo('pepe');
    avanzar(BLOQUEO_MS - 300_000);
    expect(() => limite.verificar('pepe')).not.toThrow();
  });

  it('un acierto reinicia el contador', () => {
    const { limite } = conReloj();
    limite.registrarFallo('pepe');
    limite.registrarFallo('pepe');
    limite.registrarExito('pepe');
    limite.registrarFallo('pepe');
    limite.registrarFallo('pepe');
    expect(() => limite.verificar('pepe')).not.toThrow();
  });

  it('cada usuario tiene su propio contador y la clave no distingue mayúsculas ni espacios de borde', () => {
    const { limite } = conReloj();
    for (let i = 0; i < 3; i++) limite.registrarFallo('Pepe ');
    expect(() => limite.verificar('pepe')).toThrow('CUENTA_BLOQUEADA');
    expect(() => limite.verificar('otro')).not.toThrow();
  });

  it('reiniciar() borra todo el estado', () => {
    const { limite } = conReloj();
    for (let i = 0; i < 3; i++) limite.registrarFallo('pepe');
    limite.reiniciar();
    expect(() => limite.verificar('pepe')).not.toThrow();
  });

  it('acepta otros parámetros', () => {
    let t = 0;
    const limite = crearLimiteIntentos({ maxFallos: 1, bloqueoMs: 5000, ahora: () => t });
    limite.registrarFallo('a');
    expect(() => limite.verificar('a')).toThrow('CUENTA_BLOQUEADA:5');
    t = 5000;
    expect(() => limite.verificar('a')).not.toThrow();
  });
});

describe('limiteIntentos (instancia compartida del main)', () => {
  it('existe y arranca sin bloqueos', () => {
    limiteIntentos.reiniciar();
    expect(() => limiteIntentos.verificar('nadie')).not.toThrow();
  });
});
