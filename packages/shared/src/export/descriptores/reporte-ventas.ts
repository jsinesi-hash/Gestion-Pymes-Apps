import type { DefinicionExport } from '../types.js';
import { ars } from '../helpers.js';

const fmtFecha = (v: any): string => {
  const d = v instanceof Date ? v : new Date((v as number) * 1000);
  return d.toLocaleDateString('es-AR');
};

const toDate = (v: any): Date =>
  v instanceof Date ? v : new Date((v as number) * 1000);

// ADR-157: las consultas devuelven centavos; el archivo muestra pesos.
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
        { campo: 'subtotal_centavos',    label: 'Subtotal',      formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
        { campo: 'importe_iva_centavos', label: 'IVA',           formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
        { campo: 'total_centavos',       label: 'Total',         formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
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
        { campo: 'precio_unitario_centavos', label: 'Precio unitario', formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
        { campo: 'descuento_linea',      label: 'Dto. línea %',     formatoXlsx: (v) => v },
        { campo: 'alicuota_iva',         label: 'Alíc. IVA %',      formatoXlsx: (v) => v },
        { campo: 'subtotal_linea_centavos', label: 'Subtotal línea', formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
        { campo: 'total_venta_centavos', label: 'Total venta',    formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
      ],
    },
  ],
};
