import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import {
  listaPrecioListHandler,
  listaPrecioGetHandler,
  listaPrecioCreateHandler,
  listaPrecioUpdateHandler,
  listaPrecioDeactivateHandler,
} from '../lista-precio';

describe('lista-precio handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
  });

  function crearLista(nombre = 'General', predeterminada = false, ajuste = 0) {
    return listaPrecioCreateHandler(db, { nombre, ajuste_porcentual: ajuste, predeterminada });
  }

  function crearProducto() {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).all()[0];
    return productoCreateHandler(db, {
      nombre_corto: 'Prod',
      categoria_id: cat.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: 1000,
    });
  }

  // ── list ──────────────────────────────────────────────────────────────────
  describe('listaPrecioListHandler', () => {
    it('devuelve array vacío sin listas', () => {
      expect(listaPrecioListHandler(db)).toHaveLength(0);
    });

    it('devuelve solo listas activas', () => {
      loginAsAdmin(db);
      crearLista('A');
      crearLista('B');
      expect(listaPrecioListHandler(db)).toHaveLength(2);
    });

    it('funciona sin sesión (lectura pública)', () => {
      expect(() => listaPrecioListHandler(db)).not.toThrow();
    });
  });

  // ── get ───────────────────────────────────────────────────────────────────
  describe('listaPrecioGetHandler', () => {
    it('devuelve null para id inexistente', () => {
      expect(listaPrecioGetHandler(db, { id: 'no-existe' })).toBeNull();
    });

    it('devuelve la lista correcta', () => {
      loginAsAdmin(db);
      const lista = crearLista('Mayorista');
      const found = listaPrecioGetHandler(db, { id: lista.id });
      expect(found?.nombre).toBe('Mayorista');
    });

    it('funciona sin sesión (lectura pública)', () => {
      expect(() => listaPrecioGetHandler(db, { id: 'x' })).not.toThrow();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('listaPrecioCreateHandler', () => {
    it('crea lista y la devuelve', () => {
      loginAsAdmin(db);
      const lista = crearLista('Mayorista', false, -10);
      expect(lista.nombre).toBe('Mayorista');
      expect(lista.ajuste_porcentual).toBe(-10);
      expect(lista.activo).toBe(true);
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => crearLista()).toThrow('UNAUTHENTICATED');
    });

    it('predeterminada exclusivo: marcar B desmarca A (transacción atómica)', () => {
      loginAsAdmin(db);
      const a = crearLista('A', true);
      expect(listaPrecioGetHandler(db, { id: a.id })!.predeterminada).toBe(true);

      crearLista('B', true);

      expect(listaPrecioGetHandler(db, { id: a.id })!.predeterminada).toBe(false);
      const listas = listaPrecioListHandler(db);
      const predeterminadas = listas.filter(l => l.predeterminada);
      expect(predeterminadas).toHaveLength(1);
      expect(predeterminadas[0].nombre).toBe('B');
    });

    it('crear con predeterminada=false no afecta la lista ya predeterminada', () => {
      loginAsAdmin(db);
      const a = crearLista('A', true);
      crearLista('B', false);
      expect(listaPrecioGetHandler(db, { id: a.id })!.predeterminada).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('listaPrecioUpdateHandler', () => {
    it('actualiza nombre y ajuste', () => {
      loginAsAdmin(db);
      const lista = crearLista('Viejo', false, 0);
      const updated = listaPrecioUpdateHandler(db, {
        id: lista.id,
        nombre: 'Nuevo',
        ajuste_porcentual: -15,
      });
      expect(updated.nombre).toBe('Nuevo');
      expect(updated.ajuste_porcentual).toBe(-15);
    });

    it('lanza NOT_FOUND para id inexistente', () => {
      loginAsAdmin(db);
      expect(() =>
        listaPrecioUpdateHandler(db, { id: 'no-existe', nombre: 'X' })
      ).toThrow('NOT_FOUND');
    });

    it('lanza CANNOT_UNSET_ONLY_DEFAULT al desmarcar la única predeterminada', () => {
      loginAsAdmin(db);
      const lista = crearLista('Única', true);
      expect(() =>
        listaPrecioUpdateHandler(db, { id: lista.id, predeterminada: false })
      ).toThrow('CANNOT_UNSET_ONLY_DEFAULT');
    });

    it('permite desmarcar predeterminada cuando existe otra', () => {
      loginAsAdmin(db);
      const a = crearLista('A', true);
      const b = crearLista('B', false);
      // Directly set B to predeterminada=true in the DB (bypassing handler exclusivity)
      // so that the guard in update sees another predeterminada and allows unsetting A
      db.update(schema.lista_precio)
        .set({ predeterminada: true, updated_at: new Date() })
        .where(eq(schema.lista_precio.id, b.id))
        .run();
      // Now both A and B are predeterminada=true; unsetting A should pass the guard
      expect(() =>
        listaPrecioUpdateHandler(db, { id: a.id, predeterminada: false })
      ).not.toThrow();
    });

    it('marcar predeterminada en update desmarca la anterior', () => {
      loginAsAdmin(db);
      const a = crearLista('A', true);
      const b = crearLista('B', false);
      listaPrecioUpdateHandler(db, { id: b.id, predeterminada: true });
      expect(listaPrecioGetHandler(db, { id: a.id })!.predeterminada).toBe(false);
      expect(listaPrecioGetHandler(db, { id: b.id })!.predeterminada).toBe(true);
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() =>
        listaPrecioUpdateHandler(db, { id: 'x', nombre: 'Y' })
      ).toThrow('UNAUTHENTICATED');
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────
  describe('listaPrecioDeactivateHandler', () => {
    it('desactiva lista sin referencias', () => {
      loginAsAdmin(db);
      const lista = crearLista('A');
      const result = listaPrecioDeactivateHandler(db, { id: lista.id });
      expect(result.activo).toBe(false);
      expect(listaPrecioListHandler(db)).toHaveLength(0);
    });

    it('lanza NOT_FOUND para id inexistente', () => {
      loginAsAdmin(db);
      expect(() => listaPrecioDeactivateHandler(db, { id: 'no-existe' })).toThrow('NOT_FOUND');
    });

    it('desactiva lista aunque tenga detalles heredados (ADR-034: guard deprecated)', () => {
      loginAsAdmin(db);
      const prod = crearProducto();
      const lista = crearLista('ConRefs');
      db.insert(schema.lista_precio_detalle).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        ajuste_porcentual: -5,
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: new Date(),
      }).run();
      // ADR-034: lista_precio_detalle ya no bloquea la desactivación
      const result = listaPrecioDeactivateHandler(db, { id: lista.id });
      expect(result.activo).toBe(false);
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => listaPrecioDeactivateHandler(db, { id: 'x' })).toThrow('UNAUTHENTICATED');
    });
  });
});
