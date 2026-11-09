import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// main/index.ts importa `electron` y no se puede ejecutar en el runner, así que el invariante
// se fija sobre el fuente (mismo recurso que base-seed.cli-guard.test.ts). Revisión 2026-10-20:
// el origin_id de la terminal tiene que aplicarse al contexto del main ANTES de registrar handlers
// y de `runStartup` (P0, ADR-115). Desde P2 lo hace `iniciarTerminal` de @core/main, que reemplazó
// al `config.ts` duplicado de cada app.
describe('arranque de Retail inicializa la terminal (origin_id)', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it("llama a iniciarTerminal(app.getPath('userData'))", () => {
    expect(fuente).toMatch(/iniciarTerminal\(\s*app\.getPath\(\s*'userData'\s*\)\s*\)/);
  });

  it('lo hace antes de runStartup y de registrar handlers', () => {
    const iniciar = fuente.indexOf('iniciarTerminal(');
    expect(iniciar).toBeGreaterThan(-1);
    expect(iniciar).toBeLessThan(fuente.indexOf('await runStartup('));
    expect(iniciar).toBeLessThan(fuente.indexOf('registrarHandlersRetail('));
  });

  it('ya no usa el config.ts local ni deja el resultado descartado', () => {
    expect(fuente).not.toMatch(/loadTerminalConfig/);
    expect(fuente).not.toMatch(/from '\.\/config'/);
    expect(fs.existsSync(path.join(__dirname, '..', 'config.ts'))).toBe(false);
  });
});
