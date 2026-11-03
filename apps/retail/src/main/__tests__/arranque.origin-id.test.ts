import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// main/index.ts importa `electron` y no se puede ejecutar en el runner, así que el invariante
// se fija sobre el fuente (mismo recurso que base-seed.cli-guard.test.ts). Revisión 2026-10-20:
// `loadTerminalConfig()` se llamaba y su resultado se descartaba, por lo que el origin_id de toda
// terminal quedaba en 'C1'. El config tiene que llegar a `aplicarConfigTerminal` ANTES de
// registrar handlers y de `runStartup`.
describe('arranque de Retail aplica el origin_id de la terminal', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('pasa loadTerminalConfig() a aplicarConfigTerminal', () => {
    expect(fuente).toMatch(/aplicarConfigTerminal\(\s*loadTerminalConfig\(\)\s*\)/);
  });

  it('lo hace antes de runStartup y de registrar handlers', () => {
    const aplicar = fuente.indexOf('aplicarConfigTerminal(');
    expect(aplicar).toBeGreaterThan(-1);
    expect(aplicar).toBeLessThan(fuente.indexOf('await runStartup('));
    expect(aplicar).toBeLessThan(fuente.indexOf('registerCoreHandlers('));
  });

  it('no deja loadTerminalConfig() suelto (valor descartado)', () => {
    expect(fuente).not.toMatch(/^\s*loadTerminalConfig\(\);/m);
  });
});
