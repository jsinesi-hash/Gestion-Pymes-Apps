import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { categoriaVentaCreateHandler, categoriaVentaListHandler } from '../categoria-venta';

type Db = ReturnType<typeof setupDb>;

describe('categoria-venta handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('create + list', () => {
    loginAsAdmin(db);
    categoriaVentaCreateHandler(db, { nombre: 'Helados', orden: 1 });
    categoriaVentaCreateHandler(db, { nombre: 'Licuados', orden: 2 });
    const list = categoriaVentaListHandler(db);
    expect(list.map((c) => c.nombre)).toEqual(['Helados', 'Licuados']);
  });

  it('sin sesión lanza UNAUTHENTICATED', () => {
    expect(() => categoriaVentaCreateHandler(db, { nombre: 'Helados', orden: 1 })).toThrow('UNAUTHENTICATED');
  });
});
