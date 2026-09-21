import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { crearVentaConfirmada } from './remito.helpers';
import {
  remitoCrearHandler,
  remitoEditarHandler,
  remitoConformarHandler,
  remitoAnularHandler,
} from '../remito';
import { transportistaUpsertHandler } from '../transportista';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let userId: string;

const DOMICILIO = 'Av. Siempreviva 742';

function unTransportista(razonSocial = 'Transporte Rex'): string {
  return transportistaUpsertHandler(db, { razon_social: razonSocial }).id;
}

beforeEach(() => {
  db = setupDb();
  clearSession();
  const admin = loginAsAdmin(db);
  userId = admin.id;
});
afterEach(() => { clearSession(); });

describe('remitoCrearHandler — validación de payload (ADR-085)', () => {
  it('rechaza transportista_id ausente (no-string)', () => {
    expect(() => remitoCrearHandler(db, {
      venta_id: 'v1',
      domicilio_entrega: 'x',
      lineas: [],
    } as any)).toThrow('VALIDATION:transportista_id:TIPO');
  });

  it('rechaza transportista_id vacío', () => {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: '',
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    } as any)).toThrow('VALIDATION:transportista_id:REQUERIDO');
  });

  it('rechaza venta_id ausente', () => {
    expect(() => remitoCrearHandler(db, {
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [],
    } as any)).toThrow('VALIDATION:venta_id:TIPO');
  });

  it('rechaza comprobante_id de tipo inválido', () => {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      comprobante_id: 5,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    } as any)).toThrow('VALIDATION:comprobante_id:TIPO');
  });

  it('rechaza domicilio_entrega vacío', () => {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: '  ',
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    } as any)).toThrow('VALIDATION:domicilio_entrega:REQUERIDO');
  });

  it('rechaza domicilio_entrega de tipo inválido', () => {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: 5,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    } as any)).toThrow('VALIDATION:domicilio_entrega:TIPO');
  });

  it('rechaza observaciones de tipo inválido', () => {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      observaciones: 5,
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 1 }],
    } as any)).toThrow('VALIDATION:observaciones:TIPO');
  });

  it('rechaza lineas ausente (no array)', () => {
    const { ventaId } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
    } as any)).toThrow('VALIDATION:lineas:TIPO');
  });

  it('rechaza venta_detalle_id ausente dentro de una linea', () => {
    const { ventaId } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ cantidad_entregada: 1 }],
    } as any)).toThrow('VALIDATION:lineas.0.venta_detalle_id:TIPO');
  });

  it('rechaza cantidad_entregada negativa dentro de una linea', () => {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: -1 }],
    } as any)).toThrow('VALIDATION:lineas.0.cantidad_entregada:MIN:0');
  });

  it('rechaza cantidad_entregada de tipo inválido dentro de una linea', () => {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    expect(() => remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 'x' }],
    } as any)).toThrow('VALIDATION:lineas.0.cantidad_entregada:TIPO');
  });

  it('acepta payload válido (happy path)', () => {
    const { ventaId, detalleIds, productoIds } = crearVentaConfirmada(db, userId, [10]);
    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 4 }],
    } as any);
    expect(r.numero).toBe('RE-0000001');
    expect(r.estado).toBe('emitido');
    const lineas = db.select().from(schema.remito_linea).all();
    expect(lineas[0].producto_id).toBe(productoIds[0]);
  });
});

