import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { passwordVencida } from '@ferreteria/shared';
import { setupCoreDb, clearSession } from '../testing/helpers';
import {
  loginHandler,
  recuperarSolicitarHandler,
  recuperarConfirmarHandler,
  recuperacionDisponibleHandler,
  limiteSolicitudesRecuperacion,
  getSession,
  limiteIntentos,
  type EnviadorCorreo,
} from '../index';

// ADR-137: recuperación de contraseña por mail. Código de 6 dígitos, válido 15 minutos, de un solo
// uso y con tope de intentos; solo se guarda su hash. El pedido responde siempre lo mismo (no revela
// qué usuarios existen ni cuáles tienen mail).
type Mail = { para: string; asunto: string; texto: string };

const MINUTO = 60 * 1000;
const NUEVA = 'Nueva#2026x'; // NOSONAR
let db: ReturnType<typeof setupCoreDb>;
let enviados: Mail[];
let enviador: EnviadorCorreo;
let falla = false;

const usuario = (n = 'admin') => db.select().from(schema.usuario).where(eq(schema.usuario.nombre_usuario, n)).get()!;
const filas = () => db.select().from(schema.recuperacion_password).all();
const codigoDelUltimoMail = () => /\b(\d{6})\b/.exec(enviados[enviados.length - 1].texto)![1];
const pedir = (identificador = 'admin', ahora?: () => Date) => recuperarSolicitarHandler(db, { identificador }, enviador, ahora);
const confirmar = (codigo: string, over: Record<string, string> = {}, ahora?: () => Date) =>
  recuperarConfirmarHandler(db, { identificador: 'admin', codigo, passwordNueva: NUEVA, ...over }, ahora);

beforeEach(() => {
  db = setupCoreDb();
  clearSession();
  limiteIntentos.reiniciar();
  limiteSolicitudesRecuperacion.reiniciar();
  enviados = [];
  falla = false;
  enviador = {
    disponible: () => true,
    enviar: async (m) => { if (falla) throw new Error('SMTP caído'); enviados.push(m); },
  };
});

describe('recuperacionDisponibleHandler', () => {
  it('false sin enviador de correo', () => {
    expect(recuperacionDisponibleHandler(null)).toBe(false);
  });
  it('false si el enviador no está configurado', () => {
    expect(recuperacionDisponibleHandler({ ...enviador, disponible: () => false })).toBe(false);
  });
  it('true con un enviador configurado', () => {
    expect(recuperacionDisponibleHandler(enviador)).toBe(true);
  });
});

describe('recuperarSolicitarHandler', () => {
  it('envía al mail del usuario un código de 6 dígitos que vence en 15 minutos', async () => {
    await pedir();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe('usuario@prueba.local');
    expect(enviados[0].asunto).toMatch(/recuper/i);
    expect(enviados[0].texto).toMatch(/\b\d{6}\b/);
    expect(enviados[0].texto).toMatch(/15 minutos/);
  });

  it('responde ok y no envía si el usuario no existe', async () => {
    await expect(pedir('fantasma')).resolves.toEqual({ ok: true });
    expect(enviados).toHaveLength(0);
    expect(filas()).toHaveLength(0);
  });

  it('responde ok y no envía si el usuario no tiene mail', async () => {
    db.update(schema.usuario).set({ email: null }).where(eq(schema.usuario.nombre_usuario, 'admin')).run();
    await expect(pedir()).resolves.toEqual({ ok: true });
    expect(enviados).toHaveLength(0);
  });

  it('no envía a un usuario desactivado', async () => {
    db.update(schema.usuario).set({ activo: false }).where(eq(schema.usuario.nombre_usuario, 'admin')).run();
    await expect(pedir()).resolves.toEqual({ ok: true });
    expect(enviados).toHaveLength(0);
  });

  it('la respuesta es idéntica exista o no el usuario (no revela cuáles existen)', async () => {
    expect(await pedir('admin')).toEqual(await pedir('fantasma'));
  });

  it('guarda solo el hash del código, con vencimiento a 15 minutos', async () => {
    const t0 = new Date('2026-11-03T12:00:00.000Z');
    await pedir('admin', () => t0);
    const [fila] = filas();
    const codigo = codigoDelUltimoMail();
    expect(fila.codigo_hash).not.toContain(codigo);
    expect(fila.usuario_id).toBe(usuario().id);
    expect(fila.usado).toBe(false);
    expect(fila.intentos).toBe(0);
    expect(fila.expira_en.getTime()).toBe(t0.getTime() + 15 * MINUTO);
  });

  it('pedir otro código invalida el anterior', async () => {
    await pedir();
    const viejo = codigoDelUltimoMail();
    await pedir();
    const nuevo = codigoDelUltimoMail();
    expect(() => confirmar(viejo)).toThrow('CODIGO_INVALIDO');
    expect(() => confirmar(nuevo)).not.toThrow();
  });

  it('sin enviador responde ok y no crea nada', async () => {
    await expect(recuperarSolicitarHandler(db, { identificador: 'admin' }, null)).resolves.toEqual({ ok: true });
    expect(filas()).toHaveLength(0);
  });

  it('si el correo no sale responde igual y no deja un código usable', async () => {
    falla = true;
    await expect(pedir()).resolves.toEqual({ ok: true });
    expect(enviados).toHaveLength(0);
    expect(filas().every((f) => f.usado)).toBe(true);
  });

  it('limita los pedidos: a partir del 4.º en 15 minutos no envía más (con la misma respuesta)', async () => {
    for (let i = 0; i < 3; i++) await pedir();
    expect(enviados).toHaveLength(3);
    await expect(pedir()).resolves.toEqual({ ok: true });
    expect(enviados).toHaveLength(3);
  });
});

