import { describe, it, expect } from 'vitest';
import * as schema from '../../db/schema';
import { createTestDb } from '../../__tests__/helpers';
import { eq } from 'drizzle-orm';
import { runCatalogSeedElaborados, runBaseRubroHeladeria } from '../seed';

describe('runCatalogSeedElaborados', () => {
  it('siembra los 3 impuestos base', () => {
    const db = createTestDb();
    runCatalogSeedElaborados(db);
    const rows = db.select().from(schema.impuesto).all();
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.nombre === 'IVA 21%')?.predeterminado).toBe(true);
  });

  it('es idempotente', () => {
    const db = createTestDb();
    runCatalogSeedElaborados(db);
    runCatalogSeedElaborados(db);
    expect(db.select().from(schema.impuesto).all()).toHaveLength(3);
  });
});

describe('runBaseRubroHeladeria', () => {
  it('crea las 5 categorías de venta con orden 1-5 y el grupo Sabores sin opciones', () => {
    const db = createTestDb();
    runBaseRubroHeladeria(db);
    const cats = db.select().from(schema.categoria_venta).all().sort((a, b) => a.orden - b.orden);
    expect(cats.map((c) => [c.nombre, c.orden])).toEqual([
      ['Helados', 1], ['Palitos', 2], ['Tortas', 3], ['Licuados', 4], ['Cucuruchos', 5],
    ]);
    const grupos = db.select().from(schema.grupo_modificador).all();
    expect(grupos.map((g) => g.nombre)).toEqual(['Sabores']);
    expect(db.select().from(schema.grupo_modificador_opcion).all()).toHaveLength(0);
  });

  it('es idempotente', () => {
    const db = createTestDb();
    runBaseRubroHeladeria(db);
    runBaseRubroHeladeria(db);
    expect(db.select().from(schema.categoria_venta).all()).toHaveLength(5);
    expect(db.select().from(schema.grupo_modificador).all()).toHaveLength(1);
  });

  it('no duplica una categoría que ya existe por nombre', () => {
    const db = createTestDb();
    db.insert(schema.categoria_venta).values({
      id: 'c-previa', nombre: 'Helados', orden: 9, activo: true,
      version: 1, origin_id: 'system', sync_state: 'synced', updated_at: new Date(),
    }).run();
    runBaseRubroHeladeria(db);
    const helados = db.select().from(schema.categoria_venta).where(eq(schema.categoria_venta.nombre, 'Helados')).all();
    expect(helados).toHaveLength(1);
    expect(helados[0].id).toBe('c-previa');
    expect(db.select().from(schema.categoria_venta).all()).toHaveLength(5);
  });
});
