import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createTestDb } from './helpers';
import * as schema from '../../db/schema';
import { runCatalogSeed } from '../../catalog/seed';
import { runSinonimoSeed } from '../../sinonimos/seed';
import { normalizarTermino } from '../../sinonimos/normalizar';
import { backfillNombreCortoNorm } from '../../sinonimos/backfill';
import { productoListHandler } from '../producto';

function insertarProducto(
  db: ReturnType<typeof createTestDb>,
  nombre: string,
  seq: number,
  opts: { conNorm?: boolean; marca?: string } = {},
) {
  const { conNorm = true, marca } = opts;
  const now = new Date();
  const cat = db.select().from(schema.categoria).all()[0];
  const marcaRow = marca
    ? db.select().from(schema.marca).where(eq(schema.marca.nombre, marca)).get()
    : null;
  const id = randomUUID();
  db.insert(schema.producto).values({
    id,
    sku: `P-000000${seq}-0`,
    sku_secuencial: seq,
    nombre_corto: nombre,
    nombre_corto_norm: conNorm ? normalizarTermino(nombre) : null,
    nombre_largo: nombre,
    unidad_venta: 'unidad',
    categoria_id: cat.id,
    marca_id: marcaRow?.id ?? null,
    usuario_creacion_id: 'system',
    fecha_creacion: now,
    origin_id: 'system',
    updated_at: now,
  }).run();
  return id;
}

function setFlag(db: ReturnType<typeof createTestDb>, on: boolean) {
  db.update(schema.parametros_sistema)
    .set({ valor: on ? 'true' : 'false' })
    .where(eq(schema.parametros_sistema.clave, 'sinonimos_habilitado')).run();
}

function buscar(db: ReturnType<typeof createTestDb>, texto: string) {
  return productoListHandler(db, { busqueda: texto, page: 1, pageSize: 50 });
}

describe('productoListHandler — expansión por sinónimos (ADR-067)', () => {
  function setup() {
    const db = createTestDb();
    runCatalogSeed(db);
    runSinonimoSeed(db);
    insertarProducto(db, 'Lámpara LED 9W E27', 1);
    insertarProducto(db, 'Martillo carpintero 500g', 2);
    return db;
  }

  it('con el flag APAGADO, "foco" no trae la lámpara (sin expansión)', () => {
    const db = setup();
    setFlag(db, false);
    const res = buscar(db, 'foco');
    expect(res.items.length).toBe(0);
  });

  it('con el flag ENCENDIDO, "foco" trae la lámpara vía sinónimo', () => {
    const db = setup();
    setFlag(db, true);
    const res = buscar(db, 'foco');
    expect(res.items.map(i => i.nombre_corto)).toContain('Lámpara LED 9W E27');
  });

  it('la búsqueda literal sigue funcionando con el flag encendido', () => {
    const db = setup();
    setFlag(db, true);
    const res = buscar(db, 'Martillo');
    expect(res.items.map(i => i.nombre_corto)).toContain('Martillo carpintero 500g');
    // "foco" no debe traer el martillo
    expect(res.items.map(i => i.nombre_corto)).not.toContain('Lámpara LED 9W E27');
  });

  it('un término sin sinónimos no rompe ni ensancha la búsqueda', () => {
    const db = setup();
    setFlag(db, true);
    const res = buscar(db, 'carpintero');
    expect(res.items.length).toBe(1);
    expect(res.items[0].nombre_corto).toBe('Martillo carpintero 500g');
  });

  it('match acento-insensible: producto SIN acento se encuentra por sinónimo acentuado', () => {
    const db = createTestDb();
    runCatalogSeed(db);
    runSinonimoSeed(db);
    insertarProducto(db, 'Lampara LED 9W E27', 1); // cargada SIN acento a propósito
    setFlag(db, true);
    // "foco" expande a "lampara" (norm) y matchea contra nombre_corto_norm sin importar acentos
    const res = buscar(db, 'foco');
    expect(res.items.map(i => i.nombre_corto)).toContain('Lampara LED 9W E27');
  });

  it('el término primario también es acento-insensible ("lampara" encuentra "Lámpara")', () => {
    const db = setup(); // productos con "Lámpara LED 9W E27" (con acento)
    setFlag(db, true);
    const res = buscar(db, 'lampara'); // tipeado sin acento
    expect(res.items.map(i => i.nombre_corto)).toContain('Lámpara LED 9W E27');
  });

  it('abreviatura como disparador: "torn" (abrev.) encuentra el tornillo', () => {
    const db = createTestDb();
    runCatalogSeed(db);
    runSinonimoSeed(db);
    insertarProducto(db, 'Tornillo cabeza plana 3x25', 1);
    insertarProducto(db, 'Destornillador Phillips PH2', 2);
    setFlag(db, true);
    const res = buscar(db, 'torn');
    const nombres = res.items.map(i => i.nombre_corto);
    expect(nombres).toContain('Tornillo cabeza plana 3x25');
  });

  it('la abreviatura NO se usa como substring de salida: "tornillo" no trae destornillador', () => {
    const db = createTestDb();
    runCatalogSeed(db);
    runSinonimoSeed(db);
    insertarProducto(db, 'Tornillo cabeza plana 3x25', 1);
    insertarProducto(db, 'Destornillador Phillips PH2', 2);
    setFlag(db, true);
    // Al tipear "tornillo", la abreviatura "torn" NO debe emitirse como patrón %torn%
    // (si lo hiciera, traería "Destornillador").
    const nombres = buscar(db, 'tornillo').items.map(i => i.nombre_corto);
    expect(nombres).toContain('Tornillo cabeza plana 3x25');
    expect(nombres).not.toContain('Destornillador Phillips PH2');
  });

  it('marca por abreviatura: "phil" trae productos marca Philips aunque el nombre no la mencione', () => {
    const db = createTestDb();
    runCatalogSeed(db);
    runSinonimoSeed(db);
    insertarProducto(db, 'Cable unipolar 1.5mm rojo', 1, { marca: 'Philips' });
    insertarProducto(db, 'Martillo carpintero 500g', 2, { marca: 'Stanley' });
    setFlag(db, true);
    const nombres = buscar(db, 'phil').items.map(i => i.nombre_corto);
    expect(nombres).toContain('Cable unipolar 1.5mm rojo');
    expect(nombres).not.toContain('Martillo carpintero 500g');
  });

  it('backfill normaliza filas previas (nombre_corto_norm nulo)', () => {
    const db = createTestDb();
    runCatalogSeed(db);
    runSinonimoSeed(db);
    insertarProducto(db, 'Lámpara LED 9W E27', 1, { conNorm: false });
    // Antes del backfill, con el flag on, "foco" no matchea (norm nulo).
    setFlag(db, true);
    expect(buscar(db, 'foco').items.length).toBe(0);
    const n = backfillNombreCortoNorm(db);
    expect(n).toBe(1);
    expect(buscar(db, 'foco').items.map(i => i.nombre_corto)).toContain('Lámpara LED 9W E27');
  });
});
