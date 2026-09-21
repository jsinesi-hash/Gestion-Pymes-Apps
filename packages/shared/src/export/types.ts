export type ExportPermiso = 'export.basico' | 'export.supervisor';
export type ExportFormato = 'csv' | 'xlsx';

export interface ColumnaExport<T = Record<string, unknown>> {
  campo: string;
  label: string;
  formato?: (v: any, fila: T) => string | number;
  formatoXlsx?: (v: any, fila: T) => string | number | Date;
}

export interface PerfilExport<T = Record<string, unknown>> {
  id: string;
  label: string;
  columnas: ColumnaExport<T>[];
  permiso: ExportPermiso;
  soloFormatos?: ExportFormato[];
  defaultFormato?: ExportFormato;
}

export interface DefinicionExport<T = Record<string, unknown>> {
  entidad: string;
  label: string;
  permiso: ExportPermiso;
  perfiles: PerfilExport<T>[];
}

export interface ExportRequest {
  entidad: string;
  perfilId: string;
  formato: ExportFormato;
  alcance: 'filtrado' | 'todo';
  filtros?: Record<string, unknown>;
}
