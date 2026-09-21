import type { DefinicionExport } from '../types';
import { ars, fecha } from '../helpers';

type FilaCaja = {
  turno: number;
  cajero_nombre: string | null;
  fecha_apertura: Date;
  fecha_cierre: Date | null;
  monto_inicial: number;
  monto_esperado: number | null;
  monto_contado: number | null;
  diferencia: number | null;
};

export const exportCaja: DefinicionExport<FilaCaja> = {
  entidad: 'caja',
  label: 'Caja',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'arqueos',
      label: 'Arqueos',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'turno', label: 'Turno',
          formato: (v) => v, formatoXlsx: (v) => v },
        { campo: 'cajero_nombre', label: 'Cajero', formato: (v) => v ?? '' },
        { campo: 'fecha_apertura', label: 'Apertura',
          formato: (v) => fecha(v),
          formatoXlsx: (v) => v instanceof Date ? v : new Date(v) },
        { campo: 'fecha_cierre', label: 'Cierre',
          formato: (v) => v ? fecha(v) : '',
          formatoXlsx: (v) => {
            const fallback = v ? new Date(v) : '';
            return v instanceof Date ? v : fallback;
          } },
        { campo: 'monto_inicial', label: 'Monto inicial',
          formato: ars, formatoXlsx: (v) => v },
        { campo: 'monto_esperado', label: 'Esperado',
          formato: (v) => v == null ? '' : ars(v),
          formatoXlsx: (v) => v ?? 0 },
        { campo: 'monto_contado', label: 'Contado',
          formato: (v) => v == null ? '' : ars(v),
          formatoXlsx: (v) => v ?? 0 },
        { campo: 'diferencia', label: 'Diferencia',
          formato: (v) => v == null ? '' : ars(v),
          formatoXlsx: (v) => v ?? 0 },
      ],
    },
  ],
};
