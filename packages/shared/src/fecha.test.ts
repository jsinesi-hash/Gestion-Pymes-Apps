import { describe, it, expect } from 'vitest';
import { ymdLocal, ymdHmLocal, hoyYmd, inicioDelDia, finDelDia } from './fecha.js';

// Todas las aserciones de este archivo son independientes de la zona horaria en la que
// corra la suite: afirman sobre los componentes LOCALES del Date, no sobre su epoch.
// Con la implementación ingenua (`new Date('2026-01-15')`, que parsea como medianoche
// UTC) fallan en cualquier zona con offset negativo — Buenos Aires (-3) incluida.

describe('inicioDelDia', () => {
  it('devuelve la medianoche LOCAL del día indicado a partir de YYYY-MM-DD', () => {
    const d = inicioDelDia('2026-01-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('acepta un Date de cualquier hora y lo baja a la medianoche de ESE día local', () => {
    const d = inicioDelDia(new Date(2026, 0, 15, 23, 30, 12, 500));
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });
});

describe('finDelDia', () => {
  it('devuelve las 23:59:59.999 LOCALES del día indicado a partir de YYYY-MM-DD', () => {
    const d = finDelDia('2026-01-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
    expect(d.getMilliseconds()).toBe(999);
  });

  it('acepta un Date de cualquier hora y lo sube al fin de ESE día local', () => {
    const d = finDelDia(new Date(2026, 0, 15, 0, 15));
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(23);
  });

  it('cubre una venta de las 23:30 del mismo día', () => {
    const venta = new Date(2026, 0, 15, 23, 30);
    expect(venta.getTime()).toBeLessThanOrEqual(finDelDia('2026-01-15').getTime());
    expect(venta.getTime()).toBeGreaterThanOrEqual(inicioDelDia('2026-01-15').getTime());
  });

  it('NO cubre una venta de las 00:15 del día siguiente', () => {
    const venta = new Date(2026, 0, 16, 0, 15);
    expect(venta.getTime()).toBeGreaterThan(finDelDia('2026-01-15').getTime());
  });
});

describe('ymdLocal', () => {
  it('usa los componentes locales, no UTC', () => {
    // A las 23:30 de Buenos Aires ya es el día siguiente en UTC: toISOString() daría 16.
    expect(ymdLocal(new Date(2026, 0, 15, 23, 30))).toBe('2026-01-15');
  });

  it('completa mes y día con cero a la izquierda', () => {
    expect(ymdLocal(new Date(2026, 2, 5))).toBe('2026-03-05');
  });
});

describe('hoyYmd', () => {
  it('coincide con la fecha de calendario local de hoy', () => {
    expect(hoyYmd()).toBe(ymdLocal(new Date()));
  });
});

describe('ymdHmLocal', () => {
  it('formatea en hora local para <input type="datetime-local">', () => {
    expect(ymdHmLocal(new Date(2026, 0, 15, 23, 30))).toBe('2026-01-15T23:30');
  });
});

describe('ida y vuelta', () => {
  it('ymdLocal(inicioDelDia(s)) devuelve el mismo día', () => {
    expect(ymdLocal(inicioDelDia('2026-01-15'))).toBe('2026-01-15');
  });

  it('ymdLocal(finDelDia(s)) devuelve el mismo día', () => {
    // Este es el caso que rompía el reporte de Ventas: el tope del rango se corría al día anterior.
    expect(ymdLocal(finDelDia('2026-01-15'))).toBe('2026-01-15');
  });
});
