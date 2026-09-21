import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../ipc/__tests__/helpers';
import { runSeed } from '../../auth/seed';
import { runCatalogSeed } from '../../catalog/seed';
import { seedCatalog } from '../catalog';
import { seedPersonas } from '../personas';
import { seedVentas } from '../ventas';
import * as schema from '../../db/schema';

function setupDb() {
  const db = createTestDb();
  runSeed(db);
  runCatalogSeed(db);
  seedCatalog(db, false);
  seedPersonas(db, false);
  return db;
}

describe('seedVentas', () => {
  it('inserta 1 caja cerrada, 15 ventas y movimientos de caja', () => {
    const db = setupDb();
    seedVentas(db, false);

    const cajas = db.select().from(schema.caja).all();
    expect(cajas).toHaveLength(1);
    expect(cajas[0].estado).toBe('cerrada');

    const ventas = db.select().from(schema.venta).all();
    expect(ventas).toHaveLength(15);

    const detalles = db.select().from(schema.venta_detalle).all();
    expect(detalles.length).toBeGreaterThanOrEqual(15);
  });

  it('12 ventas confirmadas y 3 anuladas', () => {
    const db = setupDb();
    seedVentas(db, false);

    const ventas = db.select().from(schema.venta).all();
    expect(ventas.filter(v => v.estado === 'confirmada')).toHaveLength(12);
    expect(ventas.filter(v => v.estado === 'anulada')).toHaveLength(3);
  });

  it('10 movimientos de caja (efectivo + tarjeta + transferencia confirmadas)', () => {
    const db = setupDb();
    seedVentas(db, false);

    const movs = db.select().from(schema.movimiento_caja).all();
    expect(movs).toHaveLength(10);
  });

  it('correlativo C1 actualizado a 15', () => {
    const db = setupDb();
    seedVentas(db, false);

    const param = db.select().from(schema.parametros_sistema)
      .all().find(p => p.clave === 'venta_correlativo_C1');
    expect(param?.valor).toBe('15');
  });

  it('1 venta con descuento global del 10%', () => {
    const db = setupDb();
    seedVentas(db, false);

    const conDesc = db.select().from(schema.venta)
      .all().filter(v => v.descuento_global > 0);
    expect(conDesc).toHaveLength(1);
    expect(conDesc[0].descuento_global).toBe(10);
  });

  it('idempotente: segunda llamada no duplica', () => {
    const db = setupDb();
    seedVentas(db, false);
    seedVentas(db, false);

    const ventas = db.select().from(schema.venta).all();
    expect(ventas).toHaveLength(15);
  });
});
