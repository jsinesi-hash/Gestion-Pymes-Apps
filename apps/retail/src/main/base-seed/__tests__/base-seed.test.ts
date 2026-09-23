import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { runBaseSeed, isSeedBaseAplicado } from '../index';

const GEO_CACHE = path.resolve(__dirname, '../../../../../../packages/core-main/geo-cache');

describe('runBaseSeed', () => {
  it('siembra roles, permisos y admin en DB vacía', async () => {
    const db = createTestDb();
    await runBaseSeed(db, GEO_CACHE);

    const roles = db.select().from(schema.rol).all();
    expect(roles.map(r => r.nombre)).toContain('SUPERVISOR');
    expect(roles.map(r => r.nombre)).toContain('OPERADOR');

    const users = db.select().from(schema.usuario).all();
    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].nombre_usuario).toBe('admin');
  });

  it('siembra IVA 21% e impuesto predeterminado, IVA 10.5% y Exento', async () => {
    const db = createTestDb();
    await runBaseSeed(db, GEO_CACHE);

    const imp = db.select().from(schema.impuesto).all();
    const nombres = imp.map(i => i.nombre);
    expect(nombres).toContain('IVA 21%');
    expect(nombres).toContain('IVA 10.5%');
    expect(nombres).toContain('Exento');
    const iva21 = imp.find(i => i.nombre === 'IVA 21%');
    expect(iva21?.predeterminado).toBe(true);
  });

  it('siembra geo (provincias y localidades)', async () => {
    const db = createTestDb();
    await runBaseSeed(db, GEO_CACHE);

    const sqlite = (db as any).$client as import('better-sqlite3').Database;
    const provCount = (sqlite.prepare('SELECT COUNT(*) c FROM provincia').get() as { c: number }).c;
    const locCount  = (sqlite.prepare('SELECT COUNT(*) c FROM localidad').get() as { c: number }).c;
    expect(provCount).toBeGreaterThanOrEqual(24);
    expect(locCount).toBeGreaterThan(1000);
  });

  it('setea el flag sistema.seed_base_aplicado = true', async () => {
    const db = createTestDb();
    await runBaseSeed(db, GEO_CACHE);

    const flag = db.select()
      .from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'sistema.seed_base_aplicado'))
      .get();
    expect(flag?.valor).toBe('true');
  });

  it('es idempotente — segunda llamada no lanza ni duplica', async () => {
    const db = createTestDb();
    await runBaseSeed(db, GEO_CACHE);
    await expect(runBaseSeed(db, GEO_CACHE)).resolves.not.toThrow();

    const roles = db.select().from(schema.rol).all();
    const supervisorCount = roles.filter(r => r.nombre === 'SUPERVISOR').length;
    expect(supervisorCount).toBe(1);
  });

  it('siembra categorías raíz y marcas iniciales', async () => {
    const db = createTestDb();
    await runBaseSeed(db, GEO_CACHE);

    const cats = db.select().from(schema.categoria).all();
    const catNombres = cats.map(c => c.nombre);
    expect(catNombres).toContain('Herramientas');
    expect(catNombres).toContain('Herramientas Manuales');
    expect(catNombres).toContain('Plomería');

    const marcas = db.select().from(schema.marca).all();
    const marcaNombres = marcas.map(m => m.nombre);
    expect(marcaNombres).toContain('Stanley');
    expect(marcaNombres).toContain('Bosch');
  });

  it('isSeedBaseAplicado devuelve false antes y true después', async () => {
    const db = createTestDb();
    expect(isSeedBaseAplicado(db)).toBe(false);
    await runBaseSeed(db, GEO_CACHE);
    expect(isSeedBaseAplicado(db)).toBe(true);
  });

  // ADR-062: una instalación arranca EN BLANCO. El catálogo demo no se siembra en el
  // first-run; se carga a demanda desde Configuración → Datos demo.
  it('NO siembra productos ni listas de precio en el arranque', async () => {
    const db = createTestDb();
    await runBaseSeed(db, GEO_CACHE);
    expect(db.select().from(schema.producto).all().length).toBe(0);
    expect(db.select().from(schema.lista_precio).all().length).toBe(0);
  });
});
