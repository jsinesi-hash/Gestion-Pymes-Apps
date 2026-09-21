import type { DefinicionExport } from '../types.js';
import { ars } from '../helpers.js';

const fmtFecha = (v: any): string => {
  const d = v instanceof Date ? v : new Date((v as number) * 1000);
  return d.toLocaleDateString('es-AR');
};

const toDate = (v: any): Date =>
  v instanceof Date ? v : new Date((v as number) * 1000);

export const exportReporteVentas: DefinicionExport<any> = {
  entidad: 'reporte_ventas',
  label: 'Reporte de Ventas',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'cabecera',
      label: 'Cabecera de ventas',
      permiso: 'export.supervisor',
      defaultFormato: 'xlsx',
      columnas: [
        { campo: 'numero_interno',       label: 'Nro. Venta' },
        { campo: 'fecha',                label: 'Fecha',         formato: fmtFecha, formatoXlsx: toDate },
        { campo: 'cliente_nombre_completo', label: 'Cliente' },
        { campo: 'vendedor_nombre',      label: 'Vendedor' },
        { campo: 'medios_pago',          label: 'Medios de pago' },
        { campo: 'subtotal',             label: 'Subtotal',      formato: ars, formatoXlsx: (v) => v },
        { campo: 'importe_iva',          label: 'IVA',           formato: ars, formatoXlsx: (v) => v },
        { campo: 'total',                label: 'Total',         formato: ars, formatoXlsx: (v) => v },
      ],
    },
    {
      id: 'detalle',
      label: 'Detalle de líneas',
      permiso: 'export.supervisor',
      defaultFormato: 'xlsx',
      columnas: [
        { campo: 'numero_interno',       label: 'Nro. Venta' },
        { campo: 'fecha',                label: 'Fecha',            formato: fmtFecha, formatoXlsx: toDate },
        { campo: 'cliente_nombre_completo', label: 'Cliente' },
        { campo: 'vendedor_nombre',      label: 'Vendedor' },
        { campo: 'sku',                  label: 'SKU' },
        { campo: 'descripcion',          label: 'Descripción' },
        { campo: 'categoria_nombre',     label: 'Categoría' },
        { campo: 'cantidad',             label: 'Cantidad',         formatoXlsx: (v) => v },
        { campo: 'precio_unitario',      label: 'Precio unitario',  formato: ars, formatoXlsx: (v) => v },
        { campo: 'descuento_linea',      label: 'Dto. línea %',     formatoXlsx: (v) => v },
        { campo: 'alicuota_iva',         label: 'Alíc. IVA %',      formatoXlsx: (v) => v },
        { campo: 'subtotal_linea',       label: 'Subtotal línea',   formato: ars, formatoXlsx: (v) => v },
        { campo: 'total_venta',          label: 'Total venta',      formato: ars, formatoXlsx: (v) => v },
      ],
    },
  ],
};
