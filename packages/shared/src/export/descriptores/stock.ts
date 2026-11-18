import type { DefinicionExport } from '../types';
import { ars, estadoStock } from '../helpers';

type FilaStock = {
  sku: string;
  nombre_corto: string;
  ubicacion_codigo: string | null;
  stock_fisico: number | null;
  stock_minimo: number | null;
  /** Centavos (ADR-157); el archivo muestra pesos. */
  precio_costo_promedio_centavos: number;
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
        { campo: 'precio_costo_promedio_centavos', label: 'Costo unit.',
          formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
        { campo: 'precio_costo_promedio_centavos', label: 'Valor total',
          formato: (v, fila) => ars(Math.round(v * (fila.stock_fisico ?? 0)) / 100),
          formatoXlsx: (v, fila) => Math.round(v * (fila.stock_fisico ?? 0)) / 100 },
      ],
    },
  ],
};
