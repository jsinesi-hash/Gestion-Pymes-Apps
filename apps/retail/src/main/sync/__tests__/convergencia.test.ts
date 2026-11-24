import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type https from 'node:https';
import { and, eq, is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { aplicandoCambiosRecibidos, columnasQueNoViajan, createDb } from '@core/db';
import {
  abrirAlmacenHub, abrirCoordinacion, abrirTerminales, crearServidorHub, generarCertificado, PROTOCOLO_VERSION, versionEsquema,
  type AlmacenHub,
} from '@core/hub';
import {
  cajaAbrirHandler, cajaAbrirCompartidaHandler, cajaAddMovimientoHandler, cajaCalcularCierreHandler, cajaCerrarHandler,
  cajaCerrarCompartidaHandler, cajaGetActivaHandler, crearCajaCompartidaTerminal, crearSyncTerminal, escribirParametro,
  getModoTerminal, leerParametro, modoCaja, movimientosTardiosDe, setModoTerminal, setOriginId,
  type SyncTerminal,
} from '@core/main';
import * as schema from '../../db/schema';
import { registroSyncRetail } from '../../db/registro-sync';
import { setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler, productoUpdateHandler } from '../../ipc/producto';
import { marcaCreateHandler, marcaUpdateHandler } from '../../ipc/marca';
import { stockEntradaHandler } from '../../ipc/stock';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { proyectarCostoPromedio, proyectarStock } from '../../catalog/stock-proyeccion';
import { opcionesSyncRetail } from '../proyecciones';

// Convergencia (F2 PR3 y PR4, ADR-150 y ADR-151): un hub HTTPS en el proceso y dos terminales de Retail.
// Arrancan como en una instalación real: la primera se empareja (leyendo la huella del certificado) y
// sube su base como semilla; la segunda es una instalación nueva, con su propio seed, que se empareja y
// baja el snapshot. Después venden y cargan stock sin verse entre sí. Al sincronizar, las dos y el hub
// tienen las mismas filas, el stock y el costo proyectados son los mismos en las tres bases y una
// edición concurrente del mismo producto termina con un ganador y una entrada en el log de conflictos.
// F2 PR5: el hub da el permiso de coordinadora a una sola, reparte bloques de SKU sin superponerse y la
// coordinadora avisa el stock que quedó negativo por ventas concurrentes.
type Db = ReturnType<typeof setupDb>;
const registro = registroSyncRetail();
const MIGRACIONES = path.resolve(__dirname, '../../db/migrations');
const CF_ID = 'cf000000-0000-0000-0000-000000000001';
const tablasSync = Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t).sort();
const COLUMNAS = new Map(Object.values(schema).filter((v) => is(v, SQLiteTable))
  .map((v) => getTableConfig(v as SQLiteTable)).map((c) => [c.name, c.columns.map((col) => col.name)]));

function columnasQueViajan(tabla: string): string[] {
  const noViajan = columnasQueNoViajan(registro[tabla]!);
  return COLUMNAS.get(tabla)!.filter((c) => !noViajan.has(c));
}
function filas(sqlite: Database.Database, tabla: string): Record<string, unknown>[] {
  return sqlite.prepare(`select ${columnasQueViajan(tabla).map((c) => `"${c}"`).join(', ')} from "${tabla}" order by id`).all() as Record<string, unknown>[];
}
/** Lo que no se compara: el estado de sync es de cada nodo; en tablas con proyectadas, mover el saldo
 * sube `version` y `updated_at` localmente sin encolar (ADR-151). */
function comparables(tabla: string, lista: Record<string, unknown>[]): Record<string, unknown>[] {
  const conSaldo = (registro[tabla]!.proyectadas ?? []).length > 0;
  return lista.map((f) => {
    const { sync_state: _s, ...resto } = f;
    if (conSaldo) { delete resto['version']; delete resto['updated_at']; }
    return resto;
  });
}

