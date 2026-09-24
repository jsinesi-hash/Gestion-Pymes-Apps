// packages/shared/src/__boundary__/no-import-apps.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PKGS = path.resolve(__dirname, '../../..'); // packages/

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return ['node_modules', 'dist'].includes(d.name) ? [] : archivos(p);
    return /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

describe('invariante: ningún paquete del core importa de apps/*', () => {
  it('sin imports a apps/ ni a paquetes de app', () => {
    const malos = archivos(PKGS).filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*\/apps\/|from\s+['"](ferreteria-client|elaborados-client)['"]/.test(src);
    });
    expect(malos).toEqual([]);
  });
});
