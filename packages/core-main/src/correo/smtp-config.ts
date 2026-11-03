import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';

type Db = BetterSQLite3Database<typeof schema>;

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  user: string;
}

function leer(db: Db, clave: string): string {
  return db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get()?.valor ?? '';
}

export function leerSmtpConfig(db: Db): SmtpConfig {
  const portNum = Number.parseInt(leer(db, 'smtp_port') || '587', 10);
  return {
    host: leer(db, 'smtp_host'),
    port: Number.isFinite(portNum) ? portNum : 587,
    secure: leer(db, 'smtp_secure') === 'true',
    from: leer(db, 'smtp_from'),
    user: leer(db, 'smtp_user'),
  };
}
