import { describe, it, expect } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb } from '../../__tests__/helpers';
import { seedClientesDemo, CLIENTES_DEMO } from '../clientes';

const docs = () => CLIENTES_DEMO.map((c) => c.numero_documento);

describe('seedClientesDemo', () => {
  it('crea 6 clientes demo: 4 sin cuenta corriente y 2 con cuenta activa y límite', () => {
    const db = setupDb();
    const r = seedClientesDemo(db);
    expect(r.creados).toBe(6);

    const clientes = db.select().from(schema.cliente).where(inArray(schema.cliente.numero_documento, docs())).all();
    expect(clientes).toHaveLength(6);
    expect(clientes.filter((c) => !c.habilita_cuenta_corriente)).toHaveLength(4);
    const conCuenta = clientes.filter((c) => c.habilita_cuenta_corriente);
    expect(conCuenta).toHaveLength(2);
    for (const c of clientes) {
      expect(c.nombre.length).toBeGreaterThan(0);
      expect(c.apellido.length).toBeGreaterThan(0);
      expect(c.apellido).not.toBe('(revisar)');
    }

    const limites: number[] = [];
    for (const c of conCuenta) {
      const cuenta = db.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.cliente_id, c.id)).get();
      expect(cuenta).toBeTruthy();
      expect(cuenta!.activo).toBe(true);
      expect(cuenta!.saldo_centavos).toBe(0);
      expect(cuenta!.limite_credito_centavos).toBeGreaterThan(0);
      limites.push(cuenta!.limite_credito_centavos);
    }
    // Uno chico ($20.000) para probar el pedido de Supervisor, otro holgado.
    expect(limites.sort((a, b) => a - b)).toEqual([2000000, 50000000]);
  });

  it('es idempotente por numero_documento', () => {
    const db = setupDb();
    seedClientesDemo(db);
    const r2 = seedClientesDemo(db);
    expect(r2.creados).toBe(0);
    expect(db.select().from(schema.cliente).where(inArray(schema.cliente.numero_documento, docs())).all()).toHaveLength(6);
    expect(db.select().from(schema.cuenta_corriente_cliente).all()).toHaveLength(2);
  });

  it('completa solo los que faltan si ya existe alguno', () => {
    const db = setupDb();
    seedClientesDemo(db);
    const uno = db.select().from(schema.cliente).where(eq(schema.cliente.numero_documento, CLIENTES_DEMO[0].numero_documento)).get()!;
    db.delete(schema.cliente).where(eq(schema.cliente.id, uno.id)).run();
    const r = seedClientesDemo(db);
    expect(r.creados).toBe(1);
    expect(db.select().from(schema.cliente).where(inArray(schema.cliente.numero_documento, docs())).all()).toHaveLength(6);
  });
});
