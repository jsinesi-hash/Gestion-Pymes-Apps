import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb } from '../../ipc/__tests__/helpers';
import { reservarSku } from '../sku';

// ADR-154 §2: el SKU conserva su formato y sale de un bloque local de la terminal.
describe('reservarSku', () => {
  let db: ReturnType<typeof setupDb>;
  const param = (clave: string) => db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get()?.valor;
  const fijar = (clave: string, valor: string) => db.insert(schema.parametros_sistema)
    .values({ clave, valor, tipo: 'number', actualizado_en: new Date() })
    .onConflictDoUpdate({ target: schema.parametros_sistema.clave, set: { valor } }).run();

  beforeEach(() => { db = setupDb(); });

  it('en standalone (sin bloque) reserva correlativos y avanza el contador, como siempre', () => {
    const inicial = Number(param('sku_proximo_secuencial'));
    const a = db.transaction((tx) => reservarSku(tx));
    const b = db.transaction((tx) => reservarSku(tx));
    expect(a.secuencial).toBe(inicial);
    expect(b.secuencial).toBe(inicial + 1);
    expect(a.sku).toMatch(/^P-\d{7}-\d$/);
    expect(param('sku_proximo_secuencial')).toBe(String(inicial + 2));
  });

  it('con un bloque asignado, reserva hasta su último número inclusive', () => {
    fijar('sku_proximo_secuencial', '1000');
    fijar('sku_bloque_hasta', '1001');
    expect(db.transaction((tx) => reservarSku(tx)).secuencial).toBe(1000);
    expect(db.transaction((tx) => reservarSku(tx)).secuencial).toBe(1001);
  });

  it('sin números en el bloque lanza SKU_SIN_BLOQUE y no avanza el contador', () => {
    fijar('sku_proximo_secuencial', '1002');
    fijar('sku_bloque_hasta', '1001');
    expect(() => db.transaction((tx) => reservarSku(tx))).toThrow('SKU_SIN_BLOQUE');
    expect(param('sku_proximo_secuencial')).toBe('1002');
  });

  it('al agotar el bloque sigue con el siguiente que el hub dio por adelantado (F2 PR5)', () => {
    fijar('sku_proximo_secuencial', '1001');
    fijar('sku_bloque_hasta', '1001');
    fijar('sku_bloque_siguiente', '3000-3999');
    expect(db.transaction((tx) => reservarSku(tx)).secuencial).toBe(1001);
    const siguiente = db.transaction((tx) => reservarSku(tx));
    expect(siguiente).toMatchObject({ secuencial: 3000, sku: expect.stringMatching(/^P-0003000-\d$/) });
    expect([param('sku_proximo_secuencial'), param('sku_bloque_hasta'), param('sku_bloque_siguiente')]).toEqual(['3001', '3999', undefined]);
  });
});
