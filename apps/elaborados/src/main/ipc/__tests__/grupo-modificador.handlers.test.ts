import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { articuloCreateHandler } from '../articulo';
import {
  grupoModificadorCreateHandler, grupoModificadorListHandler,
  grupoModificadorOpcionSetHandler, grupoModificadorGetHandler,
} from '../grupo-modificador';

type Db = ReturnType<typeof setupDb>;

describe('grupo-modificador handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('create + list', () => {
    loginAsAdmin(db);
    grupoModificadorCreateHandler(db, { nombre: 'Sabores' });
    expect(grupoModificadorListHandler(db).map((g) => g.nombre)).toEqual(['Sabores']);
  });

  it('opcion set agrega opciones al grupo, referenciando artículos', () => {
    loginAsAdmin(db);
    const grupo = grupoModificadorCreateHandler(db, { nombre: 'Sabores' });
    const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    const frutilla = articuloCreateHandler(db, { nombre: 'Frutilla', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });

    grupoModificadorOpcionSetHandler(db, {
      grupo_modificador_id: grupo.id,
      opciones: [
        { articulo_id: choco.id, nombre: 'Chocolate', recargo_centavos: 0, cantidad: 0, orden: 1 },
        { articulo_id: frutilla.id, nombre: 'Frutilla', recargo_centavos: 0, cantidad: 0, orden: 2 },
      ],
    });

    const g = grupoModificadorGetHandler(db, { id: grupo.id });
    expect(g?.opciones).toHaveLength(2);
  });

  it('opcion set reemplaza las opciones existentes', () => {
    loginAsAdmin(db);
    const grupo = grupoModificadorCreateHandler(db, { nombre: 'Sabores' });
    const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    grupoModificadorOpcionSetHandler(db, {
      grupo_modificador_id: grupo.id,
      opciones: [{ articulo_id: choco.id, nombre: 'Chocolate', recargo_centavos: 0, cantidad: 0, orden: 1 }],
    });
    grupoModificadorOpcionSetHandler(db, { grupo_modificador_id: grupo.id, opciones: [] });
    const g = grupoModificadorGetHandler(db, { id: grupo.id });
    expect(g?.opciones).toHaveLength(0);
  });
});
