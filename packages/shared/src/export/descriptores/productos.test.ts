import { describe, it, expect } from 'vitest';
import { exportProductos } from './productos';

describe('exportProductos descriptor', () => {
  it('tiene 4 perfiles', () => {
    expect(exportProductos.perfiles).toHaveLength(4);
  });
  it('perfil control-stock tiene permiso export.basico y ambos formatos', () => {
    const p = exportProductos.perfiles.find(p => p.id === 'control-stock')!;
    expect(p.permiso).toBe('export.basico');
    expect(p.soloFormatos).toBeUndefined();
  });
  it('perfil reimportable es solo CSV y usa headers en inglés', () => {
    const p = exportProductos.perfiles.find(p => p.id === 'reimportable')!;
    expect(p.permiso).toBe('export.supervisor');
    expect(p.soloFormatos).toEqual(['csv']);
    expect(p.columnas[0].label).toBe('sku');
    expect(p.columnas[1].label).toBe('nombre');
  });
  it('columna precio_venta_lista de lista-precios formatea pesos con coma', () => {
    const p = exportProductos.perfiles.find(p => p.id === 'lista-precios')!;
    const col = p.columnas.find(c => c.campo === 'precio_venta_lista')!;
    expect(col.formato!(1500, {} as any)).toBe('1500,00');
  });
  it('columna precio de reimportable usa punto decimal', () => {
    const p = exportProductos.perfiles.find(p => p.id === 'reimportable')!;
    const col = p.columnas.find(c => c.campo === 'precio_venta_lista')!;
    expect(col.formato!(1500, {} as any)).toBe('1500.00');
  });
  it('formatoXlsx de precio devuelve number', () => {
    const p = exportProductos.perfiles.find(p => p.id === 'lista-precios')!;
    const col = p.columnas.find(c => c.campo === 'precio_venta_lista')!;
    expect(col.formatoXlsx!(1500, {} as any)).toBe(1500);
  });
  it('perfil completo incluye marca, nombre largo y stock máximo', () => {
    const p = exportProductos.perfiles.find(p => p.id === 'completo')!;
    const campos = p.columnas.map(c => c.campo);
    expect(campos).toContain('marca_nombre');
    expect(campos).toContain('nombre_largo');
    expect(campos).toContain('stock_maximo');
  });
});
