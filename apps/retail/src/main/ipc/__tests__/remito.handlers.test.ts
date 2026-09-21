import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { crearVentaConfirmada } from './remito.helpers';
import {
  formatNumeroRemito,
  nextNumeroRemitoAtomico,
  remitoPendientePorVentaHandler,
  remitoCrearHandler,
  remitoListarHandler,
  remitoObtenerHandler,
  remitoConformarHandler,
  remitoAnularHandler,
  remitoEditarHandler,
} from '../remito';
import { transportistaUpsertHandler } from '../transportista';
import { renderRemitoHtml } from '../../print/remito-template';

let db: ReturnType<typeof setupDb>;

beforeEach(() => { db = setupDb(); });
afterEach(() => { clearSession(); });

/** Domicilio de entrega por defecto: emitir un remito ahora lo exige. */
const DOMICILIO = 'Av. Siempreviva 742';

/** Crea un transportista y devuelve su id: emitir un remito ahora lo exige. */
function unTransportista(razonSocial = 'Transporte Rex'): string {
  return transportistaUpsertHandler(db, { razon_social: razonSocial }).id;
}

describe('permisos de remito', () => {
  it('siembra los tres permisos de remito', () => {
    const codigos = db.select().from(schema.permiso).all().map((p) => p.codigo);
    expect(codigos).toContain('remito.crear');
    expect(codigos).toContain('remito.conformar');
    expect(codigos).toContain('remito.anular');
  });

  it('otorga los tres permisos a AMBOS roles (decision 2026-07-19)', () => {
    const roles = db.select().from(schema.rol).all();
    const permisos = db.select().from(schema.permiso).all();
    const rolPermisos = db.select().from(schema.rol_permiso).all();

    expect(roles.length).toBeGreaterThanOrEqual(2);

    for (const codigo of ['remito.crear', 'remito.conformar', 'remito.anular']) {
      const permisoId = permisos.find((p) => p.codigo === codigo)!.id;
      for (const rol of roles) {
        const tiene = rolPermisos.some((rp) => rp.rol_id === rol.id && rp.permiso_id === permisoId);
        expect(tiene, `${rol.nombre} deberia tener ${codigo}`).toBe(true);
      }
    }
  });
});

describe('parametros sembrados por la migracion 0023', () => {
  it('siembra el contador y los flags de remito', () => {
    const claves = db.select().from(schema.parametros_sistema).all()
      .reduce<Record<string, string>>((acc, p) => { acc[p.clave] = p.valor; return acc; }, {});

    expect(claves['remito_proximo_secuencial']).toBe('1');
    // ADR-060 (migración 0035): el módulo viene encendido de fábrica en 1.1.x.
    expect(claves['remitos_habilitado']).toBe('true');
    expect(claves['remito_valorizado']).toBe('false');
  });
});

describe('formatNumeroRemito', () => {
  it('proyecta RE- + 7 digitos cero-padded, sin Luhn', () => {
    expect(formatNumeroRemito(1)).toBe('RE-0000001');
    expect(formatNumeroRemito(42)).toBe('RE-0000042');
    expect(formatNumeroRemito(9999999)).toBe('RE-9999999');
  });

  it('no trunca si el secuencial excede 7 digitos', () => {
    expect(formatNumeroRemito(10000000)).toBe('RE-10000000');
  });
});

describe('nextNumeroRemitoAtomico', () => {
  const leerContador = () => db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'remito_proximo_secuencial')).get()!.valor;

  it('arranca en 1 y avanza el contador en parametros_sistema', () => {
    expect(db.transaction((tx) => nextNumeroRemitoAtomico(tx)))
      .toEqual({ numero: 'RE-0000001', secuencial: 1 });
    expect(db.transaction((tx) => nextNumeroRemitoAtomico(tx)))
      .toEqual({ numero: 'RE-0000002', secuencial: 2 });

    expect(leerContador()).toBe('3');
  });

  it('no consume secuencial si la transaccion falla (rollback)', () => {
    expect(() => db.transaction((tx) => {
      nextNumeroRemitoAtomico(tx);
      throw new Error('boom');
    })).toThrow('boom');

    expect(leerContador()).toBe('1');
  });
});

