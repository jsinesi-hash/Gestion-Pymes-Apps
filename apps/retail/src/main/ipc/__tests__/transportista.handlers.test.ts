import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  transportistaListHandler,
  transportistaGetHandler,
  transportistaUpsertHandler,
  transportistaDeactivateHandler,
} from '../transportista';

let db: ReturnType<typeof setupDb>;

beforeEach(() => { db = setupDb(); });
afterEach(() => { clearSession(); });

describe('transportistaUpsertHandler', () => {
  it('crea un transportista nuevo', () => {
    loginAsAdmin(db);
    const { id } = transportistaUpsertHandler(db, { razon_social: 'Transporte Rex' });

    const t = transportistaGetHandler(db, id);
    expect(t?.razon_social).toBe('Transporte Rex');
    expect(t?.activo).toBe(true);
  });

  it('guarda telefono, email, contacto, domicilio y observaciones', () => {
    loginAsAdmin(db);
    const { id } = transportistaUpsertHandler(db, {
      razon_social: 'Transporte Rex',
      telefono: '11-1234-5678',
      email: 'rex@transporte.com',
      persona_contacto: 'Juan',
      domicilio: 'Ruta 8 km 45',
      observaciones: 'Solo turno mañana',
    });

    const t = transportistaGetHandler(db, id);
    expect(t?.telefono).toBe('11-1234-5678');
    expect(t?.email).toBe('rex@transporte.com');
    expect(t?.persona_contacto).toBe('Juan');
    expect(t?.domicilio).toBe('Ruta 8 km 45');
    expect(t?.observaciones).toBe('Solo turno mañana');
  });

  it('edita un transportista existente cuando se pasa id', () => {
    loginAsAdmin(db);
    const { id } = transportistaUpsertHandler(db, { razon_social: 'Transporte Rex' });
    transportistaUpsertHandler(db, { id, razon_social: 'Transporte Rex SRL', telefono: '5555' });

    const t = transportistaGetHandler(db, id);
    expect(t?.razon_social).toBe('Transporte Rex SRL');
    expect(t?.telefono).toBe('5555');
  });

  it('rechaza razon_social vacia', () => {
    loginAsAdmin(db);
    expect(() => transportistaUpsertHandler(db, { razon_social: '  ' }))
      .toThrow('VALIDATION:razon_social:REQUERIDO');
  });

  it('rechaza sin sesion', () => {
    expect(() => transportistaUpsertHandler(db, { razon_social: 'Rex' }))
      .toThrow('UNAUTHENTICATED');
  });
});

describe('transportistaListHandler', () => {
  it('lista solo activos por defecto', () => {
    loginAsAdmin(db);
    const { id: idActivo } = transportistaUpsertHandler(db, { razon_social: 'Activo' });
    const { id: idInactivo } = transportistaUpsertHandler(db, { razon_social: 'Inactivo' });
    transportistaDeactivateHandler(db, idInactivo);

    const activos = transportistaListHandler(db, {});
    expect(activos.map((t) => t.id)).toContain(idActivo);
    expect(activos.map((t) => t.id)).not.toContain(idInactivo);
  });

  it('con incluirInactivos:true devuelve todos', () => {
    loginAsAdmin(db);
    const { id: idInactivo } = transportistaUpsertHandler(db, { razon_social: 'Inactivo' });
    transportistaDeactivateHandler(db, idInactivo);

    const todos = transportistaListHandler(db, { incluirInactivos: true });
    expect(todos.map((t) => t.id)).toContain(idInactivo);
  });
});

describe('transportistaDeactivateHandler', () => {
  it('da de baja logica (activo=false), no borra', () => {
    loginAsAdmin(db);
    const { id } = transportistaUpsertHandler(db, { razon_social: 'Rex' });
    transportistaDeactivateHandler(db, id);

    const t = transportistaGetHandler(db, id);
    expect(t?.activo).toBe(false);
  });
});
