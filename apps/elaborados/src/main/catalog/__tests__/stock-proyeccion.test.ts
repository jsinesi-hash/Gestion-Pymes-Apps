import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import { diferenciasDeCuentaCorriente } from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, createTestDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { articuloCreateHandler } from '../../ipc/articulo';
import { movimientoArticuloCreateHandler } from '../../ipc/movimiento-articulo';
import { ejecutarSeedDev } from '../../dev-seed';
import { diferenciasDeStock, proyectarStock, recalcularStock } from '../stock-proyeccion';

// ADR-151: el stock de un artículo es una proyección de su libro desde el último conteo.
describe('proyección del stock (Elaborados)', () => {
  let db: ReturnType<typeof setupDb>;
  const stock = (id: string) => db.select().from(schema.existencia_articulo)
    .where(eq(schema.existencia_articulo.articulo_id, id)).get()!;

  beforeEach(() => {
    db = setupDb();
    clearSession();
    loginAsAdmin(db);
  });

  const articulo = (nombre: string, bloquea = false) =>
    articuloCreateHandler(db, { nombre, tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: bloquea });
  const mover = (articulo_id: string, motivo: 'compra' | 'merma' | 'conteo', cantidad: number) =>
    movimientoArticuloCreateHandler(db, { articulo_id, motivo, cantidad, costo_unitario_centavos: motivo === 'compra' ? 1000 : null });

  function movimientoDeOtraTerminal(articuloId: string, fecha: Date, cantidad: number) {
    db.insert(schema.movimiento_articulo).values({
      id: generateId(), articulo_id: articuloId, tipo: cantidad < 0 ? 'salida' : 'entrada', motivo: 'venta',
      cantidad, stock_resultante: 0, costo_unitario_centavos: null, referencia_tipo: 'venta', referencia_id: generateId(),
      usuario_id: db.select().from(schema.usuario).get()!.id, fecha, observaciones: null,
      version: 1, origin_id: 'C2', sync_state: 'synced', updated_at: fecha,
    }).run();
  }

  it('compras, mermas y conteos (la pantalla manda la diferencia) cuadran con la proyección', () => {
    const leche = articulo('Leche');
    mover(leche.id, 'compra', 10);
    mover(leche.id, 'merma', -1.5);
    mover(leche.id, 'conteo', -0.5); // la pantalla pide el stock contado (8) y manda 8 − 8.5
    mover(leche.id, 'compra', 2);
    expect(stock(leche.id).stock).toBe(10);
    expect(proyectarStock(db, leche.id)).toBe(10);
    expect(diferenciasDeStock(db)).toEqual([]);
  });

  it('el conteo es un punto de corte y el stock negativo se proyecta tal cual', () => {
    const crema = articulo('Crema');
    mover(crema.id, 'compra', 5);
    mover(crema.id, 'conteo', -1); // contó 4
    const conteo = db.select().from(schema.movimiento_articulo)
      .where(eq(schema.movimiento_articulo.motivo, 'conteo')).get()!;
    movimientoDeOtraTerminal(crema.id, new Date(conteo.fecha.getTime() - 60_000), -3);
    expect(proyectarStock(db, crema.id)).toBe(4);
    movimientoDeOtraTerminal(crema.id, new Date(conteo.fecha.getTime() + 60_000), -6);
    expect(proyectarStock(db, crema.id)).toBe(-2);
  });

  it('recalcularStock corrige un saldo desfasado; si cuadra no toca la fila', () => {
    const azucar = articulo('Azúcar');
    mover(azucar.id, 'compra', 3);
    const version = stock(azucar.id).version;
    expect(recalcularStock(db, azucar.id)).toEqual({ guardado: 3, proyectado: 3, corregido: false });
    expect(stock(azucar.id).version).toBe(version);
    db.update(schema.existencia_articulo).set({ stock: 7 }).where(eq(schema.existencia_articulo.articulo_id, azucar.id)).run();
    expect(diferenciasDeStock(db)).toEqual([{ articulo_id: azucar.id, guardado: 7, proyectado: 3 }]);
    expect(recalcularStock(db, azucar.id)).toEqual({ guardado: 7, proyectado: 3, corregido: true });
    expect(diferenciasDeStock(db)).toEqual([]);
  });

  it('el seed de desarrollo (catálogo demo, clientes y ventas) cuadra en stock y cuenta corriente', () => {
    const otra = createTestDb();
    ejecutarSeedDev(otra);
    expect(diferenciasDeStock(otra)).toEqual([]);
    expect(diferenciasDeCuentaCorriente(otra)).toEqual([]);
  });
});