describe('remitoPendientePorVentaHandler', () => {
  it('sin remitos, pendiente = cantidad vendida', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds, productoIds } = crearVentaConfirmada(db, userId, [10, 5]);

    const { lineas: filas } = remitoPendientePorVentaHandler(db, { venta_id: ventaId });

    expect(filas).toHaveLength(2);
    const l0 = filas.find((f) => f.venta_detalle_id === detalleIds[0])!;
    expect(l0.cantidad_vendida).toBe(10);
    expect(l0.cantidad_entregada).toBe(0);
    expect(l0.cantidad_pendiente).toBe(10);
    expect(l0.producto_id).toBe(productoIds[0]);
    expect(l0.descripcion).toBe('Producto 0');
    expect(l0.unidad).toBe('u');
  });

  it('devuelve vacio para una venta sin lineas', () => {
    loginAsAdmin(db);
    expect(remitoPendientePorVentaHandler(db, { venta_id: 'inexistente' }))
      .toEqual({ lineas: [], domicilio_cliente: null });
  });

  it('incluye el domicilio del cliente de la venta', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId } = crearVentaConfirmada(db, userId, [10]);

    const { domicilio_cliente } = remitoPendientePorVentaHandler(db, { venta_id: ventaId });

    expect(domicilio_cliente).toBe('Calle Falsa 123');
  });

  it('arma el domicilio con calle/numero/aclaracion, que es lo que carga el form de cliente', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, clienteId } = crearVentaConfirmada(db, userId, [10]);

    // El form de clientes guarda calle/numero/aclaracion y NO toca `domicilio`,
    // que quedo como campo legacy. Simulamos un cliente cargado por ese form.
    db.update(schema.cliente).set({
      domicilio: null, calle: 'Larrea', numero: '200', aclaracion: 'Piso 3',
    }).where(eq(schema.cliente.id, clienteId)).run();

    const { domicilio_cliente } = remitoPendientePorVentaHandler(db, { venta_id: ventaId });

    expect(domicilio_cliente).toBe('Larrea 200 Piso 3');
  });

  it('cae al campo legacy `domicilio` si no hay calle cargada', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, clienteId } = crearVentaConfirmada(db, userId, [10]);

    db.update(schema.cliente).set({
      domicilio: 'Calle Falsa 123', calle: null, numero: null, aclaracion: null,
    }).where(eq(schema.cliente.id, clienteId)).run();

    const { domicilio_cliente } = remitoPendientePorVentaHandler(db, { venta_id: ventaId });

    expect(domicilio_cliente).toBe('Calle Falsa 123');
  });

  it('con excluir_remito_id, no cuenta las lineas de ese remito como entregadas', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const { id: transportistaId } = transportistaUpsertHandler(db, { razon_social: 'Rex' });
    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: 'Av. Siempreviva 742',
      transportista_id: transportistaId,
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    });

    const sinExcluir = remitoPendientePorVentaHandler(db, { venta_id: ventaId });
    expect(sinExcluir.lineas[0].cantidad_pendiente).toBe(6);

    const excluyendo = remitoPendientePorVentaHandler(db, { venta_id: ventaId, excluir_remito_id: r.id });
    expect(excluyendo.lineas[0].cantidad_pendiente).toBe(10);
  });
});

