import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../ipc/__tests__/helpers';
import { runSeed } from '../../auth/seed';
import { runCatalogSeed } from '../../catalog/seed';
import { seedPersonas } from '../personas';
import * as schema from '../../db/schema';

function setupDb() {
  const db = createTestDb();
  runSeed(db);
  runCatalogSeed(db);
  return db;
}

describe('seedPersonas', () => {
  it('inserta lista Mayorista, 8 clientes extra y 3 proveedores', () => {
    const db = setupDb();
    seedPersonas(db, false);

    // "Consumidor Final" viene de migración (no lo toca el seed)
    const clientes = db.select().from(schema.cliente).all();
    expect(clientes).toHaveLength(9); // 1 CF (migración) + 8 nuevos

    const proveedores = db.select().from(schema.proveedor).all();
    expect(proveedores).toHaveLength(3);

    const listas = db.select().from(schema.lista_precio).all();
    expect(listas).toHaveLength(1);
    expect(listas[0].nombre).toBe('Mayorista');
    expect(listas[0].ajuste_porcentual).toBe(15);
  });

  it('3 clientes con cuenta corriente habilitada', () => {
    const db = setupDb();
    seedPersonas(db, false);

    const conCta = db.select().from(schema.cliente)
      .all().filter(c => c.habilita_cuenta_corriente);
    expect(conCta).toHaveLength(3);
  });

  it('el cliente con lista Mayorista la tiene asignada', () => {
    const db = setupDb();
    seedPersonas(db, false);

    const lista = db.select().from(schema.lista_precio)
      .all().find(l => l.nombre === 'Mayorista');
    const conLista = db.select().from(schema.cliente)
      .all().filter(c => c.lista_precio_id === lista!.id);
    expect(conLista).toHaveLength(1);
  });

  it('idempotente: segunda llamada no duplica', () => {
    const db = setupDb();
    seedPersonas(db, false);
    seedPersonas(db, false);

    const clientes = db.select().from(schema.cliente).all();
    expect(clientes).toHaveLength(9);
  });
});
