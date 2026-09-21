import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { formatSku } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { crearPresentacionDefault } from '../ipc/presentacion';
import { normalizarTermino } from '../sinonimos/normalizar';

type Db = BetterSQLite3Database<typeof schema>;

// Marca de origen de los datos demo. Se graba en `movimiento_stock.referencia_tipo` del
// movimiento inicial de cada producto, y es lo que permite identificar (y vaciar) el
// catálogo demo sin tocar productos reales cargados por el comerciante.
export const DEMO_REFERENCIA_TIPO = 'seed_demo';

// ─────────────────────────────────────────────────────────────────────────────
// ADR-062 — Catálogo demo de arranque (10–15 productos) en el base-seed.
//
// Siembra un catálogo demo GENÉRICO respetando las invariantes del dominio:
//   • SKU vía el contador `sku_proximo_secuencial` (ADR-025) + `formatSku`.
//   • Stock SIEMPRE vía `existencias` + `movimiento_stock` (motivo `inicial`) — ADR-006.
//   • Precio vía `lista_precio_valor` en centavos (motor ADR-034) + presentación
//     default (ADR-040), replicando la lógica de `productoCreateHandler`.
//
// DEPENDENCIA CRÍTICA: no hay `lista_precio` de fábrica (ninguna migración/seed la crea).
// Sin una lista predeterminada/activa, `lista_precio_valor` quedaría vacío y el motor no
// mostraría precios. Por eso el seeder siembra una lista predeterminada si falta.
//
// NO corre en el arranque: una instalación arranca en blanco. Se invoca a demanda desde
// Configuración → Datos demo (ipc/demo-catalog.ts), y necesita que `runCatalogSeed` ya
// haya creado IVA/categorías/marcas/unidades. `vaciarCatalogoDemo` lo revierte.
// ─────────────────────────────────────────────────────────────────────────────

// Datos de arranque: valores administrativos como el catálogo base (ADR-062).
const SYNC = { version: 1, origin_id: 'system', sync_state: 'synced' as const };
const AUDIT = { usuario_creacion_id: 'system' };
const SYSTEM_USER = 'system';

type DemoProducto = {
  nombre_corto: string;
  nombre_largo: string;
  categoria: string;   // nombre de la subcategoría creada por runCatalogSeed
  marca: string;       // nombre de la marca creada por runCatalogSeed
  ubicacion: string;   // código sector-estante-posicion
  unidad_venta: string; // abreviatura de una unidad creada por runCatalogSeed
  unidad_compra?: string;
  factor_conversion?: number;
  costo: number;       // pesos (REAL)
  precio: number;      // pesos IVA incluido (REAL)
  gtin?: string;
  stock_fisico: number;
  stock_minimo: number;
  activo?: boolean;
};

