import { describe, it, expect } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  it('retorna un UUID v4 válido', () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('retorna un valor único en cada llamada', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
