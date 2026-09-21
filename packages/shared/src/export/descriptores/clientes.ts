import type { DefinicionExport } from '../types';
import { ars } from '../helpers';

type FilaCliente = {
  nombre: string;
  apellido: string;
  numero_documento: string;
  condicion_fiscal: string;
  telefono: string | null;
  email: string | null;
  saldo_cuenta: number;
};

export const exportClientes: DefinicionExport<FilaCliente> = {
  entidad: 'clientes',
  label: 'Clientes',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'nombre', label: 'Nombre' },
        { campo: 'apellido', label: 'Apellido' },
        { campo: 'numero_documento', label: 'CUIT/DNI' },
        { campo: 'condicion_fiscal', label: 'Cond. IVA' },
        { campo: 'telefono', label: 'Teléfono', formato: (v) => v ?? '' },
        { campo: 'email', label: 'Email', formato: (v) => v ?? '' },
        { campo: 'saldo_cuenta', label: 'Saldo cta. cte.',
          formato: ars, formatoXlsx: (v) => v },
      ],
    },
  ],
};
