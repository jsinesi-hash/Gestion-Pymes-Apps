import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Revisión 2026-10-20 (P2): trinquete de accesibilidad. No hay ESLint en el repo, así que este test
// impide que crezca el uso de overlays armados a mano (sin trampa de foco ni aria-modal consistente)
// y que reaparezcan filas `<tr onClick>` que solo se activan con el mouse.
//
// Migración completa (ADR-125…129, lotes A–D: 73 → 0): ya no se admite ningún overlay armado a mano.
// Un modal nuevo se escribe con `<Modal>`.

const raiz = path.resolve(__dirname, '../../..'); // raíz del monorepo
// CommandPalette tiene su propio overlay (patrón de paleta de comandos) y Modal.tsx es el componente.
const EXCLUIDOS = ['packages/core-ui/src/components/Modal.tsx', 'packages/core-ui/src/shell/CommandPalette.tsx'];

function tsx(dir: string): string[] {
  const salida: string[] = [];
  if (!fs.existsSync(dir)) return salida;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '__tests__') continue;
      salida.push(...tsx(p));
    } else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) {
      salida.push(p);
    }
  }
  return salida;
}

export function contarOverlaysAMano(texto: string): number {
  return (texto.match(/\bmodal-overlay\b/g) ?? []).length;
}

/**
 * Filas `<tr onClick>` que NO se pueden activar con el teclado. Una fila que ya trae su propio
 * `onKeyDown` (patrón previo: `tabIndex`, `role="button"`, `aria-label` y `onKeyDown`) no cuenta.
 * La etiqueta se toma hasta el primer `<td`/`<th`/`</tr`, porque un `=>` dentro de un atributo
 * contiene un `>` y no sirve para delimitarla.
 */
export function contarFilasClicablesCrudas(texto: string): number {
  let n = 0;
  for (const m of texto.matchAll(/<tr\b/g)) {
    const resto = texto.slice(m.index);
    const fin = resto.search(/<t[dh]\b|<\/tr/);
    const etiqueta = fin === -1 ? resto : resto.slice(0, fin);
    if (/\bonClick\s*=/.test(etiqueta) && !/\bonKeyDown\s*=/.test(etiqueta)) n += 1;
  }
  return n;
}

const produccion = ['apps/retail/src/renderer', 'apps/elaborados/src/renderer', 'packages/core-ui/src']
  .flatMap((d) => tsx(path.join(raiz, d)))
  .map((abs) => ({ abs, rel: path.relative(raiz, abs).split(path.sep).join('/') }))
  .filter((f) => !EXCLUIDOS.includes(f.rel));

describe('detectores', () => {
  it('cuentan overlays y filas clicables crudas', () => {
    expect(contarOverlaysAMano('<div className="modal-overlay">')).toBe(1);
    expect(contarOverlaysAMano('<div className="modal-overlay cmdk-overlay"> y otro modal-overlay')).toBe(2);
    expect(contarOverlaysAMano('<Modal titulo="x">')).toBe(0);
    expect(contarFilasClicablesCrudas('<tr key={a} onClick={() => x()}>')).toBe(1);
    expect(contarFilasClicablesCrudas('<tr key={a} {...propsFilaActivable(() => x())}>')).toBe(0);
    expect(contarFilasClicablesCrudas('<tr><td><button onClick={f}>ok</button></td></tr>')).toBe(0);
    // multilínea y con `=>` dentro del atributo (el `>` no cierra la etiqueta)
    expect(contarFilasClicablesCrudas('<tr\n  key={a}\n  onClick={() => x()}\n>\n<td>1</td></tr>')).toBe(1);
    // ya operable por teclado con su propio onKeyDown: no cuenta
    expect(contarFilasClicablesCrudas('<tr tabIndex={0} role="button" onClick={() => x()}\n onKeyDown={e => y(e)}>\n<td>1</td></tr>')).toBe(0);
  });
});

describe('trinquete de accesibilidad de modales y filas', () => {
  it(`no hay overlays armados a mano: todo modal usa <Modal>`, () => {
    const total = produccion.reduce((n, f) => n + contarOverlaysAMano(fs.readFileSync(f.abs, 'utf8')), 0);
    expect(total).toBe(0);
  });

  it('el núcleo (@core/ui) no tiene ningún overlay armado a mano', () => {
    const enNucleo = produccion
      .filter((f) => f.rel.startsWith('packages/core-ui/'))
      .filter((f) => contarOverlaysAMano(fs.readFileSync(f.abs, 'utf8')) > 0)
      .map((f) => f.rel);
    expect(enNucleo).toEqual([]);
  });

  it('no hay filas <tr onClick> crudas: se usa propsFilaActivable (teclado)', () => {
    const infractores = produccion
      .filter((f) => contarFilasClicablesCrudas(fs.readFileSync(f.abs, 'utf8')) > 0)
      .map((f) => f.rel);
    expect(infractores).toEqual([]);
  });
});