describe('remitoCrearHandler', () => {
  it('emite un remito numerado con sus lineas en una transaccion', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds, productoIds } = crearVentaConfirmada(db, userId, [10]);

    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: 'Av. Siempreviva 742',
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    });

    expect(r.numero).toBe('RE-0000001');
    expect(r.numero_secuencial).toBe(1);
    expect(r.estado).toBe('emitido');
    expect(r.venta_id).toBe(ventaId);
    expect(r.domicilio_entrega).toBe('Av. Siempreviva 742');
    expect(r.creado_por_usuario_id).toBe(userId);
    expect(r.activo).toBe(true);

    const lineas = db.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, r.id)).all();
    expect(lineas).toHaveLength(1);
    expect(lineas[0].cantidad_entregada).toBe(4);
    expect(lineas[0].producto_id).toBe(productoIds[0]);
    expect(lineas[0].descripcion).toBe('Producto 0');
    expect(lineas[0].unidad).toBe('u');
  });

  it('rechaza sin domicilio_entrega', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const { id: transportistaId } = transportistaUpsertHandler(db, { razon_social: 'Rex' });

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: '  ',
      transportista_id: transportistaId,
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    })).toThrow('VALIDATION:domicilio_entrega:REQUERIDO');
  });

  it('rechaza sin transportista_id', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: 'Av. Siempreviva 742',
      transportista_id: '',
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    })).toThrow('VALIDATION:transportista_id:REQUERIDO');
  });

  it('rechaza transportista_id inexistente', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: 'Av. Siempreviva 742',
      transportista_id: 'no-existe',
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    })).toThrow('TRANSPORTISTA_INVALIDO');
  });

  it('guarda transportista_id y el snapshot de texto del transportista', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const { id: transportistaId } = transportistaUpsertHandler(db, { razon_social: 'Transporte Rex' });

    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: 'Av. Siempreviva 742',
      transportista_id: transportistaId,
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    });

    expect(r.transportista_id).toBe(transportistaId);
    expect(r.transportista).toBe('Transporte Rex');
  });

  it('descuenta lo emitido del pendiente', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    });

    const p = remitoPendientePorVentaHandler(db, { venta_id: ventaId }).lineas[0];
    expect(p.cantidad_entregada).toBe(4);
    expect(p.cantidad_pendiente).toBe(6);
  });

  it('rechaza entregar mas que lo pendiente', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 11 }],
    })).toThrow(/EXCEDE_PENDIENTE/);
  });

  it('acumula entre remitos: dos parciales agotan la linea, el tercero falla', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const p = {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 5 }],
    };

    remitoCrearHandler(db, p);
    remitoCrearHandler(db, p);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    })).toThrow(/EXCEDE_PENDIENTE/);
  });

  it('consolida lineas repetidas del mismo venta_detalle antes de validar', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [
        { venta_detalle_id: detalleIds[0], cantidad_entregada: 6 },
        { venta_detalle_id: detalleIds[0], cantidad_entregada: 6 },
      ],
    })).toThrow(/EXCEDE_PENDIENTE/);
  });

  it('no consume secuencial cuando la validacion falla', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 99 }],
    })).toThrow();

    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    });
    expect(r.numero).toBe('RE-0000001');
  });

  it('rechaza cantidad cero o negativa', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 0 }],
    })).toThrow(/CANTIDAD_INVALIDA/);

    // ADR-085 (SEC-2): una cantidad negativa ahora la rechaza la validacion de forma
    // (min:0), antes de llegar al chequeo de dominio CANTIDAD_INVALIDA.
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: -3 }],
    })).toThrow('VALIDATION:lineas.0.cantidad_entregada:MIN:0');
  });

  it('rechaza fraccion si el producto no la permite', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 2.5 }],
    })).toThrow(/FRACCION_NO_PERMITIDA/);
  });

  it('acepta fraccion si el producto la permite', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10], { permiteFraccion: true });

    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 2.5 }],
    });
    expect(r.numero).toBe('RE-0000001');
  });

  it('rechaza remito sin lineas', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [],
    })).toThrow(/SIN_LINEAS/);
  });

  it('rechaza una linea que no pertenece a la venta', () => {
    const { id: userId } = loginAsAdmin(db);
    const a = crearVentaConfirmada(db, userId, [10]);
    const b = crearVentaConfirmada(db, userId, [10]);

    expect(() => remitoCrearHandler(db, {
      venta_id: a.ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: b.detalleIds[0], cantidad_entregada: 1 }],
    })).toThrow(/LINEA_NO_PERTENECE_A_VENTA/);
  });

  it('rechaza si la venta no esta confirmada', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    db.update(schema.venta).set({ estado: 'anulada' })
      .where(eq(schema.venta.id, ventaId)).run();

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    })).toThrow(/VENTA_NO_CONFIRMADA/);
  });

  it('exige sesion', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    // El transportista se crea con sesion viva: asi el UNAUTHENTICATED que se espera
    // proviene de remitoCrearHandler y no del alta del transportista.
    const transportistaId = unTransportista();
    clearSession();

    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: transportistaId,
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    })).toThrow('UNAUTHENTICATED');
  });

  it('NO escribe movimientos de stock (ADR-045 §2)', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const antes = db.select().from(schema.movimiento_stock).all().length;

    remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    });

    expect(db.select().from(schema.movimiento_stock).all().length).toBe(antes);
  });

  it('NO escribe movimientos de caja (ADR-045 §10)', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const antes = db.select().from(schema.movimiento_caja).all().length;

    remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    });

    expect(db.select().from(schema.movimiento_caja).all().length).toBe(antes);
  });
});

