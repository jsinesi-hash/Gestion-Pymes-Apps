import { describe, it, expect } from 'vitest';
import type { IpcMain } from 'electron';
import { registerCoreHandlers } from './registrar';

// Revisión 2026-10-20 (P2): el handler de `impuesto` era idéntico en Retail y Elaborados (tabla en
// @core/db) y pasó al núcleo. `ipcMain.handle` lanza si un canal se registra dos veces, así que
// además de comprobar que el canal está, se comprueba que ninguno se repite.
function canalesRegistrados(): string[] {
  const canales: string[] = [];
  const ipcMain = { handle: (canal: string) => { canales.push(canal); }, on: () => {} } as unknown as IpcMain;
  registerCoreHandlers(ipcMain, {} as never, { migrationsFolder: 'migraciones', navegacion: {} as never });
  return canales;
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
});
