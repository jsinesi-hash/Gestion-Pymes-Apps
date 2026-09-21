import type { DefinicionExport } from '../types';

type FilaProveedor = {
  razon_social: string;
  numero_documento: string;
  condicion_fiscal: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
};

export const exportProveedores: DefinicionExport<FilaProveedor> = {
  entidad: 'proveedores',
  label: 'Proveedores',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'razon_social', label: 'Razón social' },
        { campo: 'numero_documento', label: 'CUIT' },
        { campo: 'condicion_fiscal', label: 'Cond. IVA' },
        { campo: 'telefono', label: 'Teléfono', formato: (v) => v ?? '' },
        { campo: 'email', label: 'Email', formato: (v) => v ?? '' },
        { campo: 'activo', label: 'Activo', formato: (v) => v ? 'Sí' : 'No' },
      ],
    },
  ],
};
