import { describe, it, expect, beforeEach } from 'vitest';
import { generateId } from '@ferreteria/shared';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { proveedorUpsertHandler } from '../proveedor';
import { dashboardProveedoresRangoHandler, dashboardProveedoresEstadoHandler } from '../dashboard-proveedores';

type Db = ReturnType<typeof setupDb>;

function todayRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    hasta: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function crearProveedor(db: Db, razon: string) {
  return proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT',
    numero_documento: `${Math.floor(Math.random() * 90000000) + 10000000}`,
    razon_social: razon,
    condicion_fiscal: 'Responsable Inscripto',
  });
}

function insertOCEstado(db: Db, provId: string, estado: string, tipo = 'manual') {
  const now = new Date();
  const userId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
  db.insert(schema.orden_compra).values({
    id: generateId(),
    numero_interno: `OC-C1-${Math.floor(Math.random() * 100000)}`,
    proveedor_id: provId, tipo: tipo as any, estado: estado as any,
    fecha: now, subtotal_centavos: 0, importe_iva_centavos: 0, total_centavos: 0,
    usuario_id: userId, usuario_creacion_id: userId, fecha_creacion: now,
    version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
  }).run();
}

describe('dashboardProveedoresRangoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin OCs devuelve ranking vacío', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardProveedoresRangoHandler(db, { desde, hasta });
    expect(r.ranking).toHaveLength(0);
  });
});

describe('dashboardProveedoresEstadoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin OCs devuelve todo en cero', () => {
    loginAsAdmin(db);
    const r = dashboardProveedoresEstadoHandler(db);
    expect(r.ocs_pendientes).toBe(0);
    expect(r.ocs_sugeridas_sin_resolver).toBe(0);
  });

  it('ocs_pendientes cuenta estados emitida y recibida_parcial', () => {
    loginAsAdmin(db);
    const prov = crearProveedor(db, 'Prov Test');
    insertOCEstado(db, prov.id, 'emitida');
    insertOCEstado(db, prov.id, 'recibida_parcial');
    insertOCEstado(db, prov.id, 'recibida_total'); // no cuenta
    const r = dashboardProveedoresEstadoHandler(db);
    expect(r.ocs_pendientes).toBe(2);
  });

  it('ocs_sugeridas_sin_resolver cuenta tipo sugerida en estados no finales', () => {
    loginAsAdmin(db);
    const prov = crearProveedor(db, 'Prov S');
    insertOCEstado(db, prov.id, 'borrador', 'sugerida');
    insertOCEstado(db, prov.id, 'emitida', 'sugerida');
    insertOCEstado(db, prov.id, 'recibida_total', 'sugerida'); // no cuenta
    insertOCEstado(db, prov.id, 'cerrada', 'sugerida');        // no cuenta
    insertOCEstado(db, prov.id, 'anulada', 'sugerida');        // no cuenta
    const r = dashboardProveedoresEstadoHandler(db);
    expect(r.ocs_sugeridas_sin_resolver).toBe(2);
  });

  it('ocs_pendientes no cuenta borrador ni cerrada ni anulada', () => {
    loginAsAdmin(db);
    const prov = crearProveedor(db, 'Prov X');
    insertOCEstado(db, prov.id, 'borrador');
    insertOCEstado(db, prov.id, 'cerrada');
    insertOCEstado(db, prov.id, 'anulada');
    const r = dashboardProveedoresEstadoHandler(db);
    expect(r.ocs_pendientes).toBe(0);
  });
});
