import { describe, it, expect, beforeEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { createTestDb, clearSession } from '../../__tests__/helpers';
import { CLIENTES_DEMO } from '../clientes';
import { ejecutarSeedDev } from '../index';

const contar = (db: ReturnType<typeof createTestDb>) => ({
  productos: db.select().from(schema.producto_venta).all().length,
  categorias: db.select().from(schema.categoria_venta).all().length,
  clientesDemo: db.select().from(schema.cliente)
    .where(inArray(schema.cliente.numero_documento, CLIENTES_DEMO.map((c) => c.numero_documento))).all().length,
  ventas: db.select().from(schema.venta).where(eq(schema.venta.estado, 'confirmada')).all().length,
  cajasAbiertas: db.select().from(schema.caja).where(eq(schema.caja.estado, 'abierta')).all().length,
  impuestos: db.select().from(schema.impuesto).all().length,
  consumidorFinal: db.select().from(schema.cliente).where(eq(schema.cliente.nombre, 'Consumidor')).all().length,
  usuarios: db.select().from(schema.usuario).all().length,
});

describe('ejecutarSeedDev', () => {
  beforeEach(() => clearSession());

  it('end-to-end: catálogo demo, clientes, ventas y una caja abierta', () => {
    const db = createTestDb();
    const resumen = ejecutarSeedDev(db);
    const c = contar(db);
    expect(c.productos).toBeGreaterThan(0);
    expect(c.categorias).toBe(5);
    expect(c.clientesDemo).toBe(6);
    expect(c.ventas).toBe(3);
    expect(c.cajasAbiertas).toBe(1);
    expect(c.consumidorFinal).toBe(1);
    expect(resumen.pasos.map((p) => p.estado)).not.toContain('ya sembrado');
  });

  it('segunda corrida idempotente: no duplica y reporta "ya sembrado"', () => {
    const db = createTestDb();
    ejecutarSeedDev(db);
    const antes = contar(db);
    clearSession();
    const resumen = ejecutarSeedDev(db);
    expect(contar(db)).toEqual(antes);
    const porPaso = Object.fromEntries(resumen.pasos.map((p) => [p.paso, p.estado]));
    expect(porPaso['catálogo demo']).toBe('ya sembrado');
    expect(porPaso['clientes demo']).toBe('ya sembrado');
    expect(porPaso['ventas demo']).toBe('ya sembrado');
  });

  it('soloBase: auth, impuestos, consumidor final y rubro, sin productos, clientes ni ventas', () => {
    const db = createTestDb();
    const resumen = ejecutarSeedDev(db, { soloBase: true });
    const c = contar(db);
    expect(c.usuarios).toBeGreaterThan(0);
    expect(c.impuestos).toBe(3);
    expect(c.consumidorFinal).toBe(1);
    expect(c.categorias).toBe(5);
    expect(c.productos).toBe(0);
    expect(c.clientesDemo).toBe(0);
    expect(c.ventas).toBe(0);
    expect(c.cajasAbiertas).toBe(0);
    expect(resumen.pasos.map((p) => p.paso)).not.toContain('catálogo demo');
  });
});
