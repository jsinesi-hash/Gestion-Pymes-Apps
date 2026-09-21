import type { DefinicionExport } from '../types';

type FilaTransportista = {
  razon_social: string;
  telefono: string | null;
  email: string | null;
  persona_contacto: string | null;
  domicilio: string | null;
  activo: boolean;
};

export const exportTransportistas: DefinicionExport<FilaTransportista> = {
  entidad: 'transportistas',
  label: 'Transportistas',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'razon_social', label: 'Razón social' },
        { campo: 'persona_contacto', label: 'Contacto', formato: (v) => v ?? '' },
        { campo: 'telefono', label: 'Teléfono', formato: (v) => v ?? '' },
        { campo: 'email', label: 'Email', formato: (v) => v ?? '' },
        { campo: 'domicilio', label: 'Domicilio', formato: (v) => v ?? '' },
        { campo: 'activo', label: 'Activo', formato: (v) => v ? 'Sí' : 'No' },
      ],
    },
  ],
};
