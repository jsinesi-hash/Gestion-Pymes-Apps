import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import * as schema from '../../db/schema';
import { generateId } from '@ferreteria/shared';
import { getOriginId } from '../../context';
import {
  ubicacionListHandler, ubicacionGetHandler, ubicacionCreateHandler,
  ubicacionUpdateHandler, ubicacionDeleteHandler, ubicacionListAllHandler,
  ubicacionDedupPreviewHandler, ubicacionDedupAplicarHandler,
} from '../ubicacion';

describe('ubicacion handlers — alta canónica (ADR-064)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('crea ubicación guardando la forma canónica (01 -> 1)', () => {
    loginAsAdmin(db);
    const ub = ubicacionCreateHandler(db, { sector: 'A', estante: '01', posicion: '01' });
    expect(ub.codigo).toBe('A-1-1');
    expect(ub.sector).toBe('A');
    expect(ub.estante).toBe('1');
    expect(ub.posicion).toBe('1');
  });

  it('lista ubicaciones activas', () => {
    loginAsAdmin(db);
    ubicacionCreateHandler(db, { sector: 'A', estante: '01', posicion: '01' });
    ubicacionCreateHandler(db, { sector: 'B', estante: '01', posicion: '01' });
    expect(ubicacionListHandler(db)).toHaveLength(2);
  });

  it('get por id retorna ubicación', () => {
    loginAsAdmin(db);
    const ub = ubicacionCreateHandler(db, { sector: 'C', estante: '02', posicion: '03' });
    expect(ubicacionGetHandler(db, { id: ub.id })?.codigo).toBe('C-2-3');
  });

  it('actualiza descripción', () => {
    loginAsAdmin(db);
    const ub = ubicacionCreateHandler(db, { sector: 'D', estante: '01', posicion: '01' });
    const updated = ubicacionUpdateHandler(db, { id: ub.id, descripcion: 'Frente' });
    expect(updated.descripcion).toBe('Frente');
  });

  it('rechaza el duplicado canónico (A-0-1 vs A-0-01) con YA_EXISTE', () => {
    loginAsAdmin(db);
    ubicacionCreateHandler(db, { sector: 'A', estante: '0', posicion: '1' });
    expect(() =>
      ubicacionCreateHandler(db, { sector: 'A', estante: '0', posicion: '01' }),
    ).toThrow(/YA_EXISTE:A-0-1/);
  });
});

function crearProductoEn(db: ReturnType<typeof setupDb>, ubicacionId: string, sku: string) {
  const now = new Date();
  let cat = db.select().from(schema.categoria).limit(1).get();
  if (!cat) {
    const cid = generateId();
    db.insert(schema.categoria).values({
      id: cid, nombre: 'Cat', activo: true, usuario_creacion_id: 'u',
      fecha_creacion: now, version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
    }).run();
    cat = db.select().from(schema.categoria).where(eq(schema.categoria.id, cid)).get()!;
  }
  db.insert(schema.producto).values({
    id: generateId(), sku, sku_secuencial: 1, nombre_corto: sku, nombre_largo: sku,
    unidad_venta: 'u', categoria_id: cat.id, ubicacion_id: ubicacionId, activo: true,
    usuario_creacion_id: 'u', fecha_creacion: now, version: 1, origin_id: getOriginId(),
    sync_state: 'pending', updated_at: now,
  }).run();
}

