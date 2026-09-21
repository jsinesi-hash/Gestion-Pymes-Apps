// packages/shared/src/__boundary__/no-electron.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

// Prohibido: importar electron o builtins de Node desde el dominio puro (baranda B4).
// PERMITIDO: el global Web Crypto (`crypto.randomUUID()`), que existe en browser Y Node
// sin `import`. La prohibición es sobre `import`/`require`, no sobre globals.
const PROHIBIDO = /\b(?:import|require)\s*(?:\(|[^;]*\bfrom\s*)['"](?:electron|node:[a-z/]+|fs|path|os|crypto|child_process|better-sqlite3|drizzle-orm)['"]/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('baranda B4: shared es dominio puro sin Electron/Node', () => {
  it('ningún archivo de shared/src importa electron ni builtins de node', () => {
    const ofensores = walk(SRC).filter((f) => PROHIBIDO.test(readFileSync(f, 'utf8')));
    expect(ofensores, `Fuga de plataforma en shared:\n${ofensores.join('\n')}`).toEqual([]);
  });
});
