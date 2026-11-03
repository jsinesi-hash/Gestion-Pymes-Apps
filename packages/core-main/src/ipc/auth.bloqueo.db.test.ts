import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import {
  loginHandler, verifyPasswordHandler, usuarioCreateHandler, usuarioChangePasswordHandler,
  verificarSupervisor, limiteIntentos, clearSession,
} from '../index';
import { setupCoreDb, loginAsAdmin, loginAsOperador } from '../testing/helpers';

// Revisión 2026-10-20 (P1): sin límite de intentos ni política de contraseña. Decisión: 3 fallos
// seguidos → 15 minutos; contraseña nueva con mínimo 8, mayúscula, número y carácter especial.
const ADMIN = { nombreUsuario: 'admin', password: 'admin1234' }; // NOSONAR
const MAL = { nombreUsuario: 'admin', password: 'incorrecta' }; // NOSONAR

function fallar(veces: number, creds = MAL) {
  for (let i = 0; i < veces; i++) expect(() => loginHandler(db, creds)).toThrow('Credenciales inválidas');
}

let db: ReturnType<typeof setupCoreDb>;

beforeEach(() => {
  db = setupCoreDb();
  clearSession();
  limiteIntentos.reiniciar();
});
afterEach(() => { vi.useRealTimers(); limiteIntentos.reiniciar(); });

describe('loginHandler — límite de intentos', () => {
  it('con 2 fallos todavía se puede entrar', () => {
    fallar(2);
    expect(() => loginHandler(db, ADMIN)).not.toThrow();
  });

  it('al 3er fallo bloquea 15 minutos: ni la contraseña correcta entra', () => {
    fallar(3);
    expect(() => loginHandler(db, ADMIN)).toThrow('CUENTA_BLOQUEADA:900');
  });

  it('pasados los 15 minutos vuelve a poder entrar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    fallar(3);
    vi.setSystemTime(new Date('2026-10-20T10:14:59Z'));
    expect(() => loginHandler(db, ADMIN)).toThrow('CUENTA_BLOQUEADA:1');
    vi.setSystemTime(new Date('2026-10-20T10:15:00Z'));
    expect(() => loginHandler(db, ADMIN)).not.toThrow();
  });

  it('un login correcto reinicia el contador', () => {
    fallar(2);
    loginHandler(db, ADMIN);
    clearSession();
    fallar(2);
    expect(() => loginHandler(db, ADMIN)).not.toThrow();
  });

  it('un usuario inexistente también acumula y se bloquea (no revela si existe)', () => {
    const fantasma = { nombreUsuario: 'fantasma', password: 'x' }; // NOSONAR
    fallar(3, fantasma);
    expect(() => loginHandler(db, fantasma)).toThrow('CUENTA_BLOQUEADA');
  });

  it('el bloqueo de un usuario no afecta a otro', () => {
    fallar(3);
    expect(() => loginAsOperador(db)).not.toThrow();
  });
});

describe('verifyPasswordHandler y verificarSupervisor comparten el límite', () => {
  it('verifyPassword: 3 fallos bloquean al usuario de la sesión', () => {
    loginAsAdmin(db);
    for (let i = 0; i < 3; i++) expect(verifyPasswordHandler(db, { password: 'mal' })).toBe(false); // NOSONAR
    expect(() => verifyPasswordHandler(db, { password: 'admin1234' })).toThrow('CUENTA_BLOQUEADA'); // NOSONAR
  });

  it('verificarSupervisor: 3 credenciales malas bloquean, también con la correcta', () => {
    const mal = { nombre_usuario: 'admin', password: 'mal' }; // NOSONAR
    for (let i = 0; i < 3; i++) expect(() => verificarSupervisor(db, mal)).toThrow('SUPERVISOR_INVALIDO');
    expect(() => verificarSupervisor(db, { nombre_usuario: 'admin', password: 'admin1234' })) // NOSONAR
      .toThrow('CUENTA_BLOQUEADA');
  });

  it('verificarSupervisor: un acierto devuelve el id y reinicia el contador', () => {
    const mal = { nombre_usuario: 'admin', password: 'mal' }; // NOSONAR
    for (let i = 0; i < 2; i++) expect(() => verificarSupervisor(db, mal)).toThrow('SUPERVISOR_INVALIDO');
    expect(typeof verificarSupervisor(db, { nombre_usuario: 'admin', password: 'admin1234' })).toBe('string'); // NOSONAR
    for (let i = 0; i < 2; i++) expect(() => verificarSupervisor(db, mal)).toThrow('SUPERVISOR_INVALIDO');
  });

  it('un login bloqueado también bloquea la autorización de Supervisor del mismo usuario', () => {
    fallar(3);
    expect(() => verificarSupervisor(db, { nombre_usuario: 'admin', password: 'admin1234' })) // NOSONAR
      .toThrow('CUENTA_BLOQUEADA');
  });
});

