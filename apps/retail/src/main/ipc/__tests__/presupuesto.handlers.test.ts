import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { sembrarProducto, sembrarCliente, sembrarVenta } from './presupuesto.helpers';
import {
  formatNumeroPresupuesto,
  nextNumeroPresupuestoAtomico,
  computarPresupuesto,
  presupuestoCrearHandler,
  presupuestoEditarHandler,
  presupuestoEmitirHandler,
  presupuestoAnularHandler,
  presupuestoVencerLoteHandler,
  presupuestoPrepararConversionHandler,
  marcarPresupuestoConvertido,
  presupuestoListarHandler,
  presupuestoObtenerHandler,
  presupuestoConfigHandler,
} from '../presupuesto';
import { renderPresupuestoHtml } from '../../print/presupuesto-template';

let db: ReturnType<typeof setupDb>;

beforeEach(() => { db = setupDb(); });
afterEach(() => { clearSession(); });

const MS_DIA = 24 * 60 * 60 * 1000;

describe('migracion 0025: permisos y parametros', () => {
  it('siembra los tres permisos de presupuesto a ambos roles', () => {
    const roles = db.select().from(schema.rol).all();
    const permisos = db.select().from(schema.permiso).all();
    const rolPermisos = db.select().from(schema.rol_permiso).all();
    for (const codigo of ['presupuesto.crear', 'presupuesto.emitir', 'presupuesto.anular']) {
      const permiso = permisos.find((p) => p.codigo === codigo);
      expect(permiso, `${codigo} sembrado`).toBeTruthy();
      for (const rol of roles) {
        expect(rolPermisos.some((rp) => rp.rol_id === rol.id && rp.permiso_id === permiso!.id),
          `${rol.nombre} tiene ${codigo}`).toBe(true);
      }
    }
  });

  it('siembra el contador, el default de validez y el feature flag', () => {
    const claves = db.select().from(schema.parametros_sistema).all()
      .reduce<Record<string, string>>((a, p) => { a[p.clave] = p.valor; return a; }, {});
    expect(claves['presupuesto_proximo_secuencial']).toBe('1');
    expect(claves['presupuesto_validez_dias_default']).toBe('15');
    // ADR-060 (migración 0035): el módulo viene encendido de fábrica en 1.1.x.
    expect(claves['presupuestos_habilitado']).toBe('true');
  });
});

describe('formatNumeroPresupuesto', () => {
  it('proyecta PR- + 7 digitos, sin Luhn', () => {
    expect(formatNumeroPresupuesto(1)).toBe('PR-0000001');
    expect(formatNumeroPresupuesto(42)).toBe('PR-0000042');
    expect(formatNumeroPresupuesto(9999999)).toBe('PR-9999999');
  });
});

describe('nextNumeroPresupuestoAtomico', () => {
  const leer = () => db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'presupuesto_proximo_secuencial')).get()!.valor;

  it('arranca en 1 y avanza el contador', () => {
    expect(db.transaction((tx) => nextNumeroPresupuestoAtomico(tx)))
      .toEqual({ numero: 'PR-0000001', secuencial: 1 });
    expect(db.transaction((tx) => nextNumeroPresupuestoAtomico(tx)))
      .toEqual({ numero: 'PR-0000002', secuencial: 2 });
    expect(leer()).toBe('3');
  });

  it('no consume secuencial si la transaccion falla (rollback)', () => {
    expect(() => db.transaction((tx) => { nextNumeroPresupuestoAtomico(tx); throw new Error('boom'); }))
      .toThrow('boom');
    expect(leer()).toBe('1');
  });
});

describe('computarPresupuesto (mismo motor que el POS)', () => {
  it('sin lista predeterminada usa fallback precio_venta_lista*100 y aplica descuentos', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 }); // 10000 centavos
    const r = computarPresupuesto(db, {
      descuento_global_pct: 10,
      lineas: [{ producto_id: prod, cantidad: 2, descuento_linea_pct: 0 }],
    });
    // subtotal linea = 10000*2 = 20000; con desc global 10% = 18000
    expect(r.lineas[0].precio_unitario_centavos).toBe(10000);
    expect(r.lineas[0].subtotal_centavos).toBe(20000);
    expect(r.total_centavos).toBe(18000);
    expect(r.lineas[0].alicuota_iva).toBe(21);
  });

  it('aplica descuento de linea antes del global', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 });
    const r = computarPresupuesto(db, {
      descuento_global_pct: 0,
      lineas: [{ producto_id: prod, cantidad: 1, descuento_linea_pct: 25 }],
    });
    expect(r.lineas[0].precio_unitario_centavos).toBe(7500);
    expect(r.total_centavos).toBe(7500);
  });
});

