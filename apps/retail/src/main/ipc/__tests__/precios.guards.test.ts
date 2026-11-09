import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { IpcMain } from 'electron';
import { setupDb, loginAsAdmin, loginAsOperador, clearSession } from './helpers';
import { registerListaPrecioValorHandlers } from '../lista-precio-valor';
import { registerCambioProgramadoHandlers } from '../cambio-programado';

// Revisión 2026-10-20 (P0): las escrituras de precios y de cambios programados solo
// estaban protegidas por sesión. La matriz RBAC (CLAUDE.md §8) las reserva al Supervisor
// (`config.fiscal`). Se prueba contra el registro real de canales, no contra el handler
// suelto, porque el scheduler llama a los handlers sin sesión (callerUserId).

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

function registrar(db: ReturnType<typeof setupDb>) {
  const canales = new Map<string, Handler>();
  const ipcMain = { handle: (canal: string, fn: Handler) => { canales.set(canal, fn); } } as unknown as IpcMain;
  registerListaPrecioValorHandlers(ipcMain, db);
  registerCambioProgramadoHandlers(ipcMain, db);
  return (canal: string, ...args: unknown[]) => {
    const h = canales.get(canal);
    if (!h) throw new Error(`canal no registrado: ${canal}`);
    return h({}, ...args);
  };
}

const CANALES_ESCRITURA: Array<[string, unknown]> = [
  ['listaPrecioValor:setManual', {}],
  ['listaPrecioValor:recalcularMasivo', {}],
  ['cambioProgramado:crear', {}],
  ['cambioProgramado:cancelar', randomUUID()],
];

describe('guards de precios y cambios programados', () => {
  let db: ReturnType<typeof setupDb>;
  let invoke: ReturnType<typeof registrar>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
    invoke = registrar(db);
  });

  it.each(CANALES_ESCRITURA)('%s sin sesión → UNAUTHENTICATED', async (canal, payload) => {
    await expect(invoke(canal, payload)).rejects.toThrow('UNAUTHENTICATED');
  });

  it.each(CANALES_ESCRITURA)('%s como Operador → FORBIDDEN (config.fiscal)', async (canal, payload) => {
    loginAsOperador(db);
    await expect(invoke(canal, payload)).rejects.toThrow('FORBIDDEN:config.fiscal');
  });

  it.each(CANALES_ESCRITURA)('%s como Supervisor pasa el guard', async (canal, payload) => {
    loginAsAdmin(db);
    // Con payload vacío puede fallar por validación, pero nunca por permisos.
    const resultado = await invoke(canal, payload).then(() => null, (e) => e);
    expect(String(resultado?.message ?? '')).not.toMatch(/^(FORBIDDEN|UNAUTHENTICATED)/);
  });

  it('las lecturas siguen abiertas al Operador', async () => {
    loginAsOperador(db);
    await expect(invoke('cambioProgramado:listar', randomUUID())).resolves.toEqual([]);
    await expect(invoke('listaPrecioValor:listarVigentesPorLista', randomUUID())).resolves.toBeDefined();
  });
});
