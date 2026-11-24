import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { abrirAlmacenHub, type AlmacenHub } from './almacen';
import { esquemaPrueba, registroPrueba } from './__fixtures__/esquema';

// ADR-150 §4 a §6 y §10: el hub guarda las filas que le suben las terminales, les asigna un número de
// secuencia (el cursor del pull) y resuelve los choques sin lógica de dominio (ADR-149 §1).
const MIGRACIONES = path.resolve(__dirname, '__fixtures__/migraciones');

function marca(id: string, nombre: string, version: number, updated_at: number, extra: Record<string, unknown> = {}) {
  return { tabla: 'marca', fila: { id, nombre, activo: 1, version, origin_id: 'C1', sync_state: 'pending', updated_at, ...extra } };
}

describe('almacén del hub', () => {
  let sqlite: Database.Database;
  let hub: AlmacenHub;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    hub = abrirAlmacenHub(sqlite, { schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES });
  });

  const fila = (tabla: string, id: string) => sqlite.prepare(`select * from "${tabla}" where id = ?`).get(id) as Record<string, unknown> | undefined;

  it('aplica un alta, le asigna secuencia y la guarda como sincronizada', () => {
    const [r] = hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100)]);
    expect(r).toEqual({ estado: 'aplicado', seq: 1 });
    expect(fila('marca', 'm1')).toMatchObject({ nombre: 'Stanley', version: 1, sync_state: 'synced' });
    expect(hub.ultimoCursor()).toBe(1);
  });

  it('es idempotente: reenviar el mismo cambio devuelve el mismo resultado y no suma secuencia', () => {
    hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100)]);
    const [r] = hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100)]);
    expect(r).toEqual({ estado: 'aplicado', seq: 1, duplicado: true });
    expect(hub.ultimoCursor()).toBe(1);
  });

  it('maestro: gana el updated_at más reciente; el que pierde va al log y el ganador se reemite', () => {
    hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100)]);
    hub.aplicarLote('C1', [marca('m1', 'Stanley Tools', 2, 300)]);
    const [r] = hub.aplicarLote('C2', [marca('m1', 'STANLEY', 2, 200)]);
    expect(r).toMatchObject({ estado: 'perdio', seq: 3 });
    expect(fila('marca', 'm1')).toMatchObject({ nombre: 'Stanley Tools' });
    const [c] = hub.conflictos();
    expect(c).toMatchObject({ tipo: 'lww', tabla: 'marca', fila_id: 'm1', origin_id: 'C2' });
    expect(JSON.parse(c!.fila_entrante)).toMatchObject({ nombre: 'STANLEY' });
    // El ganador se vuelve a emitir para que la terminal que perdió lo baje aunque su cursor ya lo pasó.
    const { cambios } = hub.cambiosDesde(2, 10);
    expect(cambios).toMatchObject([{ seq: 3, tabla: 'marca', fila_id: 'm1', origin_id: 'C1' }]);
    expect(cambios[0]!.fila).toMatchObject({ nombre: 'Stanley Tools' });
  });

  it('maestro: si el cambio concurrente que llega después es el más nuevo, gana, y el que pierde también va al log', () => {
    // Hallazgo de la prueba de punta a punta (F2 PR7): las dos terminales editaron la misma fila sin
    // conexión; llegó primero la edición más vieja y la nueva la pisaba sin dejar rastro.
    hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100)]);
    hub.aplicarLote('C1', [marca('m1', 'De A', 2, 200)]);
    const [r] = hub.aplicarLote('C2', [marca('m1', 'De B', 2, 300)]); // C2 no vio la versión 2 de C1
    expect(r).toMatchObject({ estado: 'aplicado' });
    expect(fila('marca', 'm1')).toMatchObject({ nombre: 'De B' });
    const [c] = hub.conflictos();
    expect(c).toMatchObject({ tipo: 'lww', tabla: 'marca', fila_id: 'm1', origin_id: 'C2', detalle: 'GANO_EL_ENTRANTE' });
    expect(JSON.parse(c!.fila_entrante)).toMatchObject({ nombre: 'De B' });
    expect(JSON.parse(c!.fila_actual!)).toMatchObject({ nombre: 'De A' }); // la edición que se perdió

    // Un cambio que ya había visto el anterior (versión mayor) no es concurrente: no es conflicto.
    hub.aplicarLote('C1', [marca('m1', 'De A otra vez', 3, 400)]);
    expect(hub.conflictos()).toHaveLength(1);
  });

  it('maestro: otra copia idéntica de una fila que ya llegó no es cambio ni conflicto', () => {
    hub.aplicarLote('C1', [marca('m1', 'Genérica', 1, 100)]);
    const [r] = hub.aplicarLote('C2', [marca('m1', 'Genérica', 1, 90)]);
    expect(r).toEqual({ estado: 'aplicado', seq: 1, duplicado: true });
    expect(hub.conflictos()).toEqual([]);
    expect(hub.ultimoCursor()).toBe(1);
  });

  it('maestro: una fila que solo sembró una migración del hub no compite: el primer cambio la pisa', () => {
    // Sembrada "después" (reloj del hub) y con la misma versión: igual gana la de la terminal.
    sqlite.prepare("insert into marca (id, nombre, activo, version, origin_id, sync_state, updated_at) values ('m1', 'Semilla', 1, 1, 'SYSTEM', 'synced', 999)").run();
    const [r] = hub.aplicarLote('C1', [{ tabla: 'marca', fila: { id: 'm1', nombre: 'Editada', activo: 1, version: 1, origin_id: 'SYSTEM', sync_state: 'pending', updated_at: 500 } }]);
    expect(r).toMatchObject({ estado: 'aplicado' });
    expect(fila('marca', 'm1')).toMatchObject({ nombre: 'Editada' });
  });

  it('maestro: si la fila sembrada por migración es igual a la de la terminal, el hub guarda la de la terminal', () => {
    sqlite.prepare("insert into marca (id, nombre, activo, version, origin_id, sync_state, updated_at) values ('m1', 'Semilla', 1, 1, 'SYSTEM', 'synced', 999)").run();
    hub.aplicarLote('C1', [{ tabla: 'marca', fila: { id: 'm1', nombre: 'Semilla', activo: 1, version: 1, origin_id: 'SYSTEM', sync_state: 'pending', updated_at: 500 } }]);
    expect(fila('marca', 'm1')).toMatchObject({ updated_at: 500 });
    expect(hub.conflictos()).toEqual([]);
  });

  it('maestro: a igual updated_at gana el origin_id menor (determinista)', () => {
    hub.aplicarLote('C2', [marca('m1', 'De C2', 1, 100)]);
    expect(hub.aplicarLote('C1', [marca('m1', 'De C1', 2, 100)])[0]!.estado).toBe('aplicado');
    expect(hub.aplicarLote('C3', [marca('m1', 'De C3', 3, 100)])[0]!.estado).toBe('perdio');
    expect(fila('marca', 'm1')).toMatchObject({ nombre: 'De C1' });
  });

  it('maestro: dos cambios de la misma terminal se ordenan por versión, no por reloj', () => {
    hub.aplicarLote('C1', [marca('m1', 'v1', 1, 500)]);
    expect(hub.aplicarLote('C1', [marca('m1', 'v2', 2, 400)])[0]!.estado).toBe('aplicado'); // su reloj retrocedió
    expect(fila('marca', 'm1')).toMatchObject({ nombre: 'v2' });
  });

  it('unicidad: un alta que choca con un índice único se rechaza a conflicto y el resto del lote sigue', () => {
    hub.aplicarLote('C1', [marca('m1', 'Bosch', 1, 100)]);
    const r = hub.aplicarLote('C2', [marca('m2', 'Bosch', 1, 200), marca('m3', 'Makita', 1, 200)]);
    expect(r[0]).toMatchObject({ estado: 'unicidad' });
    expect(r[1]).toMatchObject({ estado: 'aplicado' });
    expect(fila('marca', 'm2')).toBeUndefined();
    expect(hub.conflictos()).toMatchObject([{ tipo: 'unicidad', fila_id: 'm2', origin_id: 'C2' }]);
  });

  it('libro: se inserta una vez; repetido igual es duplicado, distinto es error de integridad', () => {
    hub.aplicarLote('C1', [
      marca('m1', 'Stanley', 1, 100),
      { tabla: 'articulo', fila: { id: 'a1', marca_id: 'm1', nombre: 'Martillo', version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: 100 } },
    ]);
    const mov = (cantidad: number, version = 1) => ({ tabla: 'movimiento', fila: { id: 'v1', articulo_id: 'a1', cantidad, version, origin_id: 'C1', sync_state: 'pending', updated_at: 110 } });
    expect(hub.aplicarLote('C1', [mov(5)])[0]!.estado).toBe('aplicado');
    expect(hub.aplicarLote('C2', [mov(5, 2)])[0]).toMatchObject({ estado: 'aplicado', duplicado: true });
    expect(hub.aplicarLote('C2', [mov(7, 3)])[0]).toMatchObject({ estado: 'integridad' });
    expect(fila('movimiento', 'v1')).toMatchObject({ cantidad: 5 });
    expect(hub.conflictos().map((c) => c.tipo)).toEqual(['integridad']);
  });

  it('columnas proyectadas: no se guardan como dato; un alta sin ellas queda en 0', () => {
    hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100)]);
    hub.aplicarLote('C1', [{ tabla: 'articulo', fila: { id: 'a1', marca_id: 'm1', nombre: 'Martillo', stock: 99, version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: 100 } }]);
    expect(fila('articulo', 'a1')).toMatchObject({ stock: 0 });
    expect(hub.cambiosDesde(0, 10).cambios[1]!.fila).not.toHaveProperty('stock');
  });

  it('FK: el lote se aplica con las claves diferidas (el hijo puede llegar antes que el padre)', () => {
    const r = hub.aplicarLote('C1', [
      { tabla: 'articulo', fila: { id: 'a1', marca_id: 'm1', nombre: 'Martillo', version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: 100 } },
      marca('m1', 'Stanley', 1, 100),
    ]);
    expect(r.map((x) => x.estado)).toEqual(['aplicado', 'aplicado']);
  });

  const articulo = (id: string, marcaId: string, origen = 'C2', version = 1) =>
    ({ tabla: 'articulo', fila: { id, marca_id: marcaId, nombre: 'Martillo', version, origin_id: origen, sync_state: 'pending', updated_at: 200 } });
  const mov = (id: string, articuloId: string) =>
    ({ tabla: 'movimiento', fila: { id, articulo_id: articuloId, cantidad: 1, version: 1, origin_id: 'C2', sync_state: 'pending', updated_at: 200 } });

  it('FK (F3 PR1): un cambio cuya referencia no existe queda en espera y el resto del lote se aplica', () => {
    // Antes el lote entero se rechazaba (LOTE_FK_ROTA) y la terminal no podía subir nada más.
    const r = hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100), articulo('a1', 'no-existe', 'C1')]);
    expect(r).toEqual([{ estado: 'aplicado', seq: 1 }, { estado: 'en_espera' }]);
    expect(fila('marca', 'm1')).toBeDefined();
    expect(fila('articulo', 'a1')).toBeUndefined();
    expect(hub.listarConflictos({}).enEspera).toBe(1);
    // Reenviarlo (un corte antes de la respuesta) no lo duplica.
    expect(hub.aplicarLote('C1', [articulo('a1', 'no-existe', 'C1')])).toEqual([{ estado: 'en_espera', duplicado: true }]);
    expect(hub.listarConflictos({}).enEspera).toBe(1);
  });

  it('en espera (F3 PR1): un alta rechazada por unicidad no frena a la terminal; al renombrarla entran sus dependientes', () => {
    hub.aplicarLote('C1', [marca('m1', 'Bosch', 1, 100)]);
    expect(hub.aplicarLote('C2', [marca('m2', 'Bosch', 1, 200, { origin_id: 'C2' })])[0]!.estado).toBe('unicidad');
    // La terminal siguió trabajando: un artículo de esa marca, un movimiento del artículo y otra marca.
    const r = hub.aplicarLote('C2', [articulo('a2', 'm2'), mov('v2', 'a2'), marca('m3', 'Makita', 1, 200, { origin_id: 'C2' })]);
    expect(r.map((x) => x.estado)).toEqual(['en_espera', 'en_espera', 'aplicado']);
    // El Supervisor la renombra en la terminal de origen: entra la marca y, detrás, lo que esperaba.
    expect(hub.aplicarLote('C2', [marca('m2', 'Bosch B', 2, 300, { origin_id: 'C2' })])[0]!.estado).toBe('aplicado');
    expect(fila('articulo', 'a2')).toMatchObject({ marca_id: 'm2', sync_state: 'synced' });
    expect(fila('movimiento', 'v2')).toBeDefined();
    expect(hub.listarConflictos({}).enEspera).toBe(0);
    expect(hub.cambiosDesde(0, 50).cambios.map((c) => c.fila_id)).toEqual(expect.arrayContaining(['a2', 'v2']));
    // Y el conflicto de unicidad queda resuelto solo, a nombre de la terminal que corrigió.
    const [c] = hub.listarConflictos({ tipo: 'unicidad' }).conflictos;
    expect(c).toMatchObject({ fila_id: 'm2', resuelto: 1, resolucion: 'corregido', resuelto_por: 'C2' });
    // Un reenvío posterior del artículo ya aplicado no vuelve a quedar en espera.
    expect(hub.aplicarLote('C2', [articulo('a2', 'm2')])[0]).toMatchObject({ estado: 'aplicado', duplicado: true });
  });

  it('conflictos (F3 PR1): se listan del más nuevo al más viejo, se filtran y se pagina', () => {
    hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100), marca('m4', 'Bosch', 1, 100)]);
    hub.aplicarLote('C2', [marca('m1', 'STANLEY', 1, 50, { origin_id: 'C2' })]); // pierde: lww
    hub.aplicarLote('C2', [marca('m5', 'Bosch', 1, 60, { origin_id: 'C2' })]); // unicidad
    const todos = hub.listarConflictos({});
    expect(todos.conflictos.map((c) => c.tipo)).toEqual(['unicidad', 'lww']);
    expect(hub.listarConflictos({ tipo: 'lww' }).conflictos.map((c) => c.fila_id)).toEqual(['m1']);
    const pagina = hub.listarConflictos({ limite: 1 });
    expect(pagina).toMatchObject({ hayMas: true });
    expect(hub.listarConflictos({ limite: 1, antesDeId: pagina.conflictos[0]!.id }).conflictos.map((c) => c.tipo)).toEqual(['lww']);
  });

  it('conflictos (F3 PR1): resolver un lww o un error de integridad; la unicidad se resuelve corrigiendo la fila', () => {
    hub.aplicarLote('C1', [marca('m1', 'Stanley', 1, 100), marca('m4', 'Bosch', 1, 100)]);
    hub.aplicarLote('C2', [marca('m1', 'STANLEY', 1, 50, { origin_id: 'C2' })]);
    hub.aplicarLote('C2', [marca('m5', 'Bosch', 1, 60, { origin_id: 'C2' })]);
    const [unicidad, lww] = hub.listarConflictos({}).conflictos;
    expect(hub.resolverConflicto(lww!.id, { resolucion: 'recuperado', por: 'admin (C1)' }, 500))
      .toMatchObject({ resuelto: 1, resolucion: 'recuperado', resuelto_por: 'admin (C1)', resuelto_en: 500 });
    expect(() => hub.resolverConflicto(lww!.id, { resolucion: 'revisado', por: 'admin (C1)' })).toThrow('CONFLICTO_YA_RESUELTO');
    expect(() => hub.resolverConflicto(unicidad!.id, { resolucion: 'revisado', por: 'admin (C1)' })).toThrow('RESOLUCION_NO_VALIDA');
    expect(() => hub.resolverConflicto(999, { resolucion: 'revisado', por: 'admin (C1)' })).toThrow('CONFLICTO_INEXISTENTE');
    expect(hub.listarConflictos({ pendientes: true }).conflictos.map((c) => c.id)).toEqual([unicidad!.id]);
  });

  it('rechaza el lote entero si trae una tabla que no sincroniza o una columna que el hub no conoce', () => {
    expect(() => hub.aplicarLote('C1', [{ tabla: 'nota_local', fila: { id: 'n1', texto: 'x', version: 1, updated_at: 1 } }])).toThrow('TABLA_NO_SINCRONIZA: nota_local');
    expect(() => hub.aplicarLote('C1', [marca('m1', 'X', 1, 1, { color: 'rojo' })])).toThrow('COLUMNA_DESCONOCIDA: marca.color');
    expect(() => hub.aplicarLote('C1', [{ tabla: 'marca', fila: { nombre: 'sin id' } }])).toThrow('CAMBIO_INVALIDO');
  });

  it('pull: devuelve los cambios posteriores al cursor, paginados', () => {
    hub.aplicarLote('C1', [marca('m1', 'A', 1, 100), marca('m2', 'B', 1, 100), marca('m3', 'C', 1, 100)]);
    const p1 = hub.cambiosDesde(0, 2);
    expect(p1.cambios.map((c) => c.seq)).toEqual([1, 2]);
    expect(p1).toMatchObject({ hasta: 2, hayMas: true });
    const p2 = hub.cambiosDesde(p1.hasta, 2);
    expect(p2.cambios.map((c) => c.fila_id)).toEqual(['m3']);
    expect(p2).toMatchObject({ hasta: 3, hayMas: false });
    expect(hub.cambiosDesde(3, 2)).toEqual({ cambios: [], hasta: 3, hayMas: false });
  });

  it('snapshot: las tablas que sincronizan, sin proyectadas, con el cursor de ese momento', () => {
    hub.aplicarLote('C1', [
      marca('m1', 'Stanley', 1, 100),
      { tabla: 'articulo', fila: { id: 'a1', marca_id: 'm1', nombre: 'Martillo', version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: 100 } },
    ]);
    const s = hub.snapshot();
    expect(s.cursor).toBe(2);
    expect(s.tablas.map((t) => t.tabla)).toEqual(['articulo', 'marca', 'movimiento']);
    expect(s.tablas[0]!.filas).toEqual([expect.not.objectContaining({ stock: expect.anything() })]);
    expect(s.tablas[1]!.filas).toMatchObject([{ id: 'm1', nombre: 'Stanley' }]);
  });
});
