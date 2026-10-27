import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Revisión 2026-10-20 (P1): el renderer accedía al bridge con `(globalThis as any).ferreteria`
// (146 usos en Retail, 20 en Elaborados), lo que anulaba cualquier verificación de tipos y
// contradice la regla de CLAUDE.md ("nunca escribir globalThis.<clave> a mano"). Se migró todo a
// `bridge()` (tipado) y este test es el "trinquete": no hay ESLint en el repo, así que impide que
// vuelvan a aparecer. El tope es 0.
const PATRON = /\(\s*(?:globalThis|window)\s+as\s+any\s*\)\s*\.\s*(?:ferreteria|elaborados)\b|\b(?:globalThis|window)\.(?:ferreteria|elaborados)\b/g;

export function contarAccesosSinTipar(texto: string): number {
  // sin comentarios de línea: se puede mencionar el patrón en un comentario
  const sinComentarios = texto.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  return (sinComentarios.match(PATRON) ?? []).length;
}

function archivosDeProduccion(dir: string): string[] {
  const salida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      salida.push(...archivosDeProduccion(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) && e.name !== 'test-setup.ts') {
      salida.push(p);
    }
  }
  return salida;
}

describe('contarAccesosSinTipar (el detector)', () => {
  it('detecta los accesos a mano', () => {
    expect(contarAccesosSinTipar('const f = (globalThis as any).ferreteria;')).toBe(1);
    expect(contarAccesosSinTipar('await (window as any).elaborados.articulo.list();')).toBe(1);
    expect(contarAccesosSinTipar('globalThis.ferreteria.x(); window.elaborados.y();')).toBe(2);
  });
  it('no confunde bridge() ni comentarios', () => {
    expect(contarAccesosSinTipar('await bridge().articulo.list();')).toBe(0);
    expect(contarAccesosSinTipar('// antes: (globalThis as any).ferreteria')).toBe(0);
    expect(contarAccesosSinTipar('(globalThis as any).__otraCosa')).toBe(0);
  });
});

describe('trinquete de acceso al bridge', () => {
  const raiz = path.resolve(__dirname, '../../..'); // apps/
  it.each(['retail', 'elaborados'])('el renderer de %s no usa accesos sin tipar (tope 0)', (app) => {
    const dir = path.join(raiz, app, 'src', 'renderer');
    const infractores = archivosDeProduccion(dir)
      .map((f) => ({ f: path.relative(raiz, f), n: contarAccesosSinTipar(fs.readFileSync(f, 'utf8')) }))
      .filter((x) => x.n > 0);
    expect(infractores).toEqual([]);
  });
});
