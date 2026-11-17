import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { setupCoreDb, loginAsAdmin, clearSession } from './testing/helpers';
import { leerParametro, escribirParametro } from './configuracion';
import { parametrosGetHandler, parametrosSetHandler, parametrosListFlagsHandler } from './ipc/parametros';
import { invalidateCachedParametro } from './ipc/parametros-cache';

// ADR-155 §1 (F1 PR7): la configuración del negocio vive en `configuracion_negocio` (sincroniza) y
// la de la terminal en `parametros_sistema` (local). Un solo acceso para las dos.
describe('configuración del negocio y de la terminal', () => {
  let db: ReturnType<typeof setupCoreDb>;
  const negocio = (id: string) => db.select().from(schema.configuracion_negocio)
    .where(eq(schema.configuracion_negocio.id, id)).get();
  const local = (clave: string) => db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();

  beforeEach(() => {
    db = setupCoreDb();
    clearSession();
    invalidateCachedParametro();
    const now = new Date();
    db.insert(schema.configuracion_negocio).values([
      { id: 'umbral_diferencia_caja', valor: '50000', tipo: 'number', origin_id: 'C1', sync_state: 'synced', updated_at: now },
      { id: 'remitos_habilitado', valor: 'true', tipo: 'bool', descripcion: 'Remitos (ADR-045)', origin_id: 'C1', sync_state: 'synced', updated_at: now },
    ]).run();
    db.insert(schema.parametros_sistema).values([
      { clave: 'backup_auto_habilitado', valor: 'false', tipo: 'bool', descripcion: 'Backup al cerrar caja' },
      { clave: 'venta_correlativo_C1', valor: '7', tipo: 'number' },
    ]).run();
  });

  it('leerParametro busca primero en la configuración del negocio y después en la de la terminal', () => {
    expect(leerParametro(db, 'umbral_diferencia_caja')).toBe('50000');
    expect(leerParametro(db, 'venta_correlativo_C1')).toBe('7');
    expect(leerParametro(db, 'no_existe')).toBeNull();
  });

  it('escribirParametro actualiza la tabla donde vive la clave; en el negocio sube versión y queda pending', () => {
    escribirParametro(db, 'umbral_diferencia_caja', '60000', 'u-1');
    expect(negocio('umbral_diferencia_caja')).toMatchObject({
      valor: '60000', version: 2, sync_state: 'pending', usuario_modificacion_id: 'u-1',
    });
    escribirParametro(db, 'venta_correlativo_C1', '8');
    expect(local('venta_correlativo_C1')?.valor).toBe('8');
    expect(local('umbral_diferencia_caja')).toBeUndefined();
  });

  it('una clave desconocida se crea en la terminal (los correlativos nacen así)', () => {
    escribirParametro(db, 'remito_correlativo_C2', '1');
    expect(local('remito_correlativo_C2')?.valor).toBe('1');
    expect(negocio('remito_correlativo_C2')).toBeUndefined();
  });

  it('los handlers IPC leen, escriben y listan flags de las dos tablas', () => {
    loginAsAdmin(db);
    expect(parametrosGetHandler(db, { clave: 'remitos_habilitado' })).toBe('true');
    parametrosSetHandler(db, { clave: 'remitos_habilitado', valor: 'false' });
    expect(parametrosGetHandler(db, { clave: 'remitos_habilitado' })).toBe('false'); // invalida la caché
    expect(negocio('remitos_habilitado')?.version).toBe(2);
    expect(parametrosListFlagsHandler(db).map((f) => [f.clave, f.valor])).toEqual([
      ['backup_auto_habilitado', 'false'],
      ['remitos_habilitado', 'false'],
    ]);
    expect(parametrosListFlagsHandler(db)[1].descripcion).toBe('Remitos');
  });
});