describe('remitoEditarHandler — validación de payload (ADR-085)', () => {
  function emitirRemitoDePrueba() {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10, 5]);
    const transportistaId = unTransportista();
    const r = remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: transportistaId,
      lineas: [
        { venta_detalle_id: detalleIds[0], cantidad_entregada: 4 },
        { venta_detalle_id: detalleIds[1], cantidad_entregada: 3 },
      ],
    } as any);
    return { r, transportistaId };
  }

  it('rechaza id ausente', () => {
    expect(() => remitoEditarHandler(db, {
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [],
    } as any)).toThrow('VALIDATION:id:TIPO');
  });

  it('rechaza id vacío', () => {
    expect(() => remitoEditarHandler(db, {
      id: '',
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [],
    } as any)).toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza domicilio_entrega vacío', () => {
    const { r, transportistaId } = emitirRemitoDePrueba();
    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: '  ',
      transportista_id: transportistaId,
      lineas: [],
    } as any)).toThrow('VALIDATION:domicilio_entrega:REQUERIDO');
  });

  it('rechaza transportista_id vacío', () => {
    const { r } = emitirRemitoDePrueba();
    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: DOMICILIO,
      transportista_id: '',
      lineas: [],
    } as any)).toThrow('VALIDATION:transportista_id:REQUERIDO');
  });

  it('rechaza lineas ausente (no array)', () => {
    const { r, transportistaId } = emitirRemitoDePrueba();
    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: DOMICILIO,
      transportista_id: transportistaId,
    } as any)).toThrow('VALIDATION:lineas:TIPO');
  });

  it('rechaza remito_linea_id ausente dentro de una linea', () => {
    const { r, transportistaId } = emitirRemitoDePrueba();
    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: DOMICILIO,
      transportista_id: transportistaId,
      lineas: [{ cantidad_entregada: 1 }],
    } as any)).toThrow('VALIDATION:lineas.0.remito_linea_id:TIPO');
  });

  it('rechaza cantidad_entregada negativa dentro de una linea', () => {
    const { r, transportistaId } = emitirRemitoDePrueba();
    const lineas = db.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, r.id)).all();
    expect(() => remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: DOMICILIO,
      transportista_id: transportistaId,
      lineas: [{ remito_linea_id: lineas[0].id, cantidad_entregada: -1 }],
    } as any)).toThrow('VALIDATION:lineas.0.cantidad_entregada:MIN:0');
  });

  it('acepta payload válido (happy path)', () => {
    const { r, transportistaId } = emitirRemitoDePrueba();
    const lineas = db.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, r.id)).all();
    const editado = remitoEditarHandler(db, {
      id: r.id,
      domicilio_entrega: 'Domicilio nuevo',
      transportista_id: transportistaId,
      lineas: [
        { remito_linea_id: lineas[0].id, cantidad_entregada: 6 },
        { remito_linea_id: lineas[1].id, cantidad_entregada: 3 },
      ],
    } as any);
    expect(editado.domicilio_entrega).toBe('Domicilio nuevo');
  });
});

describe('remitoConformarHandler — validación de payload (ADR-085)', () => {
  function emitirRemito() {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    return remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 3 }],
    } as any);
  }

  it('rechaza id ausente', () => {
    expect(() => remitoConformarHandler(db, { recibido_por: 'Juan' } as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('rechaza id vacío', () => {
    expect(() => remitoConformarHandler(db, { id: '', recibido_por: 'Juan' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza recibido_por de tipo inválido', () => {
    const r = emitirRemito();
    expect(() => remitoConformarHandler(db, { id: r.id, recibido_por: 5 } as any))
      .toThrow('VALIDATION:recibido_por:TIPO');
  });

  it('sigue exigiendo recibido_por (regla de negocio, no de forma)', () => {
    const r = emitirRemito();
    expect(() => remitoConformarHandler(db, { id: r.id, recibido_por: '  ' } as any))
      .toThrow('RECIBIDO_POR_REQUERIDO');
  });

  it('acepta payload válido (happy path)', () => {
    const r = emitirRemito();
    const out = remitoConformarHandler(db, { id: r.id, recibido_por: 'Juan Perez' } as any);
    expect(out.estado).toBe('conformado');
    expect(out.recibido_por).toBe('Juan Perez');
  });
});

describe('remitoAnularHandler — validación de payload (ADR-085)', () => {
  function emitirRemito() {
    const { ventaId, detalleIds } = crearVentaConfirmada(db, userId, [10]);
    return remitoCrearHandler(db, {
      venta_id: ventaId,
      domicilio_entrega: DOMICILIO,
      transportista_id: unTransportista(),
      lineas: [{ venta_detalle_id: detalleIds[0], cantidad_entregada: 3 }],
    } as any);
  }

  it('rechaza id ausente', () => {
    expect(() => remitoAnularHandler(db, { motivo: 'x' } as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('rechaza id vacío', () => {
    expect(() => remitoAnularHandler(db, { id: '', motivo: 'x' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza motivo de tipo inválido', () => {
    const r = emitirRemito();
    expect(() => remitoAnularHandler(db, { id: r.id, motivo: 5 } as any))
      .toThrow('VALIDATION:motivo:TIPO');
  });

  it('sigue exigiendo motivo (regla de negocio, no de forma)', () => {
    const r = emitirRemito();
    expect(() => remitoAnularHandler(db, { id: r.id, motivo: '  ' } as any))
      .toThrow('MOTIVO_REQUERIDO');
  });

  it('acepta payload válido (happy path)', () => {
    const r = emitirRemito();
    const out = remitoAnularHandler(db, { id: r.id, motivo: 'Error de carga' } as any);
    expect(out.estado).toBe('anulado');
    expect(out.motivo_anulacion).toBe('Error de carga');
  });
});
