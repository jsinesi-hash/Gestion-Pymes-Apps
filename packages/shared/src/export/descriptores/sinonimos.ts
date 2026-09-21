import type { DefinicionExport } from '../types';

type FilaSinonimo = {
  termino: string;
  rubro: string | null;
  es_canonico: boolean;
  es_abreviatura: boolean;
  activo: boolean;
};

export const exportSinonimos: DefinicionExport<FilaSinonimo> = {
  entidad: 'sinonimos',
  label: 'Sinónimos',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'termino', label: 'Término' },
        { campo: 'rubro', label: 'Rubro', formato: (v) => v ?? '' },
        { campo: 'es_canonico', label: 'Canónico', formato: (v) => v ? 'Sí' : 'No' },
        { campo: 'es_abreviatura', label: 'Abreviatura', formato: (v) => v ? 'Sí' : 'No' },
        { campo: 'activo', label: 'Activo', formato: (v) => v ? 'Sí' : 'No' },
      ],
    },
  ],
};
