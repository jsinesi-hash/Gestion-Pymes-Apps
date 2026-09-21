import { describe, it, expect } from 'vitest';
import { buildBreadcrumb } from './breadcrumb';

describe('buildBreadcrumb (NAV-1 / ADR-077)', () => {
  it('página lista: grupo + página actual, sin links (nada arriba)', () => {
    expect(buildBreadcrumb('/productos')).toEqual([
      { label: 'Catálogo' },
      { label: 'Productos' },
    ]);
  });

  it('detalle: la lista pasa a ser link y el leaf es "Detalle"', () => {
    expect(buildBreadcrumb('/productos/abc123')).toEqual([
      { label: 'Catálogo' },
      { label: 'Productos', to: '/productos' },
      { label: 'Detalle' },
    ]);
  });

  it('nuevo y editar tienen leaf propio con la lista clicable', () => {
    expect(buildBreadcrumb('/productos/nuevo')).toEqual([
      { label: 'Catálogo' },
      { label: 'Productos', to: '/productos' },
      { label: 'Nuevo' },
    ]);
    expect(buildBreadcrumb('/productos/abc123/editar')).toEqual([
      { label: 'Catálogo' },
      { label: 'Productos', to: '/productos' },
      { label: 'Editar' },
    ]);
  });

  it('kardex de stock', () => {
    expect(buildBreadcrumb('/stock/abc/kardex')).toEqual([
      { label: 'Catálogo' },
      { label: 'Stock', to: '/stock' },
      { label: 'Kardex' },
    ]);
  });

  it('la ruta más específica gana sobre su prefijo (ordenes/sugerida)', () => {
    expect(buildBreadcrumb('/compras/ordenes/sugerida')).toEqual([
      { label: 'Abastecimiento' },
      { label: 'Órdenes de compra', to: '/compras/ordenes' },
      { label: 'OC Sugerida' },
    ]);
  });

  it('transportistas no se confunde con remitos (prefijo)', () => {
    expect(buildBreadcrumb('/remitos/transportistas')).toEqual([
      { label: 'Facturación' },
      { label: 'Transportistas' },
    ]);
  });

  it('config: grupo Configuración + página', () => {
    expect(buildBreadcrumb('/config/categorias')).toEqual([
      { label: 'Configuración' },
      { label: 'Categorías' },
    ]);
  });

  it('ruta desconocida: un único crumb de fallback, sin romper', () => {
    const r = buildBreadcrumb('/no-existe');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[r.length - 1].to).toBeUndefined();
  });

  it('hub de Precios y Costos: sub-ruta lotes (PRICE-1, ADR-078)', () => {
    expect(buildBreadcrumb('/precios/hub/lotes')).toEqual([
      { label: 'Precios y Costos' },
      { label: 'Lotes' },
    ]);
  });

  it('hub de Precios y Costos: sub-ruta importar/catalogo-proveedor (PRICE-1, ADR-078)', () => {
    expect(buildBreadcrumb('/precios/hub/importar/catalogo-proveedor')).toEqual([
      { label: 'Precios y Costos' },
      { label: 'Importar · Catálogo del Proveedor' },
    ]);
  });
});
