import type { DefinicionExport } from '../types';
import { fecha } from '../helpers';

type FilaRemito = {
  numero: string | null;
  fecha_emision: Date | number | null;
  fecha_entrega: Date | number | null;
  estado: string;
  cliente_nombre_completo: string | null;
  venta_numero_interno: string | null;
  transportista: string | null;
  recibido_por: string | null;
};

const aFecha = (v: Date | number | null) => v == null ? '' : fecha(v instanceof Date ? v : new Date(v));
const aFechaXlsx = (v: Date | number | null) => v == null ? '' : (v instanceof Date ? v : new Date(v));

export const exportRemitos: DefinicionExport<FilaRemito> = {
  entidad: 'remitos',
  label: 'Remitos',
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
        { campo: 'cliente_nombre_completo', label: 'Cliente', formato: (v) => v ?? '' },
        { campo: 'venta_numero_interno', label: 'Venta', formato: (v) => v ?? '' },
        { campo: 'transportista', label: 'Transportista', formato: (v) => v ?? '' },
        { campo: 'fecha_entrega', label: 'Entrega', formato: aFecha, formatoXlsx: aFechaXlsx },
        { campo: 'recibido_por', label: 'Recibido por', formato: (v) => v ?? '' },
      ],
    },
  ],
};
