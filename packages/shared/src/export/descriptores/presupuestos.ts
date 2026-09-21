import type { DefinicionExport } from '../types';
import { ars, fecha } from '../helpers';

type FilaPresupuesto = {
  numero: string | null;
  fecha_emision: Date | number | null;
  fecha_validez: Date | number | null;
  estado: string;
  cliente_nombre_completo: string | null;
  validez_dias: number | null;
  total_centavos: number | null;
};

const aFecha = (v: Date | number | null) => v == null ? '' : fecha(v instanceof Date ? v : new Date(v));
const aFechaXlsx = (v: Date | number | null) => v == null ? '' : (v instanceof Date ? v : new Date(v));

export const exportPresupuestos: DefinicionExport<FilaPresupuesto> = {
  entidad: 'presupuestos',
  label: 'Presupuestos',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'numero', label: 'Número', formato: (v) => v ?? '' },
        { campo: 'fecha_emision', label: 'Emisión', formato: aFecha, formatoXlsx: aFechaXlsx },
        { campo: 'estado', label: 'Estado' },
        { campo: 'cliente_nombre_completo', label: 'Cliente', formato: (v) => v ?? 'Consumidor Final' },
        { campo: 'validez_dias', label: 'Validez (días)', formato: (v) => v ?? '', formatoXlsx: (v) => v ?? '' },
        { campo: 'fecha_validez', label: 'Vence', formato: aFecha, formatoXlsx: aFechaXlsx },
        { campo: 'total_centavos', label: 'Total',
          formato: (v) => ars((v ?? 0) / 100), formatoXlsx: (v) => (v ?? 0) / 100 },
      ],
    },
  ],
};
