import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { invalidateCachedParametro } from '@core/main';
import { avisoCierreCaja } from '../caja-cierre-aviso';
import {
  cajaGetActivaHandler,
  cajaAbrirHandler,
  cajaAddMovimientoHandler,
  cajaCalcularCierreHandler,
  cajaCerrarHandler,
} from '@core/main';

describe('caja handlers — apertura y movimientos', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
    invalidateCachedParametro();
  });

  describe('cajaGetActivaHandler', () => {
    it('devuelve null cuando no hay caja abierta', () => {
      loginAsAdmin(db);
      expect(cajaGetActivaHandler(db)).toBeNull();
    });

    it('devuelve la caja abierta del usuario', () => {
      loginAsAdmin(db);
      cajaAbrirHandler(db, { monto_inicial: 5000 });
      const caja = cajaGetActivaHandler(db);
      expect(caja).not.toBeNull();
      expect(caja!.estado).toBe('abierta');
      expect(caja!.monto_inicial).toBe(5000);
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => cajaGetActivaHandler(db)).toThrow('UNAUTHENTICATED');
    });
  });

  describe('cajaAbrirHandler', () => {
    it('crea caja con estado abierta y monto_inicial', () => {
      loginAsAdmin(db);
      const caja = cajaAbrirHandler(db, { monto_inicial: 10000, observaciones: 'Apertura test' });
      expect(caja.estado).toBe('abierta');
      expect(caja.monto_inicial).toBe(10000);
      expect(caja.observaciones).toBe('Apertura test');
    });

    it('lanza ALREADY_OPEN si el usuario ya tiene caja abierta', () => {
      loginAsAdmin(db);
      cajaAbrirHandler(db, { monto_inicial: 1000 });
      expect(() => cajaAbrirHandler(db, { monto_inicial: 2000 })).toThrow('ALREADY_OPEN');
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => cajaAbrirHandler(db, { monto_inicial: 1000 })).toThrow('UNAUTHENTICATED');
    });
  });

  describe('cajaAddMovimientoHandler', () => {
    it('crea MovimientoCaja con referencia_tipo "manual" y referencia_id = id propio', () => {
      loginAsAdmin(db);
      const caja = cajaAbrirHandler(db, { monto_inicial: 5000 });
      const mov = cajaAddMovimientoHandler(db, {
        caja_id: caja.id,
        tipo: 'egreso',
        motivo: 'retiro',
        monto: 1000,
        forma_pago: 'efectivo',
      });
      expect(mov.referencia_tipo).toBe('manual');
      expect(mov.referencia_id).toBe(mov.id);
      expect(mov.tipo).toBe('egreso');
      expect(mov.motivo).toBe('retiro');
      expect(mov.monto).toBe(1000);
    });

    it('lanza CAJA_NOT_FOUND con id inválido', () => {
      loginAsAdmin(db);
      expect(() =>
        cajaAddMovimientoHandler(db, { caja_id: 'no-existe', tipo: 'egreso', motivo: 'retiro', monto: 500 })
      ).toThrow('CAJA_NOT_FOUND');
    });

    it('lanza CAJA_CERRADA sobre caja cerrada', () => {
      loginAsAdmin(db);
      const caja = cajaAbrirHandler(db, { monto_inicial: 5000 });
      db.update(schema.caja)
        .set({ estado: 'cerrada' })
        .where(eq(schema.caja.id, caja.id))
        .run();
      expect(() =>
        cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'egreso', motivo: 'retiro', monto: 100 })
      ).toThrow('CAJA_CERRADA');
    });
  });
});

describe('cajaCalcularCierreHandler', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
    invalidateCachedParametro();
  });

  it('devuelve monto_inicial como esperado_efectivo sin movimientos', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 10000 });
    const resumen = cajaCalcularCierreHandler(db, { caja_id: caja.id });
    expect(resumen.esperado_efectivo).toBe(10000);
    expect(resumen.monto_inicial).toBe(10000);
    expect(resumen.ventas_count).toBe(0);
  });

  it('suma ingresos y resta egresos de efectivo al esperado', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 10000 });
    cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'ingreso', motivo: 'aporte', monto: 5000, forma_pago: 'efectivo' });
    cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'egreso', motivo: 'retiro', monto: 2000, forma_pago: 'efectivo' });
    const resumen = cajaCalcularCierreHandler(db, { caja_id: caja.id });
    expect(resumen.esperado_efectivo).toBe(13000); // 10000 + 5000 - 2000
  });

  it('desglosa por_forma_pago correctamente', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'ingreso', motivo: 'aporte', monto: 3000, forma_pago: 'efectivo' });
    cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'ingreso', motivo: 'aporte', monto: 1000, forma_pago: 'transferencia' });
    const resumen = cajaCalcularCierreHandler(db, { caja_id: caja.id });
    const efectivo = resumen.por_forma_pago.find(f => f.forma_pago === 'efectivo');
    const transferencia = resumen.por_forma_pago.find(f => f.forma_pago === 'transferencia');
    expect(efectivo?.ingresado).toBe(3000);
    expect(transferencia?.ingresado).toBe(1000);
  });

  it('lanza CAJA_NOT_FOUND con id inválido', () => {
    expect(() => cajaCalcularCierreHandler(db, { caja_id: 'no-existe' })).toThrow('CAJA_NOT_FOUND');
  });
});

