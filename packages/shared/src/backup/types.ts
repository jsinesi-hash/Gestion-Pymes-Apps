export interface BackupManifest {
  app_version: string;
  created_at: string;          // ISO 8601 con offset -03:00
  sucursal_id: string;
  db_sha256: string;
  row_counts: Record<string, number>;
  incluye_certs: boolean;
  cifrado: boolean;
  tipo: 'manual' | 'auto';
  schema: {
    driver: 'drizzle';
    last_migration_hash: string;
    migrations_applied: number;
    last_migration_at: string;
  };
}

export interface BackupListItem {
  ruta: string;
  nombre: string;
  tamano_bytes: number;
  fecha: string;               // ISO 8601
  tipo: 'manual' | 'auto';
  incluye_certs: boolean;
  cifrado: boolean;
  app_version: string;
}

export type RestoreCompatibilidad = 'direct' | 'migrate' | 'incompatible';

export interface RestoreValidationResult {
  ok: boolean;
  error?: string;
  manifest?: BackupManifest;
  compatibilidad?: RestoreCompatibilidad;
  row_counts_actuales?: Record<string, number>;
}

export interface RestoreLogEntry {
  id: string;
  fecha: string;
  usuario_id: string;
  archivo_origen: string;
  manifest_backup: string;    // JSON serializado
  row_counts_antes: string;   // JSON serializado
  row_counts_despues: string; // JSON serializado
  resultado: 'exito' | 'error';
  error_detalle?: string;
}

export interface PoliticaRetencion {
  cantidad: number;   // N: últimos N 'auto' protegidos por carpeta
  dias: number;       // X: 'auto' más nuevos que X días protegidos
  piso: number;       // mínimo absoluto de 'auto' por carpeta
  sizeMb: number;     // tope de tamaño por carpeta; 0 = desactivado
}

export interface ResumenDepuracion {
  candidatos: BackupListItem[];
  protegidos: BackupListItem[];
  bytesALiberar: number;
  porCarpeta: Record<string, { candidatos: number; bytes: number }>;
}
