import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { createTestDb, loginAsAdmin } from '../../__tests__/helpers';
import { runSeed as runSeedCore } from '@core/main';
import { PERMISOS_ELABORADOS, OPERADOR_PERMISOS_ELABORADOS } from '../../auth/seed';
import { runCatalogSeedElaborados, runBaseRubroHeladeria } from '../seed';
import { runDemoHeladeriaSeed } from '../demo-heladeria';

function dbConCatalogoBase() {
  const db = createTestDb();
  runSeedCore(db, { permisos: PERMISOS_ELABORADOS, operador: OPERADOR_PERMISOS_ELABORADOS });
  runCatalogSeedElaborados(db);
  // Los handlers que compone el seed (articuloCreateHandler, produccionCrearHandler, etc.)
  // exigen sesión vía requireSession() — el plan original omitía este login y fallaba con
  // UNAUTHENTICATED (confirmado en RED real antes de este fix).
  loginAsAdmin(db);
  return db;
}

describe('runDemoHeladeriaSeed', () => {
  it('siembra 8 sabores, cada uno con receta y stock producido', () => {
    const db = dbConCatalogoBase();
    runDemoHeladeriaSeed(db);
    const sabores = db.select().from(schema.articulo).where(eq(schema.articulo.tipo, 'elaborado')).all();
    expect(sabores).toHaveLength(8);
    for (const s of sabores) {
      const receta = db.select().from(schema.receta_produccion).where(eq(schema.receta_produccion.articulo_id, s.id)).get();
      expect(receta).toBeTruthy();
      const ex = db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, s.id)).get();
      expect(ex!.stock).toBeGreaterThan(0);
    }
  });

  it('siembra envases, palito, torta y productos de venta con categorías', () => {
    const db = dbConCatalogoBase();
    runDemoHeladeriaSeed(db);
    const categorias = db.select().from(schema.categoria_venta).all();
    expect(categorias.map((c) => c.nombre).sort()).toEqual(['Cucuruchos', 'Helados', 'Licuados', 'Palitos', 'Tortas']);
    const productos = db.select().from(schema.producto_venta).all();
    expect(productos.length).toBeGreaterThanOrEqual(7); // pote 1/4, 1/2, 1kg, cucurucho, vasito, palito, torta, licuado
  });

  it('es idempotente (no duplica al correr dos veces)', () => {
    const db = dbConCatalogoBase();
    runDemoHeladeriaSeed(db);
    runDemoHeladeriaSeed(db);
    const sabores = db.select().from(schema.articulo).where(eq(schema.articulo.tipo, 'elaborado')).all();
    expect(sabores).toHaveLength(8);
  });
});

describe('runDemoHeladeriaSeed con el seed base del rubro', () => {
  it('corre igual, reutiliza categorías y grupo Sabores y deja las opciones en ese grupo', () => {
    const db = dbConCatalogoBase();
    runBaseRubroHeladeria(db);
    const grupoBase = db.select().from(schema.grupo_modificador).where(eq(schema.grupo_modificador.nombre, 'Sabores')).get()!;
    runDemoHeladeriaSeed(db);
    expect(db.select().from(schema.producto_venta).all().length).toBeGreaterThanOrEqual(7);
    expect(db.select().from(schema.categoria_venta).all()).toHaveLength(5);
    const grupos = db.select().from(schema.grupo_modificador).where(eq(schema.grupo_modificador.nombre, 'Sabores')).all();
    expect(grupos).toHaveLength(1);
    expect(grupos[0].id).toBe(grupoBase.id);
    const opciones = db.select().from(schema.grupo_modificador_opcion)
      .where(eq(schema.grupo_modificador_opcion.grupo_modificador_id, grupoBase.id)).all();
    expect(opciones).toHaveLength(8);
  });

  it('una segunda corrida no duplica nada (guard por producto_venta)', () => {
    const db = dbConCatalogoBase();
    runBaseRubroHeladeria(db);
    runDemoHeladeriaSeed(db);
    const productos = db.select().from(schema.producto_venta).all().length;
    const articulos = db.select().from(schema.articulo).all().length;
    runDemoHeladeriaSeed(db);
    expect(db.select().from(schema.producto_venta).all()).toHaveLength(productos);
    expect(db.select().from(schema.articulo).all()).toHaveLength(articulos);
    expect(db.select().from(schema.categoria_venta).all()).toHaveLength(5);
  });
});
