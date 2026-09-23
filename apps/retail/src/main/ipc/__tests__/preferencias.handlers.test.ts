import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { preferenciasGetHandler, preferenciasGuardarHandler } from '@core/main';
import { getSessionData } from '@core/main';
import { navegacionRetail } from '../../../common/navegacion';

describe('preferencias handlers', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => {
    db = setupDb();
    clearSession();
  });

  it('get retorna null sin preferencias guardadas', () => {
    const session = loginAsAdmin(db);
    expect(preferenciasGetHandler(db, { usuario_id: session.id })).toBeNull();
  });

  it('save crea preferencias y get las devuelve', () => {
    const session = loginAsAdmin(db);
    preferenciasGuardarHandler(db, {
      usuario_id: session.id,
      tema: 'oscuro',
      acento: 'blue',
      ui_font: 'Inter',
      densidad: 'compact',
    }, navegacionRetail);
    const prefs = preferenciasGetHandler(db, { usuario_id: session.id });
    expect(prefs?.tema).toBe('oscuro');
    expect(prefs?.acento).toBe('blue');
    expect(prefs?.densidad).toBe('compact');
  });

  it('save actualiza preferencias existentes y bumps version', () => {
    const session = loginAsAdmin(db);
    preferenciasGuardarHandler(db, {
      usuario_id: session.id,
      tema: 'claro',
      acento: 'amber',
      ui_font: 'Hanken Grotesk',
      densidad: 'comfortable',
    }, navegacionRetail);
    preferenciasGuardarHandler(db, {
      usuario_id: session.id,
      tema: 'oscuro',
      acento: 'green',
      ui_font: 'IBM Plex Sans',
      densidad: 'compact',
    }, navegacionRetail);
    const prefs = preferenciasGetHandler(db, { usuario_id: session.id });
    expect(prefs?.tema).toBe('oscuro');
    expect(prefs?.version).toBe(2);
  });

  it('skin: default es "actual" cuando no se especifica; save lo persiste (ADR-086)', () => {
    const session = loginAsAdmin(db);
    // Guardar apariencia sin `skin` → default 'actual'.
    preferenciasGuardarHandler(db, {
      usuario_id: session.id,
      tema: 'claro',
      acento: 'amber',
      ui_font: 'Hanken Grotesk',
    }, navegacionRetail);
    expect(preferenciasGetHandler(db, { usuario_id: session.id })?.skin).toBe('actual');

    // Cambiar sólo el modo no pisa el resto de la apariencia.
    preferenciasGuardarHandler(db, { usuario_id: session.id, skin: 'maximizar' }, navegacionRetail);
    const prefs = preferenciasGetHandler(db, { usuario_id: session.id });
    expect(prefs?.skin).toBe('maximizar');
    expect(prefs?.acento).toBe('amber');
    expect(getSessionData()?.preferencias.skin).toBe('maximizar');
  });

  it('save lanza UNAUTHENTICATED sin sesion', () => {
    const session = loginAsAdmin(db);
    clearSession();
    expect(() =>
      preferenciasGuardarHandler(db, {
        usuario_id: session.id,
        tema: 'claro',
        acento: 'amber',
        ui_font: 'Hanken Grotesk',
        densidad: 'comfortable',
      }, navegacionRetail)
    ).toThrow('UNAUTHENTICATED');
  });
});

describe('preferencias — inicio y favoritos (ADR-080)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('guarda pantalla_inicio y favoritos', () => {
    const s = loginAsAdmin(db);
    preferenciasGuardarHandler(db, { usuario_id: s.id, pantalla_inicio: '/pos', favoritos: ['/stock'] }, navegacionRetail);
    const p = preferenciasGetHandler(db, { usuario_id: s.id });
    expect(p?.pantalla_inicio).toBe('/pos');
    expect(JSON.parse(p!.favoritos)).toEqual(['/stock']);
  });

  it('merge parcial: guardar solo favoritos no pisa el tema existente', () => {
    const s = loginAsAdmin(db);
    preferenciasGuardarHandler(db, { usuario_id: s.id, tema: 'oscuro', acento: 'green', ui_font: 'Nunito', densidad: 'compact' }, navegacionRetail);
    preferenciasGuardarHandler(db, { usuario_id: s.id, favoritos: ['/caja'] }, navegacionRetail);
    const p = preferenciasGetHandler(db, { usuario_id: s.id });
    expect(p?.tema).toBe('oscuro');
    expect(JSON.parse(p!.favoritos)).toEqual(['/caja']);
  });

  it('rechaza pantalla_inicio fuera de la allowlist', () => {
    const s = loginAsAdmin(db);
    expect(() => preferenciasGuardarHandler(db, { usuario_id: s.id, pantalla_inicio: '/hack' }, navegacionRetail)).toThrow('PANTALLA_INICIO_INVALIDA');
  });

  it('rechaza favoritos fuera de la allowlist', () => {
    const s = loginAsAdmin(db);
    expect(() => preferenciasGuardarHandler(db, { usuario_id: s.id, favoritos: ['/hack'] }, navegacionRetail)).toThrow('FAVORITOS_INVALIDOS');
  });

  it('dedup de favoritos al guardar', () => {
    const s = loginAsAdmin(db);
    preferenciasGuardarHandler(db, { usuario_id: s.id, favoritos: ['/pos', '/pos', '/stock'] }, navegacionRetail);
    const p = preferenciasGetHandler(db, { usuario_id: s.id });
    expect(JSON.parse(p!.favoritos)).toEqual(['/pos', '/stock']);
  });

  it('refresca la sesión en memoria del usuario actual con favoritos ya parseados', () => {
    const s = loginAsAdmin(db);
    preferenciasGuardarHandler(db, { usuario_id: s.id, favoritos: ['/pos', '/stock'] }, navegacionRetail);
    // whoami lee getSessionData(): debe reflejar el cambio, con favoritos como array (no JSON).
    expect(getSessionData()?.preferencias.favoritos).toEqual(['/pos', '/stock']);
  });
});
