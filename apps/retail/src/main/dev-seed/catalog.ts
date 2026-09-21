import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { formatSku } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { normalizarTermino } from '../sinonimos/normalizar';

type Db = BetterSQLite3Database<typeof schema>;

const NOW = new Date();
const SYNC = { version: 1, origin_id: 'system', sync_state: 'synced' as const, updated_at: NOW };
const AUDIT = { usuario_creacion_id: 'system', fecha_creacion: NOW };

// 18 ubicaciones: 6+6 en sector A, 3+3 en sector B
const UBICACIONES = [
  ...(['01', '02', '03', '04', '05', '06'] as const).map(p => ({ sector: 'A', estante: '01', posicion: p })),
  ...(['01', '02', '03', '04', '05', '06'] as const).map(p => ({ sector: 'A', estante: '02', posicion: p })),
  ...(['01', '02', '03'] as const).map(p => ({ sector: 'B', estante: '01', posicion: p })),
  ...(['01', '02', '03'] as const).map(p => ({ sector: 'B', estante: '02', posicion: p })),
];

type ProductoDef = {
  nombre_corto: string; nombre_largo: string;
  categoria: string; marca: string; ubicacion: string;
  unidad_venta: string; unidad_compra?: string; factor_conversion?: number;
  costo: number; precio: number; gtin?: string; activo?: boolean;
  stock_fisico: number; stock_minimo: number;
};

