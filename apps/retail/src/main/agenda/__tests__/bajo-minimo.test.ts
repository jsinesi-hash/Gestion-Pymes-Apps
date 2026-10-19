import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import { setupDb } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { productosBajoMinimo } from '../bajo-minimo';

let seq = 1;
function sembrar(db: ReturnType<typeof setupDb>, nombre: string, fisico: number, minimo: number, activo = true) {
  const now = new Date();
  let cat = db.select().from(schema.categoria).get();
  if (!cat) {
    const catId = generateId();
    db.insert(schema.categoria).values({ id: catId, nombre: 'Test', usuario_creacion_id: 'u1', fecha_creacion: now, origin_id: 't', updated_at: now } as any).run();
    cat = db.select().from(schema.categoria).where(eq(schema.categoria.id, catId)).get();
  }
  const pid = generateId();
  db.insert(schema.producto).values({ id: pid, sku: `SKU-${nombre}`, sku_secuencial: seq++, nombre_corto: nombre, nombre_largo: nombre, unidad_venta: 'u', categoria_id: cat!.id, activo, usuario_creacion_id: 'u1', fecha_creacion: now, origin_id: 't', updated_at: now } as any).run();
  db.insert(schema.existencias).values({ id: generateId(), producto_id: pid, stock_fisico: fisico, stock_minimo: minimo, origin_id: 't', updated_at: now } as any).run();
  return pid;
}

describe('productosBajoMinimo', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); });

  it('incluye stock <= minimo (borde incluido) y excluye los que estan por encima', () => {
    sembrar(db, 'Igual', 5, 5);
    sembrar(db, 'Debajo', 2, 5);
    sembrar(db, 'Encima', 6, 5);
    expect(productosBajoMinimo(db).map((p) => p.nombre_corto).sort()).toEqual(['Debajo', 'Igual']);
  });

  it('excluye productos con stock_minimo = 0', () => {
    sembrar(db, 'SinMinimo', 0, 0);
    expect(productosBajoMinimo(db)).toEqual([]);
  });

  it('excluye productos inactivos', () => {
    sembrar(db, 'Inactivo', 1, 5, false);
    sembrar(db, 'Activo', 1, 5, true);
    expect(productosBajoMinimo(db).map((p) => p.nombre_corto)).toEqual(['Activo']);
  });

  it('marca agotado cuando stock_fisico <= 0', () => {
    sembrar(db, 'Cero', 0, 5);
    sembrar(db, 'Negativo', -1, 5);
    sembrar(db, 'Poco', 1, 5);
    const r = Object.fromEntries(productosBajoMinimo(db).map((p) => [p.nombre_corto, p.agotado]));
    expect(r).toEqual({ Cero: true, Negativo: true, Poco: false });
  });

  it('ordena por faltante descendente y expone el faltante', () => {
    sembrar(db, 'A', 4, 5);   // faltante 1
    sembrar(db, 'B', 0, 10);  // faltante 10
    sembrar(db, 'C', 3, 8);   // faltante 5
    const r = productosBajoMinimo(db);
    expect(r.map((p) => p.nombre_corto)).toEqual(['B', 'C', 'A']);
    expect(r.map((p) => p.faltante)).toEqual([10, 5, 1]);
  });

  it('devuelve producto_id y sku', () => {
    const pid = sembrar(db, 'X', 1, 5);
    const [p] = productosBajoMinimo(db);
    expect(p.producto_id).toBe(pid);
    expect(p.sku).toBe('SKU-X');
  });
});
