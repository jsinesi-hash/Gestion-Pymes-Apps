import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import https from 'node:https';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { abrirAlmacenHub } from './almacen';
import { abrirTerminales, type RegistroTerminales } from './terminales';
import { generarCertificado } from './certificado';
import { crearServidorHub } from './servidor';
import { esquemaPrueba, registroPrueba } from './__fixtures__/esquema';

// ADR-150 §1, §2, §8 y §9: HTTPS con el certificado del hub, endpoints versionados, cada pedido
// autenticado con la credencial de la terminal y la hora del hub en cada respuesta.
const MIGRACIONES = path.resolve(__dirname, '__fixtures__/migraciones');
const VERSIONES = { protocolo: 1, esquema: 5 };

type Resp = { status: number; body: Record<string, unknown> };

describe('servidor HTTPS del hub', () => {
  const cert = generarCertificado({ nombre: 'hub-prueba', dias: 30 });
  let server: https.Server;
  let terminales: RegistroTerminales;
  let base: string;

  /**
   * Cliente como el de la terminal: confía solo en el certificado que guardó al emparejar (como CA
   * única, con la verificación de TLS encendida) y además compara la huella. Ojo: con
   * `rejectUnauthorized: false` Node no llama a `checkServerIdentity`, así que eso no fija nada.
   */
  function pedir(metodo: string, ruta: string, opts: { cuerpo?: unknown; credencial?: string; versiones?: { protocolo: number; esquema: number }; certConfiable?: { certPem: string; huella: string }; crudo?: string } = {}): Promise<Resp> {
    const confiable = opts.certConfiable ?? cert;
    const v = opts.versiones ?? VERSIONES;
    const datos = opts.crudo ?? (opts.cuerpo === undefined ? undefined : JSON.stringify(opts.cuerpo));
    return new Promise((resolve, reject) => {
      const req = https.request(`${base}${ruta}`, {
        method: metodo,
        // Sin agente compartido: el agente global de Node reusa sockets ya verificados (keep-alive)
        // y una conexión nueva no vuelve a pasar por la verificación. El cliente del PR3 usa uno propio por hub.
        agent: false,
        ca: confiable.certPem,
        checkServerIdentity: (_host, c) => (c.fingerprint256 === confiable.huella ? undefined : new Error('HUELLA_DISTINTA')),
        headers: {
          'content-type': 'application/json',
          'x-protocolo': String(v.protocolo), 'x-esquema': String(v.esquema),
          ...(opts.credencial ? { authorization: `Bearer ${opts.credencial}` } : {}),
        },
      }, (res) => {
        let s = '';
        res.on('data', (d) => { s += d; });
        res.on('end', () => resolve({ status: res.statusCode!, body: s ? JSON.parse(s) : {} }));
      });
      req.on('error', reject);
      if (datos !== undefined) req.write(datos);
      req.end();
    });
  }

  async function emparejar(nombre = 'Caja'): Promise<{ origin_id: string; credencial: string }> {
    const { codigo } = terminales.generarCodigo();
    const r = await pedir('POST', '/v1/emparejar', { cuerpo: { codigo, nombre } });
    expect(r.status).toBe(200);
    return r.body as { origin_id: string; credencial: string };
  }

  beforeAll(async () => {
    const sqlite = new Database(':memory:');
    const almacen = abrirAlmacenHub(sqlite, { schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES });
    terminales = abrirTerminales(sqlite);
    server = crearServidorHub({ almacen, terminales, tls: cert, versiones: VERSIONES, limiteCuerpoBytes: 64 * 1024 });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('emparejar: canjea el código y devuelve origin_id, credencial, versiones y la hora del hub', async () => {
    const { codigo } = terminales.generarCodigo();
    const antes = Date.now();
    const r = await pedir('POST', '/v1/emparejar', { cuerpo: { codigo, nombre: 'Caja 1', origin_id_propuesto: 'C7' } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ origin_id: 'C7', versiones: VERSIONES });
    expect(r.body['hora_hub_ms']).toBeGreaterThanOrEqual(antes);
    expect((await pedir('POST', '/v1/emparejar', { cuerpo: { codigo, nombre: 'x' } })).body).toMatchObject({ error: 'CODIGO_USADO' });
  });

  it('sin credencial, con una inventada o revocada: 401', async () => {
    expect((await pedir('GET', '/v1/estado')).status).toBe(401);
    expect((await pedir('GET', '/v1/estado', { credencial: 'inventada' })).status).toBe(401);
    const t = await emparejar('Para revocar');
    expect((await pedir('GET', '/v1/estado', { credencial: t.credencial })).status).toBe(200);
    terminales.revocar(t.origin_id);
    expect((await pedir('GET', '/v1/estado', { credencial: t.credencial })).status).toBe(401);
  });

  it('push con el origin_id de la credencial, pull desde el cursor, snapshot y estado', async () => {
    const t = await emparejar();
    // El origin_id lo pone el hub desde la credencial: lo que diga el cuerpo no cuenta.
    const fila = { id: 'm1', nombre: 'Stanley', activo: 1, version: 1, origin_id: t.origin_id, sync_state: 'pending', updated_at: 100 };
    const push = await pedir('POST', '/v1/push', { credencial: t.credencial, cuerpo: { origin_id: 'OTRA', cambios: [{ tabla: 'marca', fila }] } });
    expect(push.status).toBe(200);
    expect(push.body['resultados']).toEqual([{ estado: 'aplicado', seq: 1 }]);

    const pull = await pedir('GET', '/v1/pull?desde=0&limite=10', { credencial: t.credencial });
    expect(pull.status).toBe(200);
    expect(pull.body).toMatchObject({ hasta: 1, hayMas: false, cambios: [{ seq: 1, tabla: 'marca', fila_id: 'm1', origin_id: t.origin_id }] });

    const snap = await pedir('GET', '/v1/snapshot', { credencial: t.credencial });
    expect(snap.body).toMatchObject({ cursor: 1 });
    const estado = await pedir('GET', '/v1/estado', { credencial: t.credencial });
    expect(estado.body).toMatchObject({ origin_id: t.origin_id, cursor: 1, versiones: VERSIONES });
    expect(typeof estado.body['hora_hub_ms']).toBe('number');
  });

  it('acepta la versión del hub y la anterior; otra es 409 con las versiones del hub', async () => {
    const t = await emparejar();
    expect((await pedir('GET', '/v1/estado', { credencial: t.credencial, versiones: { protocolo: 1, esquema: 4 } })).status).toBe(200);
    const vieja = await pedir('GET', '/v1/estado', { credencial: t.credencial, versiones: { protocolo: 1, esquema: 3 } });
    expect(vieja).toMatchObject({ status: 409, body: { error: 'VERSION_INCOMPATIBLE', versiones: VERSIONES } });
    // Una terminal más nueva que el hub sigue vendiendo sin sincronizar (se actualiza primero el hub).
    expect((await pedir('GET', '/v1/estado', { credencial: t.credencial, versiones: { protocolo: 1, esquema: 6 } })).status).toBe(409);
    expect((await pedir('GET', '/v1/estado', { credencial: t.credencial, versiones: { protocolo: 2, esquema: 5 } })).status).toBe(409);
  });

  it('un lote inválido es 422 con el código; un cuerpo enorme, 413; JSON roto, 400; ruta desconocida, 404', async () => {
    const t = await emparejar();
    const malo = await pedir('POST', '/v1/push', { credencial: t.credencial, cuerpo: { cambios: [{ tabla: 'nota_local', fila: { id: 'x' } }] } });
    expect(malo).toMatchObject({ status: 422, body: { error: 'TABLA_NO_SINCRONIZA: nota_local' } });
    const enorme = JSON.stringify({ cambios: [], relleno: 'x'.repeat(70 * 1024) });
    expect((await pedir('POST', '/v1/push', { credencial: t.credencial, crudo: enorme })).status).toBe(413);
    expect((await pedir('POST', '/v1/push', { credencial: t.credencial, crudo: '{no es json' })).status).toBe(400);
    expect((await pedir('GET', '/v1/otra', { credencial: t.credencial })).status).toBe(404);
  });

  it('limita los intentos fallidos de emparejar (fuerza bruta del código): 429', async () => {
    let ultimo = 0;
    for (let i = 0; i < 12; i++) ultimo = (await pedir('POST', '/v1/emparejar', { cuerpo: { codigo: 'ZZZZ-ZZZZ', nombre: 'x' } })).status;
    expect(ultimo).toBe(429);
  });

  it('un cliente que confía en el certificado de otro hub no conecta (ni siquiera manda la credencial)', async () => {
    const otro = generarCertificado({ nombre: 'hub-prueba', dias: 30 });
    await expect(pedir('GET', '/v1/estado', { certConfiable: otro })).rejects.toThrow();
    // Mismo certificado pero otra huella esperada: lo corta checkServerIdentity.
    await expect(pedir('GET', '/v1/estado', { certConfiable: { certPem: cert.certPem, huella: 'AA:BB' } })).rejects.toThrow('HUELLA_DISTINTA');
  });
});

// ADR-150 §10: la primera terminal sube su base en partes; el hub las aplica juntas al recibir la última.
describe('semilla de la primera terminal', () => {
  const cert = generarCertificado({ nombre: 'hub-semilla', dias: 30 });
  let server: https.Server;
  let terminales: RegistroTerminales;
  let base: string;

  function pedir(metodo: string, ruta: string, credencial: string, cuerpo?: unknown): Promise<Resp> {
    const datos = cuerpo === undefined ? undefined : JSON.stringify(cuerpo);
    return new Promise((resolve, reject) => {
      const req = https.request(`${base}${ruta}`, {
        method: metodo, agent: false, ca: cert.certPem,
        checkServerIdentity: (_h, c) => (c.fingerprint256 === cert.huella ? undefined : new Error('HUELLA_DISTINTA')),
        headers: { 'content-type': 'application/json', 'x-protocolo': '1', 'x-esquema': '5', authorization: `Bearer ${credencial}` },
      }, (res) => {
        let s = '';
        res.on('data', (d) => { s += d; });
        res.on('end', () => resolve({ status: res.statusCode!, body: s ? JSON.parse(s) : {} }));
      });
      req.on('error', reject);
      if (datos !== undefined) req.write(datos);
      req.end();
    });
  }

  beforeAll(async () => {
    const sqlite = new Database(':memory:');
    const almacen = abrirAlmacenHub(sqlite, { schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES });
    terminales = abrirTerminales(sqlite);
    server = crearServidorHub({ almacen, terminales, tls: cert, versiones: VERSIONES });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('junta las partes (el hijo puede llegar antes que el padre) y rechaza una segunda semilla', async () => {
    const { codigo } = terminales.generarCodigo();
    const { credencial } = terminales.emparejar(codigo, { nombre: 'Caja 1', origin_id_propuesto: 'C1' });
    const sync = { version: 1, origin_id: 'C1', sync_state: 'synced', updated_at: 100 };
    const hijo = { tabla: 'articulo', fila: { id: 'a1', marca_id: 'm1', nombre: 'Pinza', ...sync } };
    const padre = { tabla: 'marca', fila: { id: 'm1', nombre: 'Stanley', activo: 1, ...sync } };
    // Un intento cortado queda descartado por la parte con `inicio`.
    expect((await pedir('POST', '/v1/semilla', credencial, { cambios: [padre], inicio: true })).body).toMatchObject({ recibidos: 1, cursor: 0 });
    expect((await pedir('POST', '/v1/semilla', credencial, { cambios: [hijo], inicio: true })).body).toMatchObject({ recibidos: 1 });
    const fin = await pedir('POST', '/v1/semilla', credencial, { cambios: [padre], fin: true });
    expect(fin.status).toBe(200);
    expect(fin.body).toMatchObject({ recibidos: 2, cursor: 2, rechazados: [] });

    const otra = await pedir('POST', '/v1/semilla', credencial, { cambios: [padre], inicio: true, fin: true });
    expect(otra).toMatchObject({ status: 422, body: { error: 'HUB_NO_VACIO' } });
  });
});
