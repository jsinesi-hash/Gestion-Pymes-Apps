import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { createDb, instalarTriggersSync, registroSyncCore } from '@core/db';
import { RUTAS, type CambioEntrante, type CambioRegistrado, type ResultadoCambio } from '@core/hub';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import { setOriginId } from '../context';
import { tareasRegistradas } from '../tareas';
import { clienteUpsertHandler, ctacteRegistrarSaldoInicialHandler } from '../index';
import { crearClienteSync, CLAVE_CURSOR, type ClienteSync } from './cliente';
import { programarSync } from './programar';
import type { RespuestaHub, TransporteHub } from './transporte';

// Cliente de sync de la terminal (F2 PR3, ADR-150 §4, §6 y §9; ADR-151 §2) contra un hub de prueba en
// memoria que acepta todo y reparte los cambios por secuencia (las reglas de conflicto las prueba
// `@core/hub`). Las dos terminales parten de la misma base, como después del arranque de F2 PR4.
const registro = registroSyncCore();
type Db = ReturnType<typeof setupCoreDb>;

interface HubDePrueba {
  transporte: TransporteHub;
  log: CambioRegistrado[];
  lotes: number[];
  resultadoPara: (c: CambioEntrante) => ResultadoCambio;
  falla: null | (() => RespuestaHub | Error);
  adelantoMs: number;
}

function hubDePrueba(): HubDePrueba {
  const h: HubDePrueba = {
    log: [], lotes: [], resultadoPara: () => ({ estado: 'aplicado' }), falla: null, adelantoMs: 0,
    transporte: {
      async pedir(_metodo, ruta, cuerpo) {
        const enviadoMs = Date.now();
        if (h.falla) {
          const f = h.falla();
          if (f instanceof Error) throw f;
          return f;
        }
        const resp = (body: Record<string, unknown>): RespuestaHub =>
          ({ status: 200, body: { ...body, hora_hub_ms: Date.now() + h.adelantoMs }, enviadoMs, recibidoMs: Date.now() });
        if (ruta === RUTAS.push) {
          const cambios = (cuerpo as { cambios: CambioEntrante[] }).cambios;
          h.lotes.push(cambios.length);
          const resultados = cambios.map((c) => {
            const r = h.resultadoPara(c);
            if (r.estado === 'aplicado') {
              const f = c.fila as Record<string, unknown>;
              h.log.push({ seq: h.log.length + 1, tabla: c.tabla, fila_id: String(f['id']), version: Number(f['version']),
                origin_id: String(f['origin_id']), updated_at: Number(f['updated_at']), fila: { ...f } });
            }
            return r;
          });
          return resp({ resultados });
        }
        const u = new URL(ruta, 'https://hub');
        const desde = Number(u.searchParams.get('desde'));
        const limite = Number(u.searchParams.get('limite'));
        const pagina = h.log.filter((c) => c.seq > desde).slice(0, limite);
        const hasta = pagina.at(-1)?.seq ?? desde;
        return resp({ cambios: pagina, hasta, hayMas: h.log.some((c) => c.seq > hasta) });
      },
      cerrar() {},
    },
  };
  return h;
}

/** Copia de la base (misma semilla, mismos ids): la segunda terminal después del arranque. */
function copiar(db: Db): Db {
  const sqlite = new Database((db.$client as Database.Database).serialize());
  return createDb(sqlite, schema).db as unknown as Db;
}

const outbox = (db: Db) => (db.$client as Database.Database)
  .prepare('select tabla, fila_id, enviado_en from sync_outbox order by seq').all() as { tabla: string; fila_id: string; enviado_en: number | null }[];
const clientePor = (db: Db, id: string) => db.select().from(schema.cliente).where(eq(schema.cliente.id, id)).get();
const cuentaDe = (db: Db, clienteId: string) => db.select().from(schema.cuenta_corriente_cliente)
  .where(eq(schema.cuenta_corriente_cliente.cliente_id, clienteId)).get();

