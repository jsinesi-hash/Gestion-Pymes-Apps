import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Revisión 2026-10-20 (P2): trinquete anti-duplicación. `requireSession` estaba copiada 23 veces y
// el handler de `impuesto` y `config.ts` repetidos en Retail y Elaborados. No hay ESLint en el repo,
// así que este test impide que vuelvan a aparecer: lo universal vive en @core/main.
const raiz = path.resolve(__dirname, '../../..'); // raíz del monorepo

function fuentes(dir: string): string[] {
  const salida: string[] = [];
  if (!fs.existsSync(dir)) return salida;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '__tests__') continue;
      salida.push(...fuentes(p));
    } else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) {
      salida.push(p);
    }
  }
  return salida;
}

const DIRS_MAIN = ['apps/retail/src/main', 'apps/elaborados/src/main', 'packages/core-main/src'];

describe('sin duplicados en el main', () => {
  it('requireSession tiene una única definición: la del núcleo (auth/guard.ts)', () => {
    const definiciones = DIRS_MAIN.flatMap((d) => fuentes(path.join(raiz, d)))
      .filter((f) => /\bfunction\s+requireSession(OrThrow)?\s*\(|\bconst\s+requireSession(OrThrow)?\s*=/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(raiz, f).split(path.sep).join('/'));
    expect(definiciones).toEqual(['packages/core-main/src/auth/guard.ts']);
  });

  it('el handler de impuesto vive solo en el núcleo', () => {
    const copias = ['apps/retail/src/main/ipc/impuesto.ts', 'apps/elaborados/src/main/ipc/impuesto.ts']
      .filter((f) => fs.existsSync(path.join(raiz, f)));
    expect(copias).toEqual([]);
    expect(fs.existsSync(path.join(raiz, 'packages/core-main/src/ipc/impuesto.ts'))).toBe(true);
  });

  it('la config de la terminal vive solo en el núcleo (terminal.ts)', () => {
    const copias = ['apps/retail/src/main/config.ts', 'apps/elaborados/src/main/config.ts']
      .filter((f) => fs.existsSync(path.join(raiz, f)));
    expect(copias).toEqual([]);
  });
});
