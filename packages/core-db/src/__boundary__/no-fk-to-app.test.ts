import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), '../schema');

// Invariante §5: una tabla de app puede FK→core, pero el core NUNCA importa un dominio de
// app. Sólo se marcan sentencias de import/export-from (no comentarios en prosa). Los
// dominios de app viven en apps/retail/src/main/db/schema; si un archivo de core llega a
// importarlos (copy-paste accidental, o una FK dura core→app) esto muerde.
const IMPORT_APP =
  /\b(?:import|export)\b[^;]*\bfrom\s*['"](?:[./]*(?:catalog|precios|compras|remitos|presupuestos|agenda|sinonimos))['"]/;

describe('invariante §5: @core/db nunca FK→app', () => {
  it('ningún schema de core importa dominios de app', () => {
    const files = readdirSync(SCHEMA).filter((f) => f.endsWith('.ts'));
    const ofensores = files.filter((f) => IMPORT_APP.test(readFileSync(join(SCHEMA, f), 'utf8')));
    expect(ofensores, `core-db referencia app:\n${ofensores.join('\n')}`).toEqual([]);
  });
});
