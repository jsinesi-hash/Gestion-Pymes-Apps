import type { DefinicionExport } from '../types';

type FilaMarca = { nombre: string; descripcion: string | null; activo: boolean };

export const exportMarcas: DefinicionExport<FilaMarca> = {
  entidad: 'marcas',
  label: 'Marcas',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'nombre', label: 'Nombre' },
        { campo: 'descripcion', label: 'Descripción', formato: (v) => v ?? '' },
        { campo: 'activo', label: 'Activo', formato: (v) => v ? 'Sí' : 'No' },
      ],
    },
  ],
};
