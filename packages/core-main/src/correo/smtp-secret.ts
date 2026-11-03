import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage as electronSafeStorage } from 'electron';

// ADR-048 / ADR-021: la contrasena SMTP se guarda cifrada con safeStorage en un archivo
// propio dentro de userData. NUNCA en parametros_sistema ni en backups (.fbk solo empaqueta
// ferreteria.db). Mismo trato que los certs AFIP.
export interface SmtpSecretDeps {
  safeStorage: Pick<typeof electronSafeStorage, 'isEncryptionAvailable' | 'encryptString' | 'decryptString'>;
  filePath: string;
}

function defaultDeps(): SmtpSecretDeps {
  return { safeStorage: electronSafeStorage, filePath: path.join(app.getPath('userData'), 'smtp-secret.bin') };
}

export function guardarPasswordSmtp(password: string, deps: SmtpSecretDeps = defaultDeps()): void {
  if (!deps.safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_NO_DISPONIBLE');
  const buf = deps.safeStorage.encryptString(password);
  fs.writeFileSync(deps.filePath, buf);
}

export function leerPasswordSmtp(deps: SmtpSecretDeps = defaultDeps()): string | null {
  if (!fs.existsSync(deps.filePath)) return null;
  if (!deps.safeStorage.isEncryptionAvailable()) return null;
  try {
    return deps.safeStorage.decryptString(fs.readFileSync(deps.filePath));
  } catch {
    return null;
  }
}

export function borrarPasswordSmtp(deps: SmtpSecretDeps = defaultDeps()): void {
  if (fs.existsSync(deps.filePath)) fs.rmSync(deps.filePath);
}

export function tienePasswordSmtp(deps: SmtpSecretDeps = defaultDeps()): boolean {
  return fs.existsSync(deps.filePath);
}