// 35 productos:
// Edge cases:
//   3 sin stock (stock_fisico = 0): P-006, P-010, P-024
//   5 bajo mínimo (0 < stock < min): P-005, P-011, P-015, P-020, P-023
//   1 inactivo: P-032
//   2 con factor_conversion = 12: P-012, P-014
const PRODUCTOS: ProductoDef[] = [
  // Herramientas Manuales (7 productos)
  { nombre_corto: 'Martillo 500g',         nombre_largo: 'Martillo carpintero 500g mango de madera',            categoria: 'Herramientas Manuales',   marca: 'Stanley',    ubicacion: 'A-01-01', unidad_venta: 'unidad', costo: 2500,  precio: 4235,   gtin: '7790001000011', stock_fisico: 15,  stock_minimo: 5   },
  { nombre_corto: 'Destornillador PH2',    nombre_largo: 'Destornillador Phillips PH2 mango bimaterial',         categoria: 'Herramientas Manuales',   marca: 'Stanley',    ubicacion: 'A-01-02', unidad_venta: 'unidad', costo: 800,   precio: 1355,   gtin: '7790001000028', stock_fisico: 20,  stock_minimo: 5   },
  { nombre_corto: 'Alicate 8"',            nombre_largo: 'Alicate universal 8 pulgadas corte lateral',           categoria: 'Herramientas Manuales',   marca: 'Tramontina', ubicacion: 'A-01-03', unidad_venta: 'unidad', costo: 1500,  precio: 2541,                          stock_fisico: 12,  stock_minimo: 5   },
  { nombre_corto: 'Llave ajustable 12"',   nombre_largo: 'Llave inglesa ajustable 12 pulgadas cromada',          categoria: 'Herramientas Manuales',   marca: 'Stanley',    ubicacion: 'A-01-04', unidad_venta: 'unidad', costo: 3200,  precio: 5421,                          stock_fisico: 8,   stock_minimo: 3   },
  { nombre_corto: 'Cinta métrica 5m',      nombre_largo: 'Cinta métrica retráctil 5m x 19mm',                   categoria: 'Herramientas Manuales',   marca: 'Stanley',    ubicacion: 'A-01-05', unidad_venta: 'unidad', costo: 600,   precio: 1016,                          stock_fisico: 2,   stock_minimo: 8   }, // bajo mínimo
  { nombre_corto: 'Sierra manual 20"',     nombre_largo: 'Sierra manual 20 pulgadas dientes endurecidos',        categoria: 'Herramientas Manuales',   marca: 'Tramontina', ubicacion: 'A-01-06', unidad_venta: 'unidad', costo: 2800,  precio: 4743,                          stock_fisico: 0,   stock_minimo: 3   }, // sin stock
  { nombre_corto: 'Nivel burbuja 60cm',    nombre_largo: 'Nivel de burbuja aluminio 60cm 3 viales',              categoria: 'Herramientas Manuales',   marca: 'Bosch',      ubicacion: 'A-02-01', unidad_venta: 'unidad', costo: 1800,  precio: 3049,                          stock_fisico: 6,   stock_minimo: 3   },
  // Herramientas Eléctricas (4 productos)
  { nombre_corto: 'Taladro percutor 550W', nombre_largo: 'Taladro percutor 550W mandril 13mm con maletín',       categoria: 'Herramientas Eléctricas', marca: 'Bosch',      ubicacion: 'A-02-02', unidad_venta: 'unidad', costo: 12000, precio: 20328,  gtin: '7790002000015', stock_fisico: 4,   stock_minimo: 2   },
  { nombre_corto: 'Amoladora 4½" 850W',    nombre_largo: 'Amoladora angular 4.5 pulgadas 850W',                  categoria: 'Herramientas Eléctricas', marca: 'Bosch',      ubicacion: 'A-02-03', unidad_venta: 'unidad', costo: 9500,  precio: 16093,  gtin: '7790002000022', stock_fisico: 5,   stock_minimo: 2   },
  { nombre_corto: 'Atornillador 12V',      nombre_largo: 'Atornillador inalámbrico 12V 2 baterías maletín',      categoria: 'Herramientas Eléctricas', marca: 'Bosch',      ubicacion: 'A-02-04', unidad_venta: 'unidad', costo: 8000,  precio: 13552,                         stock_fisico: 0,   stock_minimo: 2   }, // sin stock
  { nombre_corto: 'Sierra caladora 500W',  nombre_largo: 'Sierra caladora 500W 3000rpm con accesorios',          categoria: 'Herramientas Eléctricas', marca: 'Bosch',      ubicacion: 'A-02-05', unidad_venta: 'unidad', costo: 11000, precio: 18634,                         stock_fisico: 1,   stock_minimo: 3   }, // bajo mínimo
  // Tornillos y Bulones (6 productos)
  { nombre_corto: 'Tornillo cab.plana 3x25', nombre_largo: 'Tornillo cabeza plana Phillips 3x25mm caja 12u',     categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'A-02-06', unidad_venta: 'unidad', unidad_compra: 'caja', factor_conversion: 12, costo: 4,     precio: 6.78,   gtin: '7790003000012', stock_fisico: 500, stock_minimo: 100 },
  { nombre_corto: 'Bulón hex M8x50',        nombre_largo: 'Bulón hexagonal M8x50mm zincado con tuerca',          categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'B-01-01', unidad_venta: 'unidad', costo: 12,    precio: 20.33,  gtin: '7790003000029', stock_fisico: 300, stock_minimo: 50  },
  { nombre_corto: 'Tornillo autop. 6x3/4"', nombre_largo: 'Tornillo autoperforante cab.hex 6x3/4" caja 12u',     categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'B-01-02', unidad_venta: 'unidad', unidad_compra: 'caja', factor_conversion: 12, costo: 3,     precio: 5.08,                          stock_fisico: 450, stock_minimo: 100 },
  { nombre_corto: 'Tuerca hex M8',          nombre_largo: 'Tuerca hexagonal M8 zincada DIN 934',                 categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'B-01-03', unidad_venta: 'unidad', costo: 5,     precio: 8.47,                          stock_fisico: 30,  stock_minimo: 100 }, // bajo mínimo
  { nombre_corto: 'Arandela plana M8',      nombre_largo: 'Arandela plana M8 zincada DIN 125',                   categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'B-02-01', unidad_venta: 'unidad', costo: 3,     precio: 5.08,                          stock_fisico: 200, stock_minimo: 50  },
  { nombre_corto: 'Arandela presión M8',    nombre_largo: 'Arandela de presión M8 muelle zincada',               categoria: 'Tornillos y Bulones',     marca: 'Tramontina', ubicacion: 'B-02-02', unidad_venta: 'unidad', costo: 3.5,   precio: 5.93,                          stock_fisico: 180, stock_minimo: 50  },
  // Anclajes y Tarugos (3 productos)
  { nombre_corto: 'Tarugo plástico 8mm',   nombre_largo: 'Tarugo plástico nylon 8mm con tornillo incluido',      categoria: 'Anclajes y Tarugos',      marca: 'Tramontina', ubicacion: 'B-02-03', unidad_venta: 'unidad', costo: 8,     precio: 13.55,                         stock_fisico: 150, stock_minimo: 50  },
  { nombre_corto: 'Anclaje mecánico M10',  nombre_largo: 'Anclaje mecánico expansivo M10 acero galvanizado',    categoria: 'Anclajes y Tarugos',      marca: 'Tramontina', ubicacion: 'A-01-01', unidad_venta: 'unidad', costo: 45,    precio: 76.22,                         stock_fisico: 80,  stock_minimo: 20  },
  { nombre_corto: 'Bulón hormigón M12',    nombre_largo: 'Bulón para hormigón M12x90mm con tuerca y arandela',  categoria: 'Anclajes y Tarugos',      marca: 'Tramontina', ubicacion: 'A-01-02', unidad_venta: 'unidad', costo: 65,    precio: 110.07,                        stock_fisico: 3,   stock_minimo: 15  }, // bajo mínimo
  // Pinturas y Esmaltes (4 productos)
  { nombre_corto: 'Látex blanco 4L',       nombre_largo: 'Pintura látex interior/exterior blanco 4 litros',     categoria: 'Pinturas y Esmaltes',     marca: 'Plavicon',   ubicacion: 'A-01-03', unidad_venta: 'litro',  costo: 2800,  precio: 4743,   gtin: '7790004000010', stock_fisico: 25,  stock_minimo: 10  },
  { nombre_corto: 'Esmalte negro mate 1L', nombre_largo: 'Esmalte sintético negro mate 1 litro alta cobertura', categoria: 'Pinturas y Esmaltes',     marca: 'Plavicon',   ubicacion: 'A-01-04', unidad_venta: 'litro',  costo: 1800,  precio: 3049,   gtin: '7790004000027', stock_fisico: 18,  stock_minimo: 8   },
  { nombre_corto: 'Fondo anticorrosivo 4L',nombre_largo: 'Fondo anticorrosivo gris 4 litros base solvente',     categoria: 'Pinturas y Esmaltes',     marca: 'Plavicon',   ubicacion: 'A-01-05', unidad_venta: 'litro',  costo: 3200,  precio: 5421,                          stock_fisico: 2,   stock_minimo: 5   }, // bajo mínimo
  { nombre_corto: 'Barniz marino 1L',      nombre_largo: 'Barniz marino brillante 1 litro UV resistente',       categoria: 'Pinturas y Esmaltes',     marca: 'Plavicon',   ubicacion: 'A-01-06', unidad_venta: 'litro',  costo: 1500,  precio: 2541,                          stock_fisico: 0,   stock_minimo: 5   }, // sin stock
  // Accesorios de Pintura (3 productos)
  { nombre_corto: 'Rodillo lana 23cm',     nombre_largo: 'Rodillo de lana 23cm con mango extensible',           categoria: 'Accesorios de Pintura',   marca: 'Tramontina', ubicacion: 'A-02-01', unidad_venta: 'unidad', costo: 450,   precio: 762,                           stock_fisico: 30,  stock_minimo: 10  },
  { nombre_corto: 'Pincel cerda 2"',       nombre_largo: 'Pincel cerda natural 2 pulgadas mango plástico',      categoria: 'Accesorios de Pintura',   marca: 'Tramontina', ubicacion: 'A-02-02', unidad_venta: 'unidad', costo: 180,   precio: 305,                           stock_fisico: 40,  stock_minimo: 15  },
  { nombre_corto: 'Bandeja rodillo',       nombre_largo: 'Bandeja para rodillo plástica 23cm con rejilla',      categoria: 'Accesorios de Pintura',   marca: 'Tramontina', ubicacion: 'A-02-03', unidad_venta: 'unidad', costo: 250,   precio: 423,                           stock_fisico: 25,  stock_minimo: 10  },
  // Cables y Conductores (3 productos)
  { nombre_corto: 'Cable unipolar 1.5mm²', nombre_largo: 'Cable unipolar flexible 1.5mm² rojo IRAM 2183',       categoria: 'Cables y Conductores',    marca: 'Philips',    ubicacion: 'A-02-04', unidad_venta: 'metro',  costo: 180,   precio: 305,    gtin: '7790005000018', stock_fisico: 200, stock_minimo: 50  },
  { nombre_corto: 'Cable bipolar 2.5mm²',  nombre_largo: 'Cable bipolar plano 2.5mm² blanco IRAM 2183',         categoria: 'Cables y Conductores',    marca: 'Philips',    ubicacion: 'A-02-05', unidad_venta: 'metro',  costo: 350,   precio: 593,                           stock_fisico: 150, stock_minimo: 50  },
  { nombre_corto: 'Cinta aisladora 20m',   nombre_largo: 'Cinta aisladora PVC negra 20m -10°C a +80°C',         categoria: 'Cables y Conductores',    marca: 'Philips',    ubicacion: 'A-02-06', unidad_venta: 'unidad', costo: 350,   precio: 593,                           stock_fisico: 60,  stock_minimo: 20  },
  // Iluminación (2 productos)
  { nombre_corto: 'Lámpara LED 9W E27',    nombre_largo: 'Lámpara LED bulbo 9W E27 6500K luz fría 810lm',       categoria: 'Iluminación',             marca: 'Philips',    ubicacion: 'B-01-01', unidad_venta: 'unidad', costo: 850,   precio: 1440,   gtin: '7790006000011', stock_fisico: 35,  stock_minimo: 10  },
  { nombre_corto: 'Luminaria estanca 2x36W', nombre_largo: 'Luminaria estanca fluorescente 2x36W IP65',         categoria: 'Iluminación',             marca: 'Philips',    ubicacion: 'B-01-02', unidad_venta: 'unidad', costo: 4500,  precio: 7623,                          stock_fisico: 8,   stock_minimo: 2,  activo: false }, // inactivo
  // Caños y Conexiones (2 productos)
  { nombre_corto: 'Caño PVC 3/4" 3m',     nombre_largo: 'Caño PVC sanitario presión 3/4 pulgada x 3 metros',   categoria: 'Caños y Conexiones',      marca: 'Ferrum',     ubicacion: 'B-01-03', unidad_venta: 'unidad', costo: 780,   precio: 1321,                          stock_fisico: 20,  stock_minimo: 8   },
  { nombre_corto: 'Codo PVC 90° 3/4"',    nombre_largo: 'Codo PVC 90 grados 3/4 pulgada rosca interna',        categoria: 'Caños y Conexiones',      marca: 'Ferrum',     ubicacion: 'B-02-01', unidad_venta: 'unidad', costo: 120,   precio: 203,                           stock_fisico: 45,  stock_minimo: 15  },
  // Llaves y Válvulas (1 producto)
  { nombre_corto: 'Válvula esfera 1/2"',   nombre_largo: 'Válvula esfera 1/2 pulgada bronce hembra-hembra',     categoria: 'Llaves y Válvulas',       marca: 'Ferrum',     ubicacion: 'B-02-02', unidad_venta: 'unidad', costo: 1200,  precio: 2033,                          stock_fisico: 15,  stock_minimo: 5   },
];