describe('cliente de sync de la terminal', () => {
  let a: Db;
  let b: Db;
  let hub: HubDePrueba;
  const clientes: ClienteSync[] = [];

  function cliente(db: Db, extra: Partial<Parameters<typeof crearClienteSync>[1]> = {}): ClienteSync {
    const c = crearClienteSync(db, { schema, registro, transporte: hub.transporte, ...extra });
    clientes.push(c);
    return c;
  }
  /** Corre `fn` como la terminal `origen` (cada terminal tiene su `origin_id`). */
  function como<T>(origen: string, fn: () => T): T {
    setOriginId(origen);
    try { return fn(); } finally { setOriginId('C1'); }
  }
  const altaCliente = (db: Db, nombre: string) => clienteUpsertHandler(db, {
    tipo_documento: 'DNI', numero_documento: String(30_000_000 + Math.floor(Math.random() * 1_000_000)),
    nombre, apellido: 'Prueba', condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: true,
  });

  beforeEach(() => {
    a = setupCoreDb();
    clearSession();
    loginAsAdmin(a);
    b = copiar(a);
    for (const db of [a, b]) instalarTriggersSync(db.$client as Database.Database, schema, registro);
    hub = hubDePrueba();
    clientes.length = 0;
  });
  afterEach(() => setOriginId('C1'));

  it('push: sube la cola en orden y por lotes, marca lo enviado y deja las filas en synced', async () => {
    const c1 = altaCliente(a, 'Ana');
    const c2 = altaCliente(a, 'Beto');
    const pendientes = outbox(a).length;
    expect(pendientes).toBe(4); // cliente + cuenta, dos veces
    const r = await cliente(a, { tamLote: 3 }).push();
    expect(r).toEqual({ enviados: 4, conflictos: 0 });
    expect(hub.lotes).toEqual([3, 1]);
    expect(hub.log.map((c) => c.fila_id)).toEqual(outbox(a).map((o) => o.fila_id));
    expect(outbox(a).every((o) => o.enviado_en !== null)).toBe(true);
    expect([clientePor(a, c1.id)!.sync_state, clientePor(a, c2.id)!.sync_state]).toEqual(['synced', 'synced']);
  });

  it('push: un rechazo por unicidad deja la fila en conflict', async () => {
    const c = altaCliente(a, 'Ana');
    hub.resultadoPara = (cambio) => (cambio.tabla === 'cliente' ? { estado: 'unicidad', conflicto_id: 1 } : { estado: 'aplicado' });
    expect(await cliente(a).push()).toEqual({ enviados: 2, conflictos: 1 });
    expect(clientePor(a, c.id)!.sync_state).toBe('conflict');
    expect(cuentaDe(a, c.id)!.sync_state).toBe('synced');
  });

  it('push: si la fila cambió mientras viajaba el lote, queda pendiente para el próximo', async () => {
    const c = altaCliente(a, 'Ana');
    let editada = false;
    hub.resultadoPara = () => {
      if (!editada) { editada = true; a.update(schema.cliente).set({ nombre: 'Ana María' }).where(eq(schema.cliente.id, c.id)).run(); }
      return { estado: 'aplicado' };
    };
    const sync = cliente(a);
    await sync.push();
    expect(clientePor(a, c.id)!.sync_state).toBe('pending');
    expect(sync.estado().pendientes).toBe(1);
    await sync.push();
    expect(clientePor(a, c.id)!.sync_state).toBe('synced');
    expect(hub.log.at(-1)!.fila['nombre']).toBe('Ana María');
  });

  it('pull: aplica lo de la otra terminal sin volver a encolarlo, avanza el cursor y recalcula el saldo', async () => {
    const nuevo = como('C2', () => {
      const c = altaCliente(b, 'Carla');
      ctacteRegistrarSaldoInicialHandler(b, { cuentaId: cuentaDe(b, c.id)!.id, monto_centavos: 10_000, tipo: 'cargo' });
      return c;
    });
    await cliente(b).push();
    const antes = outbox(a).length;
    const r = await cliente(a).pull();
    expect(r).toEqual({ recibidos: hub.log.length, aplicados: hub.log.length });
    expect(clientePor(a, nuevo.id)).toMatchObject({ nombre: 'Carla', origin_id: 'C2', sync_state: 'synced' });
    // El saldo no viaja (ADR-151): se recalculó desde el movimiento recibido.
    expect(cuentaDe(a, nuevo.id)!.saldo_centavos).toBe(10_000);
    expect(outbox(a).length).toBe(antes);
    const param = a.select().from(schema.parametros_sistema).where(eq(schema.parametros_sistema.clave, CLAVE_CURSOR)).get();
    expect(Number(param!.valor)).toBe(hub.log.length);
    expect(await cliente(a).pull()).toEqual({ recibidos: 0, aplicados: 0 });
  });

  it('pull por páginas: llega todo aunque haya más cambios que el tamaño de página', async () => {
    como('C2', () => { for (let i = 0; i < 5; i++) altaCliente(b, `Cliente ${i}`); });
    await cliente(b).push();
    const r = await cliente(a, { tamPagina: 3 }).pull();
    expect(r.recibidos).toBe(10);
    expect(a.select().from(schema.cliente).all().filter((c) => c.origin_id === 'C2')).toHaveLength(5);
  });

  it('pull: pisa la fila por id, salvo que la terminal tenga un cambio propio sin subir', async () => {
    const c = altaCliente(a, 'Ana');
    await cliente(a).push();
    await cliente(b).pull();
    const sa = cliente(a);
    const sb = cliente(b);

    como('C2', () => b.update(schema.cliente).set({ nombre: 'Beto' }).where(eq(schema.cliente.id, c.id)).run());
    await sb.push();
    await sa.pull();
    expect(clientePor(a, c.id)!.nombre).toBe('Beto');

    como('C2', () => b.update(schema.cliente).set({ nombre: 'Carla' }).where(eq(schema.cliente.id, c.id)).run());
    await sb.push();
    a.update(schema.cliente).set({ nombre: 'Dora' }).where(eq(schema.cliente.id, c.id)).run();
    await sa.pull();
    // Lo local es más nuevo: sube en el próximo push y el hub resuelve (ADR-150 §5).
    expect(clientePor(a, c.id)!.nombre).toBe('Dora');
    expect(sa.estado().pendientes).toBe(1);
  });

  it('pull: ignora tablas y columnas que esta versión no conoce (hub una versión adelante)', async () => {
    const c = como('C2', () => altaCliente(b, 'Eva'));
    await cliente(b).push();
    const fila = hub.log.find((x) => x.tabla === 'cliente')!;
    fila.fila['columna_futura'] = 'x';
    hub.log.push({ ...fila, seq: hub.log.length + 1, tabla: 'tabla_futura' });
    const r = await cliente(a).pull();
    expect(r.recibidos).toBe(3);
    expect(r.aplicados).toBe(2);
    expect(clientePor(a, c.id)!.nombre).toBe('Eva');
  });

  it('sin conexión: la cola queda intacta y el estado lo dice; versión vieja y credencial revocada tienen su código', async () => {
    altaCliente(a, 'Ana');
    const sync = cliente(a);
    hub.falla = () => new Error('HUB_INALCANZABLE: connect ECONNREFUSED');
    await expect(sync.push()).rejects.toThrow('HUB_INALCANZABLE');
    expect(sync.estado()).toMatchObject({ enLinea: false, pendientes: 2, ultimoError: 'HUB_INALCANZABLE: connect ECONNREFUSED' });
    expect(outbox(a).every((o) => o.enviado_en === null)).toBe(true);

    const versiones = { protocolo: 1, esquema: 9 };
    hub.falla = () => ({ status: 409, body: { error: 'VERSION_INCOMPATIBLE', versiones, hora_hub_ms: Date.now() }, enviadoMs: Date.now(), recibidoMs: Date.now() });
    await expect(sync.pull()).rejects.toThrow('VERSION_INCOMPATIBLE');
    expect(sync.estado()).toMatchObject({ enLinea: true, versionesHub: versiones });

    hub.falla = () => ({ status: 401, body: { error: 'NO_AUTORIZADO' }, enviadoMs: Date.now(), recibidoMs: Date.now() });
    await expect(sync.push()).rejects.toThrow('HUB_NO_AUTORIZADO');

    hub.falla = null;
    await sync.sincronizar();
    expect(sync.estado()).toMatchObject({ enLinea: true, ultimoError: null, pendientes: 0, versionesHub: null });
  });

  it('reloj: guarda el desfasaje contra la hora del hub y avisa si pasa el umbral', async () => {
    const avisar = vi.fn();
    hub.adelantoMs = 120_000;
    const sync = cliente(a, { umbralDesfasajeMs: 60_000, avisarDesfasaje: avisar });
    await sync.pull();
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(Math.abs(avisar.mock.calls[0]![0] - 120_000)).toBeLessThan(1_000);
    expect(sync.estado().relojDesfasado).toBe(true);
    // Persiste: otra instancia del cliente (reinicio de la app) lo ve.
    expect(Math.abs(cliente(a).estado().desfasajeMs! - 120_000)).toBeLessThan(1_000);

    hub.adelantoMs = 0;
    await sync.pull();
    expect(sync.estado().relojDesfasado).toBe(false);
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('programarSync: push y pull son tareas locales; un corte de red no se registra como error', async () => {
    hub.falla = () => new Error('HUB_INALCANZABLE: connect ECONNREFUSED');
    const log = vi.fn();
    const prog = programarSync(cliente(a), { intervaloPushMs: 60_000, intervaloPullMs: 60_000, log });
    try {
      expect(tareasRegistradas()).toEqual(expect.arrayContaining([
        { nombre: 'sync:push', tipo: 'local' }, { nombre: 'sync:pull', tipo: 'local' },
      ]));
      await new Promise((r) => setTimeout(r, 20));
      expect(log).not.toHaveBeenCalled();
    } finally {
      prog.detener();
    }
  });
});
