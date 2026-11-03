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

// ADR-138: si `activarLockoutPersistente()` deja de llamarse, el bloqueo por intentos vuelve a
// reiniciarse al cerrar la app y nada falla. El arranque de Electron no se puede ejecutar en un test,
// así que se fija en el código fuente.
describe('arranque: límite de intentos persistente', () => {
  const src = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
  const lineas = src.split(String.fromCharCode(10)).map((l) => l.trim());

  it('importa activarLockoutPersistente de @core/main', () => {
    const imp = lineas.find((l) => l.startsWith('import {') && l.includes("from '@core/main'") && l.includes('activarLockoutPersistente'));
    expect(imp).toBeDefined();
  });

  it('la llama antes de abrir la app (app.whenReady)', () => {
    const llamada = lineas.indexOf('activarLockoutPersistente();');
    const arranque = lineas.findIndex((l) => l.startsWith('app.whenReady()'));
    expect(llamada).toBeGreaterThan(-1);
    expect(llamada).toBeLessThan(arranque);
  });
});
