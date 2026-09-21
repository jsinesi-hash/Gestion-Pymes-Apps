import { describe, it, expect } from 'vitest';
import { resolveTerminalConfig } from './terminal';

describe('resolveTerminalConfig', () => {
  it('devuelve origin_id C1 por defecto en primer arranque (null)', () => {
    expect(resolveTerminalConfig(null)).toEqual({ origin_id: 'C1' });
  });

  it('conserva el origin_id existente si ya hay config', () => {
    expect(resolveTerminalConfig({ origin_id: 'C2' })).toEqual({ origin_id: 'C2' });
  });

  it('el origin_id nunca es un UUID', () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(resolveTerminalConfig(null).origin_id).not.toMatch(uuidPattern);
  });
});
