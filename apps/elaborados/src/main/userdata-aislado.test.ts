import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// `./db/client` abre la BD al importarse, así que el aislamiento de userData tiene que estar
// importado antes. El orden de los imports en index.ts es lo que lo garantiza: este test lo fija.
describe('arranque: userData aislado', () => {
  it("index.ts importa './userdata-aislado' antes que './db/client'", () => {
    const fuente = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
    const aislado = fuente.indexOf("import './userdata-aislado';");
    const cliente = fuente.indexOf("from './db/client'");
    expect(aislado).toBeGreaterThan(-1);
    expect(cliente).toBeGreaterThan(-1);
    expect(aislado).toBeLessThan(cliente);
  });
});
