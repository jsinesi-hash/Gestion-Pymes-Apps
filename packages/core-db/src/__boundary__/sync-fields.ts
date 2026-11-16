// packages/core-db/src/__boundary__/sync-fields.ts
// Campos de sync que toda tabla `maestro` o `libro` debe tener (ADR-003, baranda B2).
// La verificación vive en `registro-sync.ts` (`verificarRegistroSync`), que reemplazó a la
// antigua `verificarCamposSync` con lista de excepciones (ADR-150 §3, F1 PR1).
export const CAMPOS_SYNC = ['version', 'origin_id', 'sync_state', 'updated_at'] as const;
