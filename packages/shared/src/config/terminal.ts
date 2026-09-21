// packages/shared/src/config/terminal.ts
export interface TerminalConfig {
  origin_id: string;  // código corto de terminal, ej. 'C1'. NUNCA un UUID.
}

export function resolveTerminalConfig(
  existing: TerminalConfig | null
): TerminalConfig {
  return existing ?? { origin_id: 'C1' };
}