// 15 productos repartidos en las 10 subcategorías y las 6 marcas de runCatalogSeed.
// Casos borde a propósito:
//   • Sin stock   (stock_fisico = 0):          "Sierra manual 20\""
//   • Bajo mínimo (0 < stock <= mínimo):        "Amoladora 4½\" 850W"
//   • Inactivo    (activo = false):             "Válvula esfera 1/2\""
export const DEMO_PRODUCTOS: DemoProducto[] = [
  { nombre_corto: 'Martillo 500g',          nombre_largo: 'Martillo carpintero 500g mango de madera',              categoria: 'Herramientas Manuales',   marca: 'Stanley',    ubicacion: 'A-01-01', unidad_venta: 'unidad', costo: 2500,  precio: 4235,   gtin: '7791234000018', stock_fisico: 15,  stock_minimo: 5   },
  { nombre_corto: 'Destornillador PH2',     nombre_largo: 'Destornillador Phillips PH2 mango bimaterial',          categoria: 'Herramientas Manuales',   marca: 'Stanley',    ubicacion: 'A-01-02', unidad_venta: 'unidad', costo: 800,   precio: 1355,                          stock_fisico: 20,  stock_minimo: 5   },
  { nombre_corto: 'Sierra manual 20"',      nombre_largo: 'Sierra manual 20 pulgadas dientes endurecidos',         categoria: 'Herramientas Manuales',   marca: 'Tramontina', ubicacion: 'A-01-03', unidad_venta: 'unidad', costo: 2800,  precio: 4743,                          stock_fisico: 0,   stock_minimo: 3   }, // sin stock
  { nombre_corto: 'Taladro percutor 550W',  nombre_largo: 'Taladro percutor 550W mandril 13mm con maletín',        categoria: 'Herramientas Eléctricas', marca: 'Bosch',      ubicacion: 'A-01-04', unidad_venta: 'unidad', costo: 12000, precio: 20328,  gtin: '7791234000025', stock_fisico: 4,   stock_minimo: 2   },
  { nombre_corto: 'Amoladora 4½" 850W',     nombre_largo: 'Amoladora angular 4.5 pulgadas 850W',                   categoria: 'Herramientas Eléctricas', marca: 'Bosch',      ubicacion: 'A-01-05', unidad_venta: 'unidad', costo: 9500,  precio: 16093,                         stock_fisico: 1,   stock_minimo: 3   }, // bajo mínimo
  { nombre_corto: 'Tornillo cab.plana 3x25', nombre_largo: 'Tornillo cabeza plana Phillips 3x25mm',                categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'A-01-06', unidad_venta: 'unidad', unidad_compra: 'caja', factor_conversion: 12, costo: 4, precio: 6.78, gtin: '7791234000032', stock_fisico: 500, stock_minimo: 100 },
  { nombre_corto: 'Bulón hex M8x50',        nombre_largo: 'Bulón hexagonal M8x50mm zincado con tuerca',            categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'A-02-01', unidad_venta: 'unidad', costo: 12,    precio: 20.33,                         stock_fisico: 300, stock_minimo: 50  },
  { nombre_corto: 'Tarugo plástico 8mm',    nombre_largo: 'Tarugo plástico nylon 8mm con tornillo incluido',       categoria: 'Anclajes y Tarugos',      marca: 'Tramontina', ubicacion: 'A-02-02', unidad_venta: 'unidad', costo: 8,     precio: 13.55,                         stock_fisico: 150, stock_minimo: 50  },
  { nombre_corto: 'Látex blanco 4L',        nombre_largo: 'Pintura látex interior/exterior blanco 4 litros',       categoria: 'Pinturas y Esmaltes',     marca: 'Plavicon',   ubicacion: 'A-02-03', unidad_venta: 'lt',     costo: 2800,  precio: 4743,   gtin: '7791234000049', stock_fisico: 25,  stock_minimo: 10  },
  { nombre_corto: 'Esmalte negro mate 1L',  nombre_largo: 'Esmalte sintético negro mate 1 litro alta cobertura',   categoria: 'Pinturas y Esmaltes',     marca: 'Plavicon',   ubicacion: 'B-01-01', unidad_venta: 'lt',     costo: 1800,  precio: 3049,                          stock_fisico: 18,  stock_minimo: 8   },
  { nombre_corto: 'Rodillo lana 23cm',      nombre_largo: 'Rodillo de lana 23cm con mango extensible',             categoria: 'Accesorios de Pintura',   marca: 'Tramontina', ubicacion: 'B-01-02', unidad_venta: 'unidad', costo: 450,   precio: 762,                           stock_fisico: 30,  stock_minimo: 10  },
  { nombre_corto: 'Cable unipolar 1.5mm²',  nombre_largo: 'Cable unipolar flexible 1.5mm² rojo IRAM 2183',         categoria: 'Cables y Conductores',    marca: 'Philips',    ubicacion: 'B-01-03', unidad_venta: 'metro',  costo: 180,   precio: 305,    gtin: '7791234000056', stock_fisico: 200, stock_minimo: 50  },
  { nombre_corto: 'Lámpara LED 9W E27',     nombre_largo: 'Lámpara LED bulbo 9W E27 6500K luz fría 810lm',         categoria: 'Iluminación',             marca: 'Philips',    ubicacion: 'B-02-01', unidad_venta: 'unidad', costo: 850,   precio: 1440,   gtin: '7791234000063', stock_fisico: 35,  stock_minimo: 10  },
  { nombre_corto: 'Caño PVC 3/4" 3m',       nombre_largo: 'Caño PVC sanitario presión 3/4 pulgada x 3 metros',     categoria: 'Caños y Conexiones',      marca: 'Ferrum',     ubicacion: 'B-02-02', unidad_venta: 'unidad', costo: 780,   precio: 1321,                          stock_fisico: 20,  stock_minimo: 8   },
  { nombre_corto: 'Válvula esfera 1/2"',    nombre_largo: 'Válvula esfera 1/2 pulgada bronce hembra-hembra',       categoria: 'Llaves y Válvulas',       marca: 'Ferrum',     ubicacion: 'B-02-03', unidad_venta: 'unidad', costo: 1200,  precio: 2033,                          stock_fisico: 15,  stock_minimo: 5, activo: false }, // inactivo
];

