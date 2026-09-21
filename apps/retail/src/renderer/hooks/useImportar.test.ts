import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useImportar } from './useImportar';

describe('useImportar — informe de carga parcial', () => {
  beforeEach(() => {
    (globalThis as any).ferreteria = {
      importar: {
        productos: {
          validar: vi.fn(async () => ({
            rows: [
              { fila: 2, status: 'ok', raw: { nombre: 'A' } },
              { fila: 3, status: 'error', error: 'POSIBLE_DUPLICADO: SKU P-1', raw: { nombre: 'B' } },
            ],
            stats: { ok: 1, update: 0, error: 1 },
          })),
          confirmar: vi.fn(async () => ({
            rows: [{ fila: 2, status: 'created', mensaje: 'A — SKU P-2', raw: { nombre: 'A' } }],
            stats: { created: 1, updated: 0, error: 0 },
          })),
        },
      },
    };
  });

  it('el summary incluye las filas rechazadas del preview', async () => {
    const { result } = renderHook(() => useImportar());
    await act(async () => { await result.current.subirArchivo('csv'); });
    await act(async () => { await result.current.confirmar(); });
    await waitFor(() => expect(result.current.estado).toBe('done'));

    const s = result.current.summary!;
    expect(s.stats).toEqual({ created: 1, updated: 0, error: 1 });
    expect(s.rows).toHaveLength(2);
    const rechazada = s.rows.find(r => r.fila === 3)!;
    expect(rechazada.status).toBe('error');
    expect(rechazada.mensaje).toMatch(/POSIBLE_DUPLICADO/);
  });
});
