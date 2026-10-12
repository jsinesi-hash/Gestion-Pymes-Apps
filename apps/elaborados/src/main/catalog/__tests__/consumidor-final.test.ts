import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { createTestDb } from '../../__tests__/helpers';
import { asegurarConsumidorFinal, CONSUMIDOR_FINAL_ID } from '../seed';

describe('asegurarConsumidorFinal', () => {
  it('crea el cliente fijo y es idempotente', () => {
    const db = createTestDb();
    asegurarConsumidorFinal(db);
    asegurarConsumidorFinal(db);
    const rows = db.select().from(schema.cliente).where(eq(schema.cliente.id, CONSUMIDOR_FINAL_ID)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nombre: 'Consumidor', apellido: 'Final', condicion_fiscal: 'Consumidor Final', activo: true });
    expect(CONSUMIDOR_FINAL_ID).toBe('cf000000-0000-0000-0000-000000000001');
  });
});
