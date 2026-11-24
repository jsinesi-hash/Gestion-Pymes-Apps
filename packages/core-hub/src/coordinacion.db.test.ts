import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { abrirAlmacenHub } from './almacen';
import { abrirCoordinacion, type CoordinacionHub } from './coordinacion';
import { esquemaPrueba, registroPrueba } from './__fixtures__/esquema';

// ADR-152 §2: el hub otorga a una sola terminal el permiso de coordinadora, con vencimiento; la que lo
// tiene lo renueva y, si deja de renovarlo, lo toma otra al vencer. ADR-154 §2: el hub reparte bloques
// de correlativos por serie, sin superponerse.
const MIGRACIONES = path.resolve(__dirname, '__fixtures__/migraciones');

describe('coordinación del hub', () => {
  let coord: CoordinacionHub;
  const T0 = 1_800_000_000_000;
  const VIGENCIA = 120_000;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    abrirAlmacenHub(sqlite, { schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES });
    coord = abrirCoordinacion(sqlite, { vigenciaMs: VIGENCIA });
  });

  it('la primera que pide es coordinadora; otra no la obtiene mientras esté vigente', () => {
    expect(coord.pedirCoordinadora('C1', T0)).toEqual({ coordinadora: true, origin_id: 'C1', vigencia_ms: VIGENCIA });
    expect(coord.pedirCoordinadora('C2', T0 + 1000)).toEqual({ coordinadora: false, origin_id: 'C1', vigencia_ms: VIGENCIA - 1000 });
  });

  it('la coordinadora renueva y la vigencia vuelve a contar desde la renovación', () => {
    coord.pedirCoordinadora('C1', T0);
    expect(coord.pedirCoordinadora('C1', T0 + 60_000)).toEqual({ coordinadora: true, origin_id: 'C1', vigencia_ms: VIGENCIA });
    expect(coord.pedirCoordinadora('C2', T0 + 60_000 + VIGENCIA - 1)).toMatchObject({ coordinadora: false, origin_id: 'C1' });
  });

  it('si la coordinadora deja de renovar, al vencer la toma otra', () => {
    coord.pedirCoordinadora('C1', T0);
    expect(coord.pedirCoordinadora('C2', T0 + VIGENCIA)).toEqual({ coordinadora: true, origin_id: 'C2', vigencia_ms: VIGENCIA });
    expect(coord.pedirCoordinadora('C1', T0 + VIGENCIA + 1)).toMatchObject({ coordinadora: false, origin_id: 'C2' });
  });

  it('soltar libera el permiso solo si lo tiene esa terminal', () => {
    coord.pedirCoordinadora('C1', T0);
    coord.soltarCoordinadora('C2');
    expect(coord.pedirCoordinadora('C2', T0 + 1)).toMatchObject({ coordinadora: false });
    coord.soltarCoordinadora('C1');
    expect(coord.pedirCoordinadora('C2', T0 + 2)).toMatchObject({ coordinadora: true, origin_id: 'C2' });
  });

  it('los bloques de una serie no se superponen y respetan el mínimo que pide la terminal', () => {
    expect(coord.asignarBloque('sku', 'C1', { minimo: 1040, tamano: 1000 }, T0)).toEqual({ serie: 'sku', desde: 1040, hasta: 2039 });
    // C2 pide desde un número más bajo (su base sabe menos): el hub sigue después del último bloque.
    expect(coord.asignarBloque('sku', 'C2', { minimo: 1, tamano: 1000 }, T0)).toEqual({ serie: 'sku', desde: 2040, hasta: 3039 });
    // Un mínimo más alto que todo lo repartido salta hasta él.
    expect(coord.asignarBloque('sku', 'C1', { minimo: 5000, tamano: 10 }, T0)).toEqual({ serie: 'sku', desde: 5000, hasta: 5009 });
    // Otra serie empieza por su cuenta.
    expect(coord.asignarBloque('lote', 'C1', { minimo: 1, tamano: 5 }, T0)).toEqual({ serie: 'lote', desde: 1, hasta: 5 });
    expect(coord.bloques().filter((b) => b.serie === 'sku').map((b) => b.origin_id)).toEqual(['C1', 'C2', 'C1']);
  });

  it('rechaza una serie, un tamaño o un mínimo inválidos', () => {
    expect(() => coord.asignarBloque('SKU; drop', 'C1', { minimo: 1, tamano: 10 })).toThrow('BLOQUE_INVALIDO');
    expect(() => coord.asignarBloque('sku', 'C1', { minimo: 1, tamano: 0 })).toThrow('BLOQUE_INVALIDO');
    expect(() => coord.asignarBloque('sku', 'C1', { minimo: 1, tamano: 1_000_000 })).toThrow('BLOQUE_INVALIDO');
    expect(() => coord.asignarBloque('sku', 'C1', { minimo: 0, tamano: 10 })).toThrow('BLOQUE_INVALIDO');
  });

  // F3 PR4 (ADR-155 §3 y §4): un solo turno de caja compartida abierto en el negocio.
  it('caja compartida: abre la primera; otra caja no abre un segundo turno; repetir es idempotente', () => {
    expect(coord.abrirCajaCompartida('caja-1', 'C1', T0)).toEqual({ abierta: true, caja_id: 'caja-1', origin_id: 'C1' });
    expect(coord.abrirCajaCompartida('caja-2', 'C2', T0 + 1)).toEqual({ abierta: false, caja_id: 'caja-1', origin_id: 'C1' });
    expect(coord.abrirCajaCompartida('caja-1', 'C1', T0 + 2)).toEqual({ abierta: true, caja_id: 'caja-1', origin_id: 'C1' });
    expect(coord.cajaCompartida()).toEqual({ caja_id: 'caja-1', origin_id: 'C1', abierta_en_ms: T0 });
  });

  it('caja compartida: se cierra solo el turno abierto; después se puede abrir otro', () => {
    coord.abrirCajaCompartida('caja-1', 'C1', T0);
    expect(coord.cerrarCajaCompartida('caja-2')).toEqual({ cerrada: false, caja_id: 'caja-1' });
    expect(coord.cerrarCajaCompartida('caja-1')).toEqual({ cerrada: true, caja_id: null });
    expect(coord.cerrarCajaCompartida('caja-1')).toEqual({ cerrada: true, caja_id: null }); // sin turno: no hay nada que cerrar
    expect(coord.cajaCompartida()).toBeNull();
    expect(coord.abrirCajaCompartida('caja-2', 'C2', T0 + 5)).toMatchObject({ abierta: true, caja_id: 'caja-2' });
  });

  it('caja compartida: un id inválido se rechaza', () => {
    expect(() => coord.abrirCajaCompartida('', 'C1', T0)).toThrow('CAJA_INVALIDA');
  });
});
