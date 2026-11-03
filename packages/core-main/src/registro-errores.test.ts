import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearRegistroErrores, registroErrores, MAX_ERRORES, type AlmacenErrores, type ErrorRegistrado } from './registro-errores';
import { crearAlmacenErroresArchivo, activarRegistroErrores } from './registro-errores-archivo';

// Los errores de los jobs programados y los no capturados del proceso solo iban al log: nadie los
// veía. Ahora quedan en un anillo de los últimos 100 y se persisten en un archivo de userData
// (ADR-140), para que un Supervisor los vea en Backup y restauración.
let ahoraMs: number;
const reloj = () => ahoraMs;

beforeEach(() => { ahoraMs = new Date('2026-11-03T12:00:00.000Z').getTime(); });

describe('registrar y listar', () => {
  it('guarda origen, mensaje, detalle (stack) y la fecha del reloj', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    const e = new Error('SQLITE_BUSY: database is locked');
    r.registrar('tarea:avisos-reintentos', e);
    const [x] = r.listar();
    expect(x.origen).toBe('tarea:avisos-reintentos');
    expect(x.mensaje).toBe('SQLITE_BUSY: database is locked');
    expect(x.detalle).toContain('SQLITE_BUSY');
    expect(x.fecha).toBe(ahoraMs);
    expect(x.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un valor que no es un Error se guarda como texto, sin detalle', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    r.registrar('main:unhandledRejection', 'cadena suelta');
    r.registrar('main:unhandledRejection', { codigo: 7 });
    r.registrar('main:unhandledRejection', null);
    r.registrar('main:unhandledRejection', undefined);
    const mensajes = r.listar().map((x) => x.mensaje).reverse();
    expect(mensajes[0]).toBe('cadena suelta');
    expect(mensajes[1]).toContain('7');
    expect(mensajes[2]).toBe('null');
    expect(mensajes[3]).toBe('undefined');
    expect(r.listar().every((x) => x.detalle === null)).toBe(true);
  });

  it('lista del más reciente al más viejo', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    r.registrar('a', new Error('uno'));
    ahoraMs += 1000;
    r.registrar('b', new Error('dos'));
    expect(r.listar().map((x) => x.mensaje)).toEqual(['dos', 'uno']);
  });

  it('conserva solo los últimos N: descarta los más viejos', () => {
    const r = crearRegistroErrores({ maximo: 3, ahora: reloj });
    for (let i = 1; i <= 5; i++) { r.registrar('t', new Error(`e${i}`)); ahoraMs += 1000; }
    expect(r.listar().map((x) => x.mensaje)).toEqual(['e5', 'e4', 'e3']);
  });

  it('el tope por defecto es 100', () => {
    expect(MAX_ERRORES).toBe(100);
    const r = crearRegistroErrores({ ahora: reloj });
    for (let i = 0; i < 130; i++) r.registrar('t', new Error(`e${i}`));
    expect(r.listar()).toHaveLength(100);
  });

  it('trunca los mensajes y detalles largos', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    const e = new Error('x'.repeat(2000));
    e.stack = 'y'.repeat(9000);
    r.registrar('t', e);
    const [x] = r.listar();
    expect(x.mensaje.length).toBeLessThanOrEqual(501);
    expect(x.mensaje.endsWith('…')).toBe(true);
    expect(x.detalle!.length).toBeLessThanOrEqual(2001);
  });

  it('limpiar vacía el registro', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    r.registrar('t', new Error('x'));
    r.limpiar();
    expect(r.listar()).toEqual([]);
  });

  it('listar devuelve una copia: modificarla no altera el registro', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    r.registrar('t', new Error('x'));
    r.listar().pop();
    r.listar()[0]!.mensaje = 'pisado';
    expect(r.listar()).toHaveLength(1);
    expect(r.listar()[0]!.mensaje).toBe('x');
  });

  it('registrar nunca lanza, ni con un objeto que falla al convertirse en texto', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    const hostil = { toString() { throw new Error('no se puede'); } };
    expect(() => r.registrar('t', hostil)).not.toThrow();
    expect(r.listar()).toHaveLength(1);
  });
});

