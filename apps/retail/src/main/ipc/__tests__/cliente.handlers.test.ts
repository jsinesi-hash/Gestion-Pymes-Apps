import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { clienteUpsertHandler, clienteListHandler, clienteGetHandler, clienteDesactivarHandler, clienteReactivarHandler } from '@core/main';
import { listaPrecioCreateHandler } from '../lista-precio';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;
let db: Db;

beforeEach(() => {
  db = setupDb();
  clearSession();
  loginAsAdmin(db);
});

// ── clienteUpsertHandler — extensión CCC ──────────────────────────────────────

describe('clienteUpsertHandler — CCC', () => {
  it('habilita_cc=true en cliente nuevo: crea CCC con saldo=0', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: true,
    });
    const ccc = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, id)).get();
    expect(ccc).toBeDefined();
    expect(ccc!.saldo_centavos).toBe(0);
    expect(ccc!.activo).toBe(true);
  });

  it('habilita_cc=true segunda vez (idempotente): no duplica CCC', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: true,
    });
    clienteUpsertHandler(db, {
      id,
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: true,
    });
    const cccs = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, id)).all();
    expect(cccs).toHaveLength(1);
  });

  it('habilita_cc=false con saldo=0: OK, no lanza error', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: true,
    });
    expect(() => clienteUpsertHandler(db, {
      id,
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: false,
    })).not.toThrow();
  });

  it('habilita_cc=false con saldo≠0: lanza CCC_CON_SALDO', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: true,
    });
    db.update(schema.cuenta_corriente_cliente)
      .set({ saldo_centavos: 5000 })
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, id))
      .run();
    expect(() => clienteUpsertHandler(db, {
      id,
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Ana',
      apellido: 'García',
      condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: false,
    })).toThrow('CCC_CON_SALDO');
  });
});

// ── clienteListHandler ────────────────────────────────────────────────────────

describe('clienteListHandler', () => {
  it('retorna clientes activos', () => {
    clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '11111111',
      nombre: 'Cliente', apellido: 'A', condicion_fiscal: 'Consumidor Final',
    });
    clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '22222222',
      nombre: 'Cliente', apellido: 'B', condicion_fiscal: 'Consumidor Final',
    });
    const list = clienteListHandler(db);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.find(c => c.nombre === 'Cliente' && c.apellido === 'A')).toBeDefined();
  });
});

// ── clienteGetHandler ─────────────────────────────────────────────────────────

describe('clienteGetHandler', () => {
  it('retorna cliente por id', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'CUIT', numero_documento: '20123456789',
      nombre: 'Empresa SA', apellido: '(revisar)', condicion_fiscal: 'Responsable Inscripto',
    });
    const c = clienteGetHandler(db, id);
    expect(c).not.toBeNull();
    expect(c!.nombre).toBe('Empresa SA');
    expect(c!.apellido).toBe('(revisar)');
  });

  it('retorna null para id inexistente', () => {
    expect(clienteGetHandler(db, 'no-existe')).toBeNull();
  });
});

describe('clienteUpsertHandler — campos domicilio extendido', () => {
  it('guarda y recupera calle, numero, aclaracion, telefono_adicional', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Test',
      apellido: 'Cliente',
      condicion_fiscal: 'Consumidor Final',
      calle: 'Av. Corrientes',
      numero: '1234',
      aclaracion: 'Piso 3B',
      telefono_adicional: '11-9999-8888',
    });
    const c = clienteGetHandler(db, id);
    expect(c!.calle).toBe('Av. Corrientes');
    expect(c!.numero).toBe('1234');
    expect(c!.aclaracion).toBe('Piso 3B');
    expect(c!.telefono_adicional).toBe('11-9999-8888');
  });

  it('permite guardar sin los campos opcionales (null en DB)', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '87654321',
      nombre: 'Sin',
      apellido: 'Domicilio',
      condicion_fiscal: 'Consumidor Final',
    });
    const c = clienteGetHandler(db, id);
    expect(c!.calle).toBeNull();
    expect(c!.telefono_adicional).toBeNull();
  });

  it('actualiza calle, numero, aclaracion, telefono_adicional en cliente existente', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Test',
      apellido: 'Update',
      condicion_fiscal: 'Consumidor Final',
    });
    clienteUpsertHandler(db, {
      id,
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      nombre: 'Test',
      apellido: 'Update',
      condicion_fiscal: 'Consumidor Final',
      calle: 'San Martín',
      numero: '100',
      aclaracion: 'Planta baja',
      telefono_adicional: '0351-111-2222',
    });
    const c = clienteGetHandler(db, id);
    expect(c!.calle).toBe('San Martín');
    expect(c!.numero).toBe('100');
    expect(c!.aclaracion).toBe('Planta baja');
    expect(c!.telefono_adicional).toBe('0351-111-2222');
  });
});

