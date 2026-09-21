import type { DefinicionExport } from '../types';
import { ars, estadoStock } from '../helpers';

type FilaStock = {
  sku: string;
  nombre_corto: string;
  ubicacion_codigo: string | null;
  stock_fisico: number | null;
  stock_minimo: number | null;
  precio_costo_promedio: number;
};

export const exportStock: DefinicionExport<FilaStock> = {
  entidad: 'stock',
  label: 'Stock',
  permiso: 'export.basico',
  perfiles: [
    {
      id: 'existencias',
      label: 'Existencias',
      permiso: 'export.basico',
      columnas: [
        { campo: 'sku', label: 'SKU' },
        { campo: 'nombre_corto', label: 'Descripción' },
        { campo: 'ubicacion_codigo', label: 'Ubicación', formato: (v) => v ?? '' },
        { campo: 'stock_fisico', label: 'Stock actual',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
        { campo: 'stock_minimo', label: 'Umbral',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
        { campo: 'stock_fisico', label: 'Estado',
          formato: (v, fila) => estadoStock(v ?? 0, fila.stock_minimo ?? 0) },
      ],
    },
    {
      id: 'valorizado',
      label: 'Valorizado',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'sku', label: 'SKU' },
        { campo: 'nombre_corto', label: 'Descripción' },
        { campo: 'stock_fisico', label: 'Stock actual',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
        { campo: 'precio_costo_promedio', label: 'Costo unit.',
          formato: ars, formatoXlsx: (v) => v },
        { campo: 'precio_costo_promedio', label: 'Valor total',
          formato: (v, fila) => ars(v * (fila.stock_fisico ?? 0)),
          formatoXlsx: (v, fila) => v * (fila.stock_fisico ?? 0) },
      ],
    },
  ],
};