describe('persistencia con un almacén', () => {
  const valido = (n: number): ErrorRegistrado => ({ id: `id-${n}`, fecha: ahoraMs + n, origen: 'tarea:x', mensaje: `m${n}`, detalle: null });
  function almacenEnMemoria(inicial: unknown = []) {
    let guardado: ErrorRegistrado[] = [];
    const a: AlmacenErrores = { cargar: () => inicial, guardar: (e) => { guardado = e; } };
    return { a, ultimo: () => guardado };
  }

  it('carga lo guardado y desde entonces escribe cada cambio', () => {
    const { a, ultimo } = almacenEnMemoria([valido(1), valido(2)]);
    const r = crearRegistroErrores({ ahora: reloj });
    r.persistirEn(a);
    expect(r.listar().map((x) => x.mensaje)).toEqual(['m2', 'm1']);
    r.registrar('tarea:y', new Error('nuevo'));
    expect(ultimo().map((x) => x.mensaje)).toContain('nuevo');
    r.limpiar();
    expect(ultimo()).toEqual([]);
  });

  it('ignora las entradas con forma inválida', () => {
    const { a } = almacenEnMemoria([valido(1), null, { id: 3 }, { id: 'x', fecha: 'ayer', origen: 'o', mensaje: 'm', detalle: null }, 'texto']);
    const r = crearRegistroErrores({ ahora: reloj });
    r.persistirEn(a);
    expect(r.listar().map((x) => x.id)).toEqual(['id-1']);
  });

  it('si lo guardado no es una lista, arranca vacío', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    r.persistirEn(almacenEnMemoria({ no: 'es una lista' }).a);
    expect(r.listar()).toEqual([]);
  });

  it('respeta el tope al cargar', () => {
    const muchos = Array.from({ length: 10 }, (_, i) => valido(i));
    const r = crearRegistroErrores({ maximo: 4, ahora: reloj });
    r.persistirEn(almacenEnMemoria(muchos).a);
    expect(r.listar()).toHaveLength(4);
    expect(r.listar()[0]!.mensaje).toBe('m9');
  });

  it('los errores registrados antes de conectar el almacén no se pierden', () => {
    const r = crearRegistroErrores({ ahora: reloj });
    r.registrar('tarea:temprano', new Error('antes de conectar'));
    const { a, ultimo } = almacenEnMemoria([valido(1)]);
    r.persistirEn(a);
    expect(r.listar().map((x) => x.mensaje)).toContain('antes de conectar');
    r.registrar('t', new Error('otro'));
    expect(ultimo().map((x) => x.mensaje)).toContain('antes de conectar');
  });

  it('si guardar falla, registrar sigue andando (solo se informa en consola)', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const roto: AlmacenErrores = { cargar: () => [], guardar: () => { throw new Error('disco lleno'); } };
    const r = crearRegistroErrores({ ahora: reloj });
    r.persistirEn(roto);
    expect(() => { r.registrar('t', new Error('x')); r.limpiar(); }).not.toThrow();
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });

  it('si cargar falla, arranca vacío', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const roto: AlmacenErrores = { cargar: () => { throw new Error('sin permiso'); }, guardar: () => {} };
    const r = crearRegistroErrores({ ahora: reloj });
    expect(() => r.persistirEn(roto)).not.toThrow();
    expect(r.listar()).toEqual([]);
    consola.mockRestore();
  });

  it('persistirEn(null) desconecta', () => {
    const { a, ultimo } = almacenEnMemoria([]);
    const r = crearRegistroErrores({ ahora: reloj });
    r.persistirEn(a);
    r.registrar('t', new Error('uno'));
    r.persistirEn(null);
    r.registrar('t', new Error('dos'));
    expect(ultimo().map((x) => x.mensaje)).toEqual(['uno']);
  });
});

describe('almacén en archivo y activación', () => {
  let carpeta: string;
  let ruta: string;
  beforeEach(() => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'errores-'));
    ruta = path.join(carpeta, 'errores-sistema.json');
  });
  afterEach(() => {
    registroErrores.persistirEn(null);
    registroErrores.limpiar();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  it('sin archivo, cargar da una lista vacía', () => {
    expect(crearAlmacenErroresArchivo(ruta).cargar()).toEqual([]);
  });

  it('un archivo corrupto equivale a vacío y no lanza', () => {
    fs.writeFileSync(ruta, '{ no es json');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(crearAlmacenErroresArchivo(ruta).cargar()).toEqual([]);
    aviso.mockRestore();
  });

  it('guardar y cargar son inversos, con escritura atómica (sin temporales)', () => {
    const a = crearAlmacenErroresArchivo(ruta);
    const e: ErrorRegistrado = { id: 'i1', fecha: 1, origen: 'tarea:x', mensaje: 'm', detalle: 'stack' };
    a.guardar([e]);
    expect(a.cargar()).toEqual([e]);
    expect(fs.readdirSync(carpeta)).toEqual(['errores-sistema.json']);
  });

  it('activarRegistroErrores conecta el registro global al archivo de la carpeta', () => {
    activarRegistroErrores({ carpeta });
    registroErrores.registrar('tarea:cambios-programados', new Error('SQLITE_BUSY'));
    const enDisco = JSON.parse(fs.readFileSync(ruta, 'utf8')) as ErrorRegistrado[];
    expect(enDisco).toHaveLength(1);
    expect(enDisco[0]!.origen).toBe('tarea:cambios-programados');
  });

  it('al reactivar carga los errores de la sesión anterior', () => {
    fs.writeFileSync(ruta, JSON.stringify([{ id: 'v1', fecha: 5, origen: 'main:uncaughtException', mensaje: 'antes', detalle: null }]));
    activarRegistroErrores({ carpeta });
    expect(registroErrores.listar().map((x) => x.mensaje)).toEqual(['antes']);
  });
});
