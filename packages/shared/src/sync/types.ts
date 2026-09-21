// packages/shared/src/sync/types.ts
export type SyncState = 'pending' | 'synced' | 'conflict';

export interface SyncableEntity {
  id: string;          // UUID v4, generado en cliente
  version: number;     // entero creciente, gestionado por sync (R4)
  origin_id: string;   // código corto de terminal, ej. 'C1'
  sync_state: SyncState;
  updated_at: string;  // ISO 8601
}