// Lee y avanza el contador de SKU atómicamente dentro de la transacción (single-node,
// igual que productoCreateHandler; multinodo se resuelve en R4).
function nextSku(tx: Db): { sku: string; secuencial: number } {
  const row = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).get();
  if (!row) throw new Error('sku_proximo_secuencial no encontrado en parametros_sistema');
  const secuencial = Number.parseInt(row.valor, 10);
  const sku = formatSku(secuencial);
  tx.update(schema.parametros_sistema)
    .set({ valor: String(secuencial + 1), actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).run();
  return { sku, secuencial };
}

// Devuelve el id de la lista predeterminada+activa, creándola si no existe (ADR-062:
// no hay lista de fábrica). Se hace sin el handler para no depender de sesión de UI.
function ensureListaPredeterminada(tx: Db, now: Date): string {
  const existente = tx.select({ id: schema.lista_precio.id })
    .from(schema.lista_precio)
    .where(and(eq(schema.lista_precio.predeterminada, true), eq(schema.lista_precio.activo, true)))
    .get();
  if (existente) return existente.id;

  const id = randomUUID();
  tx.insert(schema.lista_precio).values({
    id,
    nombre: 'General',
    descripcion: 'Lista de precios general (predeterminada)',
    tipo: 'general',
    ajuste_porcentual: 0,
    modo_calculo: 'pct_sobre_lista',
    predeterminada: true,
    activo: true,
    ...AUDIT,
    fecha_creacion: now,
    ...SYNC,
    updated_at: now,
  }).run();
  return id;
}

