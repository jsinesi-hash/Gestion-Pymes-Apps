import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { registroSyncCore } from '@core/db';
import { RUTAS, type CambioEntrante, type CambioRegistrado } from '@core/hub';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import { getModoTerminal, getOriginId, setModoTerminal, setOriginId } from '../context';
import { getSession } from '../auth/session';
import { restoreEjecutarHandler } from '../ipc/restore';
import { clienteUpsertHandler, ctacteRegistrarSaldoInicialHandler } from '../index';
import { CLAVE_CURSOR } from './cliente';
import { crearSyncTerminal, type DepsSyncTerminal, type SyncTerminal } from './terminal-sync';
import { leerHub } from './hub-guardado';
import type { OpcionesTransporte, RespuestaHub, TransporteHub } from './transporte';

// Modo distribuido de la terminal (F2 PR4, ADR-150 §2 y §10): emparejar, semilla de la primera
// terminal, snapshot de las siguientes, desemparejar y volver a bajar la base. El hub es uno de prueba
// en memoria con las mismas rutas; el servidor real lo prueba `@core/hub` y la convergencia, cada app.
const registro = registroSyncCore();
type Db = ReturnType<typeof setupCoreDb>;
const CODIGO = 'ABCD-EFGH';
const HUELLA = 'AA:BB:CC';

function hubEnMemoria() {
  const h = {
    log: [] as CambioRegistrado[],
    origenes: new Map<string, string>(), // credencial → origin_id
    semilla: [] as CambioEntrante[],
    crearTransporte(o: OpcionesTransporte): TransporteHub {
      return {
        async pedir(_metodo, ruta, cuerpo) {
          const t = Date.now();
          const resp = (status: number, body: Record<string, unknown>): RespuestaHub =>
            ({ status, body: { ...body, hora_hub_ms: Date.now() }, enviadoMs: t, recibidoMs: Date.now() });
          const registrar = (origen: string, c: CambioEntrante) => {
            const f = c.fila as Record<string, unknown>;
            h.log.push({ seq: h.log.length + 1, tabla: c.tabla, fila_id: String(f['id']), version: Number(f['version']),
              origin_id: origen, updated_at: Number(f['updated_at']), fila: { ...f } });
          };
          if (ruta === RUTAS.emparejar) {
            const p = cuerpo as { codigo: string; origin_id_propuesto?: string };
            if (p.codigo !== CODIGO) return resp(422, { error: 'CODIGO_INVALIDO' });
            const usados = new Set(h.origenes.values());
            const origen = p.origin_id_propuesto && !usados.has(p.origin_id_propuesto) ? p.origin_id_propuesto : `C${usados.size + 1}`;
            h.origenes.set(`cred-${origen}`, origen);
            return resp(200, { origin_id: origen, credencial: `cred-${origen}` });
          }
          const origen = h.origenes.get(o.credencial ?? '');
          if (!origen) return resp(401, { error: 'NO_AUTORIZADO' });
          if (ruta === RUTAS.estado) return resp(200, { origin_id: origen, cursor: h.log.length });
          if (ruta === RUTAS.semilla) {
            const p = cuerpo as { cambios: CambioEntrante[]; inicio?: boolean; fin?: boolean };
            if (h.log.length) return resp(422, { error: 'HUB_NO_VACIO' });
            if (p.inicio) h.semilla = [];
            h.semilla.push(...p.cambios);
            if (p.fin) for (const c of h.semilla) registrar(origen, c);
            return resp(200, { recibidos: h.semilla.length, cursor: h.log.length, rechazados: [] });
          }
          if (ruta === RUTAS.snapshot) {
            const ultimas = new Map<string, CambioRegistrado>();
            for (const c of h.log) ultimas.set(`${c.tabla}/${c.fila_id}`, c);
            const tablas = new Map<string, Record<string, unknown>[]>();
            for (const c of ultimas.values()) tablas.set(c.tabla, [...(tablas.get(c.tabla) ?? []), c.fila as Record<string, unknown>]);
            return resp(200, { cursor: h.log.length, tablas: [...tablas].map(([tabla, filas]) => ({ tabla, filas })) });
          }
          if (ruta === RUTAS.push) {
            const cambios = (cuerpo as { cambios: CambioEntrante[] }).cambios;
            for (const c of cambios) registrar(origen, c);
            return resp(200, { resultados: cambios.map(() => ({ estado: 'aplicado' })) });
          }
          const u = new URL(ruta, 'https://hub');
          const desde = Number(u.searchParams.get('desde'));
          const pagina = h.log.filter((c) => c.seq > desde);
          return resp(200, { cambios: pagina, hasta: pagina.at(-1)?.seq ?? desde, hayMas: false });
        },
        cerrar() {},
      };
    },
  };
  return h;
}

