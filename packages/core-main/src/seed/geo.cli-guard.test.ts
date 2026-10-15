import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// geo.ts se bundlea en el main de Electron de cada app. Un `require.main === module` ahí es true en cada
// arranque y lanzaba el CLI de descarga (ADR-111). El CLI se activa solo con GEO_SEED_CLI=1.
describe('geo.ts no se autoejecuta al bundlearse', () => {
  const fuente = fs.readFileSync(path.join(__dirname, 'geo.ts'), 'utf8');

  it('no usa require.main === module como disparador', () => {
    const sinComentarios = fuente.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(sinComentarios).not.toMatch(/require\.main\s*===\s*module/);
  });

  it('el CLI exige GEO_SEED_CLI=1', () => {
    expect(fuente).toMatch(/process\.env\['GEO_SEED_CLI'\]\s*===\s*'1'/);
  });
});
