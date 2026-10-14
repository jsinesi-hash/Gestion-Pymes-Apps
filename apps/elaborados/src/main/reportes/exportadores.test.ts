import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearExportarEjecutar, EXPORTADORES_CORE, cajaAbrirHandler } from '@core/main';
import { setupDb, loginAsAdmin, clearSession } from '../__tests__/helpers';
import { CONSUMIDOR_FINAL_ID } from '../catalog/seed';
import { catalogo } from '../ipc/__tests__/ventaFixtures';
import { ventaConfirmarHandler } from '../ipc/venta';
import { EXPORTADORES_REPORTES, rangoExport } from './exportadores';

type Db = ReturnType<typeof setupDb>;

describe('exportadores de reportes', () => {
  let db: Db;
  const archivo = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rep-')), 'salida.csv');
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('se registran junto a los del core sin entidades duplicadas', () => {
    expect(() => crearExportarEjecutar([...EXPORTADORES_CORE, ...EXPORTADORES_REPORTES])).not.toThrow();
  });

  it('rangoExport: filtrado usa el período; todo cubre el historial', () => {
    expect(rangoExport({ entidad: 'x', perfilId: 'completo', formato: 'csv', alcance: 'filtrado', filtros: { desde: '2026-01-01', hasta: '2026-01-31' } }))
      .toEqual({ desde: '2026-01-01', hasta: '2026-01-31' });
    expect(rangoExport({ entidad: 'x', perfilId: 'completo', formato: 'csv', alcance: 'todo' }).desde).toBe('2000-01-01');
  });

  it('exporta ventas por producto a CSV en pesos', async () => {
    loginAsAdmin(db);
    const c = catalogo(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
      lineas: [{ producto_venta_id: c.palito.id, cantidad: 2 }],
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 200000 }],
    });
    const ejecutar = crearExportarEjecutar([...EXPORTADORES_CORE, ...EXPORTADORES_REPORTES]);
    const f = archivo();
    await ejecutar(db as never, { entidad: 'reporte_ventas_producto', perfilId: 'completo', formato: 'csv', alcance: 'todo' }, f);
    const csv = fs.readFileSync(f, 'utf8');
    expect(csv).toContain('Producto');
    expect(csv).toMatch(/Palito.*2.*2000,00/);
  });

  it('exige el permiso de exportación y sesión', async () => {
    const ejecutar = crearExportarEjecutar([...EXPORTADORES_REPORTES]);
    await expect(ejecutar(db as never, { entidad: 'reporte_sabores', perfilId: 'completo', formato: 'csv', alcance: 'todo' }, archivo()))
      .rejects.toThrow('UNAUTHENTICATED');
  });
});
