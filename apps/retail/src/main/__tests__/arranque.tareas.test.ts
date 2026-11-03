import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// main/index.ts importa `electron` y no corre en el runner: el invariante se fija sobre el fuente
// (mismo recurso que arranque.origin-id.test.ts). Revisión 2026-10-20 (P0): los jobs del arranque
// (cambios de precio programados, vencimiento de presupuestos, worker de avisos) corrían sin
// try/catch —un SQLITE_BUSY tumbaba el proceso— o con `.catch(() => {})` mudo, y no había
// handlers de uncaughtException/unhandledRejection.
describe('arranque de Retail: tareas en segundo plano protegidas', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('no usa setInterval a pelo: todo va por programarTareaSegura', () => {
    expect(fuente).not.toMatch(/\bsetInterval\(/);
  });

  it.each(['cambios-programados', 'presupuestos-vencidos', 'avisos-reintentos'])(
    'programa la tarea "%s" con programarTareaSegura',
    (nombre) => {
      expect(fuente).toMatch(new RegExp(`programarTareaSegura\\(\\s*'${nombre}'`));
    },
  );

  it('no deja un .catch(() => {}) que trague errores', () => {
    expect(fuente).not.toMatch(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/);
  });

  it('no llama a los jobs directo en el arranque (sin protección)', () => {
    expect(fuente).not.toMatch(/^\s*applyPendingCambiosProgramados\(db\);/m);
    expect(fuente).not.toMatch(/^\s*presupuestoVencerLoteHandler\(db\);/m);
  });

  it('registra los errores no capturados antes de runStartup', () => {
    const registrar = fuente.indexOf('registrarErroresNoCapturados(');
    expect(registrar).toBeGreaterThan(-1);
    expect(registrar).toBeLessThan(fuente.indexOf('await runStartup('));
  });
});