describe('remitoListarHandler', () => {
  it('lista remitos con datos de venta y cliente, mas nuevo primero', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const p = {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    };
    remitoCrearHandler(db, p);
    remitoCrearHandler(db, p);

    const filas = remitoListarHandler(db, {});

    expect(filas).toHaveLength(2);
    expect(filas[0].numero).toBe('RE-0000002');
    expect(filas[1].numero).toBe('RE-0000001');
    expect(filas[0].cliente_nombre_completo).toBe('Cliente Remito Test');
  });

  it('filtra por estado', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    });

    expect(remitoListarHandler(db, { estado: 'emitido' })).toHaveLength(1);
    expect(remitoListarHandler(db, { estado: 'anulado' })).toHaveLength(0);
  });

  it('filtra por venta_id', () => {
    const { id: userId } = loginAsAdmin(db);
    const a = crearVentaConfirmada(db, userId, [10]);
    const b = crearVentaConfirmada(db, userId, [10]);
    remitoCrearHandler(db, {
      venta_id: a.ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: a.detalleIds[0], cantidad_entregada: 1 }],
    });

    expect(remitoListarHandler(db, { venta_id: a.ventaId })).toHaveLength(1);
    expect(remitoListarHandler(db, { venta_id: b.ventaId })).toHaveLength(0);
  });

  it('devuelve vacio cuando no hay remitos', () => {
    loginAsAdmin(db);
    expect(remitoListarHandler(db, {})).toEqual([]);
  });
});

describe('remitoObtenerHandler', () => {
  it('devuelve cabecera con lineas y datos del cliente', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10, 5]);
    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [
        { venta_detalle_id: detalleIds[0], cantidad_entregada: 2 },
        { venta_detalle_id: detalleIds[1], cantidad_entregada: 1 },
      ],
    });

    const full = remitoObtenerHandler(db, { id: r.id });

    expect(full.numero).toBe('RE-0000001');
    expect(full.lineas).toHaveLength(2);
    expect(full.cliente_nombre_completo).toBe('Cliente Remito Test');
  });

  it('lanza NOT_FOUND si no existe', () => {
    loginAsAdmin(db);
    expect(() => remitoObtenerHandler(db, { id: 'inexistente' })).toThrow('NOT_FOUND');
  });
});

/** Emite un remito de prueba y devuelve la fila. */
function emitirRemito(userId: string, cantidad = 3) {
  const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
  const r = remitoCrearHandler(db, {
    venta_id: ventaId,
    domicilio_entrega: DOMICILIO,
    transportista_id: unTransportista(),
    lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: cantidad }],
  });
  return { r, ventaId, detalleIds };
}

