import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ejecutarComandoHub, carpetaDatosPorDefecto, type OpcionesHub } from './arranque';
import { esquemaPrueba, registroPrueba } from './__fixtures__/esquema';

// Arranque del hub desde la línea de comandos (ADR-158 §1): cada app le pasa su esquema, su registro y
// sus migraciones; la carpeta de datos guarda la base, el certificado y su clave.
const MIGRACIONES = path.resolve(__dirname, '__fixtures__/migraciones');

describe('arranque del hub', () => {
  const carpetas: string[] = [];
  const cerrar: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cerrar.splice(0)) await c();
    for (const d of carpetas.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  function opciones(): OpcionesHub & { salida: string[] } {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-'));
    carpetas.push(carpeta);
    const salida: string[] = [];
    return { nombre: 'hub-prueba', schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES, carpeta, escribir: (l) => salida.push(l), salida };
  }

  it('iniciar: crea la base y el certificado, escucha y muestra la huella; al reiniciar usa el mismo certificado', async () => {
    const o = opciones();
    const h1 = await ejecutarComandoHub(['iniciar', '--puerto', '0', '--host', '127.0.0.1'], o);
    cerrar.push(h1!.cerrar);
    expect(fs.existsSync(path.join(o.carpeta, 'hub.db'))).toBe(true);
    expect(fs.existsSync(path.join(o.carpeta, 'hub-cert.pem'))).toBe(true);
    expect(o.salida.join('\n')).toContain(h1!.huella);
    expect(h1!.puerto).toBeGreaterThan(0);
    await h1!.cerrar(); cerrar.pop();
    const h2 = await ejecutarComandoHub(['iniciar', '--puerto', '0', '--host', '127.0.0.1'], o);
    cerrar.push(h2!.cerrar);
    expect(h2!.huella).toBe(h1!.huella);
  });

  it('codigo, terminales, revocar y huella operan sobre la misma carpeta', async () => {
    const o = opciones();
    await ejecutarComandoHub(['codigo'], o);
    expect(o.salida.join('\n')).toMatch(/[A-Z2-9]{4}-[A-Z2-9]{4}/);
    await ejecutarComandoHub(['terminales'], o);
    expect(o.salida.at(-1)).toContain('Sin terminales emparejadas');
    await ejecutarComandoHub(['huella'], o);
    expect(o.salida.at(-1)).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    await expect(ejecutarComandoHub(['revocar', 'C9'], o)).rejects.toThrow('TERMINAL_INEXISTENTE');
    await expect(ejecutarComandoHub(['otra'], o)).rejects.toThrow('COMANDO_DESCONOCIDO');
  });

  it('la carpeta por defecto depende del sistema operativo y se puede pisar con GESTION_HUB_DIR', () => {
    expect(carpetaDatosPorDefecto('retail', { platform: 'win32', env: { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' }, home: 'C:\\Users\\x' }))
      .toBe(path.join('C:\\Users\\x\\AppData\\Roaming', 'retail-hub'));
    expect(carpetaDatosPorDefecto('retail', { platform: 'linux', env: {}, home: '/home/x' })).toBe(path.join('/home/x', '.config', 'retail-hub'));
    expect(carpetaDatosPorDefecto('retail', { platform: 'darwin', env: {}, home: '/Users/x' })).toBe(path.join('/Users/x', 'Library', 'Application Support', 'retail-hub'));
    expect(carpetaDatosPorDefecto('retail', { platform: 'linux', env: { GESTION_HUB_DIR: '/srv/hub' }, home: '/home/x' })).toBe('/srv/hub');
  });
});
