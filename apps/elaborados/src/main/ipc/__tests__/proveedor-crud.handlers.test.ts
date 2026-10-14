import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  proveedorListHandler, proveedorGetHandler, proveedorUpsertHandler, proveedorDeactivateHandler,
} from '@core/main';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { PERMISOS_ELABORADOS } from '../../auth/seed';

type Db = ReturnType<typeof setupDb>;

const BASE = {
  razon_social: 'Lácteos SA', tipo_documento: 'CUIT', numero_documento: '30111111118',
  condicion_fiscal: 'Responsable Inscripto', telefono: '11-5555', email: 'v@lacteos.com',
};

// CRUD universal de proveedor (ADR-106): lo ejercita Elaborados sin hooks.
describe('proveedor CRUD del core en Elaborados', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('el permiso proveedor.gestionar es del core: el Supervisor lo tiene y no hace falta en el seed de la app', () => {
    const s = loginAsAdmin(db);
    expect(s.permisos).toContain('proveedor.gestionar');
    expect(PERMISOS_ELABORADOS.map((p) => p.codigo)).not.toContain('proveedor.gestionar');
  });

  it('alta con código PROV-NNNN correlativo, edición, lectura y baja lógica', () => {
    loginAsAdmin(db);
    const { id } = proveedorUpsertHandler(db, BASE);
    const { id: id2 } = proveedorUpsertHandler(db, { ...BASE, razon_social: 'Dulces SRL' });
    expect(proveedorGetHandler(db, id)).toMatchObject({ codigo: 'PROV-0001', razon_social: 'Lácteos SA', activo: true });
    expect(proveedorGetHandler(db, id2)).toMatchObject({ codigo: 'PROV-0002' });

    proveedorUpsertHandler(db, { ...BASE, id, razon_social: 'Lácteos del Sur', persona_contacto: 'Ana' });
    expect(proveedorGetHandler(db, id)).toMatchObject({ razon_social: 'Lácteos del Sur', persona_contacto: 'Ana', version: 1, codigo: 'PROV-0001' });

    proveedorDeactivateHandler(db, id);
    expect(proveedorListHandler(db).map((p) => p.razon_social)).toEqual(['Dulces SRL']);
    expect(proveedorGetHandler(db, id)).toMatchObject({ activo: false });
  });

  it('valida en el borde (razón social, documento, condición) y exige sesión', () => {
    expect(() => proveedorUpsertHandler(db, BASE)).toThrow('UNAUTHENTICATED');
    loginAsAdmin(db);
    expect(() => proveedorUpsertHandler(db, { ...BASE, razon_social: ' ' })).toThrow('VALIDATION:razon_social');
    expect(() => proveedorUpsertHandler(db, { ...BASE, tipo_documento: 'PASAPORTE' })).toThrow('VALIDATION:tipo_documento');
    expect(() => proveedorUpsertHandler(db, { ...BASE, condicion_fiscal: 'Otro' })).toThrow('VALIDATION:condicion_fiscal');
  });

  it('hook onProveedorActualizado: se llama al editar con cambioDefaults según corresponda; un error del hook no rompe', () => {
    loginAsAdmin(db);
    const { id } = proveedorUpsertHandler(db, BASE);
    const hook = vi.fn();
    proveedorUpsertHandler(db, { ...BASE, id, telefono: '11-0000' }, { onProveedorActualizado: hook });
    expect(hook).toHaveBeenLastCalledWith(expect.anything(), { id, userId: expect.any(String), cambioDefaults: false });
    proveedorUpsertHandler(db, { ...BASE, id, flete_pct_default: 5 }, { onProveedorActualizado: hook });
    expect(hook).toHaveBeenLastCalledWith(expect.anything(), { id, userId: expect.any(String), cambioDefaults: true });

    const roto = vi.fn(() => { throw new Error('boom'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => proveedorUpsertHandler(db, { ...BASE, id, flete_pct_default: 7 }, { onProveedorActualizado: roto })).not.toThrow();
    expect(proveedorGetHandler(db, id)).toMatchObject({ flete_pct_default: 7 });
    spy.mockRestore();
  });

  it('en el alta el hook no se llama (solo al actualizar)', () => {
    loginAsAdmin(db);
    const hook = vi.fn();
    proveedorUpsertHandler(db, BASE, { onProveedorActualizado: hook });
    expect(hook).not.toHaveBeenCalled();
  });
});