describe('remitoConformarHandler', () => {
  it('emitido -> conformado con fecha_entrega y recibido_por', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);

    const out = remitoConformarHandler(db, { id: r.id, recibido_por: 'Juan Perez' });

    expect(out.estado).toBe('conformado');
    expect(out.recibido_por).toBe('Juan Perez');
    expect(out.fecha_entrega).toBeInstanceOf(Date);
    expect(out.version).toBe(r.version + 1);
    expect(out.sync_state).toBe('pending');
  });

  it('recorta espacios de recibido_por', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    expect(remitoConformarHandler(db, { id: r.id, recibido_por: '  Ana  ' }).recibido_por).toBe('Ana');
  });

  it('exige recibido_por', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    expect(() => remitoConformarHandler(db, { id: r.id, recibido_por: '  ' }))
      .toThrow(/RECIBIDO_POR_REQUERIDO/);
  });

  it('no permite conformar dos veces', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    remitoConformarHandler(db, { id: r.id, recibido_por: 'Juan' });

    expect(() => remitoConformarHandler(db, { id: r.id, recibido_por: 'Otro' }))
      .toThrow(/ESTADO_INVALIDO/);
  });

  it('no permite conformar un remito anulado', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    remitoAnularHandler(db, { id: r.id, motivo: 'error' });

    expect(() => remitoConformarHandler(db, { id: r.id, recibido_por: 'Juan' }))
      .toThrow(/ESTADO_INVALIDO/);
  });

  it('lanza NOT_FOUND si no existe', () => {
    loginAsAdmin(db);
    expect(() => remitoConformarHandler(db, { id: 'nope', recibido_por: 'Juan' })).toThrow('NOT_FOUND');
  });

  it('exige sesion', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    clearSession();
    expect(() => remitoConformarHandler(db, { id: r.id, recibido_por: 'Juan' }))
      .toThrow('UNAUTHENTICATED');
  });
});

describe('remitoAnularHandler', () => {
  it('emitido -> anulado con auditoria', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);

    const out = remitoAnularHandler(db, { id: r.id, motivo: 'Error de carga' });

    expect(out.estado).toBe('anulado');
    expect(out.motivo_anulacion).toBe('Error de carga');
    expect(out.anulado_por_usuario_id).toBe(userId);
    expect(out.anulado_en).toBeInstanceOf(Date);
    expect(out.version).toBe(r.version + 1);
  });

  it('libera las cantidades: vuelven a pendiente', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 10 }],
    });

    expect(remitoPendientePorVentaHandler(db, { venta_id: ventaId }).lineas[0].cantidad_pendiente).toBe(0);

    remitoAnularHandler(db, { id: r.id, motivo: 'Se cancelo la entrega' });

    expect(remitoPendientePorVentaHandler(db, { venta_id: ventaId }).lineas[0].cantidad_pendiente).toBe(10);
  });

  it('tras anular se puede volver a emitir por la cantidad liberada', () => {
    const { id: userId } = loginAsAdmin(db);
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 10 }],
    });
    remitoAnularHandler(db, { id: r.id, motivo: 'rehacer' });

    const r2 = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 10 }],
    });
    expect(r2.numero).toBe('RE-0000002');
  });

  it('exige motivo', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    expect(() => remitoAnularHandler(db, { id: r.id, motivo: '' })).toThrow(/MOTIVO_REQUERIDO/);
  });

  it('no permite anular un remito ya anulado', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    remitoAnularHandler(db, { id: r.id, motivo: 'primera' });

    expect(() => remitoAnularHandler(db, { id: r.id, motivo: 'segunda' })).toThrow(/ESTADO_INVALIDO/);
  });

  it('permite anular un remito conformado', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    remitoConformarHandler(db, { id: r.id, recibido_por: 'Juan' });

    expect(remitoAnularHandler(db, { id: r.id, motivo: 'devolucion' }).estado).toBe('anulado');
  });

  it('NO genera movimientos inversos de stock (ADR-045 §8)', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    const antesStock = db.select().from(schema.movimiento_stock).all().length;
    const antesCaja = db.select().from(schema.movimiento_caja).all().length;

    remitoAnularHandler(db, { id: r.id, motivo: 'test' });

    expect(db.select().from(schema.movimiento_stock).all().length).toBe(antesStock);
    expect(db.select().from(schema.movimiento_caja).all().length).toBe(antesCaja);
  });

  it('el remito anulado sigue visible en el listado', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    remitoAnularHandler(db, { id: r.id, motivo: 'test' });

    expect(remitoListarHandler(db, { estado: 'anulado' })).toHaveLength(1);
  });

  it('exige sesion', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r } = emitirRemito(userId);
    clearSession();
    expect(() => remitoAnularHandler(db, { id: r.id, motivo: 'x' })).toThrow('UNAUTHENTICATED');
  });
});

