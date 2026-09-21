import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';

describe('ADR-060 — módulos de 1.1.x encendidos de fábrica (migración 0035)', () => {
  it('remitos/presupuestos/agenda/motor_precios_v2 quedan en "true" tras migrar', () => {
    const db = createTestDb();
    const params = db.select().from(schema.parametros_sistema).all();
    const byClave = new Map(params.map((p) => [p.clave, p.valor]));

    for (const clave of [
      'remitos_habilitado',
      'presupuestos_habilitado',
      'agenda_habilitado',
      'motor_precios_v2_habilitado',
    ]) {
      expect(byClave.get(clave), `falta ${clave}`).toBeDefined();
      expect(byClave.get(clave), clave).toBe('true');
    }
  });
});
