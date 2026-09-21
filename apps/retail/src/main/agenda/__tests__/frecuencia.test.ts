import { describe, it, expect } from 'vitest';
import { calcularProximoDisparo, type FrecuenciaDef } from '../frecuencia';

const base = (o: Partial<FrecuenciaDef>): FrecuenciaDef => ({
  frecuencia_tipo: 'diaria', intervalo: 1, hora: '09:00',
  fecha_inicio: new Date('2026-01-01T00:00:00'), ...o,
});

describe('calcularProximoDisparo', () => {
  it('unica: devuelve fecha_inicio@hora si es futura, null si ya paso', () => {
    const f = base({ frecuencia_tipo: 'unica', fecha_inicio: new Date('2026-03-10T00:00:00') });
    expect(calcularProximoDisparo(f, new Date('2026-03-01T00:00:00'))!.toISOString())
      .toBe(new Date('2026-03-10T09:00:00').toISOString());
    expect(calcularProximoDisparo(f, new Date('2026-03-11T00:00:00'))).toBeNull();
  });

  it('diaria: suma 1 dia', () => {
    const f = base({ frecuencia_tipo: 'diaria' });
    const p = calcularProximoDisparo(f, new Date('2026-01-05T10:00:00'))!;
    expect(p.toISOString()).toBe(new Date('2026-01-06T09:00:00').toISOString());
  });

  it('diaria: si desde es antes del inicio, devuelve el inicio', () => {
    const f = base({ frecuencia_tipo: 'diaria', fecha_inicio: new Date('2026-02-01T00:00:00') });
    const p = calcularProximoDisparo(f, new Date('2026-01-15T10:00:00'))!;
    expect(p.toISOString()).toBe(new Date('2026-02-01T09:00:00').toISOString());
  });

  it('cada_n_dias: respeta el intervalo desde fecha_inicio', () => {
    const f = base({ frecuencia_tipo: 'cada_n_dias', intervalo: 3 });
    // desde 2026-01-01, proximos: 01-04, 01-07, ...
    const p = calcularProximoDisparo(f, new Date('2026-01-04T12:00:00'))!;
    expect(p.toISOString()).toBe(new Date('2026-01-07T09:00:00').toISOString());
  });

  it('semanal: cae en el dia_semana pedido', () => {
    // 2026-01-01 es jueves(4). Pido lunes(1).
    const f = base({ frecuencia_tipo: 'semanal', dia_semana: 1 });
    const p = calcularProximoDisparo(f, new Date('2026-01-01T00:00:00'))!;
    expect(p.getDay()).toBe(1);
    expect(p.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00').getTime());
  });

  it('semanal con intervalo 2: salta de a dos semanas', () => {
    const f = base({ frecuencia_tipo: 'semanal', dia_semana: 4, intervalo: 2 }); // jueves
    // inicio jueves 2026-01-01. desde justo despues -> +2 semanas = 2026-01-15
    const p = calcularProximoDisparo(f, new Date('2026-01-01T10:00:00'))!;
    expect(p.getDay()).toBe(4);
    expect(p.toISOString()).toBe(new Date('2026-01-15T09:00:00').toISOString());
  });

  it('mensual: dia_mes=31 hace clamp al ultimo dia en meses cortos', () => {
    const f = base({ frecuencia_tipo: 'mensual', dia_mes: 31, fecha_inicio: new Date('2026-01-31T00:00:00') });
    // proxima tras enero: febrero -> 28 (2026 no bisiesto)
    const p = calcularProximoDisparo(f, new Date('2026-01-31T12:00:00'))!;
    expect(p.getFullYear()).toBe(2026);
    expect(p.getMonth()).toBe(1);   // febrero
    expect(p.getDate()).toBe(28);   // clamp
  });

  it('mensual: dia_mes=15 normal', () => {
    const f = base({ frecuencia_tipo: 'mensual', dia_mes: 15, fecha_inicio: new Date('2026-01-15T00:00:00') });
    const p = calcularProximoDisparo(f, new Date('2026-01-20T12:00:00'))!;
    expect(p.getMonth()).toBe(1);
    expect(p.getDate()).toBe(15);
  });

  it('respeta fecha_fin: null si la proxima supera el fin', () => {
    const f = base({ frecuencia_tipo: 'diaria', fecha_fin: new Date('2026-01-05T23:59:59') });
    expect(calcularProximoDisparo(f, new Date('2026-01-05T10:00:00'))).toBeNull();
  });

  it('hora por defecto 09:00 si no se especifica', () => {
    const f = base({ frecuencia_tipo: 'diaria', hora: null });
    const p = calcularProximoDisparo(f, new Date('2026-01-05T10:00:00'))!;
    expect(p.getHours()).toBe(9);
    expect(p.getMinutes()).toBe(0);
  });
});