describe('cajaCerrarHandler', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
    invalidateCachedParametro();
  });

  it('cierra caja con diferencia <= umbral sin requerir credenciales', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 10000 });
    const cerrada = cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 10000 });
    expect(cerrada.estado).toBe('cerrada');
    expect(cerrada.monto_esperado).toBe(10000);
    expect(cerrada.monto_contado).toBe(10000);
    expect(cerrada.diferencia).toBe(0);
    expect(cerrada.supervisor_autorizacion_id).toBeNull();
  });

  it('persiste fecha_cierre y usuario_cierre_id', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 5000 });
    const cerrada = cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 5000 });
    expect(cerrada.fecha_cierre).toBeInstanceOf(Date);
    expect(cerrada.usuario_cierre_id).toBeTruthy();
  });

  it('lanza DIFERENCIA_REQUIERE_AUTORIZACION si |diferencia| > umbral sin credenciales', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 10000 });
    // diferencia = 70000 - 10000 = 60000 > umbral 50000
    expect(() =>
      cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 70000 })
    ).toThrow('DIFERENCIA_REQUIERE_AUTORIZACION');
  });

  it('lanza SUPERVISOR_INVALIDO con credenciales incorrectas', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 10000 });
    expect(() =>
      cajaCerrarHandler(db, {
        caja_id: caja.id, monto_contado: 70000,
        supervisor_credenciales: { nombre_usuario: 'admin', password: 'wrong' },
      })
    ).toThrow('SUPERVISOR_INVALIDO');
  });

  it('cierra con autorización cuando credenciales del supervisor son correctas', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 10000 });
    const cerrada = cajaCerrarHandler(db, {
      caja_id: caja.id,
      monto_contado: 70000,
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
    });
    expect(cerrada.estado).toBe('cerrada');
    expect(cerrada.supervisor_autorizacion_id).toBeTruthy();
    expect(Math.abs(cerrada.diferencia!)).toBeGreaterThan(50000);
  });

  it('lanza CAJA_NOT_FOUND con id inválido', () => {
    loginAsAdmin(db);
    expect(() =>
      cajaCerrarHandler(db, { caja_id: 'no-existe', monto_contado: 0 })
    ).toThrow('CAJA_NOT_FOUND');
  });
});

describe('cajaCerrarHandler — productor de aviso de cierre (ADR-048)', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
    invalidateCachedParametro();
  });

  it('emite un aviso in_app de origen cierre_caja al cerrar (sin descuadre)', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 5000 });
    cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 5000 }, { onCajaCerrada: avisoCierreCaja });
    const avisos = db.select().from(schema.aviso).where(eq(schema.aviso.origen_tipo, 'cierre_caja')).all();
    expect(avisos.length).toBeGreaterThanOrEqual(1);
    expect(avisos.some((a) => a.canal === 'in_app')).toBe(true);
    expect(avisos.every((a) => a.origen_id === caja.id)).toBe(true);
    expect(avisos.every((a) => a.severidad === 'normal')).toBe(true);
  });

  it('marca severidad alerta cuando |diferencia| supera $2.000', () => {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 5000 });
    // ingreso efectivo de 10000 -> esperado_efectivo = 15000
    cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'ingreso', motivo: 'aporte', monto: 10000, forma_pago: 'efectivo' });
    // contado 12000 -> diferencia -3000 ( > $2.000, pero < umbral_diferencia_caja 50000, no requiere supervisor )
    cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 12000 }, { onCajaCerrada: avisoCierreCaja });
    const inApp = db.select().from(schema.aviso).where(and(eq(schema.aviso.origen_tipo, 'cierre_caja'), eq(schema.aviso.canal, 'in_app'))).get();
    expect(inApp!.severidad).toBe('alerta');
  });
});
