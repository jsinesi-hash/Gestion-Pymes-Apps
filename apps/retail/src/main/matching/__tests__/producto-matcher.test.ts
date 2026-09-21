import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { normalizar } from '@ferreteria/shared';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { runCatalogSeed } from '../../catalog/seed';
import { runSinonimoSeed } from '../../sinonimos/seed';
import { crearMatcher, construirMapaSinonimos } from '../producto-matcher';

function insertar(db: ReturnType<typeof createTestDb>, nombre: string, seq: number) {
  const now = new Date();
  const cat = db.select().from(schema.categoria).all()[0];
  db.insert(schema.producto).values({
    id: randomUUID(),
    sku: `P-000000${seq}-0`,
    sku_secuencial: seq,
    nombre_corto: nombre,
    nombre_corto_norm: normalizar(nombre),
    nombre_largo: nombre,
    unidad_venta: 'unidad',
    categoria_id: cat.id,
    usuario_creacion_id: 'system',
    fecha_creacion: now,
    origin_id: 'system',
    updated_at: now,
  }).run();
}

function setup() {
  const db = createTestDb();
  runCatalogSeed(db);
  runSinonimoSeed(db); // trae el grupo alicate={pinza,...}
  insertar(db, 'Alicate universal 8 pulgadas', 1);
  insertar(db, 'Martillo carpintero 500g', 2);
  insertar(db, 'Caño PVC 3/4 pulgada', 3);
  return db;
}

describe('producto-matcher (ADR-063 Lote 3)', () => {
  it('construirMapaSinonimos mapea "pinza" al canónico "alicate"', () => {
    const db = setup();
    const mapa = construirMapaSinonimos(db);
    expect(mapa.get('pinza')).toBe('alicate');
    expect(mapa.get('alicate')).toBe('alicate');
  });

  it('sugiere el alicate cuando el proveedor lo llama "pinza" (sinónimo)', () => {
    const db = setup();
    const m = crearMatcher(db);
    const res = m.sugerir('Pinza universal 8 pulgadas');
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].nombre_corto).toBe('Alicate universal 8 pulgadas');
    expect(res[0].score).toBeGreaterThan(0.5);
    // no debería colar el martillo
    expect(res.map(r => r.nombre_corto)).not.toContain('Martillo carpintero 500g');
  });

  it('respeta el piso: un nombre sin tokens en común no devuelve candidatos', () => {
    const db = setup();
    const m = crearMatcher(db);
    expect(m.sugerir('Tornillo autoperforante 6x40')).toEqual([]);
  });

  it('ordena por score descendente y limita', () => {
    const db = setup();
    insertar(db, 'Alicate de corte 6 pulgadas', 4);
    const m = crearMatcher(db);
    const res = m.sugerir('alicate 8 pulgadas', { limite: 1 });
    expect(res.length).toBe(1);
    expect(res[0].nombre_corto).toBe('Alicate universal 8 pulgadas');
  });

  it('acento-insensible: "cano pvc" matchea "Caño PVC …"', () => {
    const db = setup();
    const m = crearMatcher(db);
    const res = m.sugerir('cano pvc');
    expect(res.map(r => r.nombre_corto)).toContain('Caño PVC 3/4 pulgada');
  });

  // REPRO (reporte del usuario): producto acortado a "Aceite multiuso 100" debe sugerirse
  // para la línea "Aceite multiuso 100 cm TF3" del archivo.
  it('REPRO aceite: sugiere el producto acortado para el nombre completo de la lista', () => {
    const db = setup();
    insertar(db, 'Aceite multiuso 100', 5);
    const m = crearMatcher(db);
    const res = m.sugerir('Aceite multiuso 100 cm TF3');
    expect(res.map(r => r.nombre_corto)).toContain('Aceite multiuso 100');
  });

  // El usuario pidió matchear también por nombre largo (descripción): un producto cuyo
  // nombre corto no comparte tokens pero cuyo nombre largo sí, debe sugerirse.
  it('matchea por nombre largo (descripción) además del nombre corto', () => {
    const db = setup();
    const now = new Date();
    const cat = db.select().from(schema.categoria).all()[0];
    db.insert(schema.producto).values({
      id: randomUUID(), sku: 'P-0000099-0', sku_secuencial: 99,
      nombre_corto: 'TF3-K7', nombre_corto_norm: normalizar('TF3-K7'),
      nombre_largo: 'Aceite lubricante multiuso 100 en aerosol',
      unidad_venta: 'unidad', categoria_id: cat.id,
      usuario_creacion_id: 'system', fecha_creacion: now, origin_id: 'system', updated_at: now,
    }).run();

    const m = crearMatcher(db);
    const res = m.sugerir('Aceite multiuso 100');
    expect(res.map(r => r.nombre_corto)).toContain('TF3-K7');
  });

  // Robustez: aunque nombre_corto_norm haya quedado desactualizado (edición por una vía que
  // no lo recomputó), el matcher normaliza en vivo y sugiere igual por el nombre_corto real.
  it('normaliza en vivo: sugiere aunque nombre_corto_norm esté desactualizado', () => {
    const db = setup();
    const now = new Date();
    const cat = db.select().from(schema.categoria).all()[0];
    db.insert(schema.producto).values({
      id: randomUUID(), sku: 'P-0000098-0', sku_secuencial: 98,
      nombre_corto: 'Destornillador Phillips 6', nombre_corto_norm: 'valor viejo stale',
      nombre_largo: 'Destornillador Phillips 6',
      unidad_venta: 'unidad', categoria_id: cat.id,
      usuario_creacion_id: 'system', fecha_creacion: now, origin_id: 'system', updated_at: now,
    }).run();

    const m = crearMatcher(db);
    const res = m.sugerir('Destornillador Phillips 6 pulgadas');
    expect(res.map(r => r.nombre_corto)).toContain('Destornillador Phillips 6');
  });
});
