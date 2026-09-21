import type { DefinicionExport } from '../types';
import { ars, fecha } from '../helpers';

export const exportVentas: DefinicionExport<any> = {
  entidad: 'ventas',
  label: 'Ventas',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'resumen',
      label: 'Resumen',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'numero_interno', label: 'Comprobante' },
        { campo: 'fecha', label: 'Fecha',
          formato: (v) => fecha(v),
          formatoXlsx: (v) => v instanceof Date ? v : new Date(v) },
        { campo: 'cliente_nombre', label: 'Cliente', formato: (v) => v ?? '' },
        { campo: 'cajero_nombre',  label: 'Cajero',  formato: (v) => v ?? '' },
        { campo: 'forma_pago', label: 'Medio pago' },
        { campo: 'total', label: 'Total', formato: ars, formatoXlsx: (v) => v },
        { campo: 'estado', label: 'Estado' },
      ],
    },
    {
      id: 'detallado',
      label: 'Detallado (por línea)',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'numero_interno', label: 'Comprobante' },
        { campo: 'fecha', label: 'Fecha',
          formato: (v) => fecha(v),
          formatoXlsx: (v) => v instanceof Date ? v : new Date(v) },
        { campo: 'sku', label: 'SKU', formato: (v) => v ?? '' },
        { campo: 'descripcion', label: 'Descripción' },
        { campo: 'cantidad', label: 'Cantidad',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
        { campo: 'precio_unitario', label: 'Precio unit.',
          formato: ars, formatoXlsx: (v) => v },
        { campo: 'subtotal', label: 'Subtotal',
          formato: ars, formatoXlsx: (v) => v },
      ],
    },
  ],
};
