import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { ejecutarComandoHub, versionEsquema, PROTOCOLO_VERSION, type HubEnMarcha } from '@core/hub';
import { opcionesHub, MIGRACIONES_APP } from '../opciones';

// El hub de Retail arranca con el esquema y las migraciones reales de la app (F2 PR2, ADR-158).
describe('hub de Retail', () => {
  let carpeta = '';
  let hub: HubEnMarcha | undefined;
  afterEach(async () => {
    await hub?.cerrar();
    hub = undefined;
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  it('arranca con las migraciones de la app y una terminal se empareja por HTTPS', async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-app-'));
    const salida: string[] = [];
    const o = { ...opcionesHub(carpeta), escribir: (l: string) => salida.push(l) };
    hub = await ejecutarComandoHub(['iniciar', '--puerto', '0', '--host', '127.0.0.1'], o);
    await ejecutarComandoHub(['codigo'], o);
    const codigo = /([A-Z2-9]{4}-[A-Z2-9]{4})/.exec(salida.join(' '))![1]!;
    const esquema = versionEsquema(MIGRACIONES_APP);
    const certPem = fs.readFileSync(path.join(carpeta, 'hub-cert.pem'), 'utf8');
    const r = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const req = https.request(`https://127.0.0.1:${hub!.puerto}/v1/emparejar`, {
        method: 'POST', agent: false, ca: certPem,
        checkServerIdentity: (_h, c) => (c.fingerprint256 === hub!.huella ? undefined : new Error('HUELLA_DISTINTA')),
        headers: { 'content-type': 'application/json', 'x-protocolo': String(PROTOCOLO_VERSION), 'x-esquema': String(esquema) },
      }, (res) => { let s = ''; res.on('data', (d) => { s += d; }); res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(s) })); });
      req.on('error', reject);
      req.end(JSON.stringify({ codigo, nombre: 'Caja 1' }));
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ origin_id: 'C1', versiones: { protocolo: PROTOCOLO_VERSION, esquema } });
    expect(esquema).toBe(JSON.parse(fs.readFileSync(path.join(MIGRACIONES_APP, 'meta', '_journal.json'), 'utf8')).entries.length);
  });
});
