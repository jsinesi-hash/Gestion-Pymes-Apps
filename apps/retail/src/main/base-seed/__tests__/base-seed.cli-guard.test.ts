import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// base-seed/index.ts lo importa startup.ts, así que se bundlea en el main de Electron. Un
// `require.main === module` ahí es true en cada arranque y ejecutaría el CLI seed:base (ADR-113,
// mismo patrón que geo.ts en ADR-111). El CLI se activa solo con BASE_SEED_CLI=1.
describe('base-seed/index.ts no se autoejecuta al bundlearse', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  it('no usa require.main === module como disparador', () => {
    const sinComentarios = fuente.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(sinComentarios).not.toMatch(/require\.main\s*===\s*module/);
  });

  it('el CLI exige BASE_SEED_CLI=1', () => {
    expect(fuente).toMatch(/process\.env\['BASE_SEED_CLI'\]\s*===\s*'1'/);
  });

  it('seed-base.cjs setea BASE_SEED_CLI=1', () => {
    const lanzador = fs.readFileSync(path.join(__dirname, '../../../../scripts/seed-base.cjs'), 'utf8');
    expect(lanzador).toMatch(/BASE_SEED_CLI:\s*'1'/);
  });
});
