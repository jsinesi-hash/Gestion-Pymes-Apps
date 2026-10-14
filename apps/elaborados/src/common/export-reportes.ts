import type { DefinicionExport } from '@ferreteria/shared';

// ADR-105: definiciones de exportación de los reportes de Elaborados. Browser-safe (las usa el
// renderer para el botón Exportar y el main para los exportadores del registry del core).
// Los importes viajan en centavos desde las consultas; acá se muestran en pesos.

const pesos = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');
const pesosXlsx = (centavos: number) => centavos / 100;
const importe = (campo: string, label: string) =>
  ({ campo, label, formato: pesos, formatoXlsx: pesosXlsx });

const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
  cuenta_corriente: 'Cuenta corriente', cheque: 'Cheque',
};

export const exportVentasPeriodo: DefinicionExport<any> = {
  entidad: 'reporte_ventas_periodo',
  label: 'Ventas por día',
  permiso: 'export.supervisor',
  perfiles: [{
    id: 'completo', label: 'Por día', permiso: 'export.supervisor',
    columnas: [
      { campo: 'dia', label: 'Día' },
      { campo: 'cantidad', label: 'Ventas' },
      importe('total_centavos', 'Total'),
      importe('neto_centavos', 'Neto (sin IVA)'),
      importe('costo_centavos', 'Costo'),
      importe('margen_centavos', 'Margen'),
    ],
  }],
};

export const exportVentasMedio: DefinicionExport<any> = {
  entidad: 'reporte_ventas_medio',
  label: 'Ventas por medio de pago',
  permiso: 'export.supervisor',
  perfiles: [{
    id: 'completo', label: 'Por medio de pago', permiso: 'export.supervisor',
    columnas: [
      { campo: 'medio_pago', label: 'Medio de pago', formato: (v: string) => MEDIOS[v] ?? v },
      importe('monto_centavos', 'Monto'),
    ],
  }],
};

export const exportVentasProducto: DefinicionExport<any> = {
  entidad: 'reporte_ventas_producto',
  label: 'Ventas por producto',
  permiso: 'export.supervisor',
  perfiles: [{
    id: 'completo', label: 'Por producto', permiso: 'export.supervisor',
    columnas: [
      { campo: 'descripcion', label: 'Producto' },
      { campo: 'unidades', label: 'Unidades' },
      importe('importe_centavos', 'Importe'),
    ],
  }],
};

export const exportSabores: DefinicionExport<any> = {
  entidad: 'reporte_sabores',
  label: 'Sabores más pedidos',
  permiso: 'export.supervisor',
  perfiles: [{
    id: 'completo', label: 'Ranking de sabores', permiso: 'export.supervisor',
    columnas: [
      { campo: 'descripcion', label: 'Sabor' },
      { campo: 'veces', label: 'Veces pedido' },
      { campo: 'consumo', label: 'Consumo' },
    ],
  }],
};

export const exportStockAlertas: DefinicionExport<any> = {
  entidad: 'reporte_stock_alertas',
  label: 'Stock negativo y bajo mínimo',
  permiso: 'export.supervisor',
  perfiles: [{
    id: 'completo', label: 'Alertas de stock', permiso: 'export.supervisor',
    columnas: [
      { campo: 'nombre', label: 'Artículo' },
      { campo: 'unidad', label: 'Unidad' },
      { campo: 'stock', label: 'Stock' },
      { campo: 'stock_minimo', label: 'Stock mínimo', formato: (v: number | null) => v ?? '' },
      { campo: 'estado', label: 'Estado', formato: (v: string) => (v === 'negativo' ? 'Negativo' : 'Bajo mínimo') },
    ],
  }],
};