/** safeStorage de prueba: "cifra" con un prefijo, para ver que la credencial no queda en claro. */
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(`cifrado:${Buffer.from(s).toString('base64')}`),
  decryptString: (b: Buffer) => Buffer.from(b.toString().replace(/^cifrado:/, ''), 'base64').toString(),
};

const sqliteDe = (db: Db) => db.$client as Database.Database;
const pendientes = (db: Db) => (sqliteDe(db).prepare('select count(*) n from sync_outbox where enviado_en is null').get() as { n: number }).n;
const cursorDe = (db: Db) => Number((sqliteDe(db).prepare('select valor from parametros_sistema where clave = ?').get(CLAVE_CURSOR) as { valor: string } | undefined)?.valor);
const leerConfig = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')) as { origin_id: string; modo: string };

describe('modo distribuido de la terminal', () => {
  let hub: ReturnType<typeof hubEnMemoria>;
  let migraciones: string;
  const carpetas: string[] = [];
  let tareas: { detener: ReturnType<typeof vi.fn> }[];

  function carpeta(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-sync-'));
    carpetas.push(d);
    return d;
  }

  function terminal(db: Db, dir: string, extra: Partial<DepsSyncTerminal> = {}): { s: SyncTerminal; respaldar: ReturnType<typeof vi.fn> } {
    const respaldar = vi.fn(async () => undefined);
    const s = crearSyncTerminal(db, { schema, registro, migrationsFolder: migraciones, carpetaDatos: dir }, {
      safeStorage, respaldar,
      crearTransporte: (o) => hub.crearTransporte(o),
      sondear: async (url) => ({ url: `https://${url}:7443`, certPem: 'PEM DEL HUB', huella: HUELLA }),
      programar: () => { const t = { detener: vi.fn() }; tareas.push(t); return t; },
      ...extra,
    });
    return { s, respaldar };
  }

  const altaCliente = (db: Db, nombre: string) => clienteUpsertHandler(db, {
    tipo_documento: 'DNI', numero_documento: String(30_000_000 + Math.floor(Math.random() * 1_000_000)),
    nombre, apellido: 'Prueba', condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: true,
  });

  beforeEach(() => {
    hub = hubEnMemoria();
    tareas = [];
    migraciones = carpeta();
    fs.mkdirSync(path.join(migraciones, 'meta'));
    fs.writeFileSync(path.join(migraciones, 'meta', '_journal.json'), JSON.stringify({ entries: [{}, {}, {}] }));
    setOriginId('C1');
    setModoTerminal('standalone');
  });
  afterEach(() => {
    setOriginId('C1');
    setModoTerminal('standalone');
    clearSession();
    for (const d of carpetas.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  /** La primera terminal, con un cliente con saldo, emparejada contra el hub vacío. */
  async function primeraTerminal() {
    const a = setupCoreDb();
    clearSession();
    loginAsAdmin(a);
    const cli = altaCliente(a, 'Ana');
    const cuenta = a.select().from(schema.cuenta_corriente_cliente).where(eq(schema.cuenta_corriente_cliente.cliente_id, cli.id)).get()!;
    ctacteRegistrarSaldoInicialHandler(a, { cuentaId: cuenta.id, monto_centavos: 12_345, tipo: 'cargo' });
    const dir = carpeta();
    const t = terminal(a, dir);
    const r = await t.s.emparejar({ url: 'hub.local', codigo: 'abcd-efgh ', huella: HUELLA, nombre: 'Caja del frente' });
    return { a, dir, ...t, r, cuentaId: cuenta.id };
  }

  it('primera terminal: sube su base como semilla, guarda el hub y queda en modo distribuido', async () => {
    const { a, dir, s, r, respaldar } = await primeraTerminal();
    expect(r).toMatchObject({ origin_id: 'C1', arranque: 'semilla' });
    // Subió todas las filas que sincronizan, con las columnas que viajan (sin saldos proyectados).
    expect(r.filas).toBe(hub.log.length);
    const usuarios = a.select().from(schema.usuario).all().map((u) => u.id).sort();
    expect(hub.log.filter((c) => c.tabla === 'usuario').map((c) => c.fila_id).sort()).toEqual(usuarios);
    expect(hub.log.find((c) => c.tabla === 'cuenta_corriente_cliente')!.fila).not.toHaveProperty('saldo_centavos');
    expect(hub.log.some((c) => c.tabla === 'parametros_sistema')).toBe(false);
    expect(respaldar).not.toHaveBeenCalled();

    expect(cursorDe(a)).toBe(hub.log.length);
    expect(leerConfig(dir)).toEqual({ origin_id: 'C1', modo: 'distribuido' });
    expect([getOriginId(), getModoTerminal()]).toEqual(['C1', 'distribuido']);
    const guardado = leerHub({ safeStorage, carpeta: dir })!;
    expect(guardado).toMatchObject({ credencial: 'cred-C1', datos: { url: 'https://hub.local:7443', huella: HUELLA, nombre: 'Caja del frente' } });
    // La credencial no queda en claro en ningún archivo.
    for (const f of fs.readdirSync(dir)) expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toContain('cred-C1');

    // Encendió el cliente y los triggers: un cambio nuevo va a la cola y sube con el próximo sync.
    expect(tareas).toHaveLength(1);
    altaCliente(a, 'Beto');
    expect(pendientes(a)).toBeGreaterThan(0);
    const e = await s.sincronizarAhora();
    expect(e).toMatchObject({ modo: 'distribuido', origin_id: 'C1', hub: { url: 'https://hub.local:7443' }, sync: { pendientes: 0, enLinea: true } });
    expect(e.hub).not.toHaveProperty('certPem');
  });

  it('siguiente terminal: baja el snapshot del hub y reemplaza su base (sin duplicar el seed)', async () => {
    const { a } = await primeraTerminal();
    setModoTerminal('standalone'); // el mismo proceso hace de segunda terminal

    // Una instalación nueva: su propio seed con UUID aleatorios y un código de recuperación local.
    const b = setupCoreDb();
    const adminB = b.select().from(schema.usuario).get()!;
    expect(adminB.id).not.toBe(a.select().from(schema.usuario).get()!.id);
    b.insert(schema.recuperacion_password).values({ id: 'rec-1', usuario_id: adminB.id, codigo_hash: 'x', expira_en: new Date(), creado_en: new Date() }).run();
    clearSession();
    loginAsAdmin(b);
    const dir = carpeta();
    const { s, respaldar } = terminal(b, dir);
    const r = await s.emparejar({ url: 'hub.local', codigo: CODIGO, huella: HUELLA });

    expect(r).toMatchObject({ origin_id: 'C2', arranque: 'snapshot' });
    expect(respaldar).toHaveBeenCalledTimes(1);
    expect(leerConfig(dir)).toEqual({ origin_id: 'C2', modo: 'distribuido' });
    // Las mismas filas que la primera: ni roles ni usuarios duplicados.
    for (const t of ['usuario', 'rol', 'permiso', 'rol_permiso', 'cliente'] as const) {
      const ids = (db: Db) => (sqliteDe(db).prepare(`select id from ${t} order by id`).all() as { id: string }[]).map((f) => f.id);
      expect(ids(b), t).toEqual(ids(a));
    }
    // El saldo se recalcula desde el libro (no viaja).
    const saldos = (db: Db) => db.select().from(schema.cuenta_corriente_cliente).all().map((c) => c.saldo_centavos);
    expect(saldos(b)).toEqual([12_345]);
    // El código de recuperación apuntaba a un usuario que ya no existe: se descarta.
    expect(b.select().from(schema.recuperacion_password).all()).toEqual([]);
    // Los usuarios cambiaron: la sesión abierta se cierra.
    expect(getSession()).toBeNull();
    expect([cursorDe(b), pendientes(b)]).toEqual([hub.log.length, 0]);
    expect(b.select().from(schema.cliente).all().every((c) => c.sync_state === 'synced')).toBe(true);
    expect(tareas).toHaveLength(2);
  });

  it('una huella distinta a la confirmada no empareja ni toca nada', async () => {
    const a = setupCoreDb();
    const dir = carpeta();
    const { s } = terminal(a, dir);
    await expect(s.emparejar({ url: 'hub.local', codigo: CODIGO, huella: 'OTRA' })).rejects.toThrow('HUELLA_DISTINTA');
    expect(hub.origenes.size).toBe(0);
    expect(fs.readdirSync(dir)).toEqual([]);
    expect(getModoTerminal()).toBe('standalone');
  });

  it('la semilla no sube con saldos que no coinciden con sus libros', async () => {
    const a = setupCoreDb();
    clearSession();
    loginAsAdmin(a);
    altaCliente(a, 'Ana');
    sqliteDe(a).prepare('update cuenta_corriente_cliente set saldo_centavos = 999').run();
    const dir = carpeta();
    const { s } = terminal(a, dir);
    await expect(s.emparejar({ url: 'hub.local', codigo: CODIGO, huella: HUELLA })).rejects.toThrow('INTEGRIDAD_SALDOS: 1 diferencias');
    expect(hub.log).toEqual([]);
    expect(getModoTerminal()).toBe('standalone');
    // Sin triggers: un cambio no va a la cola.
    altaCliente(a, 'Beto');
    expect(pendientes(a)).toBe(0);
  });

  it('desemparejar avisa si hay cambios sin subir; forzado vuelve a standalone sin triggers', async () => {
    const { a, dir, s } = await primeraTerminal();
    altaCliente(a, 'Beto');
    await expect(s.desemparejar()).rejects.toThrow(/^CAMBIOS_SIN_SUBIR: \d+$/);
    expect(getModoTerminal()).toBe('distribuido');
    await s.desemparejar({ forzar: true });
    expect(tareas[0]!.detener).toHaveBeenCalled();
    expect(leerConfig(dir)).toEqual({ origin_id: 'C1', modo: 'standalone' });
    expect(getModoTerminal()).toBe('standalone');
    expect(leerHub({ safeStorage, carpeta: dir })).toBeNull();
    altaCliente(a, 'Ceci');
    expect(pendientes(a)).toBe(0);
    expect(s.estado()).toMatchObject({ modo: 'standalone', hub: null, sync: null });
  });

  it('volver a bajar el snapshot (restaurar en modo distribuido) sube primero lo pendiente', async () => {
    const { a, s, respaldar, cuentaId } = await primeraTerminal();
    altaCliente(a, 'Beto');
    // Un saldo desfasado a mano: el snapshot lo vuelve a proyectar desde el libro.
    sqliteDe(a).prepare('update cuenta_corriente_cliente set saldo_centavos = 1 where id = ?').run(cuentaId);
    const r = await s.rebajarSnapshot();
    expect(hub.log.some((c) => c.tabla === 'cliente' && (c.fila as { nombre: string }).nombre === 'Beto')).toBe(true);
    expect(r.filas).toBeGreaterThan(0);
    expect(respaldar).toHaveBeenCalledTimes(1);
    expect(a.select().from(schema.cuenta_corriente_cliente).where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!.saldo_centavos).toBe(12_345);
    expect(pendientes(a)).toBe(0);
    // Reinstaló los triggers y volvió a encender el cliente; la sesión se cierra (los usuarios pueden haber cambiado).
    expect(tareas).toHaveLength(2);
    expect(getSession()).toBeNull();
    loginAsAdmin(a);
    altaCliente(a, 'Ceci');
    expect(pendientes(a)).toBeGreaterThan(0);
  });

  it('al arrancar la app: enciende el cliente solo en modo distribuido y con los datos del hub', async () => {
    const { a, dir } = await primeraTerminal();
    // Otra instancia (la app que vuelve a abrir) con la misma carpeta.
    const otra = terminal(a, dir).s;
    expect(otra.iniciar()).toBe(true);
    expect(tareas).toHaveLength(2);

    const sinDatos = terminal(a, carpeta()).s;
    expect(sinDatos.iniciar()).toBe(false);
    // En standalone no arranca, y quita los triggers que hubieran quedado (un emparejamiento cortado).
    setModoTerminal('standalone');
    expect(terminal(a, dir).s.iniciar()).toBe(false);
    expect(tareas).toHaveLength(2);
    altaCliente(a, 'Beto');
    expect(pendientes(a)).toBe(0);
  });

  it('sin safeStorage no empareja ni toca el hub', async () => {
    const a = setupCoreDb();
    const { s } = terminal(a, carpeta(), { safeStorage: { ...safeStorage, isEncryptionAvailable: () => false } });
    await expect(s.emparejar({ url: 'hub.local', codigo: CODIGO, huella: HUELLA })).rejects.toThrow('SAFE_STORAGE_NO_DISPONIBLE');
    expect(hub.origenes.size).toBe(0);
  });

  it('en modo distribuido no se restaura un backup local: se vuelve a bajar el snapshot', async () => {
    const a = setupCoreDb();
    clearSession();
    loginAsAdmin(a);
    setModoTerminal('distribuido');
    await expect(restoreEjecutarHandler(a, { ruta: 'x.fbk' }, { migrationsFolder: migraciones })).rejects.toThrow('RESTORE_LOCAL_NO_DISPONIBLE_EN_DISTRIBUIDO');
  });
});
