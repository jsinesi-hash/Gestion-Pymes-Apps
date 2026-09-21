import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler } from '../../ipc/producto';
import * as schema from '../../db/schema';
import { rederivarNombreCortoNorm } from '../backfill';

type Db = ReturnType<typeof setupDb>;

function crearProducto(db: Db, nombre_corto: string) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat re-deriv' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, {
    nombre_corto, categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'unidad', precio_venta_lista: 5000,
  });
}

describe('rederivarNombreCortoNorm (enmienda ADR-063/067 — one-shot guardado por versión)', () => {
  it('recomputa nombre_corto_norm stale y lo deja con la unidad pegada', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const p = crearProducto(db, 'Tornillo 8 mm');
    // Simula el valor stale que dejó la normalizar() anterior (unidad separada).
    db.update(schema.producto).set({ nombre_corto_norm: 'tornillo 8 mm' })
      .where(eq(schema.producto.id, p.id)).run();

    const total = db.select().from(schema.producto).all().length;
    const n = rederivarNombreCortoNorm(db);
    expect(n).toBe(total); // re-deriva TODOS los productos una vez

    const row = db.select().from(schema.producto).where(eq(schema.producto.id, p.id)).get()!;
    expect(row.nombre_corto_norm).toBe('tornillo 8mm');
  });

  it('sube la clave de versión y es idempotente en la segunda corrida', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    crearProducto(db, 'Tornillo 8 mm');

    const n1 = rederivarNombreCortoNorm(db);
    expect(n1).toBeGreaterThan(0);

    const ver = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'nombre_norm_version')).get();
    expect(ver?.valor).toBe('2');

    // Segunda corrida: versión ya al día → no toca nada.
    expect(rederivarNombreCortoNorm(db)).toBe(0);
  });
});
