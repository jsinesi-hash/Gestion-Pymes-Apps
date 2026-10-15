import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// El CLI de dev-seed se activa solo con DEV_SEED_CLI=1 (ADR-113): `require.main === module` es true en el
// bundle del main de Electron y autoejecutaría el seed en cada arranque.
describe('dev-seed/index.ts no se autoejecuta', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  it('no usa require.main === module como disparador', () => {
    const sinComentarios = fuente.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(sinComentarios).not.toMatch(/require\.main\s*===\s*module/);
  });

  it('el CLI exige DEV_SEED_CLI=1 y seed-dev.cjs lo setea', () => {
    expect(fuente).toMatch(/process\.env\['DEV_SEED_CLI'\]\s*===\s*'1'/);
    const lanzador = fs.readFileSync(path.join(__dirname, '../../../../scripts/seed-dev.cjs'), 'utf8');
    expect(lanzador).toMatch(/DEV_SEED_CLI:\s*'1'/);
  });
});
