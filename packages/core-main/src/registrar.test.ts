import { describe, it, expect } from 'vitest';
import type { IpcMain } from 'electron';
import { registerCoreHandlers, type CoreHandlersOpts } from './registrar';
import { clearSession } from './auth/session';

// Revisión 2026-10-20 (P2): el handler de `impuesto` era idéntico en Retail y Elaborados (tabla en
// @core/db) y pasó al núcleo. `ipcMain.handle` lanza si un canal se registra dos veces, así que
// además de comprobar que el canal está, se comprueba que ninguno se repite.
function registrar(extra: Partial<CoreHandlersOpts> = {}) {
  const handlers = new Map<string, (...a: any[]) => unknown>();
  const ipcMain = { handle: (canal: string, h: (...a: any[]) => unknown) => { handlers.set(canal, h); }, on: () => {} } as unknown as IpcMain;
  registerCoreHandlers(ipcMain, {} as never, { migrationsFolder: 'migraciones', navegacion: {} as never, ...extra });
  return handlers;
}

function canalesRegistrados(): string[] {
  return [...registrar().keys()];
}

describe('registerCoreHandlers', () => {
  it('registra el canal universal impuesto:list', () => {
    expect(canalesRegistrados()).toContain('impuesto:list');
  });

  it('registra los canales universales de siempre', () => {
    const c = canalesRegistrados();
    for (const esperado of ['auth:login', 'caja:abrir', 'usuario:list', 'backup:ejecutar', 'restore:validar']) {
      expect(c).toContain(esperado);
    }
  });

  it('no registra ningún canal dos veces (Electron lanzaría al arrancar)', () => {
    const c = canalesRegistrados();
    const repetidos = c.filter((canal, i) => c.indexOf(canal) !== i);
    expect(repetidos).toEqual([]);
  });

  // Revisión 2026-10-20 (P2): `venta:listByCaja` (lo registraban Retail y Elaborados por separado y
  // respondía sin sesión) y `menu:rebuild` (solo Retail; el renderer lo llamaba con `?.`).
  it('registra venta:listByCaja y menu:rebuild como canales universales', () => {
    const c = canalesRegistrados();
    expect(c).toContain('venta:listByCaja');
    expect(c).toContain('menu:rebuild');
  });

  it('venta:listByCaja sin sesión rechaza con UNAUTHENTICATED', async () => {
    clearSession();
    const h = registrar().get('venta:listByCaja')!;
    await expect(Promise.resolve().then(() => h({}, { caja_id: 'x' }))).rejects.toThrow('UNAUTHENTICATED');
  });

  it('menu:rebuild invoca reconstruirMenu y, sin él, no hace nada', async () => {
    let llamadas = 0;
    await registrar({ reconstruirMenu: () => { llamadas++; } }).get('menu:rebuild')!({});
    expect(llamadas).toBe(1);
    await expect(Promise.resolve(registrar().get('menu:rebuild')!({}))).resolves.toBeUndefined();
  });
});

// ADR-142: el SMTP (configuración, clave, enviador y pantalla) pasó de Retail al núcleo para que la
// recuperación de contraseña (ADR-137) la tengan todas las apps.
describe('registerCoreHandlers — SMTP en el núcleo (ADR-142)', () => {
  it('registra los cuatro canales smtp:*', () => {
    const c = canalesRegistrados();
    for (const esperado of ['smtp:getConfig', 'smtp:setConfig', 'smtp:setPassword', 'smtp:probar']) {
      expect(c).toContain(esperado);
    }
  });

  it('la recuperación de contraseña respeta un enviador de correo inyectado (override)', async () => {
    const disponible = registrar({ enviadorCorreo: { disponible: () => true, enviar: async () => {} } }).get('auth:recuperacionDisponible')!;
    const noDisponible = registrar({ enviadorCorreo: { disponible: () => false, enviar: async () => {} } }).get('auth:recuperacionDisponible')!;
    expect(await disponible({})).toBe(true);
    expect(await noDisponible({})).toBe(false);
  });
});
