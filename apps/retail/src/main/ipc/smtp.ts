import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import nodemailer from 'nodemailer';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { parametrosSetHandler } from './parametros';
import { leerSmtpConfig } from '../agenda/canales/smtp-config';
import { guardarPasswordSmtp, borrarPasswordSmtp, tienePasswordSmtp, leerPasswordSmtp } from '../seguridad/smtp-secret';

type Db = BetterSQLite3Database<typeof schema>;

function requireSupervisor() {
  const s = getSession();
  if (!s || !s.permisos.has('config.fiscal')) throw new Error('FORBIDDEN');
  return s;
}

export function smtpGetConfigHandler(db: Db, deps: { tienePassword?: () => boolean } = {}) {
  const cfg = leerSmtpConfig(db);
  const tiene = (deps.tienePassword ?? tienePasswordSmtp)();
  return { host: cfg.host, port: cfg.port, secure: cfg.secure, from: cfg.from, user: cfg.user, tiene_password: tiene };
}

export function smtpSetConfigHandler(db: Db, p: { host: string; port: number; secure: boolean; from: string; user: string }) {
  requireSupervisor();
  parametrosSetHandler(db, { clave: 'smtp_host', valor: p.host });
  parametrosSetHandler(db, { clave: 'smtp_port', valor: String(p.port) });
  parametrosSetHandler(db, { clave: 'smtp_secure', valor: p.secure ? 'true' : 'false' });
  parametrosSetHandler(db, { clave: 'smtp_from', valor: p.from });
  parametrosSetHandler(db, { clave: 'smtp_user', valor: p.user });
}

export function smtpSetPasswordHandler(_db: Db, p: { password: string }) {
  requireSupervisor();
  if (!p.password) { borrarPasswordSmtp(); return; }
  guardarPasswordSmtp(p.password);
}

export async function smtpProbarHandler(db: Db) {
  requireSupervisor();
  const cfg = leerSmtpConfig(db);
  if (!cfg.host || !cfg.from || !cfg.user) return { ok: false, error: 'SMTP_NO_CONFIGURADO' };
  const pass = leerPasswordSmtp();
  if (!pass) return { ok: false, error: 'SMTP_SIN_CREDENCIAL' };
  try {
    const t = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass } });
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function registerSmtpHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('smtp:getConfig',   async ()      => smtpGetConfigHandler(db));
  ipcMain.handle('smtp:setConfig',   async (_e, p) => smtpSetConfigHandler(db, p));
  ipcMain.handle('smtp:setPassword', async (_e, p) => smtpSetPasswordHandler(db, p));
  ipcMain.handle('smtp:probar',      async ()      => smtpProbarHandler(db));
}