describe('clienteDesactivarHandler', () => {
  it('desactiva cliente sin saldo CC', () => {
    const now = new Date();
    const id = 'cli-test-001';
    db.insert(schema.cliente).values({
      id, tipo_documento: 'DNI', numero_documento: '11111111',
      nombre: 'Sin', apellido: 'Saldo', condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: false, activo: true,
      usuario_creacion_id: 'system', fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    clienteDesactivarHandler(db, { id });
    const row = db.select().from(schema.cliente).where(eq(schema.cliente.id, id)).get()!;
    expect(row.activo).toBe(false);
  });

  it('lanza TIENE_SALDO_CC cuando cliente tiene saldo pendiente', () => {
    const now = new Date();
    const id = 'cli-test-002';
    db.insert(schema.cliente).values({
      id, tipo_documento: 'DNI', numero_documento: '22222222',
      nombre: 'Con', apellido: 'Saldo', condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: true, activo: true,
      usuario_creacion_id: 'system', fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    db.insert(schema.cuenta_corriente_cliente).values({
      id: `ccc-${id}`, cliente_id: id,
      saldo_centavos: 50000, limite_credito_centavos: 0,
      fecha_ultimo_movimiento: now, activo: true,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    expect(() => clienteDesactivarHandler(db, { id })).toThrow(/TIENE_SALDO_CC/);
  });

  it('lanza NOT_FOUND con id inexistente', () => {
    expect(() => clienteDesactivarHandler(db, { id: 'no-existe' })).toThrow('NOT_FOUND');
  });
});

describe('ADR-083 — cliente.lista_precio_id', () => {
  it('persiste lista_precio_id en el insert y lo devuelve el get', () => {
    const lista = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '30111222',
      nombre: 'Ana', apellido: 'Pérez', condicion_fiscal: 'Consumidor Final',
      lista_precio_id: lista.id,
    });
    expect(clienteGetHandler(db, id)!.lista_precio_id).toBe(lista.id);
  });

  it('permite null (predeterminada) y lo actualiza', () => {
    const lista = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 });
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '30111223',
      nombre: 'Beto', apellido: 'Ruiz', condicion_fiscal: 'Consumidor Final',
      lista_precio_id: lista.id,
    });
    clienteUpsertHandler(db, {
      id, tipo_documento: 'DNI', numero_documento: '30111223',
      nombre: 'Beto', apellido: 'Ruiz', condicion_fiscal: 'Consumidor Final',
      lista_precio_id: null,
    });
    expect(clienteGetHandler(db, id)!.lista_precio_id).toBeNull();
  });
});

describe('clienteReactivarHandler', () => {
  it('reactiva cliente inactivo', () => {
    const now = new Date();
    const id = 'cli-test-003';
    db.insert(schema.cliente).values({
      id, tipo_documento: 'DNI', numero_documento: '33333333',
      nombre: 'Inactivo', apellido: '(revisar)', condicion_fiscal: 'Consumidor Final',
      habilita_cuenta_corriente: false, activo: false,
      usuario_creacion_id: 'system', fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    clienteReactivarHandler(db, { id });
    const row = db.select().from(schema.cliente).where(eq(schema.cliente.id, id)).get()!;
    expect(row.activo).toBe(true);
  });
});
