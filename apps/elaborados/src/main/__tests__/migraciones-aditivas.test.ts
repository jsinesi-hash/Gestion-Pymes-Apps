import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { problemasDeConvivencia } from '@core/db';

// F3 PR6 (análisis §3.9, ADR-042, ADR-150 §8): desde que hay cajas con hub, el hub se actualiza primero y
// acepta las cajas de la versión anterior. Toda migración posterior al corte tiene que ser aditiva: nada de
// columnas obligatorias sin DEFAULT, columnas borradas o renombradas, ni tablas reconstruidas.
const MIGRACIONES = path.resolve(__dirname, '../db/migrations');
/** Primera migración de la fase con hub (F2 PR1: `updated_at` en segundos). */
const CORTE = 21;

const journal = JSON.parse(fs.readFileSync(path.join(MIGRACIONES, 'meta', '_journal.json'), 'utf8')) as { entries: { idx: number; tag: string }[] };
const sql = (tag: string) => fs.readFileSync(path.join(MIGRACIONES, `${tag}.sql`), 'utf8');

describe('migraciones aditivas de Elaborados (convivencia de versiones)', () => {
  const posteriores = journal.entries.filter((e) => e.idx >= CORTE);

  it('hay migraciones después del corte para revisar', () => {
    expect(posteriores.length).toBeGreaterThan(0);
  });

  it.each(posteriores.map((e) => [e.tag]))('%s es aditiva', (tag) => {
    expect(problemasDeConvivencia(sql(tag))).toEqual([]);
  });

  it('la baranda detecta una reconstrucción de tabla (0020, anterior al corte)', () => {
    expect(problemasDeConvivencia(sql('0020_adr157_venta_centavos')).length).toBeGreaterThan(0);
  });
});
