import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and, isNull } from 'drizzle-orm';
import { clienteUpsertHandler, cajaAbrirHandler } from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { catalogo } from './ventaFixtures';
import {
  listaPrecioListHandler, listaPrecioCreateHandler, listaPrecioUpdateHandler,
  listaPrecioPreciosHandler, listaPrecioPrecioSetHandler,
} from '../lista-precio';
import { ventaCotizarHandler, ventaConfirmarHandler, ventaCatalogoHandler } from '../venta';

type Db = ReturnType<typeof setupDb>;

function clienteConLista(db: Db, lista_precio_id?: string) {
  return clienteUpsertHandler(db, {
    tipo_documento: 'DNI', numero_documento: String(Math.floor(Math.random() * 1e8)),
    nombre: 'Cli', apellido: 'Mayorista', condicion_fiscal: 'Consumidor Final',
    ...(lista_precio_id ? { lista_precio_id } : {}),
  } as never) as { id: string };
}

describe('lista-precio handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('create + list + update (nombre único, ajuste %, baja lógica)', () => {
    loginAsAdmin(db);
    const l = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
    expect(l).toMatchObject({ nombre: 'Mayorista', ajuste_porcentual: -10, activo: true, tipo: 'especial' });
    expect(() => listaPrecioCreateHandler(db, { nombre: 'Mayorista' })).toThrow();
    const u = listaPrecioUpdateHandler(db, { id: l.id, nombre: 'Mayoristas', ajuste_porcentual: -15, activo: false });
    expect(u).toMatchObject({ nombre: 'Mayoristas', ajuste_porcentual: -15, activo: false, version: 2 });
    expect(listaPrecioListHandler(db).map((x) => x.nombre)).toEqual(['Mayoristas']);
  });

  it('create valida el ajuste y exige sesión', () => {
    expect(() => listaPrecioCreateHandler(db, { nombre: 'X' })).toThrow('UNAUTHENTICATED');
    loginAsAdmin(db);
    expect(() => listaPrecioCreateHandler(db, { nombre: 'X', ajuste_porcentual: -101 })).toThrow();
    expect(() => listaPrecioCreateHandler(db, { nombre: '  ' })).toThrow();
  });

  it('precio set: historial SCD2 con un único vigente; null quita el absoluto', () => {
    loginAsAdmin(db);
    const c = catalogo(db);
    const l = listaPrecioCreateHandler(db, { nombre: 'Mayorista' });
    listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: c.palito.id, precio_centavos: 90000 });
    listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: c.palito.id, precio_centavos: 80000 });
    const todas = db.select().from(schema.producto_venta_precio).all();
    expect(todas).toHaveLength(2);
    expect(todas.filter((f) => f.fecha_hasta == null)).toHaveLength(1);
    expect(listaPrecioPreciosHandler(db, { lista_precio_id: l.id })).toEqual([
      { producto_venta_id: c.palito.id, precio_centavos: 80000 },
    ]);
    listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: c.palito.id, precio_centavos: null });
    expect(listaPrecioPreciosHandler(db, { lista_precio_id: l.id })).toEqual([]);
    expect(db.select().from(schema.producto_venta_precio)
      .where(and(eq(schema.producto_venta_precio.lista_precio_id, l.id), isNull(schema.producto_venta_precio.fecha_hasta))).all()).toHaveLength(0);
  });

  it('precio set rechaza lista o producto inexistente y precios inválidos', () => {
    loginAsAdmin(db);
    const c = catalogo(db);
    const l = listaPrecioCreateHandler(db, { nombre: 'M' });
    expect(() => listaPrecioPrecioSetHandler(db, { lista_precio_id: 'x', producto_venta_id: c.palito.id, precio_centavos: 1 })).toThrow('NOT_FOUND');
    expect(() => listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: 'x', precio_centavos: 1 })).toThrow('NOT_FOUND');
    expect(() => listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: c.palito.id, precio_centavos: -1 })).toThrow();
    expect(() => listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: c.palito.id, precio_centavos: 1.5 })).toThrow();
  });

  describe('catálogo del POS con la lista del cliente', () => {
    const precioPalito = (c: ReturnType<typeof catalogo>, payload?: unknown) =>
      ventaCatalogoHandler(db, payload).productos.find((p) => p.id === c.palito.id)!.precio_centavos;

    it('sin cliente o cliente sin lista: precio base; con lista: el mismo precio que cotiza', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const l = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
      const conLista = clienteConLista(db, l.id);
      const sinLista = clienteConLista(db);
      expect(precioPalito(c)).toBe(100000);
      expect(precioPalito(c, { cliente_id: sinLista.id })).toBe(100000);
      expect(precioPalito(c, { cliente_id: conLista.id })).toBe(90000);
      listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: c.palito.id, precio_centavos: 85000 });
      expect(precioPalito(c, { cliente_id: conLista.id })).toBe(85000);
      expect(ventaCotizarHandler(db, { cliente_id: conLista.id, lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }] }).total_centavos).toBe(85000);
    });

    it('rechaza un cliente_id mal formado', () => {
      loginAsAdmin(db);
      catalogo(db);
      expect(() => ventaCatalogoHandler(db, { cliente_id: 42 })).toThrow();
    });
  });

  describe('cotizar y confirmar con la lista del cliente', () => {
    const carritoPalito = (c: ReturnType<typeof catalogo>, cliente_id?: string) => ({
      ...(cliente_id ? { cliente_id } : {}),
      lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }],
    });

    it('sin cliente o cliente sin lista: precio base', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const sinLista = clienteConLista(db);
      expect(ventaCotizarHandler(db, carritoPalito(c)).total_centavos).toBe(100000);
      expect(ventaCotizarHandler(db, carritoPalito(c, sinLista.id)).total_centavos).toBe(100000);
    });

    it('lista con ajuste %: aplica sobre el base; el absoluto pisa al ajuste', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const l = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
      const cli = clienteConLista(db, l.id);
      expect(ventaCotizarHandler(db, carritoPalito(c, cli.id)).total_centavos).toBe(90000);
      listaPrecioPrecioSetHandler(db, { lista_precio_id: l.id, producto_venta_id: c.palito.id, precio_centavos: 85000 });
      expect(ventaCotizarHandler(db, carritoPalito(c, cli.id)).total_centavos).toBe(85000);
    });

    it('lista inactiva se ignora', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const l = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
      const cli = clienteConLista(db, l.id);
      listaPrecioUpdateHandler(db, { id: l.id, activo: false });
      expect(ventaCotizarHandler(db, carritoPalito(c, cli.id)).total_centavos).toBe(100000);
    });

    it('los recargos de sabor no varían por lista', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const l = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
      const cli = clienteConLista(db, l.id);
      const r = ventaCotizarHandler(db, {
        cliente_id: cli.id,
        lineas: [{ producto_venta_id: c.pote.id, cantidad: 1,
          modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id, c.opDdl.id] }] }],
      });
      // base 150000 -10% = 135000, + recargo dulce de leche 20000 (sin descuento)
      expect(r.lineas[0].precio_unitario_centavos).toBe(155000);
    });

    it('confirmar cobra al precio de la lista del cliente', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
      const l = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
      const cli = clienteConLista(db, l.id);
      const r = ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: cli.id,
        lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 90000 }],
      });
      expect(r.venta.total).toBe(900);
    });
  });
});
