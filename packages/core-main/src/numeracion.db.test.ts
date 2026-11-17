import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { setupCoreDb } from './testing/helpers';
import { setOriginId } from './context';
import { numeroPorTerminal, siguienteNumeroPorTerminal } from './numeracion';

// ADR-154: numeración de documentos por terminal, `<PREFIJO>-<terminal>-NNNNNN`.
describe('numeroPorTerminal', () => {
  it('arma PREFIJO-terminal-NNNNNN con 6 dígitos y no trunca si se pasa', () => {
    expect(numeroPorTerminal('RE', 'C1', 1)).toBe('RE-C1-000001');
    expect(numeroPorTerminal('PR', 'CAJA2', 42)).toBe('PR-CAJA2-000042');
    expect(numeroPorTerminal('RE', 'C1', 1234567)).toBe('RE-C1-1234567');
  });
});

describe('siguienteNumeroPorTerminal', () => {
  let db: ReturnType<typeof setupCoreDb>;
  const contador = (clave: string) => db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get()?.valor;

  beforeEach(() => { db = setupCoreDb(); setOriginId('C1'); });
  afterEach(() => setOriginId('C1'));

  it('crea el correlativo de la terminal en el primer uso y lo avanza', () => {
    expect(db.transaction((tx) => siguienteNumeroPorTerminal(tx, 'RE', 'remito')))
      .toEqual({ numero: 'RE-C1-000001', correlativo: 1 });
    expect(db.transaction((tx) => siguienteNumeroPorTerminal(tx, 'RE', 'remito')))
      .toEqual({ numero: 'RE-C1-000002', correlativo: 2 });
    expect(contador('remito_correlativo_C1')).toBe('2');
  });

  it('cada terminal lleva su propio correlativo', () => {
    db.transaction((tx) => siguienteNumeroPorTerminal(tx, 'RE', 'remito'));
    setOriginId('C2');
    expect(db.transaction((tx) => siguienteNumeroPorTerminal(tx, 'RE', 'remito')).numero).toBe('RE-C2-000001');
    expect(contador('remito_correlativo_C1')).toBe('1');
  });

  it('documentos distintos no comparten correlativo', () => {
    db.transaction((tx) => siguienteNumeroPorTerminal(tx, 'RE', 'remito'));
    expect(db.transaction((tx) => siguienteNumeroPorTerminal(tx, 'PR', 'presupuesto')).numero).toBe('PR-C1-000001');
  });

  it('no consume número si la transacción falla', () => {
    expect(() => db.transaction((tx) => {
      siguienteNumeroPorTerminal(tx, 'RE', 'remito');
      throw new Error('boom');
    })).toThrow('boom');
    expect(contador('remito_correlativo_C1')).toBeUndefined();
    expect(db.transaction((tx) => siguienteNumeroPorTerminal(tx, 'RE', 'remito')).correlativo).toBe(1);
  });
});
