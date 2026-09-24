import { describe, it, expect } from 'vitest';
import { verificarCamposSync } from '@core/db';
import * as schema from '../schema';

// Excepciones documentadas (spec §5.5 B2): geo = catálogo de referencia, parametros_sistema =
// clave-valor, aviso = outbox local por terminal (ADR-047 §10).
const EXCEPCIONES = ['provincia', 'departamento', 'localidad', 'parametros_sistema', 'aviso'];

describe('B2 — toda tabla sincronizable tiene id texto + campos de sync', () => {
  it('sin incumplimientos', () => {
    expect(verificarCamposSync(schema, EXCEPCIONES)).toEqual([]);
  });
});
