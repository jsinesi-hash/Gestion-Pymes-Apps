import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { passwordVencida } from '@ferreteria/shared';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import {
  loginHandler,
  cambiarPasswordVencidaHandler,
  completarEmailHandler,
  usuarioCreateHandler,
  usuarioUpdateHandler,
  usuarioChangePasswordHandler,
  getSession,
  whoamiHandler,
  limiteIntentos,
} from '../index';

// ADR-136: la contraseña vence a los 30 días y el mail es obligatorio. Cuando falta una de las dos
// cosas el login verifica las credenciales pero NO crea la sesión: así ningún canal IPC que lea la
// sesión directamente puede usarse sin haber cambiado la clave o cargado el mail.
const DIA = 24 * 60 * 60 * 1000;
const haceDias = (n: number) => new Date(Date.now() - n * DIA);
const CLAVE = 'admin1234'; // NOSONAR (seed de pruebas)
const NUEVA = 'Nueva#2026x'; // NOSONAR

let db: ReturnType<typeof setupCoreDb>;

function usuario(nombre = 'admin') {
  return db.select().from(schema.usuario).where(eq(schema.usuario.nombre_usuario, nombre)).get()!;
}
function fijar(patch: Partial<typeof schema.usuario.$inferInsert>, nombre = 'admin') {
  db.update(schema.usuario).set(patch).where(eq(schema.usuario.nombre_usuario, nombre)).run();
}
const login = (password = CLAVE) => loginHandler(db, { nombreUsuario: 'admin', password });

beforeEach(() => {
  db = setupCoreDb();
  clearSession();
  limiteIntentos.reiniciar();
});

describe('loginHandler — vigencia de la contraseña y mail', () => {
  it('al día y con mail: inicia sesión', () => {
    expect(login().nombreCompleto).toBeTruthy();
    expect(getSession()).not.toBeNull();
  });

  it('vencida (31 días): PASSWORD_VENCIDA y no se crea la sesión', () => {
    fijar({ password_changed_at: haceDias(31) });
    expect(() => login()).toThrow('PASSWORD_VENCIDA');
    expect(getSession()).toBeNull();
  });

  it('justo a los 30 días ya está vencida; a los 29 no', () => {
    fijar({ password_changed_at: haceDias(29) });
    expect(() => login()).not.toThrow();
    clearSession();
    fijar({ password_changed_at: haceDias(30) });
    expect(() => login()).toThrow('PASSWORD_VENCIDA');
  });

  it('sin fecha de último cambio cuenta como vencida', () => {
    fijar({ password_changed_at: null });
    expect(() => login()).toThrow('PASSWORD_VENCIDA');
  });

  it('sin mail: EMAIL_REQUERIDO y no se crea la sesión', () => {
    fijar({ email: null });
    expect(() => login()).toThrow('EMAIL_REQUERIDO');
    expect(getSession()).toBeNull();
  });

  it('un mail en blanco cuenta como sin mail', () => {
    fijar({ email: '   ' });
    expect(() => login()).toThrow('EMAIL_REQUERIDO');
  });

  it('vencida y sin mail: primero PASSWORD_VENCIDA', () => {
    fijar({ password_changed_at: haceDias(40), email: null });
    expect(() => login()).toThrow('PASSWORD_VENCIDA');
  });

  it('con credenciales incorrectas no revela el estado de la cuenta y cuenta para el límite', () => {
    fijar({ password_changed_at: haceDias(40), email: null });
    for (let i = 0; i < 3; i++) {
      expect(() => login('incorrecta')).toThrow('Credenciales inválidas');
    }
    expect(() => login()).toThrow('CUENTA_BLOQUEADA');
  });

  it('la sesión informa los días que le quedan a la contraseña', () => {
    fijar({ password_changed_at: haceDias(10) });
    expect(login().passwordDiasRestantes).toBe(20);
    expect(whoamiHandler()?.passwordDiasRestantes).toBe(20);
  });
});