describe('ubicacion delete — baja lógica + reasignación (ADR-064 L2)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); clearSession(); loginAsAdmin(db); });

  it('sin productos: baja lógica (activo=false)', () => {
    const ub = ubicacionCreateHandler(db, { sector: 'A', estante: '1', posicion: '1' });
    ubicacionDeleteHandler(db, { id: ub.id });
    const row = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, ub.id)).get()!;
    expect(row.activo).toBe(false);
  });

  it('con productos y sin destino: arroja TIENE_PRODUCTOS:N', () => {
    const ub = ubicacionCreateHandler(db, { sector: 'B', estante: '1', posicion: '1' });
    crearProductoEn(db, ub.id, 'P-1');
    expect(() => ubicacionDeleteHandler(db, { id: ub.id })).toThrow(/TIENE_PRODUCTOS:1/);
  });

  it('con productos reasignando a otra ubicación: mueve y da de baja', () => {
    const origen = ubicacionCreateHandler(db, { sector: 'C', estante: '1', posicion: '1' });
    const destino = ubicacionCreateHandler(db, { sector: 'C', estante: '1', posicion: '2' });
    crearProductoEn(db, origen.id, 'P-2');
    ubicacionDeleteHandler(db, { id: origen.id, reasignarA: destino.id });
    const prod = db.select().from(schema.producto).where(eq(schema.producto.sku, 'P-2')).get()!;
    expect(prod.ubicacion_id).toBe(destino.id);
    const row = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, origen.id)).get()!;
    expect(row.activo).toBe(false);
  });

  it('reasignando a null: deja productos sin ubicación', () => {
    const ub = ubicacionCreateHandler(db, { sector: 'D', estante: '1', posicion: '1' });
    crearProductoEn(db, ub.id, 'P-3');
    ubicacionDeleteHandler(db, { id: ub.id, reasignarA: null });
    const prod = db.select().from(schema.producto).where(eq(schema.producto.sku, 'P-3')).get()!;
    expect(prod.ubicacion_id).toBeNull();
  });

  it('listAll incluye activas e inactivas', () => {
    const ub = ubicacionCreateHandler(db, { sector: 'E', estante: '1', posicion: '1' });
    ubicacionDeleteHandler(db, { id: ub.id });
    const all = ubicacionListAllHandler(db);
    expect(all.some(u => u.id === ub.id && u.activo === false)).toBe(true);
  });
});

function insertarUbicacionCruda(db: ReturnType<typeof setupDb>, codigo: string, sector: string, estante: string, posicion: string) {
  const now = new Date();
  const id = generateId();
  db.insert(schema.ubicacion).values({
    id, codigo, sector, estante, posicion, descripcion: null, activo: true,
    usuario_creacion_id: 'u', fecha_creacion: now, version: 1,
    origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
  }).run();
  return id;
}

describe('ubicacion dedup (ADR-064 L3)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); clearSession(); loginAsAdmin(db); });

  it('preview agrupa A-0-1 y A-0-01 en un grupo con sobreviviente canónico', () => {
    const canonId = insertarUbicacionCruda(db, 'A-0-1', 'A', '0', '1');
    insertarUbicacionCruda(db, 'A-0-01', 'A', '0', '01');
    const grupos = ubicacionDedupPreviewHandler(db);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigo).toBe('A-0-1');
    expect(grupos[0].sobreviviente.id).toBe(canonId);
    expect(grupos[0].duplicados.map(d => d.codigo)).toEqual(['A-0-01']);
  });

  it('aplicar reasigna productos al sobreviviente y da de baja el duplicado', () => {
    const canonId = insertarUbicacionCruda(db, 'A-0-1', 'A', '0', '1');
    const dupId = insertarUbicacionCruda(db, 'A-0-01', 'A', '0', '01');
    crearProductoEn(db, dupId, 'P-DUP');
    ubicacionDedupAplicarHandler(db);
    const prod = db.select().from(schema.producto).where(eq(schema.producto.sku, 'P-DUP')).get()!;
    expect(prod.ubicacion_id).toBe(canonId);
    const dup = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, dupId)).get()!;
    expect(dup.activo).toBe(false);
    const canon = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, canonId)).get()!;
    expect(canon.activo).toBe(true);
  });

  it('sin ninguna fila canónica, elige la de más productos y la reescribe a canónica', () => {
    const aId = insertarUbicacionCruda(db, 'A-0-01', 'A', '0', '01');
    const bId = insertarUbicacionCruda(db, 'A-0-001', 'A', '0', '001');
    crearProductoEn(db, bId, 'P-B1');
    crearProductoEn(db, bId, 'P-B2'); // b tiene más productos -> sobrevive
    ubicacionDedupAplicarHandler(db);
    const b = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, bId)).get()!;
    expect(b.activo).toBe(true);
    expect(b.codigo).toBe('A-0-1');
    const a = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, aId)).get()!;
    expect(a.activo).toBe(false);
  });
});
