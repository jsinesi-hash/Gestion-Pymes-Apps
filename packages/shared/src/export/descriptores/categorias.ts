import type { DefinicionExport } from '../types';

type FilaCategoria = {
  nombre: string;
  descripcion: string | null;
  categoria_padre: string | null;
  activo: boolean;
};

export const exportCategorias: DefinicionExport<FilaCategoria> = {
  entidad: 'categorias',
  label: 'Categorías',
  permiso: 'export.supervisor',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.supervisor',
      columnas: [
        { campo: 'nombre', label: 'Nombre' },
        { campo: 'categoria_padre', label: 'Categoría padre', formato: (v) => v ?? '' },
        { campo: 'descripcion', label: 'Descripción', formato: (v) => v ?? '' },
        { campo: 'activo', label: 'Activo', formato: (v) => v ? 'Sí' : 'No' },
      ],
    },
  ],
};
