import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { invalidateCachedParametro } from '@core/main';
import { parametrosGetHandler, parametrosSetHandler, parametrosListFlagsHandler, limpiarReferenciasInternas } from '@core/main';

describe('parametros handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
    invalidateCachedParametro();
  });

  describe('parametrosGetHandler', () => {
    it('devuelve valor del parámetro sembrado por la migración', () => {
      expect(parametrosGetHandler(db, { clave: 'umbral_diferencia_caja' })).toBe('50000');
    });

    it('devuelve null para clave inexistente', () => {
      expect(parametrosGetHandler(db, { clave: 'no_existe' })).toBeNull();
    });

    it('usa caché: segunda llamada no re-consulta DB', () => {
      parametrosGetHandler(db, { clave: 'umbral_diferencia_caja' });
      // Modify DB directly, bypassing handler
      db.update(schema.parametros_sistema)
        .set({ valor: '99999' })
        .where(eq(schema.parametros_sistema.clave, 'umbral_diferencia_caja'))
        .run();
      // Should return cached value, not the DB-modified value
      expect(parametrosGetHandler(db, { clave: 'umbral_diferencia_caja' })).toBe('50000');
    });
  });

  describe('parametrosSetHandler', () => {
    it('lanza FORBIDDEN sin sesión activa', () => {
      expect(() =>
        parametrosSetHandler(db, { clave: 'umbral_diferencia_caja', valor: '100000' })
      ).toThrow('FORBIDDEN');
    });

    it('actualiza valor en DB e invalida caché', () => {
      loginAsAdmin(db);
      parametrosSetHandler(db, { clave: 'umbral_diferencia_caja', valor: '100000' });
      // Cache was invalidated, next get reads from DB
      expect(parametrosGetHandler(db, { clave: 'umbral_diferencia_caja' })).toBe('100000');
    });

    it('persiste actualizado_en y actualizado_por', () => {
      loginAsAdmin(db);
      parametrosSetHandler(db, { clave: 'umbral_diferencia_caja', valor: '75000' });
      const row = db.select().from(schema.parametros_sistema)
        .where(eq(schema.parametros_sistema.clave, 'umbral_diferencia_caja'))
        .get();
      expect(row?.actualizado_en).toBeInstanceOf(Date);
      expect(row?.actualizado_por).toBeTruthy();
    });
  });

  describe('parametrosListFlagsHandler', () => {
    it('lanza FORBIDDEN sin sesión de supervisor', () => {
      expect(() => parametrosListFlagsHandler(db)).toThrow('FORBIDDEN');
    });

    it('devuelve los flags _habilitado, incluyendo hub_precios_habilitado en "true"', () => {
      loginAsAdmin(db);
      const flags = parametrosListFlagsHandler(db);
      expect(Array.isArray(flags)).toBe(true);
      const hub = flags.find(f => f.clave === 'hub_precios_habilitado');
      expect(hub).toBeDefined();
      expect(hub?.valor).toBe('true');
      for (const f of flags) {
        expect(f.clave.endsWith('_habilitado')).toBe(true);
      }
    });

    it('las descripciones no exponen referencias internas (ADR/SEC/PERF)', () => {
      loginAsAdmin(db);
      const flags = parametrosListFlagsHandler(db);
      for (const f of flags) {
        if (f.descripcion) {
          expect(f.descripcion).not.toMatch(/ADR-\d|SEC-\d|PERF-\d/i);
        }
      }
    });
  });

  describe('limpiarReferenciasInternas', () => {
    it('quita el paréntesis cuando solo contiene una referencia interna', () => {
      expect(limpiarReferenciasInternas('Feature flag del modulo Remitos (ADR-044). Default false.'))
        .toBe('Feature flag del modulo Remitos. Default false.');
    });

    it('quita referencias con barras (ADR-044/046)', () => {
      expect(limpiarReferenciasInternas('Modulo Presupuestos (ADR-044/046). Default false.'))
        .toBe('Modulo Presupuestos. Default false.');
    });

    it('conserva el texto útil dentro del paréntesis', () => {
      expect(limpiarReferenciasInternas('Búsqueda por similitud (token-set / ADR-063)'))
        .toBe('Búsqueda por similitud (token-set)');
    });

    it('quita el prefijo "ADR-067:" y capitaliza', () => {
      expect(limpiarReferenciasInternas('ADR-067: expansión de búsqueda por sinónimos'))
        .toBe('Expansión de búsqueda por sinónimos');
    });

    it('quita códigos SEC/PERF al final', () => {
      expect(limpiarReferenciasInternas('Auto-bloqueo por inactividad (SEC-3).'))
        .toBe('Auto-bloqueo por inactividad.');
      expect(limpiarReferenciasInternas('Vistos recientemente (PERF-2).'))
        .toBe('Vistos recientemente.');
    });

    it('deja null como null', () => {
      expect(limpiarReferenciasInternas(null)).toBeNull();
    });
  });
});
