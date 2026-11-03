import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Ver apps/retail/src/main/__tests__/arranque.origin-id.test.ts: mismo invariante para
// Elaborados (revisión 2026-10-20, P0 y P2).
describe('arranque de Elaborados inicializa la terminal (origin_id)', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it("llama a iniciarTerminal(app.getPath('userData'))", () => {
    expect(fuente).toMatch(/iniciarTerminal\(\s*app\.getPath\(\s*'userData'\s*\)\s*\)/);
  });

  it('lo hace antes de runStartup y de registrar handlers', () => {
    const iniciar = fuente.indexOf('iniciarTerminal(');
    expect(iniciar).toBeGreaterThan(-1);
    expect(iniciar).toBeLessThan(fuente.indexOf('await runStartup('));
    expect(iniciar).toBeLessThan(fuente.indexOf('registerCoreHandlers('));
  });

  it('ya no usa el config.ts local ni deja el resultado descartado', () => {
    expect(fuente).not.toMatch(/loadTerminalConfig/);
    expect(fuente).not.toMatch(/from '\.\/config'/);
    expect(fs.existsSync(path.join(__dirname, '..', 'config.ts'))).toBe(false);
  });

  // Revisión 2026-10-20 (P0): sin handlers de uncaughtException/unhandledRejection un error no
  // capturado en el main cortaba el proceso en plena venta.
  it('registra los errores no capturados antes de runStartup', () => {
    const registrar = fuente.indexOf('registrarErroresNoCapturados(');
    expect(registrar).toBeGreaterThan(-1);
    expect(registrar).toBeLessThan(fuente.indexOf('await runStartup('));
  });
});
