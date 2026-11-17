import { describe, it, expect } from 'vitest';
import { CLAVES_NEGOCIO_CORE } from '@core/main';
import { createTestDb } from './helpers';
import { CLAVES_NEGOCIO_ELABORADOS } from '../db/claves-negocio';

// Baranda ADR-155 §1 (F1 PR7): la configuración del negocio vive en `configuracion_negocio` y lo de
// cada terminal en `parametros_sistema`. Una clave nueva del negocio se declara y se siembra por migración.
describe('configuración del negocio vs. de la terminal (elaborados)', () => {
  const db = createTestDb();
  const sqlite = db.$client;
  const negocio = (sqlite.prepare('select id from configuracion_negocio').all() as { id: string }[]).map((r) => r.id);
  const local = (sqlite.prepare('select clave from parametros_sistema').all() as { clave: string }[]).map((r) => r.clave);
  const declaradas = new Set<string>([...CLAVES_NEGOCIO_CORE, ...CLAVES_NEGOCIO_ELABORADOS]);

  it('todo lo que hay en configuracion_negocio está declarado como del negocio', () => {
    expect(negocio.filter((k) => !declaradas.has(k))).toEqual([]);
  });

  it('toda clave del negocio de la app está sembrada, y caja_modo también', () => {
    expect([...CLAVES_NEGOCIO_ELABORADOS, 'caja_modo'].filter((k) => !negocio.includes(k))).toEqual([]);
  });

  it('ninguna clave del negocio quedó en parametros_sistema', () => {
    expect(local.filter((k) => declaradas.has(k))).toEqual([]);
  });
});
