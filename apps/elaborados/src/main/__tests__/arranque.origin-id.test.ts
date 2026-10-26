import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Ver apps/retail/src/main/__tests__/arranque.origin-id.test.ts: mismo invariante para
// Elaborados (revisión 2026-10-20, P0).
describe('arranque de Elaborados aplica el origin_id de la terminal', () => {
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
