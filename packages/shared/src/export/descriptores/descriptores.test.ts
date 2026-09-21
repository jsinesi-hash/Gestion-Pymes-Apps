import { describe, it, expect } from 'vitest';
import { exportStock } from './stock';
import { exportUbicaciones } from './ubicaciones';
import { exportProveedores } from './proveedores';
import { exportClientes } from './clientes';
import { exportVentas } from './ventas';
import { exportCaja } from './caja';

describe('exportStock', () => {
  it('tiene 2 perfiles', () => { expect(exportStock.perfiles).toHaveLength(2); });
  it('existencias es export.basico', () => {
    expect(exportStock.perfiles.find(p => p.id === 'existencias')!.permiso).toBe('export.basico');
  });
  it('valorizado es export.supervisor', () => {
    expect(exportStock.perfiles.find(p => p.id === 'valorizado')!.permiso).toBe('export.supervisor');
  });
  it('valor total en valorizado multiplica costo por stock', () => {
    const col = exportStock.perfiles.find(p => p.id === 'valorizado')!
      .columnas.find(c => c.label === 'Valor total')!;
    expect(col.formatoXlsx!(100, { stock_fisico: 3 } as any)).toBe(300);
  });
});

describe('exportUbicaciones', () => {
  it('tiene 1 perfil y permiso export.basico', () => {
    expect(exportUbicaciones.perfiles).toHaveLength(1);
    expect(exportUbicaciones.permiso).toBe('export.basico');
  });
  it('columna cantidad_productos tiene formatoXlsx numérico', () => {
    const col = exportUbicaciones.perfiles[0].columnas.find(c => c.campo === 'cantidad_productos')!;
    expect(col.formatoXlsx!(5, {} as any)).toBe(5);
  });
});

describe('exportProveedores', () => {
  it('permiso entidad es export.supervisor', () => {
    expect(exportProveedores.permiso).toBe('export.supervisor');
  });
});

describe('exportClientes', () => {
  it('permiso entidad es export.supervisor', () => {
    expect(exportClientes.permiso).toBe('export.supervisor');
  });
  it('columna saldo_cuenta formatea pesos con coma', () => {
    const col = exportClientes.perfiles[0].columnas.find(c => c.campo === 'saldo_cuenta')!;
    expect(col.formato!(100.5, {} as any)).toBe('100,50');
  });
});

describe('exportVentas', () => {
  it('tiene perfiles resumen y detallado', () => {
    const ids = exportVentas.perfiles.map(p => p.id);
    expect(ids).toContain('resumen');
    expect(ids).toContain('detallado');
  });
});

describe('exportCaja', () => {
  it('tiene 1 perfil arqueos', () => { expect(exportCaja.perfiles).toHaveLength(1); });
  it('columna diferencia tiene formatoXlsx numérico', () => {
    const col = exportCaja.perfiles[0].columnas.find(c => c.campo === 'diferencia')!;
    expect(col.formatoXlsx!(50, {} as any)).toBe(50);
  });
});

import { exportCategorias } from './categorias';
import { exportMarcas } from './marcas';
import { exportUnidades } from './unidades';
import { exportSinonimos } from './sinonimos';
import { exportTransportistas } from './transportistas';
import { exportRemitos } from './remitos';
import { exportPresupuestos } from './presupuestos';

describe('descriptores nuevos (solo supervisor)', () => {
  const nuevos = [exportCategorias, exportMarcas, exportUnidades, exportSinonimos, exportTransportistas, exportRemitos, exportPresupuestos];
  it('todos exigen permiso export.supervisor (entidad y perfil)', () => {
    for (const d of nuevos) {
      expect(d.permiso).toBe('export.supervisor');
      expect(d.perfiles.length).toBeGreaterThanOrEqual(1);
      for (const p of d.perfiles) expect(p.permiso).toBe('export.supervisor');
    }
  });
  it('entidades esperadas', () => {
    expect(nuevos.map(d => d.entidad)).toEqual([
      'categorias', 'marcas', 'unidades', 'sinonimos', 'transportistas', 'remitos', 'presupuestos',
    ]);
  });
  it('presupuestos: la columna Total convierte centavos a pesos', () => {
    const col = exportPresupuestos.perfiles[0].columnas.find(c => c.label === 'Total')!;
    expect(col.formatoXlsx!(150000, {} as any)).toBe(1500);
  });
  it('remitos: la columna Emisión formatea la fecha (Date)', () => {
    const col = exportRemitos.perfiles[0].columnas.find(c => c.label === 'Emisión')!;
    expect(typeof col.formato!(new Date('2026-01-15'), {} as any)).toBe('string');
  });
});
