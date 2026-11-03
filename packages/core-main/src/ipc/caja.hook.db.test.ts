import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import { cajaAbrirHandler, cajaCerrarHandler, cajaGetActivaHandler, type OnCajaCerrada } from '../index';

describe('cajaCerrarHandler — hook onCajaCerrada', () => {
  beforeEach(() => clearSession());

  it('llama al hook dentro de la transacción y ejecuta su post-commit después', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 1000 });
    const orden: string[] = [];
    const hook: OnCajaCerrada = vi.fn(({ tx, cajaRow, diferencia }) => {
      orden.push('hook');
      expect(tx).toBeDefined();
      expect(cajaRow.id).toBe(caja.id);
      expect(diferencia).toBe(0);
      return () => { orden.push('post'); };
    });
    const r = cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 1000 }, { onCajaCerrada: hook });
    expect(r.estado).toBe('cerrada');
    expect(hook).toHaveBeenCalledOnce();
    expect(orden).toEqual(['hook', 'post']);
  });

  it('sin hook cierra igual (Elaborados E1)', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    expect(cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 0 }).estado).toBe('cerrada');
  });

  it('si el hook lanza, la caja NO queda cerrada (misma transacción)', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    expect(() => cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 0 },
      { onCajaCerrada: () => { throw new Error('BOOM'); } })).toThrow('BOOM');
    expect(cajaGetActivaHandler(db)?.id).toBe(caja.id); // sigue abierta
  });
});
