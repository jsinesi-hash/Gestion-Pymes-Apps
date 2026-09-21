import type { DefinicionExport } from '../types';

type FilaUbicacion = {
  codigo: string;
  descripcion: string | null;
  sector: string;
  estante: string;
  posicion: string;
  cantidad_productos: number;
};

export const exportUbicaciones: DefinicionExport<FilaUbicacion> = {
  entidad: 'ubicaciones',
  label: 'Ubicaciones',
  permiso: 'export.basico',
  perfiles: [
    {
      id: 'completo',
      label: 'Completo',
      permiso: 'export.basico',
      columnas: [
        { campo: 'codigo', label: 'Código' },
        { campo: 'descripcion', label: 'Descripción', formato: (v) => v ?? '' },
        { campo: 'sector', label: 'Sector' },
        { campo: 'estante', label: 'Estante' },
        { campo: 'posicion', label: 'Posición' },
        { campo: 'cantidad_productos', label: 'Cant. productos',
          formato: (v) => v ?? 0, formatoXlsx: (v) => v ?? 0 },
      ],
    },
  ],
};