describe('cambiarPasswordVencidaHandler (pre-sesión)', () => {
  beforeEach(() => fijar({ password_changed_at: haceDias(45) }));
  const cambiar = (over: Record<string, string> = {}) =>
    cambiarPasswordVencidaHandler(db, { nombreUsuario: 'admin', passwordActual: CLAVE, passwordNueva: NUEVA, ...over });

  it('cambia la clave, registra la fecha y abre la sesión', () => {
    const antes = Date.now();
    const s = cambiar();
    expect(s.nombreCompleto).toBeTruthy();
    expect(getSession()).not.toBeNull();
    expect(usuario().password_changed_at!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(passwordVencida(usuario().password_changed_at)).toBe(false);
    clearSession();
    expect(() => login(NUEVA)).not.toThrow();
  });

  it('la clave vieja deja de servir', () => {
    cambiar();
    clearSession();
    expect(() => login(CLAVE)).toThrow('Credenciales inválidas');
  });

  it('exige la contraseña actual correcta y cuenta para el límite', () => {
    for (let i = 0; i < 3; i++) {
      expect(() => cambiar({ passwordActual: 'incorrecta' })).toThrow('Credenciales inválidas');
    }
    expect(() => cambiar()).toThrow('CUENTA_BLOQUEADA');
    expect(getSession()).toBeNull();
  });

  it('la nueva clave debe cumplir la política', () => {
    expect(() => cambiar({ passwordNueva: 'corta' })).toThrow('PASSWORD_DEBIL');
    expect(getSession()).toBeNull();
  });

  it('la nueva clave no puede ser igual a la actual', () => {
    const hash = usuario().hash_password;
    expect(() => cambiar({ passwordNueva: CLAVE })).toThrow('PASSWORD_IGUAL_A_LA_ACTUAL');
    expect(usuario().hash_password).toBe(hash);
    expect(getSession()).toBeNull();
  });

  it('si la clave no está vencida se rechaza (no es una puerta para cambiar claves sin sesión)', () => {
    fijar({ password_changed_at: new Date() });
    expect(() => cambiar()).toThrow('PASSWORD_NO_VENCIDA');
  });

  it('si además falta el mail, cambia la clave pero responde EMAIL_REQUERIDO y no abre sesión', () => {
    fijar({ email: null });
    expect(() => cambiar()).toThrow('EMAIL_REQUERIDO');
    expect(getSession()).toBeNull();
    expect(passwordVencida(usuario().password_changed_at)).toBe(false);
  });
});

describe('completarEmailHandler (pre-sesión)', () => {
  beforeEach(() => fijar({ email: null }));
  const completar = (over: Record<string, string> = {}) =>
    completarEmailHandler(db, { nombreUsuario: 'admin', password: CLAVE, email: 'Ana@Ejemplo.com', ...over });

  it('guarda el mail normalizado y abre la sesión', () => {
    const s = completar();
    expect(s.nombreCompleto).toBeTruthy();
    expect(getSession()).not.toBeNull();
    expect(usuario().email).toBe('ana@ejemplo.com');
    clearSession();
    expect(() => login()).not.toThrow();
  });

  it('rechaza un mail inválido', () => {
    expect(() => completar({ email: 'no-es-un-mail' })).toThrow('EMAIL_INVALIDO');
    expect(usuario().email).toBeNull();
    expect(getSession()).toBeNull();
  });

  it('exige credenciales correctas y cuenta para el límite', () => {
    for (let i = 0; i < 3; i++) expect(() => completar({ password: 'incorrecta' })).toThrow('Credenciales inválidas');
    expect(() => completar()).toThrow('CUENTA_BLOQUEADA');
  });

  it('con la clave vencida pide primero cambiarla', () => {
    fijar({ password_changed_at: haceDias(40) });
    expect(() => completar()).toThrow('PASSWORD_VENCIDA');
    expect(usuario().email).toBeNull();
  });

  it('si el usuario ya tiene mail se rechaza (no es una puerta para cambiarlo sin sesión)', () => {
    fijar({ email: 'ya@tengo.com' });
    expect(() => completar()).toThrow('EMAIL_YA_CARGADO');
    expect(usuario().email).toBe('ya@tengo.com');
  });
});

describe('usuarioCreateHandler — mail obligatorio y fecha de contraseña', () => {
  const base = { nombre_usuario: 'nuevo1', nombre_completo: 'Nuevo Uno', password: NUEVA, rol_id: '' };
  beforeEach(() => {
    loginAsAdmin(db);
    base.rol_id = db.select().from(schema.rol).where(eq(schema.rol.nombre, 'OPERADOR')).get()!.id;
  });

  it('sin mail: EMAIL_REQUERIDO y no se crea el usuario', () => {
    expect(() => usuarioCreateHandler(db, base)).toThrow('EMAIL_REQUERIDO');
    expect(() => usuarioCreateHandler(db, { ...base, email: '   ' })).toThrow('EMAIL_REQUERIDO');
    expect(db.select().from(schema.usuario).where(eq(schema.usuario.nombre_usuario, 'nuevo1')).get()).toBeUndefined();
  });

  it('con un mail inválido: EMAIL_INVALIDO', () => {
    expect(() => usuarioCreateHandler(db, { ...base, email: 'ana@' })).toThrow('EMAIL_INVALIDO');
  });

  it('con mail válido lo guarda normalizado y fija la fecha de la contraseña', () => {
    const creado = usuarioCreateHandler(db, { ...base, email: ' Nuevo@Ejemplo.COM ' });
    expect(creado.email).toBe('nuevo@ejemplo.com');
    const fila = usuario('nuevo1');
    expect(passwordVencida(fila.password_changed_at)).toBe(false);
  });
});

describe('usuarioUpdateHandler — el mail no se puede borrar', () => {
  beforeEach(() => { loginAsAdmin(db); });
  const id = () => usuario().id;

  it('vaciar el mail se rechaza', () => {
    expect(() => usuarioUpdateHandler(db, { id: id(), email: '' })).toThrow('EMAIL_REQUERIDO');
    expect(usuario().email).toBe('usuario@prueba.local');
  });

  it('un mail inválido se rechaza', () => {
    expect(() => usuarioUpdateHandler(db, { id: id(), email: 'xx' })).toThrow('EMAIL_INVALIDO');
  });

  it('un mail válido se guarda normalizado', () => {
    usuarioUpdateHandler(db, { id: id(), email: ' Otro@Ejemplo.com ' });
    expect(usuario().email).toBe('otro@ejemplo.com');
  });

  it('no tocar el mail (undefined) no lo cambia', () => {
    usuarioUpdateHandler(db, { id: id(), nombre_completo: 'Otro Nombre' });
    expect(usuario().email).toBe('usuario@prueba.local');
  });
});

describe('usuarioChangePasswordHandler — fecha de la contraseña', () => {
  it('cambiar la propia clave reinicia el plazo de 30 días', () => {
    loginAsAdmin(db);
    fijar({ password_changed_at: haceDias(25) });
    usuarioChangePasswordHandler(db, { target_user_id: usuario().id, current_password: CLAVE, new_password: NUEVA });
    expect(passwordVencida(usuario().password_changed_at)).toBe(false);
    expect(Date.now() - usuario().password_changed_at!.getTime()).toBeLessThan(60 * 1000);
  });

  it('un Supervisor que restablece la clave de otro la deja VENCIDA: debe cambiarla al ingresar', () => {
    loginAsAdmin(db);
    const rol = db.select().from(schema.rol).where(eq(schema.rol.nombre, 'OPERADOR')).get()!;
    usuarioCreateHandler(db, { nombre_usuario: 'op1', nombre_completo: 'Op Uno', email: 'op1@ejemplo.com', password: NUEVA, rol_id: rol.id });
    const op = usuario('op1');
    expect(passwordVencida(op.password_changed_at)).toBe(false);

    usuarioChangePasswordHandler(db, { target_user_id: op.id, new_password: 'Temporal#2026y' });
    expect(passwordVencida(usuario('op1').password_changed_at)).toBe(true);
    clearSession();
    expect(() => loginHandler(db, { nombreUsuario: 'op1', password: 'Temporal#2026y' })).toThrow('PASSWORD_VENCIDA');
  });
});
