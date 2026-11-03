import nodemailer from 'nodemailer';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { EnviadorCorreo } from '@core/main';
import type * as schema from '../db/schema';
import { leerSmtpConfig, type SmtpConfig } from '../agenda/canales/smtp-config';
import { leerPasswordSmtp } from './smtp-secret';

// ADR-137: correo saliente de Retail para la recuperación de contraseña. Reutiliza la configuración
// SMTP de la agenda (servidor, puerto, remitente y usuario en parametros_sistema; la clave en
// safeStorage, ADR-048) y la lee en cada llamada: un cambio en Configuración → Email se nota sin
// reiniciar la app.
export interface EnviadorSmtpDeps {
  getConfig: () => SmtpConfig;
  getPassword: () => string | null;
  createTransport: typeof nodemailer.createTransport;
}

const configurado = (c: SmtpConfig, pass: string | null): boolean => Boolean(c.host && c.from && c.user && pass);

export function crearEnviadorSmtp(deps: EnviadorSmtpDeps): EnviadorCorreo {
  return {
    disponible() {
      return configurado(deps.getConfig(), deps.getPassword());
    },
    async enviar({ para, asunto, texto }) {
      const cfg = deps.getConfig();
      const pass = deps.getPassword();
      if (!configurado(cfg, pass)) throw new Error('SMTP_NO_CONFIGURADO');
      const transport = deps.createTransport({
        host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: pass! },
      });
      await transport.sendMail({ from: cfg.from, to: para, subject: asunto, text: texto });
    },
  };
}

/** Instancia con las dependencias reales (base de la app, safeStorage y nodemailer). */
export function crearEnviadorSmtpReal(db: BetterSQLite3Database<typeof schema>): EnviadorCorreo {
  return crearEnviadorSmtp({
    getConfig: () => leerSmtpConfig(db),
    getPassword: () => leerPasswordSmtp(),
    createTransport: nodemailer.createTransport,
  });
}
