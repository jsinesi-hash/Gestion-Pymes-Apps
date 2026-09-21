import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { ubicacionCreateHandler } from '../ubicacion';
import { printProductLabelHandler, printLocationLabelHandler } from '../print';
import type { IPrintService, ProductLabelData, LocationLabelData, PrintFormat } from '../../../print/types';

function makeMockService() {
  const calls: { method: string; data: ProductLabelData | LocationLabelData; format: PrintFormat }[] = [];
  const svc: IPrintService = {
    async printProductLabel(data, format) { calls.push({ method: 'product', data, format }); },
    async printLocationLabel(data, format) { calls.push({ method: 'location', data, format }); },
    async printRawHtml() {},
  };
  return { svc, calls };
}

type Db = ReturnType<typeof setupDb>;

describe('print handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('printProductLabelHandler pasa nombre, sku al servicio (codigoQr = sku, ADR-025)', async () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat = categoriaCreateHandler(db, { nombre: 'T' });
    const imp = db.select().from(schema.impuesto).all()[0];
    const p = productoCreateHandler(db, {
      nombre_corto: 'Taladro', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 1500,
    });
    const { svc, calls } = makeMockService();
    await printProductLabelHandler(db, { id: p.id, format: 'label' }, svc);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('product');
    expect((calls[0].data as ProductLabelData).nombre).toBe('Taladro');
    expect((calls[0].data as ProductLabelData).codigoQr).toBe(p.sku);
    expect((calls[0].data as ProductLabelData).sku).toBe(p.sku);
    expect(calls[0].format).toBe('label');
  });

  it('printLocationLabelHandler pasa codigo al servicio', async () => {
    loginAsAdmin(db);
    const ub = ubicacionCreateHandler(db, { sector: 'A', estante: '01', posicion: '01', descripcion: 'Entrada' });
    const { svc, calls } = makeMockService();
    await printLocationLabelHandler(db, { id: ub.id, format: 'label' }, svc);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('location');
    expect((calls[0].data as LocationLabelData).codigo).toBe('A-1-1');
  });
});
