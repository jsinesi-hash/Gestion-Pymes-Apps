import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { abrirAlmacenHub } from './almacen';
import { abrirTerminales, type RegistroTerminales } from './terminales';
import { esquemaPrueba, registroPrueba } from './__fixtures__/esquema';

// ADR-150 §2: un administrador genera en el hub un código de un solo uso; la terminal lo canjea y
// recibe su origin_id (asignado por el hub) y una credencial propia y revocable.
const MIGRACIONES = path.resolve(__dirname, '__fixtures__/migraciones');

describe('emparejamiento de terminales', () => {
  let sqlite: Database.Database;
  let term: RegistroTerminales;
  const T0 = 1_800_000_000;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    abrirAlmacenHub(sqlite, { schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES });
    term = abrirTerminales(sqlite);
  });

  it('el código se canjea una sola vez y da un origin_id y una credencial', () => {
    const { codigo, vence_en } = term.generarCodigo(T0);
    expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(vence_en).toBe(T0 + 15 * 60);
    const r = term.emparejar(codigo, { nombre: 'Caja 1' }, T0 + 10);
    expect(r.origin_id).toBe('C1');
    expect(r.credencial).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(() => term.emparejar(codigo, { nombre: 'Otra' }, T0 + 20)).toThrow('CODIGO_USADO');
  });

  it('acepta el código sin guion y en minúsculas; rechaza uno inexistente o vencido', () => {
    const { codigo } = term.generarCodigo(T0);
    expect(() => term.emparejar('ZZZZ-ZZZZ', { nombre: 'x' }, T0)).toThrow('CODIGO_INVALIDO');
    expect(term.emparejar(codigo.replace('-', '').toLowerCase(), { nombre: 'x' }, T0).origin_id).toBe('C1');
    const viejo = term.generarCodigo(T0).codigo;
    expect(() => term.emparejar(viejo, { nombre: 'x' }, T0 + 16 * 60)).toThrow('CODIGO_VENCIDO');
  });

  it('asigna el siguiente origin_id libre, o el propuesto si está libre y es válido', () => {
    const e = (prop?: string) => term.emparejar(term.generarCodigo(T0).codigo, { nombre: 'x', ...(prop ? { origin_id_propuesto: prop } : {}) }, T0);
    expect(e('C3').origin_id).toBe('C3');           // la primera terminal conserva el suyo (semilla, PR4)
    expect(e().origin_id).toBe('C1');
    expect(e('C3').origin_id).toBe('C2');           // tomado: le da otro
    expect(e('no válido!').origin_id).toBe('C4');   // inválido: le da otro
  });

  it('autentica por credencial, registra el contacto y deja de hacerlo al revocar', () => {
    const { credencial, origin_id } = term.emparejar(term.generarCodigo(T0).codigo, { nombre: 'Caja 1' }, T0);
    expect(term.autenticar(credencial, T0 + 5)).toEqual({ origin_id });
    expect(term.autenticar('otra-credencial', T0 + 5)).toBeNull();
    expect(term.listar()).toMatchObject([{ origin_id: 'C1', nombre: 'Caja 1', ultimo_contacto: T0 + 5, revocada_en: null }]);
    term.revocar('C1', T0 + 9);
    expect(term.autenticar(credencial, T0 + 10)).toBeNull();
    expect(() => term.revocar('C9', T0)).toThrow('TERMINAL_INEXISTENTE');
  });

  it('no guarda códigos ni credenciales en claro', () => {
    const { codigo } = term.generarCodigo(T0);
    const { credencial } = term.emparejar(codigo, { nombre: 'x' }, T0);
    const volcado = JSON.stringify([sqlite.prepare('select * from hub_codigo').all(), sqlite.prepare('select * from hub_terminal').all()]);
    expect(volcado).not.toContain(codigo.replace('-', ''));
    expect(volcado).not.toContain(credencial);
  });
});
