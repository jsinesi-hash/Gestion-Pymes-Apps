import { describe, it, expect } from 'vitest';
import { POS_ATAJOS, teclaDe, atajoHabilitado, textoAyudaAtajos, type PosAtajoCtx } from '../../../../common/posAtajos';

const base: PosAtajoCtx = {
  lineas: 1, loading: false, cantidadEnEspera: 1, canOverride: true, multiplicadorPendiente: false,
};

describe('posAtajos', () => {
  it('no usa las teclas reservadas F1, F5, F10, F11, F12', () => {
    for (const a of POS_ATAJOS) expect(['F1', 'F5', 'F10', 'F11', 'F12']).not.toContain(a.tecla);
  });

  it('no repite teclas', () => {
    const teclas = POS_ATAJOS.map((a) => a.tecla);
    expect(new Set(teclas).size).toBe(teclas.length);
  });

  it('teclaDe devuelve la tecla de cada acción', () => {
    expect(teclaDe('enfocar-buscador')).toBe('F2');
    expect(teclaDe('cobrar')).toBe('F4');
    expect(teclaDe('descuento-ultima-linea')).toBe('F6');
    expect(teclaDe('ventas-espera')).toBe('F8');
    expect(teclaDe('poner-espera')).toBe('F9');
    expect(teclaDe('cancelar-multiplicador')).toBe('Escape');
  });

  it('F2 siempre habilitado', () => {
    expect(atajoHabilitado('enfocar-buscador', { ...base, lineas: 0, loading: true })).toBe(true);
  });

  it('F4 y F9 requieren líneas y no estar cargando', () => {
    for (const a of ['cobrar', 'poner-espera'] as const) {
      expect(atajoHabilitado(a, base)).toBe(true);
      expect(atajoHabilitado(a, { ...base, lineas: 0 })).toBe(false);
      expect(atajoHabilitado(a, { ...base, loading: true })).toBe(false);
    }
  });

  it('F6 requiere precio.override y líneas', () => {
    expect(atajoHabilitado('descuento-ultima-linea', base)).toBe(true);
    expect(atajoHabilitado('descuento-ultima-linea', { ...base, canOverride: false })).toBe(false);
    expect(atajoHabilitado('descuento-ultima-linea', { ...base, lineas: 0 })).toBe(false);
  });

  it('F8 requiere ventas en espera', () => {
    expect(atajoHabilitado('ventas-espera', base)).toBe(true);
    expect(atajoHabilitado('ventas-espera', { ...base, cantidadEnEspera: 0 })).toBe(false);
  });

  it('Esc requiere multiplicador pendiente', () => {
    expect(atajoHabilitado('cancelar-multiplicador', base)).toBe(false);
    expect(atajoHabilitado('cancelar-multiplicador', { ...base, multiplicadorPendiente: true })).toBe(true);
  });

  it('la ayuda F1 se genera desde la misma tabla y conserva los atajos del menú', () => {
    const t = textoAyudaAtajos();
    for (const a of POS_ATAJOS) {
      expect(t).toContain(a.descripcion);
      expect(t).toContain(a.tecla === 'Escape' ? 'Esc' : a.tecla);
    }
    expect(t).toContain('Ctrl+N');
    expect(t).toContain('Ctrl+F4');
    expect(t).toContain('Ctrl+Q');
    expect(t).toContain('F1');
  });
});
