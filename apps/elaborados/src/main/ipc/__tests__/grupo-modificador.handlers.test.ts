import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import * as schema from '../../db/schema';
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

  describe('edición con baja lógica (ADR-102)', () => {
    function armar() {
      loginAsAdmin(db);
      const grupo = grupoModificadorCreateHandler(db, { nombre: 'Sabores' });
      const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
      const frutilla = articuloCreateHandler(db, { nombre: 'Frutilla', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
      const op = (a: { id: string }, nombre: string, orden: number, recargo = 0) =>
        ({ articulo_id: a.id, nombre, recargo_centavos: recargo, cantidad: 0, orden });
      return { grupo, choco, frutilla, op };
    }

    it('conserva el id de la opción cuando el artículo sigue en el grupo y actualiza sus datos', () => {
      const { grupo, choco, op } = armar();
      const antes = grupoModificadorOpcionSetHandler(db, { grupo_modificador_id: grupo.id, opciones: [op(choco, 'Chocolate', 1)] })!;
      const despues = grupoModificadorOpcionSetHandler(db, {
        grupo_modificador_id: grupo.id, opciones: [op(choco, 'Choco amargo', 2, 500)],
      })!;
      expect(despues.opciones).toHaveLength(1);
      expect(despues.opciones[0]).toMatchObject({ id: antes.opciones[0]!.id, nombre: 'Choco amargo', recargo_centavos: 500, orden: 2 });
    });

    it('da de baja (no borra) las opciones omitidas y get solo devuelve las activas', () => {
      const { grupo, choco, frutilla, op } = armar();
      grupoModificadorOpcionSetHandler(db, {
        grupo_modificador_id: grupo.id, opciones: [op(choco, 'Chocolate', 1), op(frutilla, 'Frutilla', 2)],
      });
      const g = grupoModificadorOpcionSetHandler(db, { grupo_modificador_id: grupo.id, opciones: [op(choco, 'Chocolate', 1)] })!;
      expect(g.opciones.map((o) => o.nombre)).toEqual(['Chocolate']);
      const filas = db.select().from(schema.grupo_modificador_opcion).all();
      expect(filas).toHaveLength(2);
      expect(filas.find((f) => f.articulo_id === frutilla.id)?.activo).toBe(false);
    });

    it('reactiva con el mismo id una opción dada de baja', () => {
      const { grupo, choco, op } = armar();
      const a = grupoModificadorOpcionSetHandler(db, { grupo_modificador_id: grupo.id, opciones: [op(choco, 'Chocolate', 1)] })!;
      grupoModificadorOpcionSetHandler(db, { grupo_modificador_id: grupo.id, opciones: [] });
      const b = grupoModificadorOpcionSetHandler(db, { grupo_modificador_id: grupo.id, opciones: [op(choco, 'Chocolate', 1)] })!;
      expect(b.opciones[0]!.id).toBe(a.opciones[0]!.id);
      expect(db.select().from(schema.grupo_modificador_opcion).all()).toHaveLength(1);
    });
  });
});