describe('presupuestoCrearHandler (borrador)', () => {
  it('crea borrador sin numero ni fechas, con total computado en vivo', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 });
    const cliente = sembrarCliente(db, userId);
    const p = presupuestoCrearHandler(db, {
      cliente_id: cliente,
      lineas: [{ producto_id: prod, cantidad: 3 }],
    });
    expect(p.estado).toBe('borrador');
    expect(p.numero).toBeNull();
    expect(p.fecha_emision).toBeNull();
    expect(p.fecha_validez).toBeNull();
    expect(p.validez_dias).toBe(15); // default
    expect(p.total_centavos).toBe(30000);
    expect(p.lineas).toHaveLength(1);
  });

  it('permite cliente null (consumidor final)', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    expect(p.cliente_id).toBeNull();
  });
});

describe('presupuestoEditarHandler', () => {
  it('recalcula total y reemplaza lineas; solo en borrador', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 });
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    const editado = presupuestoEditarHandler(db, {
      id: p.id, descuento_global_pct: 0,
      lineas: [{ producto_id: prod, cantidad: 5 }],
    });
    expect(editado.total_centavos).toBe(50000);
    expect(editado.lineas).toHaveLength(1);
    expect(editado.lineas[0].cantidad).toBe(5);
  });

  it('rechaza editar un presupuesto no borrador', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    presupuestoEmitirHandler(db, { id: p.id });
    expect(() => presupuestoEditarHandler(db, { id: p.id, lineas: [] }))
      .toThrow(/ESTADO_INVALIDO/);
  });
});

describe('presupuestoEmitirHandler', () => {
  it('asigna numero, congela snapshot, setea fechas y pasa a emitido', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 });
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 2 }] });
    const antes = Date.now();
    const emitido = presupuestoEmitirHandler(db, { id: p.id, validez_dias: 30 });

    expect(emitido.estado).toBe('emitido');
    expect(emitido.numero).toBe('PR-0000001');
    expect(emitido.numero_secuencial).toBe(1);
    expect(emitido.validez_dias).toBe(30);
    expect(emitido.fecha_emision).toBeTruthy();
    expect(emitido.lineas[0].precio_unitario_centavos).toBe(10000); // congelado
    const emisionMs = new Date(emitido.fecha_emision!).getTime();
    const validezMs = new Date(emitido.fecha_validez!).getTime();
    expect(Math.round((validezMs - emisionMs) / MS_DIA)).toBe(30);
    expect(emisionMs).toBeGreaterThanOrEqual(antes - 1000);
  });

  it('rechaza emitir sin lineas y no consume secuencial', () => {
    const { id: userId } = loginAsAdmin(db);
    const p = presupuestoCrearHandler(db, { lineas: [] });
    expect(() => presupuestoEmitirHandler(db, { id: p.id })).toThrow('SIN_LINEAS');
    const cont = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'presupuesto_proximo_secuencial')).get()!.valor;
    expect(cont).toBe('1');
  });

  it('numera correlativamente entre presupuestos', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const a = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    const b = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    expect(presupuestoEmitirHandler(db, { id: a.id }).numero).toBe('PR-0000001');
    expect(presupuestoEmitirHandler(db, { id: b.id }).numero).toBe('PR-0000002');
  });
});

describe('presupuestoVencerLoteHandler (job diario)', () => {
  it('marca emitido -> vencido cuando fecha_validez < ahora', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    presupuestoEmitirHandler(db, { id: p.id, validez_dias: 1 });

    // simula "hoy" = dentro de 5 dias
    const res = presupuestoVencerLoteHandler(db, { ahora: Date.now() + 5 * MS_DIA });
    expect(res.vencidos).toBe(1);
    const row = db.select().from(schema.presupuesto).where(eq(schema.presupuesto.id, p.id)).get()!;
    expect(row.estado).toBe('vencido');
  });

  it('no toca borradores ni presupuestos aun vigentes', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const borrador = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    const vigente = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    presupuestoEmitirHandler(db, { id: vigente.id, validez_dias: 30 });

    const res = presupuestoVencerLoteHandler(db, { ahora: Date.now() });
    expect(res.vencidos).toBe(0);
    expect(db.select().from(schema.presupuesto).where(eq(schema.presupuesto.id, borrador.id)).get()!.estado).toBe('borrador');
    expect(db.select().from(schema.presupuesto).where(eq(schema.presupuesto.id, vigente.id)).get()!.estado).toBe('emitido');
  });
});

