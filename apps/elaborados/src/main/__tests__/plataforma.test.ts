import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  clienteUpsertHandler,
  clienteListHandler,
  cajaAbrirHandler,
  cajaCerrarHandler,
  preferenciasGuardarHandler,
  PERMISOS_CORE,
} from '@core/main';
import { PERMISOS_ELABORADOS } from '../auth/seed';
import { navegacionElaborados } from '../../common/navegacion';

describe('Elaborados E1 — plataforma del core sobre su propia BD', () => {
  beforeEach(() => clearSession());

  it('seed: admin Supervisor con los permisos del core + los propios de Elaborados', () => {
    const db = setupDb();
    const s = loginAsAdmin(db);
    const esperados = [...PERMISOS_CORE, ...PERMISOS_ELABORADOS].map((p) => p.codigo).sort();
    expect([...s.permisos].sort()).toEqual(esperados);
  });

  it('clientes: alta y listado', () => {
    const db = setupDb();
    loginAsAdmin(db);
    clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
    });
    expect(clienteListHandler(db).length).toBeGreaterThanOrEqual(1);
  });

  it('caja: abrir y cerrar sin hooks', () => {
    const db = setupDb();
    loginAsAdmin(db);
    const c = cajaAbrirHandler(db, { monto_inicial: 0 });
    expect(cajaCerrarHandler(db, { caja_id: c.id, monto_contado: 0 }).estado).toBe('cerrada');
  });

  it('preferencias valida contra la navegación de Elaborados', () => {
    const db = setupDb();
    const s = loginAsAdmin(db);
    expect(() =>
      preferenciasGuardarHandler(db, { usuario_id: s.id, pantalla_inicio: '/pos' }, navegacionElaborados)
    ).toThrow('PANTALLA_INICIO_INVALIDA');
    expect(() =>
      preferenciasGuardarHandler(db, { usuario_id: s.id, pantalla_inicio: '/caja' }, navegacionElaborados)
    ).not.toThrow();
  });
});
