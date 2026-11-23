import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearHubLocal, type DepsHubLocal, type OpcionesHubLocal } from './hub-local';

// «Usar esta PC como servidor» (F2 PR6, ADR-156 §1): la pantalla de Sincronización instala el hub como
// servicio del sistema operativo pidiendo permiso de administrador, muestra si está en marcha (responde en
// la PC con la huella de su certificado) y genera códigos de emparejamiento.
const HUELLA = 'AA:BB:CC';

describe('hub en esta PC', () => {
  let carpeta: string;
  let temporal: string;
  let instalado: boolean;
  let deps: DepsHubLocal & { ejecutados: string[][] };

  const opciones: OpcionesHubLocal = {
    id: 'prueba-client', nombre: 'Prueba', ejecutable: 'C:\\App\\prueba.exe', args: ['C:\\App\\cli.js'],
    opcionesHub: (c) => ({ nombre: 'hub-prueba', schema: {}, registro: {}, migracionesApp: 'm', carpeta: c }),
  };

  beforeEach(() => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-local-'));
    temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-local-tmp-'));
    instalado = false;
    deps = {
      plataforma: 'win32',
      carpeta: () => carpeta,
      temporal: () => temporal,
      usuario: () => 'caja',
      direcciones: () => ['192.168.0.10'],
      ejecutados: [],
      async ejecutar(c) {
        deps.ejecutados.push([...c]);
        if (c[0] === 'powershell.exe') { instalado = c.join(' ').includes('hub-instalar'); return 0; }
        if (c[0] === 'cmd.exe' && c[2] === 'if') return instalado ? 0 : 1; // la consulta (marca de instalado)
        return 0;
      },
      sondear: vi.fn(async () => { throw new Error('HUB_INALCANZABLE: connect ECONNREFUSED'); }),
      generarCodigo: (o) => ({ codigo: o.carpeta === carpeta ? 'ABCD-EFGH' : 'OTRA-CARP', vence_en: 1_900_000_000 }),
    };
  });
  afterEach(() => { for (const d of [carpeta, temporal]) fs.rmSync(d, { recursive: true, force: true }); });

  it('estado sin instalar: no está en marcha, sin huella, con las direcciones de la PC', async () => {
    expect(await crearHubLocal(opciones, deps).estado()).toEqual({
      plataforma: 'win32', carpeta, puerto: 7443, instalado: false, enMarcha: false, huella: null, direcciones: ['192.168.0.10'],
    });
  });

  it('instalar: escribe la definición, corre el script elevado y comprueba que quedó registrado', async () => {
    const hub = crearHubLocal(opciones, deps);
    const e = await hub.instalar();
    expect(fs.existsSync(path.join(carpeta, 'hub-tarea.xml'))).toBe(true);
    expect(fs.readFileSync(path.join(carpeta, 'hub-servicio.cmd'), 'utf8')).toContain('iniciar --puerto 7443');
    const elevado = deps.ejecutados.find((c) => c[0] === 'powershell.exe')!;
    expect(elevado.join(' ')).toContain(path.join(temporal, 'hub-instalar.cmd'));
    expect(e.instalado).toBe(true);
  });

  it('si el usuario no da el permiso de administrador, no queda instalado y lo dice', async () => {
    const hub = crearHubLocal(opciones, { ...deps, ejecutar: async (c) => (c[0] === 'powershell.exe' ? 1 : 1) });
    await expect(hub.instalar()).rejects.toThrow('HUB_SERVICIO_NO_INSTALADO');
  });

  it('en marcha = responde en la PC con la huella de su propio certificado', async () => {
    fs.writeFileSync(path.join(carpeta, 'hub-cert.pem'), 'x');
    const hub = crearHubLocal(opciones, { ...deps, huellaGuardada: () => HUELLA, sondear: async () => ({ url: 'https://127.0.0.1:7443', huella: HUELLA }) });
    expect(await hub.estado()).toMatchObject({ enMarcha: true, huella: HUELLA });
    // Otro proceso en el puerto (otra huella) no cuenta como nuestro hub.
    const otro = crearHubLocal(opciones, { ...deps, huellaGuardada: () => HUELLA, sondear: async () => ({ url: 'x', huella: 'OTRA' }) });
    expect(await otro.estado()).toMatchObject({ enMarcha: false });
  });

  it('desinstalar corre el script elevado; generar código usa la carpeta del hub', async () => {
    const hub = crearHubLocal(opciones, deps);
    await hub.instalar();
    expect((await hub.desinstalar()).instalado).toBe(false);
    expect(deps.ejecutados.some((c) => c.join(' ').includes('hub-desinstalar.cmd'))).toBe(true);
    expect(hub.codigo()).toEqual({ codigo: 'ABCD-EFGH', vence_en: 1_900_000_000 });
  });
});
