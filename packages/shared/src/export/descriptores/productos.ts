import type { DefinicionExport } from '../types';
import { ars, arsDecimal, estadoStock } from '../helpers';

type FilaProducto = {
  sku: string;
  gtin_barcode: string | null;
  nombre_corto: string;
  nombre_largo: string | null;
  unidad_venta: string;
  precio_venta_lista: number;
  precio_costo_promedio: number;
  margen_ganancia: number | null;
  iva_alicuota: number | null;
  stock_fisico: number | null;
  stock_minimo: number | null;
  stock_maximo: number | null;
  ubicacion_codigo: string | null;
  categoria_nombre: string | null;
  marca_nombre: string | null;
  activo: boolean;
};

export const exportProductos: DefinicionExport<FilaProducto> = {
  entidad: 'productos',
  label: 'Productos',
  permiso: 'export.basico',
  perfiles: [
    {
      id: 'control-stock',
      label: 'Control de stock',
      permiso: 'export.basico',
      columnas: [
        { campo: 'sku', label: 'SKU' },
        { campo: 'nombre_corto', label: 'Descripción' },
        { campo: 'categoria_nombre', label: 'Rubro', formato: (v) => v ?? '' },
        { campo: 'stock_fisico', label: 'Stock',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
        { campo: 'ubicacion_codigo', label: 'Ubicación', formato: (v) => v ?? '' },
        { campo: 'stock_fisico', label: 'Estado',
          formato: (v, fila) => estadoStock(v ?? 0, fila.stock_minimo ?? 0) },
      ],
    },
    {
      id: 'lista-precios',
      label: 'Lista de precios',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'sku', label: 'SKU' },
        { campo: 'nombre_corto', label: 'Descripción' },
        { campo: 'precio_venta_lista', label: 'Precio venta',
          formato: ars, formatoXlsx: (v) => v },
        { campo: 'precio_costo_promedio', label: 'Precio costo',
          formato: ars, formatoXlsx: (v) => v },
        { campo: 'margen_ganancia', label: 'Margen %',
          formato: (v) => v == null ? '' : `${v.toFixed(2)}%`,
          formatoXlsx: (v) => v ?? 0 },
      ],
    },
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'sku', label: 'SKU' },
        { campo: 'gtin_barcode', label: 'Cód. barras', formato: (v) => v ?? '' },
        { campo: 'nombre_corto', label: 'Descripción' },
        { campo: 'nombre_largo', label: 'Descripción larga', formato: (v) => v ?? '' },
        { campo: 'categoria_nombre', label: 'Rubro', formato: (v) => v ?? '' },
        { campo: 'marca_nombre', label: 'Marca', formato: (v) => v ?? '' },
        { campo: 'stock_fisico', label: 'Stock',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
        { campo: 'stock_maximo', label: 'Stock máx.',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
        { campo: 'ubicacion_codigo', label: 'Ubicación', formato: (v) => v ?? '' },
        { campo: 'precio_venta_lista', label: 'Precio venta',
          formato: ars, formatoXlsx: (v) => v },
        { campo: 'precio_costo_promedio', label: 'Precio costo',
          formato: ars, formatoXlsx: (v) => v },
        { campo: 'activo', label: 'Activo', formato: (v) => v ? 'Sí' : 'No' },
      ],
    },
    {
      id: 'reimportable',
      label: 'Para reimportar',
      permiso: 'export.supervisor',
      soloFormatos: ['csv'],
      columnas: [
        { campo: 'sku',                   label: 'sku' },
        { campo: 'nombre_corto',          label: 'nombre' },
        { campo: 'unidad_venta',          label: 'unidad_medida' },
        { campo: 'precio_venta_lista',    label: 'precio_venta',   formato: arsDecimal },
        { campo: 'iva_alicuota',          label: 'iva_alicuota',   formato: (v) => String(v ?? 0) },
        { campo: 'categoria_nombre',      label: 'rubro',          formato: (v) => v ?? '' },
        { campo: 'gtin_barcode',          label: 'codigo_barras',  formato: (v) => v ?? '' },
        { campo: 'precio_costo_promedio', label: 'costo',          formato: arsDecimal },
        { campo: 'stock_minimo',          label: 'stock_minimo',   formato: (v) => String(v ?? 0) },
        { campo: 'activo',                label: 'activo',         formato: (v) => String(v) },
      ],
    },
  ],
};
