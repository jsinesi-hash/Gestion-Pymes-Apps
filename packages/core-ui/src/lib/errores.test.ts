import { describe, it, expect } from 'vitest';
import { traducirError } from './errores';

describe('traducirError — códigos de dominio de Elaborados (ADR-102)', () => {
  it('STOCK_INSUFICIENTE con nombre lo muestra', () => {
    expect(traducirError(new Error('STOCK_INSUFICIENTE:Palito')).mensaje).toContain('Palito');
  });
  it('STOCK_INSUFICIENTE sin nombre mantiene el mensaje genérico', () => {
    expect(traducirError(new Error('STOCK_INSUFICIENTE')).mensaje).toBe('No hay stock suficiente para completar la operación.');
  });
  it.each([
    'RECETA_NO_DEFINIDA', 'RINDE_INVALIDO', 'ARTICULO_NO_ELABORADO', 'CANTIDAD_PRODUCIDA_INVALIDA',
    'ANULACION_REQUIERE_AUTORIZACION', 'YA_ANULADA',
  ])('%s tiene mensaje propio (no cae al genérico)', (codigo) => {
    const m = traducirError(new Error(`Error invoking remote method 'x': Error: ${codigo}`)).mensaje;
    expect(m).not.toMatch(/No se pudo completar la operación/);
  });
});

describe('traducirError — DEMO_EN_USO (ADR-110)', () => {
  it('nombra qué impide vaciar los datos demo', () => {
    const m = traducirError(new Error('DEMO_EN_USO:ventas,compras')).mensaje;
    expect(m).toContain('ventas');
    expect(m).toContain('compras');
    expect(m).not.toContain('DEMO_EN_USO');
  });
  it('sin detalle usa un mensaje genérico', () => {
    expect(traducirError(new Error('DEMO_EN_USO')).mensaje).toMatch(/datos demo/i);
  });
});

describe('códigos de desactivación de usuario (P0 2026-10-20)', () => {
  it('traduce LAST_SUPERVISOR y AUTO_DESACTIVACION, también envueltos por Electron', () => {
    expect(traducirError(new Error('LAST_SUPERVISOR')).mensaje).toMatch(/al menos un usuario activo que pueda administrar/);
    expect(traducirError(new Error("Error invoking remote method 'usuario:desactivar': Error: AUTO_DESACTIVACION")).mensaje)
      .toMatch(/propio usuario/);
  });
});

describe('códigos de presentación en venta (P0 2026-10-20)', () => {
  it('traduce FACTOR_INVALIDO y PRESENTACION_INVALIDA', () => {
    expect(traducirError(new Error('FACTOR_INVALIDO')).mensaje).toMatch(/presentación/);
    expect(traducirError(new Error('PRESENTACION_INVALIDA')).mensaje).toMatch(/presentación/);
  });
});

describe('códigos de restauración (P0 2026-10-20)', () => {
  it('traduce RESTORE_SWAP_FALLIDO, RESTORE_ROLLBACK_FALLIDO y RESTORE_RUTA_BD con detalle técnico', () => {
    expect(traducirError(new Error('RESTORE_SWAP_FALLIDO: no se pudo colocar la BD (EBUSY)')).mensaje).toMatch(/se reiniciará/);
    expect(traducirError(new Error('RESTORE_ROLLBACK_FALLIDO: la base original está en datos/app.db.pre-restore.bak')).mensaje).toMatch(/NO reinicies/);
    expect(traducirError(new Error('RESTORE_RUTA_BD: la conexión actual no corresponde a un archivo')).mensaje).toMatch(/base de datos/);
  });
});

describe('códigos de login y contraseña (P1 2026-10-20)', () => {
  it('CUENTA_BLOQUEADA muestra los minutos restantes, también envuelto por Electron', () => {
    expect(traducirError(new Error('CUENTA_BLOQUEADA:900')).mensaje).toMatch(/15 minutos/);
    expect(traducirError(new Error('CUENTA_BLOQUEADA:61')).mensaje).toMatch(/2 minutos/);
    expect(traducirError(new Error('CUENTA_BLOQUEADA:30')).mensaje).toMatch(/1 minuto\b/);
    expect(traducirError(new Error("Error invoking remote method 'auth:login': Error: CUENTA_BLOQUEADA:900")).mensaje)
      .toMatch(/Demasiados intentos/);
  });

  it.each([
    ['LARGO', /8 caracteres/],
    ['MAYUSCULA', /mayúscula/],
    ['NUMERO', /número/],
    ['ESPECIAL', /carácter especial/],
    ['USUARIO', /nombre de usuario/],
  ])('PASSWORD_DEBIL:%s tiene un mensaje claro', (motivo, patron) => {
    expect(traducirError(new Error(`PASSWORD_DEBIL:${motivo}`)).mensaje).toMatch(patron);
  });
});

describe('códigos de totales de venta (P1 2026-10-20)', () => {
  it('traduce TOTALES_INCONSISTENTES y PRECIO_INVALIDO', () => {
    expect(traducirError(new Error('TOTALES_INCONSISTENTES')).mensaje).toMatch(/no coinciden/);
    expect(traducirError(new Error('PRECIO_INVALIDO')).mensaje).toMatch(/precio inválido/);
  });
});
