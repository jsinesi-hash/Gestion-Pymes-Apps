import { describe, it, expect } from 'vitest';
import { verificarCamposSync } from '@core/db';
import * as schema from '../db/schema';

// Excepciones documentadas (spec §5.5 B2): geo = catálogo de referencia, parametros_sistema =
// clave-valor, aviso = outbox local por terminal (ADR-047 §10), recuperacion_password = códigos de
// recuperación de contraseña, estado operativo local que no se sincroniza (ADR-137).
const EXCEPCIONES = ['provincia', 'departamento', 'localidad', 'parametros_sistema', 'aviso', 'recuperacion_password'];

describe('B2 — toda tabla sincronizable tiene id texto + campos de sync', () => {
  it('sin incumplimientos', () => {
    expect(verificarCamposSync(schema, EXCEPCIONES)).toEqual([]);
  });
});
