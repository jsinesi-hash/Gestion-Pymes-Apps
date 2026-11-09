import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from '../../db/schema';
import { runSeed } from '../../auth/seed';
import { clearSession, getSession, hashPassword } from '@core/main';
import {
  loginHandler,
  logoutHandler,
  whoamiHandler,
  desactivarUsuarioHandler,
  verifyPasswordHandler,
} from '@core/main';
import { setupDb, loginAsAdmin, loginAsOperador } from './helpers';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../../db/migrations/0001_r1_schema.sql'), 'utf8'
  );
  const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) sqlite.exec(stmt);
  // ADR-080 (0046): columnas agregadas a usuario_preferencias después de 0001 — este
  // harness liviano no corre el migrator completo, así que se replican acá para que la
  // forma de la tabla siga el schema de Drizzle.
  sqlite.exec("ALTER TABLE `usuario_preferencias` ADD `pantalla_inicio` text;");
  sqlite.exec("ALTER TABLE `usuario_preferencias` ADD `favoritos` text DEFAULT '[]' NOT NULL;");
  // ADR-086 (0048): columna `skin`.
  sqlite.exec("ALTER TABLE `usuario_preferencias` ADD `skin` text DEFAULT 'actual' NOT NULL;");
  // ADR-136 (0050): `usuario.password_changed_at`. Este harness liviano no corre el migrator
  // completo: se aplica el SQL real de la migración para que la tabla siga el schema de Drizzle.
  const sql0050 = fs.readFileSync(
    path.resolve(__dirname, '../../db/migrations/0050_adr136_password_vigencia.sql'), 'utf8'
  );
  for (const stmt of sql0050.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) sqlite.exec(stmt);
  return drizzle(sqlite, { schema });
}

describe('auth IPC handlers', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
    runSeed(db);
    // ADR-136: el seed deja al admin sin mail ni fecha de contraseña; estos tests prueban login y
    // sesión, no la vigencia (eso está en auth.vigencia.db.test.ts del núcleo).
    db.update(schema.usuario).set({ email: 'usuario@prueba.local', password_changed_at: new Date() }).run();
    clearSession();
  });

  describe('loginHandler', () => {
    it('login con contraseña correcta retorna SessionData con permisos', () => {
      const result = loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' });
      expect(result.id).toBeDefined();
      expect(result.nombreCompleto).toBe('Administrador');
      expect(result.permisos).toHaveLength(35);
      expect(result.preferencias.tema).toBe('claro');
    });

    it('login correcto establece la sesión en el módulo session', () => {
      loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' });
      expect(getSession()).not.toBeNull();
      expect(getSession()!.permisos.has('venta.crear')).toBe(true);
    });

    it('login con contraseña incorrecta lanza error genérico', () => {
      expect(() =>
        loginHandler(db, { nombreUsuario: 'admin', password: 'incorrecta' })
      ).toThrow('Credenciales inválidas');
    });

    it('login con usuario inexistente lanza el mismo error genérico', () => {
      expect(() =>
        loginHandler(db, { nombreUsuario: 'noexiste', password: 'cualquiera' })
      ).toThrow('Credenciales inválidas');
    });

  });

  describe('logoutHandler', () => {
    it('logout después de login deja la sesión en null', () => {
      loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' });
      logoutHandler();
      expect(getSession()).toBeNull();
    });
  });

  describe('whoamiHandler', () => {
    it('retorna null cuando no hay sesión', () => {
      expect(whoamiHandler()).toBeNull();
    });

    it('retorna SessionData después de login', () => {
      loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' });
      const data = whoamiHandler();
      expect(data).not.toBeNull();
      expect(data!.nombreCompleto).toBe('Administrador');
    });
  });

  describe('desactivarUsuarioHandler', () => {
    function agregarSegundoSupervisor() {
      const { randomUUID } = require('node:crypto');
      const supervisorRol = db.select().from(schema.rol).all().find(r => r.nombre === 'SUPERVISOR')!;
      const now = new Date();
      const sync = { version: 1, origin_id: 'system', sync_state: 'synced' as const, updated_at: now };
      const segundoId = randomUUID();
      db.insert(schema.usuario).values({
        id: segundoId,
        nombre_usuario: 'admin2',
        nombre_completo: 'Admin 2',
        hash_password: hashPassword('pass'),
        email: 'admin2@prueba.local',
        password_changed_at: now,
        rol_id: supervisorRol.id,
        activo: true,
        usuario_creacion_id: 'system',
        fecha_creacion: now,
        ...sync,
      }).run();
      return segundoId;
    }

    it('sin sesión lanza UNAUTHENTICATED', () => {
      const admin = db.select().from(schema.usuario).all()[0];
      expect(() => desactivarUsuarioHandler(db, { userId: admin.id }))
        .toThrow('UNAUTHENTICATED');
    });

    it('un Operador (sin usuario.administrar) recibe FORBIDDEN y el usuario sigue activo', () => {
      const admin = db.select().from(schema.usuario).all().find(u => u.nombre_usuario === 'admin')!;
      loginAsOperador(db as any);
      expect(() => desactivarUsuarioHandler(db, { userId: admin.id })).toThrow('FORBIDDEN');
      const after = db.select().from(schema.usuario).where(eq(schema.usuario.id, admin.id)).get();
      expect(after!.activo).toBe(true);
    });

    it('rechaza desactivar el único Supervisor activo', () => {
      loginAsAdmin(db as any);
      const admin = db.select().from(schema.usuario).all().find(u => u.nombre_usuario === 'admin')!;
      expect(() => desactivarUsuarioHandler(db, { userId: admin.id }))
        .toThrow('LAST_SUPERVISOR');
    });

    it('permite a un Supervisor desactivar a otro cuando hay otro activo', () => {
      agregarSegundoSupervisor();
      loginHandler(db, { nombreUsuario: 'admin2', password: 'pass' }); // NOSONAR
      const admin = db.select().from(schema.usuario).all().find(u => u.nombre_usuario === 'admin')!;
      expect(() => desactivarUsuarioHandler(db, { userId: admin.id })).not.toThrow();

      const updated = db.select().from(schema.usuario).where(eq(schema.usuario.id, admin.id)).get();
      expect(updated!.activo).toBe(false);
    });

    it('un Supervisor no puede desactivarse a sí mismo', () => {
      agregarSegundoSupervisor();
      loginAsAdmin(db as any);
      const admin = db.select().from(schema.usuario).all().find(u => u.nombre_usuario === 'admin')!;
      expect(() => desactivarUsuarioHandler(db, { userId: admin.id }))
        .toThrow('AUTO_DESACTIVACION');
      const after = db.select().from(schema.usuario).where(eq(schema.usuario.id, admin.id)).get();
      expect(after!.activo).toBe(true);
    });
  });

  describe('verifyPasswordHandler', () => {
    it('devuelve true con la contraseña correcta del usuario logueado', () => {
      const db = setupDb(); loginAsAdmin(db);
      expect(verifyPasswordHandler(db, { password: 'admin1234' })).toBe(true);
    });
    it('devuelve false con contraseña incorrecta', () => {
      const db = setupDb(); loginAsAdmin(db);
      expect(verifyPasswordHandler(db, { password: 'nope' })).toBe(false);
    });
    it('devuelve false sin sesión', () => {
      const db = setupDb(); clearSession();
      expect(verifyPasswordHandler(db, { password: 'admin1234' })).toBe(false);
    });
  });
});
