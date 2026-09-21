import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { ubicacionCreateHandler } from '../ubicacion';
import {
  productoCreateHandler, productoListHandler, productoGetHandler,
  productoUpdateHandler, productoDeactivateHandler, productoStockCountsHandler,
  productoQuickCreateHandler,
  type CreateProductoPayload,
} from '../producto';
import { formatSku } from '@ferreteria/shared';

type Db = ReturnType<typeof setupDb>;

function makeBase(db: Db): CreateProductoPayload {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Test' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return { nombre_corto: 'Taladro', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'unidad', precio_venta_lista: 5000 };
}

describe('producto handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('create genera SKU formato P-NNNNNNN-C correlativo', () => {
    loginAsAdmin(db);
    const p1 = productoCreateHandler(db, makeBase(db));
    const p2 = productoCreateHandler(db, { ...makeBase(db), nombre_corto: 'Sierra' });
    expect(p1.sku).toBe(formatSku(1));
    expect(p2.sku).toBe(formatSku(2));
    expect(p1.sku_secuencial).toBe(1);
    expect(p2.sku_secuencial).toBe(2);
  });

  it('create genera existencias con stock_fisico=0', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, makeBase(db));
    const ex = db.select().from(schema.existencias).all().find(e => e.producto_id === p.id);
    expect(ex?.stock_fisico).toBe(0);
  });

  it('create genera movimiento_stock tipo=entrada motivo=inicial', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, makeBase(db));
    const mv = db.select().from(schema.movimiento_stock).all().find(m => m.producto_id === p.id);
    expect(mv?.motivo).toBe('inicial');
    expect(mv?.cantidad).toBe(0);
  });

  it('create con stock_inicial setea existencias, movimiento y CPP', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, { ...makeBase(db), stock_inicial: { cantidad: 10, costo: 300 } });
    const ex = db.select().from(schema.existencias).all().find(e => e.producto_id === p.id);
    const mv = db.select().from(schema.movimiento_stock).all().find(m => m.producto_id === p.id);
    const prod = db.select().from(schema.producto).where(eq(schema.producto.id, p.id)).get();
    expect(ex?.stock_fisico).toBe(10);
    expect(mv?.motivo).toBe('inicial');
    expect(mv?.cantidad).toBe(10);
    expect(mv?.stock_resultante).toBe(10);
    expect(mv?.costo_unitario).toBe(300);
    expect(prod?.precio_costo_promedio).toBe(300);
  });

  it('create con stock_inicial sin costo: stock sí, CPP queda en 0', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, { ...makeBase(db), stock_inicial: { cantidad: 5 } });
    const ex = db.select().from(schema.existencias).all().find(e => e.producto_id === p.id);
    const prod = db.select().from(schema.producto).where(eq(schema.producto.id, p.id)).get();
    expect(ex?.stock_fisico).toBe(5);
    expect(prod?.precio_costo_promedio).toBe(0);
  });

  it('create con stock_inicial de cantidad inválida (<=0) no mueve stock ni CPP', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, { ...makeBase(db), stock_inicial: { cantidad: -5, costo: 100 } });
    const ex = db.select().from(schema.existencias).all().find(e => e.producto_id === p.id);
    const mv = db.select().from(schema.movimiento_stock).all().find(m => m.producto_id === p.id);
    const prod = db.select().from(schema.producto).where(eq(schema.producto.id, p.id)).get();
    expect(ex?.stock_fisico).toBe(0);
    expect(mv?.cantidad).toBe(0);
    expect(prod?.precio_costo_promedio).toBe(0);
  });

  it('nombre_largo por defecto = nombre_corto', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, makeBase(db));
    expect(p.nombre_largo).toBe('Taladro');
  });

  it('list retorna items con stock_fisico y paginación', () => {
    loginAsAdmin(db);
    productoCreateHandler(db, makeBase(db));
    productoCreateHandler(db, { ...makeBase(db), nombre_corto: 'Sierra' });
    const result = productoListHandler(db, { page: 1, pageSize: 10 });
    expect(result.total).toBe(2);
    expect(result.items[0]).toHaveProperty('stock_fisico');
  });

  it('list filtra por búsqueda en nombre_corto', () => {
    loginAsAdmin(db);
    productoCreateHandler(db, makeBase(db));
    productoCreateHandler(db, { ...makeBase(db), nombre_corto: 'Sierra' });
    const r = productoListHandler(db, { busqueda: 'Sierra', page: 1, pageSize: 10 });
    expect(r.total).toBe(1);
    expect(r.items[0].nombre_corto).toBe('Sierra');
  });

  it('list con activo=true excluye inactivos', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, makeBase(db));
    productoDeactivateHandler(db, { id: p.id });
    expect(productoListHandler(db, { activo: true, page: 1, pageSize: 10 }).total).toBe(0);
  });

  it('get retorna producto por id', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, makeBase(db));
    expect(productoGetHandler(db, { id: p.id })?.nombre_corto).toBe('Taladro');
  });

  it('update modifica nombre y bumps version', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, makeBase(db));
    const u = productoUpdateHandler(db, { id: p.id, nombre_corto: 'Pro' });
    expect(u.nombre_corto).toBe('Pro');
    expect(u.version).toBe(2);
  });

  it('deactivate marca activo=false', () => {
    loginAsAdmin(db);
    const p = productoCreateHandler(db, makeBase(db));
    productoDeactivateHandler(db, { id: p.id });
    expect(productoGetHandler(db, { id: p.id })?.activo).toBe(false);
  });

  it('create lanza UNAUTHENTICATED sin sesión', () => {
    expect(() => productoCreateHandler(db, makeBase(db))).toThrow('UNAUTHENTICATED');
  });

  describe('list — ubicacion_id server-side filter', () => {
    it('retorna solo productos de esa ubicacion_id', () => {
      loginAsAdmin(db);
      const base = makeBase(db);
      const ub = ubicacionCreateHandler(db, { sector: 'A', estante: '01', posicion: '01' });
      const p1 = productoCreateHandler(db, { ...base, ubicacion_id: ub.id });
      productoCreateHandler(db, { ...base, nombre_corto: 'Otro' }); // sin ubicacion
      const r = productoListHandler(db, { ubicacion_id: ub.id, page: 1, pageSize: 10 });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe(p1.id);
    });

    it('retorna [] si la ubicacion no tiene productos', () => {
      loginAsAdmin(db);
      const base = makeBase(db);
      productoCreateHandler(db, base); // producto existe pero sin esa ubicacion
      const ub = ubicacionCreateHandler(db, { sector: 'B', estante: '02', posicion: '02' });
      const r = productoListHandler(db, { ubicacion_id: ub.id, page: 1, pageSize: 10 });
      expect(r.total).toBe(0);
    });
  });

  describe('list — exactCodigo', () => {
    it('busca por SKU exacto (scan interno)', () => {
      loginAsAdmin(db);
      const p = productoCreateHandler(db, makeBase(db));
      const r = productoListHandler(db, { exactCodigo: p.sku, page: 1, pageSize: 10 });
      expect(r.items).toHaveLength(1);
      expect(r.items[0].id).toBe(p.id);
    });

    it('busca por gtin_barcode exacto (EAN-13)', () => {
      loginAsAdmin(db);
      const p = productoCreateHandler(db, { ...makeBase(db), gtin_barcode: '7891234560001' });
      const r = productoListHandler(db, { exactCodigo: '7891234560001', page: 1, pageSize: 10 });
      expect(r.items).toHaveLength(1);
      expect(r.items[0].id).toBe(p.id);
    });

    it('busca por gtin_barcode exacto (EAN-8)', () => {
      loginAsAdmin(db);
      const p = productoCreateHandler(db, { ...makeBase(db), gtin_barcode: '12345678' });
      const r = productoListHandler(db, { exactCodigo: '12345678', page: 1, pageSize: 10 });
      expect(r.items).toHaveLength(1);
      expect(r.items[0].id).toBe(p.id);
    });

    // ADR-066 item 3: `busqueda` (texto libre) ahora también matchea gtin_barcode,
    // a diferencia del comportamiento previo a este ADR (donde solo exactCodigo
    // matcheaba EAN). Este test documenta el cambio deliberado de comportamiento.
    it('EAN parcial sin exactCodigo SÍ matchea (ADR-066: busqueda incluye gtin_barcode)', () => {
      loginAsAdmin(db);
      const p = productoCreateHandler(db, { ...makeBase(db), gtin_barcode: '7891234560001' });
      const r = productoListHandler(db, { busqueda: '7891234560', page: 1, pageSize: 10 });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe(p.id);
    });

    it('exactCodigo inexistente retorna items vacío', () => {
      loginAsAdmin(db);
      const r = productoListHandler(db, { exactCodigo: 'P-9999999-0', page: 1, pageSize: 10 });
      expect(r.items).toHaveLength(0);
    });
  });

  describe('list — búsqueda por EAN/GTIN (ADR-066 item 3)', () => {
    it('busca por fragmento de EAN/GTIN', () => {
      loginAsAdmin(db);
      runCatalogSeed(db);
      const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
      const imp = db.select().from(schema.impuesto).all()[0];
      productoCreateHandler(db, {
        nombre_corto: 'Cinta aisladora', categoria_id: cat.id, impuesto_id: imp.id,
        unidad_venta: 'u', precio_venta_lista: 100, gtin_barcode: '7791234567890',
      });
      const res = productoListHandler(db, { busqueda: '123456', page: 1, pageSize: 10 });
      expect(res.items.some((p: any) => p.gtin_barcode === '7791234567890')).toBe(true);
    });
  });

  describe('list — join ubicacion', () => {
    it('incluye ubicacion_codigo/sector/estante/posicion cuando hay ubicacion', () => {
      loginAsAdmin(db);
      const ub = ubicacionCreateHandler(db, { sector: 'C', estante: '03', posicion: '05' });
      const p = productoCreateHandler(db, { ...makeBase(db), ubicacion_id: ub.id });
      const r = productoListHandler(db, { exactCodigo: p.sku, page: 1, pageSize: 10 });
      expect(r.items[0].ubicacion_codigo).toBe('C-3-5');
      expect(r.items[0].ubicacion_sector).toBe('C');
      expect(r.items[0].ubicacion_estante).toBe('3');
      expect(r.items[0].ubicacion_posicion).toBe('5');
    });

    it('retorna campos de ubicacion como null cuando no hay ubicacion', () => {
      loginAsAdmin(db);
      const p = productoCreateHandler(db, makeBase(db)); // sin ubicacion_id
      const r = productoListHandler(db, { exactCodigo: p.sku, page: 1, pageSize: 10 });
      expect(r.items[0].ubicacion_codigo).toBeNull();
      expect(r.items[0].ubicacion_sector).toBeNull();
    });
  });

  describe('list — busqueda_ubicacion (textual, sin QR)', () => {
    function seedConUbicaciones() {
      loginAsAdmin(db);
      const base = makeBase(db);
      const ubA = ubicacionCreateHandler(db, { sector: 'Pasillo A', estante: '01', posicion: '01' });
      const ubB = ubicacionCreateHandler(db, { sector: 'Pasillo B', estante: '02', posicion: '03' });
      const pA = productoCreateHandler(db, { ...base, nombre_corto: 'EnA', ubicacion_id: ubA.id });
      const pB = productoCreateHandler(db, { ...base, nombre_corto: 'EnB', ubicacion_id: ubB.id });
      productoCreateHandler(db, { ...base, nombre_corto: 'SinUbic' });
      return { ubA, ubB, pA, pB };
    }

    it('filtra por sector', () => {
      const { pA } = seedConUbicaciones();
      const r = productoListHandler(db, { busqueda_ubicacion: 'Pasillo A', page: 1, pageSize: 10 });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe(pA.id);
    });

    it('filtra por codigo de ubicacion', () => {
      const { pB } = seedConUbicaciones();
      const r = productoListHandler(db, { busqueda_ubicacion: 'B-2-3', page: 1, pageSize: 10 });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe(pB.id);
    });

    it('filtra por estante y por posicion (parcial)', () => {
      const { pB } = seedConUbicaciones();
      // Forma canónica (ADR-064): '02' -> '2'; sigue siendo un match parcial porque
      // también aparece dentro del código compuesto 'B-2-3'.
      expect(productoListHandler(db, { busqueda_ubicacion: '2', page: 1, pageSize: 10 }).total).toBe(1);
      const r = productoListHandler(db, { busqueda_ubicacion: '2', page: 1, pageSize: 10 });
      expect(r.items[0].id).toBe(pB.id);
    });

    it('el total (count) respeta el filtro de ubicacion', () => {
      seedConUbicaciones();
      // 3 productos totales, solo 1 en Pasillo A
      const r = productoListHandler(db, { busqueda_ubicacion: 'Pasillo A', page: 1, pageSize: 10 });
      expect(r.total).toBe(1);
      expect(r.items).toHaveLength(1);
    });

    it('sin coincidencia retorna vacío', () => {
      seedConUbicaciones();
      const r = productoListHandler(db, { busqueda_ubicacion: 'Zzz-99', page: 1, pageSize: 10 });
      expect(r.total).toBe(0);
    });
  });

  describe('list — orden por columna', () => {
    function seedParaOrdenar() {
      loginAsAdmin(db);
      const base = makeBase(db);
      const ubZ = ubicacionCreateHandler(db, { sector: 'Zeta', estante: '09', posicion: '09' });
      const ubA = ubicacionCreateHandler(db, { sector: 'Alfa', estante: '01', posicion: '01' });
      productoCreateHandler(db, { ...base, nombre_corto: 'Zeta prod', precio_venta_lista: 300, ubicacion_id: ubZ.id });
      productoCreateHandler(db, { ...base, nombre_corto: 'Alfa prod', precio_venta_lista: 100, ubicacion_id: ubA.id });
      productoCreateHandler(db, { ...base, nombre_corto: 'Media prod', precio_venta_lista: 200 });
    }

    it('ordena por nombre_corto asc/desc', () => {
      seedParaOrdenar();
      const asc = productoListHandler(db, { sortBy: 'nombre_corto', sortDir: 'asc', page: 1, pageSize: 10 });
      expect(asc.items.map(i => i.nombre_corto)).toEqual(['Alfa prod', 'Media prod', 'Zeta prod']);
      const desc = productoListHandler(db, { sortBy: 'nombre_corto', sortDir: 'desc', page: 1, pageSize: 10 });
      expect(desc.items.map(i => i.nombre_corto)).toEqual(['Zeta prod', 'Media prod', 'Alfa prod']);
    });

    it('ordena por precio_venta_lista', () => {
      seedParaOrdenar();
      const asc = productoListHandler(db, { sortBy: 'precio_venta_lista', sortDir: 'asc', page: 1, pageSize: 10 });
      expect(asc.items.map(i => i.precio_venta_lista)).toEqual([100, 200, 300]);
    });

    it('ordena por ubicacion_sector: entre los ubicados, Alfa antes que Zeta', () => {
      seedParaOrdenar();
      const asc = productoListHandler(db, { sortBy: 'ubicacion_sector', sortDir: 'asc', page: 1, pageSize: 10 });
      // SQLite ordena NULLs primero en ASC (los sin ubicación); verificamos el orden
      // relativo de los que sí tienen sector.
      const conSector = asc.items.map(i => i.ubicacion_sector).filter(Boolean);
      // Forma canónica (ADR-064): el sector se guarda en mayúsculas.
      expect(conSector).toEqual(['ALFA', 'ZETA']);
    });

    it('ordena por ubicacion_estante y ubicacion_posicion sin romper', () => {
      seedParaOrdenar();
      expect(() => productoListHandler(db, { sortBy: 'ubicacion_estante', sortDir: 'desc', page: 1, pageSize: 10 })).not.toThrow();
      expect(() => productoListHandler(db, { sortBy: 'ubicacion_posicion', sortDir: 'asc', page: 1, pageSize: 10 })).not.toThrow();
    });
  });

  describe('get — join ubicacion', () => {
    it('incluye campos de ubicacion cuando producto tiene ubicacion_id', () => {
      loginAsAdmin(db);
      const ub = ubicacionCreateHandler(db, { sector: 'D', estante: '04', posicion: '01' });
      const p = productoCreateHandler(db, { ...makeBase(db), ubicacion_id: ub.id });
      const result = productoGetHandler(db, { id: p.id }) as any;
      expect(result.ubicacion_codigo).toBe('D-4-1');
      expect((result as any).ubicacion_sector).toBe('D');
      expect((result as any).ubicacion_estante).toBe('4');
      expect((result as any).ubicacion_posicion).toBe('1');
    });

    it('retorna campos de ubicacion como null cuando no hay ubicacion_id', () => {
      loginAsAdmin(db);
      const p = productoCreateHandler(db, makeBase(db));
      const result = productoGetHandler(db, { id: p.id });
      expect((result as any).ubicacion_codigo).toBeNull();
      expect((result as any).ubicacion_sector).toBeNull();
    });
  });

  describe('productoStockCountsHandler', () => {
    it('cuenta correctamente ok, bajo y sin stock', () => {
      loginAsAdmin(db);
      const base = makeBase(db);
      // Producto OK: stock 10, min 5
      const p1 = productoCreateHandler(db, { ...base, nombre_corto: 'OK' });
      db.update(schema.existencias)
        .set({ stock_fisico: 10, stock_minimo: 5 })
        .where(eq(schema.existencias.producto_id, p1.id))
        .run();

      // Producto bajo mínimo: stock 2, min 5
      const p2 = productoCreateHandler(db, { ...base, nombre_corto: 'Bajo' });
      db.update(schema.existencias)
        .set({ stock_fisico: 2, stock_minimo: 5 })
        .where(eq(schema.existencias.producto_id, p2.id))
        .run();

      // Producto sin stock: stock 0, min 5
      const p3 = productoCreateHandler(db, { ...base, nombre_corto: 'SinStock' });
      db.update(schema.existencias)
        .set({ stock_fisico: 0, stock_minimo: 5 })
        .where(eq(schema.existencias.producto_id, p3.id))
        .run();

      const counts = productoStockCountsHandler(db);
      expect(counts.ok).toBe(1);
      expect(counts.bajo).toBe(1);
      expect(counts.sin).toBe(1);
    });

    it('incluye producto sin fila existencias como "sin stock"', () => {
      loginAsAdmin(db);
      const base = makeBase(db);
      const p1 = productoCreateHandler(db, { ...base, nombre_corto: 'SinExistencias' });
      // Borrar la fila de existencias para simular inconsistencia
      db.delete(schema.existencias)
        .where(eq(schema.existencias.producto_id, p1.id))
        .run();

      const counts = productoStockCountsHandler(db);
      expect(counts.sin).toBe(1);
      expect(counts.ok).toBe(0);
      expect(counts.bajo).toBe(0);
    });
  });

  describe('productoListHandler — filtro stock_status (ADR-057)', () => {
    function seedTresEstados() {
      loginAsAdmin(db);
      const base = makeBase(db);
      // OK: stock 10, min 5
      const pOk = productoCreateHandler(db, { ...base, nombre_corto: 'OK' });
      db.update(schema.existencias).set({ stock_fisico: 10, stock_minimo: 5 })
        .where(eq(schema.existencias.producto_id, pOk.id)).run();
      // Bajo mínimo: stock 2, min 5
      const pBajo = productoCreateHandler(db, { ...base, nombre_corto: 'Bajo' });
      db.update(schema.existencias).set({ stock_fisico: 2, stock_minimo: 5 })
        .where(eq(schema.existencias.producto_id, pBajo.id)).run();
      // Sin stock: stock 0, min 5
      const pSin = productoCreateHandler(db, { ...base, nombre_corto: 'SinStock' });
      db.update(schema.existencias).set({ stock_fisico: 0, stock_minimo: 5 })
        .where(eq(schema.existencias.producto_id, pSin.id)).run();
      return { pOk, pBajo, pSin };
    }

    it("'bajo_sin' trae Bajo mínimo + Sin stock y excluye los OK", () => {
      const { pBajo, pSin } = seedTresEstados();
      const r = productoListHandler(db, { stock_status: 'bajo_sin', page: 1, pageSize: 10 });
      expect(r.total).toBe(2);
      expect(r.items.map(i => i.id).sort()).toEqual([pBajo.id, pSin.id].sort());
    });

    it("'bajo' y 'sin' siguen filtrando un solo estado cada uno", () => {
      const { pBajo, pSin } = seedTresEstados();
      const bajo = productoListHandler(db, { stock_status: 'bajo', page: 1, pageSize: 10 });
      expect(bajo.items.map(i => i.id)).toEqual([pBajo.id]);
      const sin = productoListHandler(db, { stock_status: 'sin', page: 1, pageSize: 10 });
      expect(sin.items.map(i => i.id)).toEqual([pSin.id]);
    });
  });

  it('alta de producto siembra lista_precio_valor por cada lista activa', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const now = new Date();
    const sync = { version: 1, origin_id: 'T1', sync_state: 'pending' as const, updated_at: now };
    const listaId = randomUUID();
    db.insert(schema.lista_precio).values({
      id: listaId, nombre: 'General', tipo: 'general', ajuste_porcentual: 10,
      predeterminada: true, activo: true,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();

    const imp = db.select().from(schema.impuesto).get()!;
    const catId = randomUUID();
    db.insert(schema.categoria).values({
      id: catId, nombre: 'Cat', activo: true,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();

    productoCreateHandler(db, {
      nombre_corto: 'Martillo',
      categoria_id: catId,
      unidad_venta: 'und',
      impuesto_id: imp.id,
      precio_venta_lista: 100,
    });

    const lpvRows = db.select().from(schema.lista_precio_valor).all();
    expect(lpvRows).toHaveLength(1);
    expect(lpvRows[0].lista_precio_id).toBe(listaId);
    // Math.round(10000 * 1.10) = 11000
    expect(lpvRows[0].precio_centavos).toBe(11000);
    expect(lpvRows[0].origen).toBe('manual');
  });

  describe('productoQuickCreateHandler', () => {
    it('crea el mínimo viable con categoría Sin clasificar, unidad y IVA por defecto', () => {
      const db = setupDb(); runCatalogSeed(db); loginAsAdmin(db);
      const p = productoQuickCreateHandler(db, { nombre_corto: 'Cosa X', precio_venta_lista: 100 });
      expect(p.sku).toMatch(/^P-\d{7}-\d$/);
      expect(p.precio_venta_lista).toBe(100);
      const cat = db.select().from(schema.categoria).where(eq(schema.categoria.id, p.categoria_id)).get()!;
      expect(cat.nombre).toBe('Sin clasificar');
      expect(cat.categoria_padre_id).toBeNull();
      const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
      expect(p.impuesto_id).toBe(imp.id);
    });

    it('reutiliza la categoría Sin clasificar en altas sucesivas', () => {
      const db = setupDb(); runCatalogSeed(db); loginAsAdmin(db);
      const a = productoQuickCreateHandler(db, { nombre_corto: 'A', precio_venta_lista: 10 });
      const b = productoQuickCreateHandler(db, { nombre_corto: 'B', precio_venta_lista: 20 });
      expect(a.categoria_id).toBe(b.categoria_id);
      const n = db.select().from(schema.categoria).where(eq(schema.categoria.nombre, 'Sin clasificar')).all().length;
      expect(n).toBe(1);
    });

    it('guarda el gtin cuando se informa', () => {
      const db = setupDb(); runCatalogSeed(db); loginAsAdmin(db);
      const p = productoQuickCreateHandler(db, { nombre_corto: 'C', precio_venta_lista: 5, gtin_barcode: '7790000000017' });
      expect(p.gtin_barcode).toBe('7790000000017');
    });
  });
});
