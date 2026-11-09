// ADR-145 — Baranda: todo canal IPC de Elaborados cumple la política de `politicas-canales.ts`.
// Registra los canales reales (los mismos que `index.ts`, vía `registrarHandlersElaborados`) sobre un
// `ipcMain` falso y los invoca con payload vacío: el guard tiene que cortar antes que cualquier
// validación o efecto. Un canal nuevo sin política hace fallar el registro (y este test).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setSession, clearSession } from '@core/main';
import { setupDb } from '../../__tests__/helpers';
import { registrarHandlersElaborados } from '../registrar';
import { POLITICAS_CANALES_ELABORADOS } from '../politicas-canales';
import { PERMISOS_CORE } from '@core/main';
import { PERMISOS_ELABORADOS } from '../../auth/seed';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function registrarTodo() {
  const canales = new Map<string, Handler>();
  const ipcFalso = {
    handle: (canal: string, fn: Handler) => { canales.set(canal, fn); },
    on: () => undefined,
    removeHandler: () => undefined,
  };
  const db = setupDb();
  registrarHandlersElaborados(ipcFalso as never, db, {
    migrationsFolder: '',
    imprimirHtml: async () => undefined,
  });
  return canales;
}

/** Invoca el handler y devuelve el mensaje del rechazo ('' si resolvió). */
async function mensajeDeRechazo(fn: Handler): Promise<string> {
  const limite = new Promise<string>((res) => setTimeout(() => res('TIMEOUT'), 2000));
  const llamada = (async () => {
    try { await fn({ sender: {} }, {}); return ''; } catch (e) {
      return e instanceof Error ? e.message : `NO_ES_ERROR:${String(e)}`;
    }
  })();
  return Promise.race([llamada, limite]);
}

const DATOS_SESION = {
  id: 'u-prueba', nombreCompleto: 'Prueba', rolId: 'rol-prueba', rolNombre: 'PRUEBA',
  permisos: [], passwordDiasRestantes: 30,
  preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] },
};
const sesionCon = (...permisos: string[]) =>
  setSession({ userId: 'u-prueba', rolId: 'rol-prueba', permisos: new Set(permisos) }, DATOS_SESION);

// Canales con un chequeo condicional en el handler: con payload vacío (sin usuario destino) el
// handler rechaza aunque la sesión cumpla la política. Se prueban en sus propios tests.
const CONDICIONALES = new Set(['usuario:update', 'usuario:changePassword']);

const politica = (canal: string) => POLITICAS_CANALES_ELABORADOS[canal];
const permisoDe = (canal: string) => politica(canal).startsWith('permiso:') ? politica(canal).slice(8) : null;

describe('ADR-145 — permisos de todos los canales IPC de Elaborados', () => {
  let canales: Map<string, Handler>;
  beforeAll(() => { canales = registrarTodo(); });
  afterAll(() => clearSession());

  it('la tabla no tiene canales que ya no existen', () => {
    const sobrantes = Object.keys(POLITICAS_CANALES_ELABORADOS).filter(c => !canales.has(c));
    expect(sobrantes).toEqual([]);
  });

  it('todo permiso de la tabla existe en el seed (núcleo + Elaborados)', () => {
    const codigos = new Set([...PERMISOS_CORE, ...PERMISOS_ELABORADOS].map(p => p.codigo));
    const desconocidos = [...canales.keys()].map(permisoDe).filter((p): p is string => !!p && !codigos.has(p));
    expect([...new Set(desconocidos)]).toEqual([]);
  });

  it('sin sesión, todo canal no público rechaza', async () => {
    const abiertos: string[] = [];
    for (const [canal, fn] of canales) {
      if (politica(canal) === 'publico') continue;
      clearSession();
      const msg = await mensajeDeRechazo(fn);
      if (!msg.startsWith('UNAUTHENTICATED')) abiertos.push(`${canal} → ${msg || 'RESOLVIÓ'}`);
    }
    expect(abiertos).toEqual([]);
  });

  it('con una sesión sin permisos, todo canal con permiso rechaza con FORBIDDEN', async () => {
    const abiertos: string[] = [];
    for (const [canal, fn] of canales) {
      if (!permisoDe(canal)) continue;
      // Se repone en cada vuelta: algunos canales (p. ej. `auth:logout`) cierran la sesión.
      sesionCon();
      const msg = await mensajeDeRechazo(fn);
      if (!msg.startsWith(`FORBIDDEN:${permisoDe(canal)}`)) abiertos.push(`${canal} → ${msg || 'RESOLVIÓ'}`);
    }
    expect(abiertos).toEqual([]);
  });

  it('con solo el permiso declarado, ningún canal rechaza por permisos (la tabla coincide con el handler)', async () => {
    const rechazados: string[] = [];
    for (const [canal, fn] of canales) {
      const p = permisoDe(canal);
      if (politica(canal) === 'publico' || CONDICIONALES.has(canal)) continue;
      if (p) sesionCon(p); else sesionCon();
      const msg = await mensajeDeRechazo(fn);
      if (/^(FORBIDDEN|UNAUTHENTICATED)/.test(msg)) rechazados.push(`${canal} → ${msg}`);
    }
    clearSession();
    expect(rechazados).toEqual([]);
  });
});
