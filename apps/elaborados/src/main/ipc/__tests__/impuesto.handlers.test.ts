import { describe, it, expect } from 'vitest';
import { setupDb } from '../../__tests__/helpers';
import { runCatalogSeedElaborados } from '../../catalog/seed';
import { impuestoListHandler } from '@core/main';

describe('impuesto handlers (Elaborados)', () => {
  it('list devuelve los impuestos activos sembrados por el catálogo', () => {
    const db = setupDb();
    runCatalogSeedElaborados(db);
    expect(impuestoListHandler(db)).toHaveLength(3);
  });
});
