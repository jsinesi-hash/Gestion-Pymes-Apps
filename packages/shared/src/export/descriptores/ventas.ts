import type { DefinicionExport } from '../types';
import { ars, fecha } from '../helpers';

// ADR-157: las consultas devuelven centavos; el archivo muestra pesos.
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
        { campo: 'total_centavos', label: 'Total', formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
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
        { campo: 'precio_unitario_centavos', label: 'Precio unit.',
          formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
        { campo: 'subtotal_centavos', label: 'Subtotal',
          formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
      ],
    },
  ],
};
