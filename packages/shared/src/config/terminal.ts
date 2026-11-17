// packages/shared/src/config/terminal.ts
export interface TerminalConfig {
  origin_id: string;  // código corto de terminal, ej. 'C1'. NUNCA un UUID.
  // ADR-156 (F1 PR8): 'standalone' (una terminal, sin hub) o 'distribuido' (F2). Lo valida el main.
  modo: 'standalone' | 'distribuido';
}

export function resolveTerminalConfig(
  existing: Partial<TerminalConfig> | null
): TerminalConfig {
  // Un config.json existente conserva su origin_id tal cual (aunque falte): lo valida el main y
  // un valor inválido debe fallar (TERMINAL_INVALIDA), no caer en silencio a 'C1'.
  if (!existing) return { origin_id: 'C1', modo: 'standalone' };
  return { origin_id: existing.origin_id as string, modo: existing.modo ?? 'standalone' };
}
