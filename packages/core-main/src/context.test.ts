import { describe, it, expect, afterEach } from 'vitest';
import { aplicarConfigTerminal, getOriginId, setOriginId } from './context';

// Revisión 2026-10-20 (P0): `loadTerminalConfig()` se llamaba al arrancar pero su valor se
// descartaba y nadie invocaba `setOriginId`: todas las terminales grababan `origin_id='C1'` y
// numeraban `V-C1-…`, lo que choca en R4 (numero_interno UNIQUE, last-write-wins por origen).
describe('aplicarConfigTerminal', () => {
  afterEach(() => setOriginId('C1'));

  it('el origin_id por defecto sigue siendo C1', () => {
    expect(getOriginId()).toBe('C1');
  });

  it('aplica el origin_id de la config de la terminal', () => {
    aplicarConfigTerminal({ origin_id: 'C2' });
    expect(getOriginId()).toBe('C2');
  });

  it.each(['', '   ', 'C 2', 'C-2', 'a'.repeat(9), '3f2b8c1e-aaaa-bbbb-cccc-123456789012'])(
    'rechaza un origin_id inválido (%j) y conserva el anterior',
    (invalido) => {
      aplicarConfigTerminal({ origin_id: 'C3' });
      expect(() => aplicarConfigTerminal({ origin_id: invalido })).toThrow('TERMINAL_INVALIDA');
      expect(getOriginId()).toBe('C3');
    },
  );
});
