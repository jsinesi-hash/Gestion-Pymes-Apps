import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ejecutarComandoHub, carpetaDatosPorDefecto, generarCodigoHub, huellaGuardada, type OpcionesHub } from './arranque';
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

  it('generarCodigoHub y huellaGuardada: lo que pide la pantalla de la app (F2 PR6)', async () => {
    const o = opciones();
    expect(huellaGuardada(o.carpeta)).toBeNull(); // sin hub instalado no inventa un certificado
    const { codigo, vence_en } = generarCodigoHub(o);
    expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(vence_en).toBeGreaterThan(Date.now() / 1000);
    await ejecutarComandoHub(['huella'], o);
    expect(huellaGuardada(o.carpeta)).toBe(o.salida.at(-1));
  });

  it('instalar-servicio y desinstalar-servicio: escriben la definición y corren el script (desde una consola de administrador)', async () => {
    const o = opciones();
    const scripts: string[] = [];
    const conServicio: OpcionesHub = {
      ...o,
      servicio: { id: 'prueba-client', nombre: 'Prueba', ejecutable: '/opt/p/prueba', args: ['/opt/p/cli.js'], usuario: 'caja', plataforma: 'linux' },
      ejecutarScript: (ruta) => { scripts.push(ruta); return 0; },
    };
    await ejecutarComandoHub(['instalar-servicio', '--puerto', '7444'], conServicio);
    // Linux arma rutas con `/` (en este equipo de Windows, la carpeta de prueba queda mezclada).
    const prep = path.join(o.carpeta, 'servicio');
    expect(fs.readFileSync(path.join(prep, 'prueba-client-hub.service'), 'utf8')).toContain('iniciar --puerto 7444');
    expect(scripts).toEqual([path.posix.join(prep, 'hub-instalar.sh')]);
    expect(fs.readFileSync(scripts[0]!, 'utf8')).toContain("'systemctl' 'enable' '--now' 'prueba-client-hub.service'");

    await ejecutarComandoHub(['desinstalar-servicio'], conServicio);
    expect(scripts.at(-1)).toBe(path.posix.join(prep, 'hub-desinstalar.sh'));

    await expect(ejecutarComandoHub(['instalar-servicio'], { ...conServicio, ejecutarScript: () => 5 })).rejects.toThrow('SERVICIO_FALLO: instalar (código 5)');
    await expect(ejecutarComandoHub(['instalar-servicio'], o)).rejects.toThrow('SERVICIO_NO_CONFIGURADO');
  });

  it('la carpeta por defecto depende del sistema operativo y se puede pisar con GESTION_HUB_DIR', () => {
    expect(carpetaDatosPorDefecto('retail', { platform: 'win32', env: { ProgramData: 'C:\\ProgramData' }, home: 'C:\\Users\\x' }))
      .toBe('C:\\ProgramData\\retail-hub');
    expect(carpetaDatosPorDefecto('retail', { platform: 'linux', env: {}, home: '/home/x' })).toBe('/home/x/.config/retail-hub');
    expect(carpetaDatosPorDefecto('retail', { platform: 'darwin', env: {}, home: '/Users/x' })).toBe('/Users/x/Library/Application Support/retail-hub');
    expect(carpetaDatosPorDefecto('retail', { platform: 'linux', env: { GESTION_HUB_DIR: '/srv/hub' }, home: '/home/x' })).toBe('/srv/hub');
  });
});
