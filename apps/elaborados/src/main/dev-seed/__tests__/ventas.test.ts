import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin } from '../../__tests__/helpers';
import { runCatalogSeedElaborados, runBaseRubroHeladeria } from '../../catalog/seed';
import { runDemoHeladeriaSeed } from '../../catalog/demo-heladeria';
import { seedClientesDemo } from '../clientes';
import { seedVentasDemo } from '../ventas';

function preparar() {
  const db = setupDb();
  runCatalogSeedElaborados(db);
  runBaseRubroHeladeria(db);
  loginAsAdmin(db);
  runDemoHeladeriaSeed(db);
  seedClientesDemo(db);
  return db;
}

const CAJA_PREVIA = randomUUID();

const stockDe = (db: ReturnType<typeof setupDb>, nombre: string) => {
  const art = db.select().from(schema.articulo).where(eq(schema.articulo.nombre, nombre)).get()!;
  return db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, art.id)).get()!.stock;
};

describe('seedVentasDemo', () => {
  it('deja una caja abierta con 3 ventas confirmadas (efectivo, tarjeta y cuenta corriente) y stock descontado', () => {
    const db = preparar();
    const palitoAntes = stockDe(db, 'Palito');
    const bananaAntes = stockDe(db, 'Banana');

    const r = seedVentasDemo(db);
    expect(r.creadas).toBe(3);

    const cajas = db.select().from(schema.caja).all();
    expect(cajas).toHaveLength(1);
    expect(cajas[0].estado).toBe('abierta');

    const ventas = db.select().from(schema.venta).where(eq(schema.venta.estado, 'confirmada')).all();
    expect(ventas).toHaveLength(3);
    expect(ventas.every((v) => v.caja_id === cajas[0].id)).toBe(true);

    const medios = db.select().from(schema.venta_pago).all().map((p) => p.medio_pago).sort();
    expect(medios).toEqual(['cuenta_corriente', 'efectivo', 'tarjeta']);

    // El pote lleva 3 sabores del grupo "Sabores".
    const grupo = db.select().from(schema.grupo_modificador).where(eq(schema.grupo_modificador.nombre, 'Sabores')).get()!;
    const opcionesGrupo = new Set(db.select().from(schema.grupo_modificador_opcion)
      .where(eq(schema.grupo_modificador_opcion.grupo_modificador_id, grupo.id)).all().map((o) => o.id));
    const mods = db.select().from(schema.venta_linea_modificador).all();
    expect(mods).toHaveLength(3);
    expect(mods.every((m) => opcionesGrupo.has(m.grupo_modificador_opcion_id))).toBe(true);

    // La venta a cuenta corriente sube el saldo de un cliente demo con cuenta.
    const pagoCcc = db.select().from(schema.venta_pago).where(eq(schema.venta_pago.medio_pago, 'cuenta_corriente')).get()!;
    const ventaCcc = ventas.find((v) => v.id === pagoCcc.venta_id)!;
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, ventaCcc.cliente_id)).get()!;
    expect(cuenta.saldo_centavos).toBe(pagoCcc.monto_centavos);
    expect(pagoCcc.monto_centavos).toBe(Math.round(ventaCcc.total * 100));
    expect(cuenta.saldo_centavos).toBeLessThanOrEqual(cuenta.limite_credito_centavos);

    expect(stockDe(db, 'Palito')).toBe(palitoAntes - 1);
    expect(stockDe(db, 'Banana')).toBeLessThan(bananaAntes);
  });

  it('es idempotente: si ya hay ventas confirmadas no agrega otras ni abre otra caja', () => {
    const db = preparar();
    seedVentasDemo(db);
    const r2 = seedVentasDemo(db);
    expect(r2.creadas).toBe(0);
    expect(db.select().from(schema.venta).all()).toHaveLength(3);
    expect(db.select().from(schema.caja).all()).toHaveLength(1);
  });

  it('reutiliza una caja abierta del admin en vez de abrir otra', () => {
    const db = preparar();
    const ahora = new Date();
    const admin = db.select().from(schema.usuario).where(eq(schema.usuario.nombre_usuario, 'admin')).get()!;
    db.insert(schema.caja).values({
      id: CAJA_PREVIA, usuario_id: admin.id, fecha_apertura: ahora, monto_inicial: 0,
      estado: 'abierta', version: 1, origin_id: 'test', sync_state: 'pending', updated_at: ahora,
    }).run();
    seedVentasDemo(db);
    expect(db.select().from(schema.caja).all()).toHaveLength(1);
    const ventas = db.select().from(schema.venta).all();
    expect(ventas.every((v) => v.caja_id === CAJA_PREVIA)).toBe(true);
  });
});
