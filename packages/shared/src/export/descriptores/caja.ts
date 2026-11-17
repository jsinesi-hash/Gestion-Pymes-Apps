import type { DefinicionExport } from '../types';
import { ars, fecha } from '../helpers';

type FilaCaja = {
  turno: number;
  cajero_nombre: string | null;
  fecha_apertura: Date;
  fecha_cierre: Date | null;
  // ADR-157: la consulta devuelve centavos; el archivo muestra pesos.
  monto_inicial_centavos: number;
  monto_esperado_centavos: number | null;
  monto_contado_centavos: number | null;
  diferencia_centavos: number | null;
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
        { campo: 'monto_inicial_centavos', label: 'Monto inicial',
          formato: (v) => ars(v / 100), formatoXlsx: (v) => v / 100 },
        { campo: 'monto_esperado_centavos', label: 'Esperado',
          formato: (v) => v == null ? '' : ars(v / 100),
          formatoXlsx: (v) => (v ?? 0) / 100 },
        { campo: 'monto_contado_centavos', label: 'Contado',
          formato: (v) => v == null ? '' : ars(v / 100),
          formatoXlsx: (v) => (v ?? 0) / 100 },
        { campo: 'diferencia_centavos', label: 'Diferencia',
          formato: (v) => v == null ? '' : ars(v / 100),
          formatoXlsx: (v) => (v ?? 0) / 100 },
      ],
    },
  ],
};
