import type { DefinicionExport } from '../types';

type FilaUnidad = { nombre: string; abreviatura: string; activo: boolean };

export const exportUnidades: DefinicionExport<FilaUnidad> = {
  entidad: 'unidades',
  label: 'Unidades',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'nombre', label: 'Nombre' },
        { campo: 'abreviatura', label: 'Abreviatura' },
        { campo: 'activo', label: 'Activo', formato: (v) => v ? 'Sí' : 'No' },
      ],
    },
  ],
};
