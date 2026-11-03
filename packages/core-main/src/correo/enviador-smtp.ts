import nodemailer from 'nodemailer';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { EnviadorCorreo } from '../auth/recuperacion';
import type * as schema from '@core/db';
import { leerSmtpConfig, type SmtpConfig } from './smtp-config';
import { leerPasswordSmtp } from './smtp-secret';

// ADR-137 / ADR-142: correo saliente de la recuperación de contraseña, ahora en el núcleo para que lo
// usen todas las apps. Usa la configuración SMTP (servidor, puerto, remitente y usuario en
// parametros_sistema; la clave en safeStorage, ADR-048) y la lee en cada llamada: un cambio en
// Configuración → Email se nota sin reiniciar la app.
export interface EnviadorSmtpDeps {
  getConfig: () => SmtpConfig;
  getPassword: () => string | null;
  createTransport: typeof nodemailer.createTransport;
}

const configCompleta = (c: SmtpConfig): boolean => Boolean(c.host && c.from && c.user);
const configurado = (c: SmtpConfig, pass: string | null): boolean => configCompleta(c) && Boolean(pass);

export function crearEnviadorSmtp(deps: EnviadorSmtpDeps): EnviadorCorreo {
  return {
    disponible() {
      // La clave (safeStorage) solo se lee si la configuración está completa: sin servidor no hay nada que descifrar.
      if (!configCompleta(deps.getConfig())) return false;
      return Boolean(deps.getPassword());
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
