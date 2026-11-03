import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage as electronSafeStorage } from 'electron';
import { configurarFirmaBackup } from './firma-config';

// Clave por instalación con la que se firman los `.fbk` (ADR-135). 32 bytes aleatorios guardados
// cifrados con safeStorage en un archivo propio de userData: NUNCA en la base ni dentro de un
// backup (la clave no viaja con el archivo que firma). Mismo trato que la contraseña SMTP (ADR-048).

export interface ClaveFirmaDeps {
  safeStorage: Pick<typeof electronSafeStorage, 'isEncryptionAvailable' | 'encryptString' | 'decryptString'>;
  filePath: string;
}

const LARGO_HEX = 64; // 32 bytes

function defaultDeps(): ClaveFirmaDeps {
  return { safeStorage: electronSafeStorage, filePath: path.join(app.getPath('userData'), 'backup-signing.key') };
}

/**
 * La clave de esta instalación; la crea la primera vez. `null` si safeStorage no está disponible o
 * el archivo existe pero no se puede descifrar (otro usuario de Windows, archivo dañado): en ese
 * caso NO se pisa la clave existente y los backups salen sin firma en vez de con una clave nueva.
 */
export function obtenerOCrearClaveFirma(deps: ClaveFirmaDeps = defaultDeps()): Buffer | null {
  if (!deps.safeStorage.isEncryptionAvailable()) return null;
  if (fs.existsSync(deps.filePath)) {
    try {
      const hex = deps.safeStorage.decryptString(fs.readFileSync(deps.filePath));
      return /^[0-9a-f]+$/.test(hex) && hex.length === LARGO_HEX ? Buffer.from(hex, 'hex') : null;
    } catch {
      return null;
    }
  }
  const clave = crypto.randomBytes(LARGO_HEX / 2);
  fs.writeFileSync(deps.filePath, deps.safeStorage.encryptString(clave.toString('hex')), { mode: 0o600 });
  return clave;
}

/**
 * Lo llama cada app una vez al arrancar, con `userData` ya resuelto. Perezoso (safeStorage solo
 * responde con la app lista) y con caché de la clave; un `null` no se cachea, para que un fallo
 * transitorio no deje la instalación sin firmar hasta reiniciar.
 */
export function activarFirmaBackup(deps?: ClaveFirmaDeps): void {
  let cache: Buffer | null = null;
  configurarFirmaBackup(() => {
    cache ??= obtenerOCrearClaveFirma(deps);
    return cache;
  });
}
