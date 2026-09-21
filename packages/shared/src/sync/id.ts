// packages/shared/src/sync/id.ts
export function generateId(): string {
  return crypto.randomUUID();
}