describe('presupuestoPrepararConversionHandler', () => {
  it('dentro de validez precarga el precio snapshot congelado', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 });
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 2 }] });
    presupuestoEmitirHandler(db, { id: p.id, validez_dias: 30 });

    const conv = presupuestoPrepararConversionHandler(db, { id: p.id });
    expect(conv.vencido).toBe(false);
    expect(conv.aviso).toBeNull();
    expect(conv.lineas[0].precio_unitario_centavos).toBe(10000);
  });

  it('vencido reprecia al valor de hoy y devuelve aviso no bloqueante', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 });
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    presupuestoEmitirHandler(db, { id: p.id, validez_dias: 1 });
    presupuestoVencerLoteHandler(db, { ahora: Date.now() + 5 * MS_DIA });

    // sube el precio del producto: la reprecificacion debe reflejarlo
    db.update(schema.producto).set({ precio_venta_lista: 200 })
      .where(eq(schema.producto.id, prod)).run();

    const conv = presupuestoPrepararConversionHandler(db, { id: p.id });
    expect(conv.vencido).toBe(true);
    expect(conv.aviso).toMatch(/vencido/i);
    expect(conv.lineas[0].precio_unitario_centavos).toBe(20000); // reprecio a hoy
  });
});

describe('marcarPresupuestoConvertido', () => {
  it('setea convertido + venta_id cuando esta emitido', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const cliente = sembrarCliente(db, userId);
    const ventaId = sembrarVenta(db, userId, cliente);
    const p = presupuestoCrearHandler(db, { cliente_id: cliente, lineas: [{ producto_id: prod, cantidad: 1 }] });
    presupuestoEmitirHandler(db, { id: p.id });

    db.transaction((tx) => marcarPresupuestoConvertido(tx, p.id, ventaId));
    const row = db.select().from(schema.presupuesto).where(eq(schema.presupuesto.id, p.id)).get()!;
    expect(row.estado).toBe('convertido');
    expect(row.venta_id).toBe(ventaId);
  });

  it('rechaza convertir un borrador (no emitido/vencido)', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    expect(() => db.transaction((tx) => marcarPresupuestoConvertido(tx, p.id, 'v1')))
      .toThrow(/NO_CONVERTIBLE/);
  });
});

describe('presupuestoAnularHandler', () => {
  it('anula un borrador (soft) y lo saca de activos', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 1 }] });
    const anulado = presupuestoAnularHandler(db, { id: p.id });
    expect(anulado.estado).toBe('anulado');
    expect(anulado.activo).toBe(false);
  });

  it('no anula un convertido', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const cliente = sembrarCliente(db, userId);
    const ventaId = sembrarVenta(db, userId, cliente);
    const p = presupuestoCrearHandler(db, { cliente_id: cliente, lineas: [{ producto_id: prod, cantidad: 1 }] });
    presupuestoEmitirHandler(db, { id: p.id });
    db.transaction((tx) => marcarPresupuestoConvertido(tx, p.id, ventaId));
    expect(() => presupuestoAnularHandler(db, { id: p.id })).toThrow(/ESTADO_INVALIDO/);
  });
});

describe('presupuestoListarHandler / config', () => {
  it('lista por estado y trae razon social del cliente', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId);
    const cliente = sembrarCliente(db, userId);
    presupuestoCrearHandler(db, { cliente_id: cliente, lineas: [{ producto_id: prod, cantidad: 1 }] });
    const lista = presupuestoListarHandler(db, { estado: 'borrador' });
    expect(lista.length).toBe(1);
    expect(lista[0].cliente_nombre_completo).toBe('Cliente Presup Test');
  });

  it('config devuelve la validez default', () => {
    loginAsAdmin(db);
    expect(presupuestoConfigHandler(db)).toEqual({ validez_dias_default: 15 });
  });
});

describe('renderPresupuestoHtml', () => {
  it('renderiza numero, total y aviso no-fiscal', () => {
    const { id: userId } = loginAsAdmin(db);
    const prod = sembrarProducto(db, userId, { precio: 100 });
    const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prod, cantidad: 2 }] });
    const emitido = presupuestoEmitirHandler(db, { id: p.id });
    const full = presupuestoObtenerHandler(db, { id: emitido.id });
    const html = renderPresupuestoHtml({
      numero: full.numero,
      fecha_emision: full.fecha_emision,
      fecha_validez: full.fecha_validez,
      estado: full.estado,
      descuento_global_pct: full.descuento_global_pct,
      total_centavos: full.total_centavos,
      observaciones: full.observaciones,
      cliente_nombre_completo: full.cliente_nombre_completo,
      cliente_documento: full.cliente_documento,
      cliente_condicion_fiscal: full.cliente_condicion_fiscal,
      lineas: full.lineas.map((l) => ({
        descripcion: l.descripcion, cantidad: l.cantidad,
        precio_unitario_centavos: l.precio_unitario_centavos,
        descuento_linea_pct: l.descuento_linea_pct, subtotal_centavos: l.subtotal_centavos,
      })),
    });
    expect(html).toContain('PR-0000001');
    expect(html).toContain('no válido como factura');
    expect(html).toContain('TOTAL');
  });
});