describe('recuperarConfirmarHandler', () => {
  it('con el código correcto cambia la clave, reinicia el plazo y consume el código', async () => {
    await pedir();
    const antes = Date.now();
    confirmar(codigoDelUltimoMail());
    expect(passwordVencida(usuario().password_changed_at)).toBe(false);
    expect(usuario().password_changed_at!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(filas()[0].usado).toBe(true);
    expect(() => loginHandler(db, { nombreUsuario: 'admin', password: NUEVA })).not.toThrow();
    clearSession();
    expect(() => loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' })).toThrow('Credenciales inválidas');
  });

  it('no abre sesión: después hay que iniciar sesión con la clave nueva', async () => {
    await pedir();
    confirmar(codigoDelUltimoMail());
    expect(getSession()).toBeNull();
  });

  it('un código incorrecto da CODIGO_INVALIDO, suma un intento y no cambia la clave', async () => {
    await pedir();
    const hash = usuario().hash_password;
    expect(() => confirmar('000000')).toThrow('CODIGO_INVALIDO');
    expect(filas()[0].intentos).toBe(1);
    expect(usuario().hash_password).toBe(hash);
  });

  it('tras 5 intentos fallidos el código queda inutilizable, aun con el correcto', async () => {
    await pedir();
    const correcto = codigoDelUltimoMail();
    const equivocado = correcto === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) expect(() => confirmar(equivocado)).toThrow('CODIGO_INVALIDO');
    expect(() => confirmar(correcto)).toThrow('CODIGO_INVALIDO');
  });

  it('un código vencido no sirve', async () => {
    const t0 = new Date('2026-11-03T12:00:00.000Z');
    await pedir('admin', () => t0);
    const codigo = codigoDelUltimoMail();
    expect(() => confirmar(codigo, {}, () => new Date(t0.getTime() + 15 * MINUTO))).toThrow('CODIGO_INVALIDO');
    expect(() => confirmar(codigo, {}, () => new Date(t0.getTime() + 14 * MINUTO))).not.toThrow();
  });

  it('es de un solo uso', async () => {
    await pedir();
    const codigo = codigoDelUltimoMail();
    confirmar(codigo);
    expect(() => confirmar(codigo, { passwordNueva: 'Otra#2026yz' })).toThrow('CODIGO_INVALIDO');
  });

  it('un usuario inexistente recibe el mismo error que un código malo', () => {
    expect(() => confirmar('123456', { identificador: 'fantasma' })).toThrow('CODIGO_INVALIDO');
  });

  it('el código de un usuario no sirve para otro', async () => {
    const rol = db.select().from(schema.rol).where(eq(schema.rol.nombre, 'OPERADOR')).get()!;
    db.insert(schema.usuario).values({
      id: 'u-otro', nombre_usuario: 'otro', nombre_completo: 'Otro', hash_password: 'x', rol_id: rol.id,
      email: 'otro@prueba.local', password_changed_at: new Date(), activo: true,
      usuario_creacion_id: 'system', fecha_creacion: new Date(), version: 1, origin_id: 'system',
      sync_state: 'synced', updated_at: new Date(),
    }).run();
    await pedir('admin');
    expect(() => confirmar(codigoDelUltimoMail(), { identificador: 'otro' })).toThrow('CODIGO_INVALIDO');
  });

  it('una clave que no cumple la política se rechaza SIN consumir el código', async () => {
    await pedir();
    const codigo = codigoDelUltimoMail();
    expect(() => confirmar(codigo, { passwordNueva: 'corta' })).toThrow('PASSWORD_DEBIL');
    expect(filas()[0].usado).toBe(false);
    expect(() => confirmar(codigo)).not.toThrow();
  });

  it('levanta el bloqueo por intentos de login del usuario', async () => {
    for (let i = 0; i < 3; i++) expect(() => loginHandler(db, { nombreUsuario: 'admin', password: 'mal' })).toThrow();
    expect(() => loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' })).toThrow('CUENTA_BLOQUEADA');
    await pedir();
    confirmar(codigoDelUltimoMail());
    expect(() => loginHandler(db, { nombreUsuario: 'admin', password: NUEVA })).not.toThrow();
  });

  it('sirve también cuando la contraseña ya había vencido', async () => {
    db.update(schema.usuario).set({ password_changed_at: new Date(Date.now() - 90 * 24 * 60 * MINUTO) })
      .where(eq(schema.usuario.nombre_usuario, 'admin')).run();
    await pedir();
    confirmar(codigoDelUltimoMail());
    expect(() => loginHandler(db, { nombreUsuario: 'admin', password: NUEVA })).not.toThrow();
  });
});