export function runDemoCatalogSeed(db: Db): void {
  // Defensa extra sobre el guard de runBaseSeed: nunca sembrar sobre un catálogo con datos.
  const yaHayProductos = db.select({ id: schema.producto.id }).from(schema.producto).get();
  if (yaHayProductos) {
    console.log('[seed:demo] catálogo ya tiene productos — se omite el demo');
    return;
  }

  db.transaction((tx) => {
    const now = new Date();

    // IVA 21% predeterminado (creado por runCatalogSeed).
    const iva = tx.select({ id: schema.impuesto.id }).from(schema.impuesto)
      .where(eq(schema.impuesto.predeterminado, true)).get();
    if (!iva) throw new Error('IVA predeterminado no encontrado — correr runCatalogSeed primero');

    // Mapas nombre→id de categorías y marcas (creadas por runCatalogSeed).
    const categoriaIds: Record<string, string> = {};
    for (const c of tx.select({ id: schema.categoria.id, nombre: schema.categoria.nombre }).from(schema.categoria).all()) {
      categoriaIds[c.nombre] = c.id;
    }
    const marcaIds: Record<string, string> = {};
    for (const m of tx.select({ id: schema.marca.id, nombre: schema.marca.nombre }).from(schema.marca).all()) {
      marcaIds[m.nombre] = m.id;
    }

    // Lista predeterminada (dependencia crítica ADR-062) + todas las listas activas
    // para replicar el fan-out de precios de productoCreateHandler.
    ensureListaPredeterminada(tx, now);
    const listasActivas = tx.select({
      id: schema.lista_precio.id,
      ajuste_porcentual: schema.lista_precio.ajuste_porcentual,
    }).from(schema.lista_precio).where(eq(schema.lista_precio.activo, true)).all();

    // Ubicaciones: una por cada código distinto del dataset.
    const ubicacionIds: Record<string, string> = {};
    for (const codigo of new Set(DEMO_PRODUCTOS.map(p => p.ubicacion))) {
      const [sector, estante, posicion] = codigo.split('-');
      const id = randomUUID();
      ubicacionIds[codigo] = id;
      tx.insert(schema.ubicacion).values({
        id, codigo, sector, estante, posicion,
        activo: true, ...AUDIT, fecha_creacion: now, ...SYNC, updated_at: now,
      }).run();
    }

    for (const p of DEMO_PRODUCTOS) {
      const categoriaId = categoriaIds[p.categoria];
      if (!categoriaId) throw new Error(`Categoría demo no encontrada: ${p.categoria}`);
      const marcaId = marcaIds[p.marca] ?? null;

      const { sku, secuencial } = nextSku(tx);
      const productoId = randomUUID();
      const activo = p.activo ?? true;

      // 1) Producto (pesos REAL).
      tx.insert(schema.producto).values({
        id: productoId,
        sku,
        sku_secuencial: secuencial,
        gtin_barcode: p.gtin ?? null,
        nombre_corto: p.nombre_corto,
        nombre_corto_norm: normalizarTermino(p.nombre_corto),
        nombre_largo: p.nombre_largo,
        descripcion_tecnica: null,
        unidad_venta: p.unidad_venta,
        unidad_compra: p.unidad_compra ?? null,
        factor_conversion: p.factor_conversion ?? 1,
        permite_fraccion: false,
        precio_costo_promedio: p.costo,
        precio_venta_lista: p.precio,
        impuesto_id: iva.id,
        moneda: 'ARS',
        categoria_id: categoriaId,
        marca_id: marcaId,
        ubicacion_id: ubicacionIds[p.ubicacion],
        activo,
        ...AUDIT,
        fecha_creacion: now,
        ...SYNC,
        updated_at: now,
      }).run();

      // 2) Existencias (saldo).
      tx.insert(schema.existencias).values({
        id: randomUUID(),
        producto_id: productoId,
        stock_fisico: p.stock_fisico,
        stock_minimo: p.stock_minimo,
        ultima_fecha_movimiento: now,
        ...SYNC,
        updated_at: now,
      }).run();

      // 3) Movimiento de stock inicial (invariante ADR-006: nunca stock sin movimiento).
      tx.insert(schema.movimiento_stock).values({
        id: randomUUID(),
        producto_id: productoId,
        tipo: 'entrada',
        motivo: 'inicial',
        cantidad: p.stock_fisico,
        stock_resultante: p.stock_fisico,
        costo_unitario: p.costo,
        referencia_tipo: DEMO_REFERENCIA_TIPO,
        referencia_id: productoId,
        usuario_id: SYSTEM_USER,
        fecha: now,
        ...SYNC,
        updated_at: now,
      }).run();

      // 4) Presentación default (ADR-040).
      const presentacionId = crearPresentacionDefault(tx, productoId, p.unidad_venta, SYSTEM_USER, SYNC.origin_id);

      // 5) Precio por cada lista activa → lista_precio_valor en centavos (motor ADR-034).
      const baseCs = Math.round(p.precio * 100);
      for (const lista of listasActivas) {
        tx.insert(schema.lista_precio_valor).values({
          id: randomUUID(),
          lista_precio_id: lista.id,
          producto_id: productoId,
          precio_centavos: Math.round(baseCs * (1 + lista.ajuste_porcentual / 100)),
          fecha_desde: now,
          fecha_hasta: null,
          origen: 'manual',
          recalculo_masivo_id: null,
          presentacion_id: presentacionId,
          usuario_id: SYSTEM_USER,
          ...SYNC,
          updated_at: now,
        }).run();
      }
    }
  });

  console.log(`[seed:demo] ${DEMO_PRODUCTOS.length} productos demo sembrados (ADR-062)`);
}

// Ids de los productos que provienen del seeder demo (por su movimiento inicial marcado).
export function productosDemoIds(db: Db): string[] {
  const rows = db.selectDistinct({ producto_id: schema.movimiento_stock.producto_id })
    .from(schema.movimiento_stock)
    .where(eq(schema.movimiento_stock.referencia_tipo, DEMO_REFERENCIA_TIPO))
    .all();
  return rows.map(r => r.producto_id);
}

// Borra SOLO los productos del catálogo demo y sus filas dependientes (existencias,
// movimientos, presentaciones, valores de precio). No toca la `lista_precio` "General"
// (queda como predeterminada útil para el catálogo real) ni las ubicaciones (reutilizables)
// ni productos cargados por el comerciante. Devuelve cuántos productos se eliminaron.
export function vaciarCatalogoDemo(db: Db): number {
  return db.transaction((tx) => {
    const ids = productosDemoIds(tx);
    if (ids.length === 0) return 0;

    // Orden respetando FKs: primero lo que referencia al producto/presentación.
    tx.delete(schema.lista_precio_valor).where(inArray(schema.lista_precio_valor.producto_id, ids)).run();
    tx.delete(schema.producto_presentacion).where(inArray(schema.producto_presentacion.producto_id, ids)).run();
    tx.delete(schema.movimiento_stock).where(inArray(schema.movimiento_stock.producto_id, ids)).run();
    tx.delete(schema.existencias).where(inArray(schema.existencias.producto_id, ids)).run();
    tx.delete(schema.producto).where(inArray(schema.producto.id, ids)).run();
    return ids.length;
  });
}