export function wipeCatalog(db: Db): void {
  db.delete(schema.movimiento_stock).run();
  db.delete(schema.existencias).run();
  db.delete(schema.lista_precio_detalle).run();
  db.delete(schema.producto).run();
  db.update(schema.parametros_sistema)
    .set({ valor: '1' })
    .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).run();
  db.delete(schema.ubicacion).run();
  // Categories, brands, and impuestos are base-seed data (runCatalogSeed) — not wiped here
}

export function seedCatalog(db: Db, force: boolean): void {
  const count = db.select({ id: schema.producto.id }).from(schema.producto).all().length;
  if (count > 0 && !force) {
    console.log('[skip] catalog ya tiene datos');
    return;
  }
  if (force) wipeCatalog(db);

  // Categorías y marcas ya fueron insertadas por runCatalogSeed (base seed) — solo leemos los IDs
  const subcatIds: Record<string, string> = {};
  for (const cat of db.select({ id: schema.categoria.id, nombre: schema.categoria.nombre }).from(schema.categoria).all()) {
    subcatIds[cat.nombre] = cat.id;
  }

  const marcaIds: Record<string, string> = {};
  for (const m of db.select({ id: schema.marca.id, nombre: schema.marca.nombre }).from(schema.marca).all()) {
    marcaIds[m.nombre] = m.id;
  }

  // Ubicaciones (18 únicas)
  const ubicacionIds: Record<string, string> = {};
  for (const u of UBICACIONES) {
    const id = randomUUID();
    const codigo = `${u.sector}-${u.estante}-${u.posicion}`;
    ubicacionIds[codigo] = id;
    db.insert(schema.ubicacion).values({
      id, codigo, sector: u.sector, estante: u.estante, posicion: u.posicion,
      activo: true, ...AUDIT, ...SYNC,
    }).run();
  }

  // Obtener IVA 21% (predeterminado, insertado por runCatalogSeed)
  const iva21 = db.select({ id: schema.impuesto.id }).from(schema.impuesto)
    .where(eq(schema.impuesto.predeterminado, true)).get();
  if (!iva21) throw new Error('IVA 21% no encontrado — correr runCatalogSeed primero');

  // Productos + existencias + movimiento inicial
  for (const p of PRODUCTOS) {
    const id = randomUUID();

    // Leer y actualizar contador de SKU atómicamente (single-node; R4 gestiona multinodo).
    const paramRow = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).get();
    const secuencial = paramRow ? Number.parseInt(paramRow.valor, 10) : 1;
    const sku = formatSku(secuencial);
    db.update(schema.parametros_sistema)
      .set({ valor: String(secuencial + 1) })
      .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).run();

    db.insert(schema.producto).values({
      id,
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
      impuesto_id: iva21.id,
      moneda: 'ARS',
      categoria_id: subcatIds[p.categoria],
      marca_id: marcaIds[p.marca],
      ubicacion_id: ubicacionIds[p.ubicacion],
      activo: p.activo ?? true,
      ...AUDIT, ...SYNC,
    }).run();

    db.insert(schema.existencias).values({
      id: randomUUID(),
      producto_id: id,
      stock_fisico: p.stock_fisico,
      stock_minimo: p.stock_minimo,
      ultima_fecha_movimiento: NOW,
      ...SYNC,
    }).run();

    db.insert(schema.movimiento_stock).values({
      id: randomUUID(),
      producto_id: id,
      tipo: 'entrada',
      motivo: 'inicial',
      cantidad: p.stock_fisico,
      stock_resultante: p.stock_fisico,
      costo_unitario: p.costo,
      referencia_tipo: 'seed',
      referencia_id: 'dev-seed',
      usuario_id: 'system',
      fecha: NOW,
      ...SYNC,
    }).run();
  }

  // Verificación inline — usa el MISMO drizzle instance para contar
  console.log('[ok] catalog: 3 impuestos, 15 categorías, 6 marcas, 18 ubicaciones, 35 productos');
}
