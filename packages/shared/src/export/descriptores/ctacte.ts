import type { DefinicionExport } from '../types';
import { ars } from '../helpers';

type FilaCtaCte = {
  nombre: string;
  apellido: string;
  tipo_documento: string;
  numero_documento: string;
  saldo: number;
  limite_credito: number;
};

export const exportCtaCte: DefinicionExport<FilaCtaCte> = {
  entidad: 'ctacte',
  label: 'Cuentas Corrientes',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'nombre',           label: 'Nombre' },
        { campo: 'apellido',         label: 'Apellido' },
        { campo: 'tipo_documento',   label: 'Tipo doc.' },
        { campo: 'numero_documento', label: 'Documento' },
        { campo: 'saldo',            label: 'Saldo',          formato: ars, formatoXlsx: (v) => v },
        { campo: 'limite_credito',   label: 'Límite crédito', formato: (v: number) => v === 0 ? 'Sin límite' : ars(v), formatoXlsx: (v) => v },
      ],
    },
  ],
};
