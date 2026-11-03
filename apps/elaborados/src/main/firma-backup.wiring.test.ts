import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ADR-135: si `activarFirmaBackup()` deja de llamarse, los backups salen sin firma y nada falla.
// El arranque de Electron no se puede ejecutar en un test, así que se fija en el código fuente.
describe('arranque: firma de backups', () => {
  const src = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
  const lineas = src.split(String.fromCharCode(10)).map((l) => l.trim());

  it('importa activarFirmaBackup de @core/main', () => {
    const imp = lineas.find((l) => l.startsWith('import {') && l.includes("from '@core/main'") && l.includes('activarFirmaBackup'));
    expect(imp).toBeDefined();
  });

  it('la llama antes de abrir la app (app.whenReady)', () => {
    const llamada = lineas.indexOf('activarFirmaBackup();');
    const arranque = lineas.findIndex((l) => l.startsWith('app.whenReady()'));
    expect(llamada).toBeGreaterThan(-1);
    expect(llamada).toBeLessThan(arranque);
  });
});
