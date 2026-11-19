import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { RUTAS } from '@core/hub';
import { setupCoreDb } from '../testing/helpers';
import { esTerminalCoordinadora, setCoordinadoraHasta, setModoTerminal } from '../context';
import {
  crearCoordinacionTerminal, disponiblesDeSerie, liberarSeries, prepararSeriesDistribuido, type SerieBloques,
} from './coordinacion';
import type { RespuestaHub, TransporteHub } from './transporte';

// ADR-152 §2 y ADR-154 §2, lado terminal (F2 PR5): la terminal renueva el permiso de coordinadora que
// otorga el hub (y deja de serlo sola si no lo renueva) y pide bloques de correlativos antes de quedarse
// sin números.
type Db = ReturnType<typeof setupCoreDb>;
const sqliteDe = (db: Db) => db.$client as Database.Database;

function parametro(db: Db, clave: string): string | undefined {
  return (sqliteDe(db).prepare('SELECT valor FROM parametros_sistema WHERE clave = ?').get(clave) as { valor: string } | undefined)?.valor;
}
function fijar(db: Db, clave: string, valor: string): void {
  sqliteDe(db).prepare(
    "INSERT INTO parametros_sistema (clave, valor, tipo) VALUES (?, ?, 'number') ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
  ).run(clave, valor);
}

/** Hub de prueba: el permiso lo tiene `duenio`; los bloques siguen desde `ultimoHasta`. */
function hubFalso(o: { duenio?: string; vigencia?: number } = {}) {
  const h = {
    duenio: o.duenio ?? 'C1',
    vigencia: o.vigencia ?? 120_000,
    ultimoHasta: 0,
    pedidos: [] as { ruta: string; cuerpo?: unknown }[],
    caido: false,
    transporte: {
      async pedir(_m, ruta, cuerpo) {
        h.pedidos.push({ ruta, cuerpo });
        if (h.caido) throw new Error('HUB_INALCANZABLE: connect ECONNREFUSED');
        const t = Date.now();
        const resp = (body: Record<string, unknown>): RespuestaHub => ({ status: 200, body, enviadoMs: t, recibidoMs: t });
        if (ruta === RUTAS.coordinadora) return resp({ coordinadora: h.duenio === 'C1', origin_id: h.duenio, vigencia_ms: h.vigencia });
        const p = cuerpo as { serie: string; minimo: number; tamano: number };
        const desde = Math.max(h.ultimoHasta + 1, p.minimo);
        h.ultimoHasta = desde + p.tamano - 1;
        return resp({ serie: p.serie, desde, hasta: h.ultimoHasta });
      },
      cerrar() {},
    } as TransporteHub,
  };
  return h;
}