describe('renderRemitoHtml', () => {
  const base = {
    numero: 'RE-0000001',
    fecha_emision: new Date('2026-07-19T10:00:00Z'),
    estado: 'emitido' as const,
    domicilio_entrega: 'Av. Siempreviva 742',
    transportista: 'Transporte Rex',
    observaciones: 'Entregar por la manana',
    venta_numero_interno: 'V-C1-000010',
    cliente_nombre_completo: 'Ferreteria Sur',
    cliente_documento: '30111222',
    lineas: [
      { cantidad_entregada: 3, descripcion: 'Martillo', unidad: 'u' },
      { cantidad_entregada: 1.5, descripcion: 'Cable', unidad: 'm' },
    ],
  };

  it('incluye numero, cliente, domicilio, transportista y lineas', () => {
    const html = renderRemitoHtml(base);
    expect(html).toContain('RE-0000001');
    expect(html).toContain('Ferreteria Sur');
    expect(html).toContain('30111222');
    expect(html).toContain('Av. Siempreviva 742');
    expect(html).toContain('Transporte Rex');
    expect(html).toContain('V-C1-000010');
    expect(html).toContain('Martillo');
    expect(html).toContain('Cable');
  });

  it('NO incluye importes (ADR-045 §4)', () => {
    const html = renderRemitoHtml(base);
    expect(html).not.toContain('$');
    expect(html).not.toMatch(/precio/i);
    expect(html).not.toMatch(/importe/i);
    expect(html).not.toMatch(/subtotal/i);
    expect(html).not.toMatch(/\bIVA\b/);
    expect(html).not.toMatch(/\btotal\b/i);
  });

  it('incluye pie de firma de recepcion', () => {
    expect(renderRemitoHtml(base)).toMatch(/firma/i);
  });

  it('escapa HTML en campos de texto libre', () => {
    const html = renderRemitoHtml({ ...base, observaciones: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('marca visiblemente los remitos anulados', () => {
    expect(renderRemitoHtml({ ...base, estado: 'anulado' as const })).toMatch(/anulado/i);
  });

  it('no marca anulado un remito emitido', () => {
    expect(renderRemitoHtml(base)).not.toMatch(/anulado/i);
  });

  it('tolera campos opcionales nulos', () => {
    const html = renderRemitoHtml({
      ...base,
      domicilio_entrega: null,
      transportista: null,
      observaciones: null,
      cliente_nombre_completo: null,
    });
    expect(html).toContain('RE-0000001');
    expect(html).not.toContain('null');
  });
});

describe('remitoEditarHandler', () => {
  function emitirRemitoDePrueba(db: ReturnType<typeof setupDb>, userId: string) {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10, 5]);
    const { id: transportistaId } = transportistaUpsertHandler(db, { razon_social: 'Transporte Rex' });
    const { id: transportistaId2 } = transportistaUpsertHandler(db, { razon_social: 'Transporte Otro' });
    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: 'Domicilio original',
      transportista_id: transportistaId,
      lineas: [
        { venta_detalle_id: detalleIds[0], cantidad_entregada: 4 },
        { venta_detalle_id: detalleIds[1], cantidad_entregada: 3 },
      ],
    });
    const lineas = db.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, r.id)).all();
    return { r, ventaId, detalleIds, transportistaId, transportistaId2, lineas };
  }

  it('edita domicilio, transportista y cantidades de un remito emitido', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r, transportistaId2, lineas } = emitirRemitoDePrueba(db, userId);

    const editado = remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: 'Domicilio nuevo',
      transportista_id: transportistaId2,
      lineas: [
        { remito_linea_id: lineas[0].id, cantidad_entregada: 6 },
        { remito_linea_id: lineas[1].id, cantidad_entregada: 3 },
      ],
    });

    expect(editado.domicilio_entrega).toBe('Domicilio nuevo');
    expect(editado.transportista_id).toBe(transportistaId2);
    expect(editado.transportista).toBe('Transporte Otro');

    const lineasFinales = db.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, r.id)).all();
    expect(lineasFinales.find((l) => l.id === lineas[0].id)?.cantidad_entregada).toBe(6);
  });

  it('elimina la linea si la cantidad editada queda en 0', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r, transportistaId, lineas } = emitirRemitoDePrueba(db, userId);

    remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: 'Domicilio original',
      transportista_id: transportistaId,
      lineas: [
        { remito_linea_id: lineas[0].id, cantidad_entregada: 4 },
        { remito_linea_id: lineas[1].id, cantidad_entregada: 0 },
      ],
    });

    const lineasFinales = db.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, r.id)).all();
    expect(lineasFinales).toHaveLength(1);
    expect(lineasFinales[0].id).toBe(lineas[0].id);
  });

  it('rechaza si todas las lineas quedarian en 0', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r, transportistaId, lineas } = emitirRemitoDePrueba(db, userId);

    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: 'Domicilio original',
      transportista_id: transportistaId,
      lineas: [
        { remito_linea_id: lineas[0].id, cantidad_entregada: 0 },
        { remito_linea_id: lineas[1].id, cantidad_entregada: 0 },
      ],
    })).toThrow('REMITO_QUEDARIA_SIN_LINEAS');

    // No se aplico nada: las lineas originales siguen intactas.
    const lineasFinales = db.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, r.id)).all();
    expect(lineasFinales).toHaveLength(2);
  });

  it('no permite exceder lo pendiente de OTROS remitos (excluyendo el propio)', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r, transportistaId, lineas } = emitirRemitoDePrueba(db, userId);
    // linea 0: vendido 10, ya entregado 4 en este remito. Maximo editable = 10.

    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: 'Domicilio original',
      transportista_id: transportistaId,
      lineas: [
        { remito_linea_id: lineas[0].id, cantidad_entregada: 11 },
        { remito_linea_id: lineas[1].id, cantidad_entregada: 3 },
      ],
    })).toThrow(/EXCEDE_PENDIENTE/);
  });

  it('rechaza editar un remito conformado', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r, transportistaId, lineas } = emitirRemitoDePrueba(db, userId);
    remitoConformarHandler(db, { id: r.id, recibido_por: 'Juan' });

    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: 'Otro',
      transportista_id: transportistaId,
      lineas: [{ remito_linea_id: lineas[0].id, cantidad_entregada: 4 }],
    })).toThrow('ESTADO_INVALIDO:conformado');
  });

  it('rechaza editar un remito anulado', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r, transportistaId, lineas } = emitirRemitoDePrueba(db, userId);
    remitoAnularHandler(db, { id: r.id, motivo: 'Error' });

    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: 'Otro',
      transportista_id: transportistaId,
      lineas: [{ remito_linea_id: lineas[0].id, cantidad_entregada: 4 }],
    })).toThrow('ESTADO_INVALIDO:anulado');
  });

  it('rechaza domicilio vacio', () => {
    const { id: userId } = loginAsAdmin(db);
    const { r, transportistaId, lineas } = emitirRemitoDePrueba(db, userId);

    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: '  ',
      transportista_id: transportistaId,
      lineas: [{ remito_linea_id: lineas[0].id, cantidad_entregada: 4 }],
    })).toThrow('VALIDATION:domicilio_entrega:REQUERIDO');
  });

  it('rechaza una remito_linea_id que no pertenece al remito', () => {
    const { id: userId } = loginAsAdmin(db);
    const { transportistaId, lineas } = emitirRemitoDePrueba(db, userId);
    const otra = emitirRemitoDePrueba(db, userId); // otro remito, otras lineas

    expect(() => remitoEditarHandler(db, {
      id: otra.r.id,
      domicilio_entrega: 'Domicilio original',
      transportista_id: transportistaId,
      lineas: [{ remito_linea_id: lineas[0].id, cantidad_entregada: 1 }],
    })).toThrow('LINEA_NO_PERTENECE_AL_REMITO');
  });
});