describe('convergencia de dos terminales de Retail con el hub', () => {
  let a: Db;
  let b: Db;
  let almacen: AlmacenHub;
  let hubSqlite: Database.Database;
  let server: https.Server;
  let syncA: SyncTerminal;
  let syncB: SyncTerminal;
  const carpetas: string[] = [];
  let productoId = '';

  function como<T>(origen: string, fn: () => T): T {
    setOriginId(origen);
    try { return fn(); } finally { setOriginId('C1'); }
  }
  const sqliteDe = (db: Db) => db.$client as Database.Database;

  beforeAll(async () => {
    setOriginId('C1');
    a = setupDb();
    runCatalogSeed(a);
    clearSession();
    loginAsAdmin(a);
    const imp = a.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    productoId = productoCreateHandler(a, {
      nombre_corto: 'Pinza', categoria_id: categoriaCreateHandler(a, { nombre: 'Herramientas' }).id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista_centavos: 90_000,
      stock_inicial: { cantidad: 10, costo_centavos: 10_000 },
    }).id;

    hubSqlite = new Database(':memory:');
    almacen = abrirAlmacenHub(hubSqlite, { schema, registro, migracionesApp: MIGRACIONES });
    const terminales = abrirTerminales(hubSqlite);
    const cert = generarCertificado({ nombre: 'hub-retail', dias: 30 });
    const versiones = { protocolo: PROTOCOLO_VERSION, esquema: versionEsquema(MIGRACIONES) };
    server = crearServidorHub({ almacen, terminales, coordinacion: abrirCoordinacion(hubSqlite), tls: cert, versiones });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `127.0.0.1:${(server.address() as AddressInfo).port}`;

    const terminal = (db: Db): SyncTerminal => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'convergencia-retail-'));
      carpetas.push(dir);
      return crearSyncTerminal(db as never, opcionesSyncRetail(db, { migrationsFolder: MIGRACIONES, carpetaDatos: dir }), {
        safeStorage: { isEncryptionAvailable: () => true, encryptString: (t) => Buffer.from(t), decryptString: (b) => b.toString() },
        respaldar: async () => undefined,
        programar: () => ({ detener() {} }), // el test sincroniza a mano
      });
    };

    // Primera terminal: lee la huella del hub (la que el usuario compara) y sube su base como semilla.
    syncA = terminal(a);
    const { huella } = await syncA.sondear(url);
    expect(huella).toBe(cert.huella);
    expect(await syncA.emparejar({ url, codigo: terminales.generarCodigo().codigo, huella })).toMatchObject({ origin_id: 'C1', arranque: 'semilla' });

    // Segunda terminal: una instalación nueva con su propio seed (UUID aleatorios); el mismo proceso
    // hace de las dos, así que el modo vuelve a standalone para emparejarla.
    setModoTerminal('standalone');
    b = setupDb();
    runCatalogSeed(b);
    syncB = terminal(b);
    expect(await syncB.emparejar({ url, codigo: terminales.generarCodigo().codigo, huella })).toMatchObject({ origin_id: 'C2', arranque: 'snapshot' });
    expect(getModoTerminal()).toBe('distribuido');
    // Bajar el snapshot cerró la sesión: los usuarios ahora son los del hub (los mismos que en A).
    loginAsAdmin(a);
  });
  afterAll(async () => {
    for (const s of [syncA, syncB]) s?.detener();
    await new Promise<void>((r) => server.close(() => r()));
    setOriginId('C1');
    setModoTerminal('standalone');
    for (const d of carpetas) fs.rmSync(d, { recursive: true, force: true });
  });

  const vender = (db: Db, cajaId: string, cantidad: number) => ventaConfirmarHandler(db, {
    caja_id: cajaId, cliente_id: CF_ID,
    lineas: [{ producto_id: productoId, descripcion: 'Pinza', cantidad, precio_unitario_centavos: 90_000, descuento_linea: 0, alicuota_iva: 21, subtotal_centavos: 90_000 * cantidad }],
    descuento_global: 0, subtotal_centavos: 90_000 * cantidad, importe_iva_centavos: Math.round((90_000 * cantidad * 21) / 121),
    total_centavos: 90_000 * cantidad, ajuste_redondeo_centavos: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: 90_000 * cantidad }],
  });

  it('venden y cargan stock por separado; al sincronizar, las tres bases coinciden', async () => {
    como('C1', () => {
      const caja = cajaAbrirHandler(a, { monto_inicial_centavos: 0 });
      stockEntradaHandler(a, { producto_id: productoId, cantidad: 5, costo_unitario_centavos: 13_000 });
      vender(a, caja.id, 2);
      productoUpdateHandler(a, { id: productoId, nombre_corto: 'Pinza de A' });
    });
    como('C2', () => {
      const caja = cajaAbrirHandler(b, { monto_inicial_centavos: 0 });
      stockEntradaHandler(b, { producto_id: productoId, cantidad: 3, costo_unitario_centavos: 20_000 });
      vender(b, caja.id, 1);
      productoUpdateHandler(b, { id: productoId, nombre_corto: 'Pinza de B' });
    });

    // Dos vueltas: cada una sube lo suyo y baja lo del otro (y los ganadores reemitidos).
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncA.sincronizarAhora();
      await syncB.sincronizarAhora();
    }
    expect([syncA.estado().sync?.pendientes, syncB.estado().sync?.pendientes]).toEqual([0, 0]);

    // Mismas filas en las dos terminales y en el hub, tabla por tabla.
    const snap = new Map(almacen.snapshot().tablas.map((t) => [t.tabla, t.filas]));
    for (const t of tablasSync) {
      const enA = comparables(t, filas(sqliteDe(a), t));
      expect(comparables(t, filas(sqliteDe(b), t)), `${t}: A y B`).toEqual(enA);
      expect(comparables(t, (snap.get(t) ?? []) as Record<string, unknown>[]), `${t}: hub`).toEqual(enA);
    }

    // El stock y el costo proyectados son los mismos en las tres bases: 10 + 5 − 2 + 3 − 1.
    const hubDb = createDb(hubSqlite, schema).db as unknown as Db;
    const stock = (db: Db) => db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, productoId)).get()!.stock_fisico;
    const costo = (db: Db) => db.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get()!.precio_costo_promedio_centavos;
    expect([stock(a), stock(b), proyectarStock(hubDb, productoId)]).toEqual([15, 15, 15]);
    expect(costo(b)).toBe(costo(a));
    expect(proyectarCostoPromedio(hubDb, productoId)).toBe(costo(a));
    expect(proyectarCostoPromedio(a, productoId)).toBe(costo(a));

    // La edición concurrente del mismo producto: un ganador en las tres bases y una entrada en el log.
    const nombre = (db: Db) => db.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get()!.nombre_corto;
    expect(['Pinza de A', 'Pinza de B']).toContain(nombre(a));
    expect(nombre(b)).toBe(nombre(a));
    const lww = almacen.conflictos().filter((c) => c.tipo === 'lww');
    expect(lww.map((c) => c.tabla)).toEqual(['producto']);
  });

  it('coordinadora, bloques de SKU y alerta de stock negativo por ventas concurrentes', async () => {
    // El permiso es de una sola: la primera que lo pidió (A) y B no lo obtiene mientras A lo renueva.
    // (El mismo proceso hace de las dos terminales: el estado vale justo después de cada sync.)
    expect((await syncA.sincronizarAhora()).coordinadora).toBe(true);
    expect((await syncB.sincronizarAhora()).coordinadora).toBe(false);

    // Cada una da de alta un producto con un SKU de su bloque: no se repiten.
    const imp = a.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    const cat = a.select().from(schema.categoria).get()!;
    const alta = (db: Db, nombre: string) => productoCreateHandler(db, { nombre_corto: nombre, categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista_centavos: 1_000 });
    const enA = como('C1', () => alta(a, 'Destornillador'));
    const enB = como('C2', () => alta(b, 'Llave'));
    expect(enA.sku).not.toBe(enB.sku);
    const bloques = new Map(hubSqlite.prepare("select origin_id, desde, hasta from hub_bloque where serie = 'sku'").all()
      .map((f) => { const x = f as { origin_id: string; desde: number; hasta: number }; return [x.origin_id, x] as const; }));
    const dentro = (p: { sku_secuencial: number }, o: string) => p.sku_secuencial >= bloques.get(o)!.desde && p.sku_secuencial <= bloques.get(o)!.hasta;
    expect(dentro(a.select().from(schema.producto).where(eq(schema.producto.id, enA.id)).get()!, 'C1')).toBe(true);
    expect(dentro(b.select().from(schema.producto).where(eq(schema.producto.id, enB.id)).get()!, 'C2')).toBe(true);
    // El bloque de B empieza después de todo lo que ya existía (incluido lo que bajó del hub).
    expect(bloques.get('C2')!.desde).toBeGreaterThan(bloques.get('C1')!.hasta);

    // Ventas concurrentes: cada una ve 15 y vende 10. Al juntarlas, el stock queda en −5.
    const cajaDe = (db: Db, origen: string) => db.select().from(schema.caja)
      .where(and(eq(schema.caja.estado, 'abierta'), eq(schema.caja.origin_id, origen))).get()!.id;
    como('C1', () => vender(a, cajaDe(a, 'C1'), 10));
    como('C2', () => vender(b, cajaDe(b, 'C2'), 10));
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncA.sincronizarAhora();
      await syncB.sincronizarAhora();
    }
    const stock = (db: Db) => db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, productoId)).get()!.stock_fisico;
    expect([stock(a), stock(b)]).toEqual([-5, -5]);
    // La coordinadora avisa una sola vez; la otra no genera avisos.
    const avisos = (db: Db) => db.select().from(schema.aviso).where(eq(schema.aviso.origen_tipo, 'stock_negativo')).all();
    expect(avisos(a).map((x) => x.origen_id)).toEqual([productoId]);
    expect(avisos(b)).toEqual([]);
    await syncA.sincronizarAhora();
    expect(avisos(a)).toHaveLength(1);
    // Y ninguna vende ese producto hasta corregirlo.
    expect(() => como('C1', () => vender(a, cajaDe(a, 'C1'), 1))).toThrow('STOCK_INSUFICIENTE');
    expect(() => como('C2', () => vender(b, cajaDe(b, 'C2'), 1))).toThrow('STOCK_INSUFICIENTE');
  });

  it('entrar con el mismo usuario en las dos no genera conflictos: el último acceso es de cada caja (F3 PR1)', async () => {
    const antes = almacen.conflictos().length;
    const acceso = (db: Db) => db.select().from(schema.usuario).where(eq(schema.usuario.nombre_usuario, 'admin')).get()!.ultimo_acceso;
    // Un acceso viejo en las dos (sin encolar): el ingreso de abajo lo cambia de verdad.
    for (const db of [a, b]) {
      aplicandoCambiosRecibidos(sqliteDe(db), () => sqliteDe(db).prepare(`update "usuario" set "ultimo_acceso" = 1 where "nombre_usuario" = 'admin'`).run());
    }
    como('C1', () => { clearSession(); loginAsAdmin(a); });
    como('C2', () => { clearSession(); loginAsAdmin(b); });
    expect([syncA.estado().sync?.pendientes, syncB.estado().sync?.pendientes]).toEqual([0, 0]);
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncA.sincronizarAhora();
      await syncB.sincronizarAhora();
    }
    expect(almacen.conflictos().slice(antes)).toEqual([]);
    // Cada caja conserva su propio último acceso: el pull no lo pisa.
    expect(acceso(a)!.getTime()).toBeGreaterThan(1000);
    expect(acceso(b)!.getTime()).toBeGreaterThan(1000);
    loginAsAdmin(a);
  });

  it('conflictos desde una caja (F3 PR1): se listan, «Recuperar» devuelve la versión perdida y se ven las cajas', async () => {
    // El primer test dejó un lww en `producto` (las dos editaron el nombre de la pinza sin verse).
    const nombre = (db: Db) => db.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get()!.nombre_corto;
    const { conflictos } = await syncA.conflictos().listar({ pendientes: true, tipo: 'lww' });
    const c = conflictos.find((x) => x.tabla === 'producto' && x.fila_id === productoId)!;
    expect(c).toMatchObject({ recuperable: true, resuelto: 0 });
    const perdida = String((c.perdida === 'actual' ? c.fila_actual : c.fila_entrante)!['nombre_corto']);
    expect(perdida).not.toBe(nombre(a));

    const resuelto = await como('C1', () => syncA.conflictos().resolver(c.id, 'recuperado', 'Administrador'));
    expect(resuelto).toMatchObject({ resuelto: 1, resolucion: 'recuperado', resuelto_por: 'Administrador (C1)' });
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncA.sincronizarAhora();
      await syncB.sincronizarAhora();
    }
    expect([nombre(a), nombre(b)]).toEqual([perdida, perdida]);
    expect((await syncB.conflictos().listar({ pendientes: true, tipo: 'lww' })).conflictos.filter((x) => x.tabla === 'producto')).toEqual([]);

    const cajas = await syncB.conflictos().terminales();
    expect(cajas.map((t) => t.origin_id).sort()).toEqual(['C1', 'C2']);
  });

  it('una marca repetida sin conexión no frena a la caja: lo que depende de ella espera y entra al renombrarla (F3 PR1)', async () => {
    const imp = a.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    const categoria = a.select().from(schema.categoria).get()!.id;
    const enA = como('C1', () => marcaCreateHandler(a, { nombre: 'Irwin F3' }));
    const enB = como('C2', () => marcaCreateHandler(b, { nombre: 'Irwin F3' }));
    await syncA.sincronizarAhora();
    await syncB.sincronizarAhora(); // la de B choca con el índice único: conflicto de unicidad
    const { conflictos } = await syncA.conflictos().listar({ pendientes: true, tipo: 'unicidad' });
    expect(conflictos.map((x) => x.fila_id)).toEqual([enB.id]);

    // B sigue trabajando: un producto de su marca. Antes el lote entero se rechazaba (LOTE_FK_ROTA).
    const llave = como('C2', () => productoCreateHandler(b, {
      nombre_corto: 'Llave Irwin', categoria_id: categoria, marca_id: enB.id, impuesto_id: imp.id, unidad_venta: 'u',
      precio_venta_lista_centavos: 50_000,
    }));
    // Y A, uno de la suya: al bajar a B apunta a una marca que B todavía no pudo guardar.
    const pinza = como('C1', () => productoCreateHandler(a, {
      nombre_corto: 'Pinza Irwin', categoria_id: categoria, marca_id: enA.id, impuesto_id: imp.id, unidad_venta: 'u',
      precio_venta_lista_centavos: 60_000,
    }));
    await syncA.sincronizarAhora();
    await syncB.sincronizarAhora();
    expect(syncB.estado().sync).toMatchObject({ pendientes: 0, ultimoError: null });
    expect((await syncB.conflictos().listar({})).enEspera).toBeGreaterThan(0);
    // B apartó la marca de A (choca con la suya), el producto de A (le falta esa marca) y lo que cuelga del
    // producto (existencias, movimiento inicial, precio), sin cortar el pull.
    expect(syncB.estado().sync!.recibidosEnEspera).toBeGreaterThanOrEqual(2);
    const enB_ = (id: string) => b.select().from(schema.producto).where(eq(schema.producto.id, id)).get();
    expect(enB_(pinza.id)).toBeUndefined();
    // Mientras, A renombra la suya: en B entra esa versión y la vieja que había quedado apartada no la pisa.
    como('C1', () => marcaUpdateHandler(a, { id: enA.id, nombre: 'Irwin A' }));
    await syncA.sincronizarAhora();
    await syncB.sincronizarAhora();
    const enHub = () => almacen.snapshot().tablas.find((t) => t.tabla === 'producto')!.filas.some((p) => p['id'] === llave.id);
    expect(enHub()).toBe(false);

    // El Supervisor la renombra en B: entra la marca, detrás el producto, y el conflicto se resuelve solo.
    como('C2', () => marcaUpdateHandler(b, { id: enB.id, nombre: 'Irwin F3 (B)' }));
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncB.sincronizarAhora();
      await syncA.sincronizarAhora();
    }
    expect(enHub()).toBe(true);
    expect(a.select().from(schema.producto).where(eq(schema.producto.id, llave.id)).get()).toMatchObject({ marca_id: enB.id });
    // En B entró lo apartado: la marca de A y su producto.
    expect(syncB.estado().sync!.recibidosEnEspera).toBe(0);
    expect(b.select().from(schema.marca).where(eq(schema.marca.id, enA.id)).get()).toMatchObject({ nombre: 'Irwin A' });
    expect(enB_(pinza.id)).toMatchObject({ marca_id: enA.id });
    expect((await syncA.conflictos().listar({})).enEspera).toBe(0);
    const [u] = (await syncA.conflictos().listar({ tipo: 'unicidad' })).conflictos;
    expect(u).toMatchObject({ fila_id: enB.id, resuelto: 1, resolucion: 'corregido', resuelto_por: 'C2' });
    expect(enA.id).not.toBe(enB.id);
  });

  it('descartar una alta repetida en su caja (F3 PR2): queda de baja, libera el nombre y el conflicto se resuelve solo', async () => {
    // Lo que corre después de un await ve el origin_id global: se fija a mano mientras dura la llamada.
    const desde = async <T>(origen: string, fn: () => Promise<T>): Promise<T> => {
      setOriginId(origen);
      try { return await fn(); } finally { setOriginId('C1'); }
    };
    const enA = como('C1', () => marcaCreateHandler(a, { nombre: 'Truper F3' }));
    const enB = como('C2', () => marcaCreateHandler(b, { nombre: 'Truper F3' }));
    await syncA.sincronizarAhora();
    await syncB.sincronizarAhora();
    const c = (await syncB.conflictos().listar({ pendientes: true, tipo: 'unicidad' })).conflictos.find((x) => x.fila_id === enB.id)!;
    expect(c.columnasUnicas).toEqual(['nombre']);
    // La fila rechazada está solo en B: desde A no se puede descartar.
    await expect(desde('C1', () => syncA.conflictos().descartarAlta(c.id))).rejects.toThrow('CONFLICTO_DE_OTRA_CAJA');

    await desde('C2', () => syncB.conflictos().descartarAlta(c.id));
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await syncB.sincronizarAhora();
      await syncA.sincronizarAhora();
    }
    const marca = (db: Db, id: string) => db.select().from(schema.marca).where(eq(schema.marca.id, id)).get()!;
    expect(marca(b, enB.id)).toMatchObject({ activo: false, nombre: `Truper F3 (descartado ${enB.id.slice(0, 8)})` });
    expect(marca(a, enB.id)).toMatchObject({ activo: false });
    expect(marca(a, enA.id)).toMatchObject({ activo: true, nombre: 'Truper F3' });
    const [r] = (await syncA.conflictos().listar({ tipo: 'unicidad' })).conflictos.filter((x) => x.fila_id === enB.id);
    expect(r).toMatchObject({ resuelto: 1, resolucion: 'corregido', resuelto_por: 'C2' });
  });

  it('caja compartida (F3 PR4, ADR-155): un solo turno en el negocio, las dos cajas operan contra él y el cierre suma todo', async () => {
    const desde = async <T>(origen: string, fn: () => Promise<T>): Promise<T> => {
      setOriginId(origen);
      try { return await fn(); } finally { setOriginId('C1'); }
    };
    const sincronizar = async () => { for (let v = 0; v < 2; v++) { await syncA.sincronizarAhora(); await syncB.sincronizarAhora(); } };
    // Para cambiar de modo no puede haber cajas abiertas: se cierran las de los tests anteriores (por terminal).
    for (const db of [a, b]) {
      for (const c of db.select().from(schema.caja).where(eq(schema.caja.estado, 'abierta')).all()) {
        const r = cajaCalcularCierreHandler(db, { caja_id: c.id });
        cajaCerrarHandler(db, { caja_id: c.id, monto_contado_centavos: r.esperado_efectivo_centavos });
      }
    }
    await sincronizar();
    escribirParametro(a, 'caja_modo', 'compartida');
    await sincronizar();
    expect([modoCaja(a), modoCaja(b), leerParametro(b, 'caja_modo')]).toEqual(['compartida', 'compartida', 'compartida']);

    // A abre el turno; B lo ve como su caja activa y no puede abrir otro (ni acá ni en el hub).
    const turno = await desde('C1', () => cajaAbrirCompartidaHandler(a, { monto_inicial_centavos: 10_000 }, syncA.cajaCompartida()));
    await sincronizar();
    expect(cajaGetActivaHandler(b)?.id).toBe(turno.id);
    await expect(desde('C2', () => cajaAbrirCompartidaHandler(b, { monto_inicial_centavos: 0 }, syncB.cajaCompartida()))).rejects.toThrow('CAJA_COMPARTIDA_YA_ABIERTA');
    await expect(syncB.cajaCompartida().reservar('00000000-0000-0000-0000-00000000000b')).rejects.toThrow('CAJA_COMPARTIDA_YA_ABIERTA');
    expect(await syncB.cajaCompartida().actual()).toMatchObject({ caja_id: turno.id, origin_id: 'C1' });

    // Las dos operan contra el mismo turno; B, además, sin conexión: aporta igual, pero no abre ni cierra.
    como('C1', () => cajaAddMovimientoHandler(a, { caja_id: turno.id, tipo: 'ingreso', motivo: 'aporte', monto_centavos: 1_000 }));
    const sinHub = crearCajaCompartidaTerminal(sqliteDe(b), { pedir: async () => { throw new Error('HUB_INALCANZABLE: prueba'); }, cerrar() {} } as never);
    como('C2', () => cajaAddMovimientoHandler(b, { caja_id: turno.id, tipo: 'ingreso', motivo: 'aporte', monto_centavos: 2_000 }));
    await expect(desde('C2', () => cajaCerrarCompartidaHandler(b, { caja_id: turno.id, monto_contado_centavos: 0 }, {}, sinHub))).rejects.toThrow('CAJA_COMPARTIDA_SIN_CONEXION');
    expect(b.select().from(schema.caja).where(eq(schema.caja.id, turno.id)).get()!.estado).toBe('abierta');
    await sincronizar();

    // El cierre en A suma los movimientos de las dos cajas y libera el turno en el hub.
    const resumen = cajaCalcularCierreHandler(a, { caja_id: turno.id });
    expect(resumen.esperado_efectivo_centavos).toBe(13_000);
    const cerrada = await desde('C1', () => cajaCerrarCompartidaHandler(a, { caja_id: turno.id, monto_contado_centavos: 13_000 }, {}, syncA.cajaCompartida()));
    expect(cerrada).toMatchObject({ estado: 'cerrada', monto_esperado_centavos: 13_000, diferencia_centavos: 0 });
    expect(await syncA.cajaCompartida().actual()).toBeNull();
    await sincronizar();
    expect(b.select().from(schema.caja).where(eq(schema.caja.id, turno.id)).get()).toMatchObject({ estado: 'cerrada', monto_esperado_centavos: 13_000 });
    expect(cajaGetActivaHandler(b)).toBeNull();

    // Ahora B puede abrir el turno siguiente.
    const siguiente = await desde('C2', () => cajaAbrirCompartidaHandler(b, { monto_inicial_centavos: 0 }, syncB.cajaCompartida()));
    expect(await syncA.cajaCompartida().actual()).toMatchObject({ caja_id: siguiente.id, origin_id: 'C2' });
  });

  it('movimiento posterior al cierre (F3 PR5, ADR-155 §5): queda en el turno, avisa una vez y no mueve la diferencia', async () => {
    const desde = async <T>(origen: string, fn: () => Promise<T>): Promise<T> => {
      setOriginId(origen);
      try { return await fn(); } finally { setOriginId('C1'); }
    };
    // El turno que abrió B en el test anterior sigue abierto; las dos lo conocen.
    await syncB.sincronizarAhora();
    await syncA.sincronizarAhora();
    const turno = cajaGetActivaHandler(a)!;
    expect(cajaGetActivaHandler(b)?.id).toBe(turno.id);

    // B aporta y todavía no sube (está sin conexión); A cierra con lo que ve.
    const mov = como('C2', () => cajaAddMovimientoHandler(b, { caja_id: turno.id, tipo: 'ingreso', motivo: 'aporte', monto_centavos: 700 }));
    const esperadoEnA = cajaCalcularCierreHandler(a, { caja_id: turno.id }).esperado_efectivo_centavos;
    await desde('C1', () => cajaCerrarCompartidaHandler(a, { caja_id: turno.id, monto_contado_centavos: esperadoEnA }, {}, syncA.cajaCompartida()));
    await syncA.sincronizarAhora();

    // B vuelve: sube su aporte y baja el cierre. El aporte queda en el turno cerrado.
    await syncB.sincronizarAhora();
    await syncA.sincronizarAhora();
    const cajaEn = (db: Db) => db.select().from(schema.caja).where(eq(schema.caja.id, turno.id)).get()!;
    expect(a.select().from(schema.movimiento_caja).where(eq(schema.movimiento_caja.id, mov.id)).get()).toMatchObject({ caja_id: turno.id });
    expect(cajaEn(a)).toMatchObject({ estado: 'cerrada', monto_esperado_centavos: esperadoEnA, diferencia_centavos: 0 });
    expect(cajaEn(b)).toMatchObject({ estado: 'cerrada', monto_esperado_centavos: esperadoEnA, diferencia_centavos: 0 });
    expect(movimientosTardiosDe(a as never, cajaEn(a))).toMatchObject({ esperado_cierre_centavos: esperadoEnA, esperado_actual_centavos: esperadoEnA + 700 });

    // La coordinadora (A) avisa una vez a quien autoriza diferencias; la otra no genera avisos.
    const tardios = (db: Db) => db.select().from(schema.aviso).where(eq(schema.aviso.origen_tipo, 'caja_movimiento_tardio')).all();
    expect(tardios(a).length).toBeGreaterThan(0);
    expect(tardios(a).every((x) => x.origen_id === turno.id)).toBe(true);
    expect(tardios(b)).toEqual([]);
    const cuantos = tardios(a).length;
    await syncA.sincronizarAhora();
    expect(tardios(a)).toHaveLength(cuantos);
  });
});