describe('usuarioChangePasswordHandler — contraseña actual', () => {
  it('3 contraseñas actuales incorrectas bloquean al usuario', () => {
    const s = loginAsAdmin(db);
    const payload = { target_user_id: s.id, current_password: 'mal', new_password: 'Nueva#2026' }; // NOSONAR
    for (let i = 0; i < 3; i++) expect(() => usuarioChangePasswordHandler(db, payload)).toThrow('PASSWORD_INCORRECTA');
    expect(() => usuarioChangePasswordHandler(db, { ...payload, current_password: 'admin1234' })) // NOSONAR
      .toThrow('CUENTA_BLOQUEADA');
  });
});

describe('política de contraseña en usuarioCreateHandler / usuarioChangePasswordHandler', () => {
  function rolOperador() {
    return db.select().from(schema.rol).where(eq(schema.rol.nombre, 'OPERADOR')).get()!;
  }
  const alta = (password: string, nombre_usuario = 'nuevo') => ({
    nombre_usuario, nombre_completo: 'Nuevo Usuario', email: 'nuevo@ejemplo.com', password, rol_id: rolOperador().id,
  });

  it.each([
    ['corta', 'Ab1#xyz', 'PASSWORD_DEBIL:LARGO'],
    ['sin mayúscula', 'clave#2026', 'PASSWORD_DEBIL:MAYUSCULA'],
    ['sin número', 'Clave#Segura', 'PASSWORD_DEBIL:NUMERO'],
    ['sin carácter especial', 'Clave2026x', 'PASSWORD_DEBIL:ESPECIAL'],
    ['igual al usuario', 'Nuevo#2026', 'PASSWORD_DEBIL:USUARIO'],
  ])('crear usuario con contraseña %s → %s y no inserta la fila', (_n, password, error) => {
    loginAsAdmin(db);
    const nombre = error.endsWith('USUARIO') ? 'nuevo#2026' : 'nuevo';
    expect(() => usuarioCreateHandler(db, alta(password, nombre))).toThrow(error);
    expect(db.select().from(schema.usuario).where(eq(schema.usuario.nombre_usuario, nombre)).all()).toHaveLength(0);
  });

  it('crear usuario con una contraseña que cumple funciona y puede entrar', () => {
    loginAsAdmin(db);
    usuarioCreateHandler(db, alta('Clave#2026'));
    clearSession();
    expect(() => loginHandler(db, { nombreUsuario: 'nuevo', password: 'Clave#2026' })).not.toThrow(); // NOSONAR
  });

  it('cambiar la contraseña por una débil se rechaza y la anterior sigue valiendo', () => {
    const s = loginAsAdmin(db);
    expect(() => usuarioChangePasswordHandler(db, {
      target_user_id: s.id, current_password: 'admin1234', new_password: 'corta', // NOSONAR
    })).toThrow('PASSWORD_DEBIL:LARGO');
    clearSession();
    expect(() => loginHandler(db, ADMIN)).not.toThrow();
  });

  it('cambiar la contraseña por una que cumple funciona', () => {
    const s = loginAsAdmin(db);
    usuarioChangePasswordHandler(db, { target_user_id: s.id, current_password: 'admin1234', new_password: 'Otra#2026' }); // NOSONAR
    clearSession();
    expect(() => loginHandler(db, { nombreUsuario: 'admin', password: 'Otra#2026' })).not.toThrow(); // NOSONAR
  });
});
