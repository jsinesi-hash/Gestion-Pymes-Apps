import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ADR-137: si `index.ts` deja de pasar `enviadorCorreo` a `registerCoreHandlers`, la recuperación de
// contraseña desaparece (el login no ofrece el enlace) y nada falla. El arranque de Electron no se
// puede ejecutar en un test, así que se fija en el código fuente.
describe('arranque: correo de la recuperación de contraseña', () => {
  const src = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
  const lineas = src.split(String.fromCharCode(10)).map((l) => l.trim());

  it('importa crearEnviadorSmtpReal', () => {
    expect(lineas.some((l) => l.startsWith('import {') && l.includes('crearEnviadorSmtpReal') && l.includes('enviador-correo'))).toBe(true);
  });

  it('se lo pasa a registerCoreHandlers como enviadorCorreo', () => {
    const apertura = lineas.findIndex((l) => l.startsWith('registerCoreHandlers('));
    const cierre = lineas.findIndex((l, i) => i > apertura && l === '});');
    const dentro = lineas.slice(apertura, cierre);
    expect(apertura).toBeGreaterThan(-1);
    expect(dentro).toContain('enviadorCorreo: crearEnviadorSmtpReal(db),');
  });
});