describe('coordinación en la terminal', () => {
  let db: Db;
  let ultimoUsado: number;
  const serie = (): SerieBloques => ({ serie: 'sku', tamano: 100, umbral: 10, ultimoUsado: () => ultimoUsado });

  beforeEach(() => {
    db = setupCoreDb();
    ultimoUsado = 0;
    setModoTerminal('distribuido');
    setCoordinadoraHasta(0);
  });
  afterEach(() => { setModoTerminal('standalone'); setCoordinadoraHasta(0); });

  it('en standalone siempre es coordinadora; en distribuido, solo con el permiso vigente', async () => {
    setModoTerminal('standalone');
    expect(esTerminalCoordinadora()).toBe(true);
    setModoTerminal('distribuido');
    expect(esTerminalCoordinadora()).toBe(false);

    const hub = hubFalso({ vigencia: 60_000 });
    const c = crearCoordinacionTerminal(sqliteDe(db), hub.transporte, []);
    expect(await c.renovar()).toBe(true);
    expect(esTerminalCoordinadora()).toBe(true);
    // Si no la renueva, deja de serlo sola antes de que el hub se la dé a otra (cuenta desde el envío).
    expect(esTerminalCoordinadora(Date.now() + 60_000)).toBe(false);

    hub.duenio = 'C2';
    expect(await c.renovar()).toBe(false);
    expect(esTerminalCoordinadora()).toBe(false);
  });

  it('sin conexión no cambia el permiso: vence solo', async () => {
    const hub = hubFalso();
    const c = crearCoordinacionTerminal(sqliteDe(db), hub.transporte, []);
    await c.renovar();
    hub.caido = true;
    await expect(c.renovar()).rejects.toThrow('HUB_INALCANZABLE');
    expect(esTerminalCoordinadora()).toBe(true);
    expect(esTerminalCoordinadora(Date.now() + 120_000)).toBe(false);
  });

  it('al emparejar la serie queda sin números hasta recibir el primer bloque', async () => {
    fijar(db, 'sku_proximo_secuencial', '40');
    ultimoUsado = 39;
    prepararSeriesDistribuido(sqliteDe(db), [serie()]);
    expect(disponiblesDeSerie(sqliteDe(db), 'sku')).toBe(0);

    const hub = hubFalso();
    await crearCoordinacionTerminal(sqliteDe(db), hub.transporte, [serie()]).revisarBloques();
    expect(hub.pedidos.at(-1)).toEqual({ ruta: RUTAS.bloque, cuerpo: { serie: 'sku', minimo: 40, tamano: 100 } });
    expect(parametro(db, 'sku_proximo_secuencial')).toBe('40');
    expect(parametro(db, 'sku_bloque_hasta')).toBe('139');
    expect(disponiblesDeSerie(sqliteDe(db), 'sku')).toBe(100);
  });

  it('el mínimo que pide sale de lo que la terminal ya ve en su base (una terminal que bajó el snapshot)', async () => {
    fijar(db, 'sku_proximo_secuencial', '1');
    ultimoUsado = 1039; // productos que bajaron del hub
    prepararSeriesDistribuido(sqliteDe(db), [serie()]);
    const hub = hubFalso();
    hub.ultimoHasta = 2039; // el bloque que ya tiene otra terminal
    await crearCoordinacionTerminal(sqliteDe(db), hub.transporte, [serie()]).revisarBloques();
    expect(hub.pedidos.at(-1)?.cuerpo).toMatchObject({ minimo: 1040 });
    expect(parametro(db, 'sku_proximo_secuencial')).toBe('2040');
    expect(parametro(db, 'sku_bloque_hasta')).toBe('2139');
  });

  it('con pocos números pide el siguiente bloque y lo guarda aparte; con uno guardado no pide más', async () => {
    fijar(db, 'sku_proximo_secuencial', '135');
    fijar(db, 'sku_bloque_hasta', '139');
    const hub = hubFalso();
    hub.ultimoHasta = 139;
    const c = crearCoordinacionTerminal(sqliteDe(db), hub.transporte, [serie()]);
    await c.revisarBloques();
    expect(parametro(db, 'sku_proximo_secuencial')).toBe('135');
    expect(parametro(db, 'sku_bloque_hasta')).toBe('139');
    expect(parametro(db, 'sku_bloque_siguiente')).toBe('140-239');
    expect(disponiblesDeSerie(sqliteDe(db), 'sku')).toBe(105);
    const n = hub.pedidos.length;
    await c.revisarBloques();
    expect(hub.pedidos.length).toBe(n);
  });

  it('con números de sobra no pide nada', async () => {
    fijar(db, 'sku_proximo_secuencial', '40');
    fijar(db, 'sku_bloque_hasta', '139');
    const hub = hubFalso();
    await crearCoordinacionTerminal(sqliteDe(db), hub.transporte, [serie()]).revisarBloques();
    expect(hub.pedidos).toEqual([]);
  });

  it('al volver a standalone la serie no tiene tope y sigue después de lo último que vio', () => {
    fijar(db, 'sku_proximo_secuencial', '45');
    fijar(db, 'sku_bloque_hasta', '139');
    fijar(db, 'sku_bloque_siguiente', '240-339');
    ultimoUsado = 2100;
    liberarSeries(sqliteDe(db), [serie()]);
    expect(parametro(db, 'sku_bloque_hasta')).toBeUndefined();
    expect(parametro(db, 'sku_bloque_siguiente')).toBeUndefined();
    expect(parametro(db, 'sku_proximo_secuencial')).toBe('2101');
    expect(disponiblesDeSerie(sqliteDe(db), 'sku')).toBeNull();
  });
});
