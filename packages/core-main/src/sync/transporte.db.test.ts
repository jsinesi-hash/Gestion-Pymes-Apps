import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { generarCertificado } from '@core/hub';
import { crearTransporteHttps, type OpcionesTransporte } from './transporte';

// Transporte HTTPS de la terminal (F2 PR3, ADR-158 §3): confía solo en el certificado guardado al
// emparejar y además compara su huella. Corre bajo Electron porque `@core/hub` carga better-sqlite3.
describe('transporte HTTPS hacia el hub', () => {
  const cert = generarCertificado({ nombre: 'hub-prueba', dias: 30 });
  let server: https.Server;
  let url = '';
  const vistos: { metodo: string | undefined; ruta: string | undefined; headers: Record<string, unknown>; cuerpo: string }[] = [];

  beforeAll(async () => {
    server = https.createServer({ cert: cert.certPem, key: cert.keyPem }, (req, res) => {
      let cuerpo = '';
      req.on('data', (d) => { cuerpo += d; });
      req.on('end', () => {
        vistos.push({ metodo: req.method, ruta: req.url, headers: req.headers, cuerpo });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, hora_hub_ms: Date.now() }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    url = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const opciones = (extra: Partial<OpcionesTransporte> = {}): OpcionesTransporte => ({
    url, certPem: cert.certPem, huella: cert.huella, credencial: 'secreta', versiones: { protocolo: 1, esquema: 63 }, ...extra,
  });

  it('con el certificado y la huella guardados: manda la credencial, las versiones y el cuerpo', async () => {
    const t = crearTransporteHttps(opciones());
    try {
      const r = await t.pedir('POST', '/v1/push', { cambios: [] });
      expect(r.status).toBe(200);
      expect(r.recibidoMs).toBeGreaterThanOrEqual(r.enviadoMs);
      // Dos pedidos seguidos por el mismo agente (keep-alive) siguen funcionando.
      expect((await t.pedir('GET', '/v1/estado')).status).toBe(200);
      const v = vistos.at(-2)!;
      expect(v).toMatchObject({ metodo: 'POST', ruta: '/v1/push', cuerpo: '{"cambios":[]}' });
      expect(v.headers).toMatchObject({ authorization: 'Bearer secreta', 'x-protocolo': '1', 'x-esquema': '63' });
    } finally {
      t.cerrar();
    }
  });

  it('otra huella esperada: HUELLA_DISTINTA, sin mandar el pedido', async () => {
    const antes = vistos.length;
    const t = crearTransporteHttps(opciones({ huella: 'AA:BB' }));
    try {
      await expect(t.pedir('GET', '/v1/estado')).rejects.toThrow('HUELLA_DISTINTA');
      expect(vistos.length).toBe(antes);
    } finally {
      t.cerrar();
    }
  });

  it('un hub con otro certificado (o un impostor) no conecta', async () => {
    const otro = generarCertificado({ nombre: 'hub-prueba', dias: 30 });
    const t = crearTransporteHttps(opciones({ certPem: otro.certPem, huella: otro.huella }));
    try {
      await expect(t.pedir('GET', '/v1/estado')).rejects.toThrow('HUB_INALCANZABLE');
    } finally {
      t.cerrar();
    }
  });

  it('hub apagado: HUB_INALCANZABLE', async () => {
    const t = crearTransporteHttps(opciones({ url: 'https://127.0.0.1:1' }));
    try {
      await expect(t.pedir('GET', '/v1/estado')).rejects.toThrow('HUB_INALCANZABLE');
    } finally {
      t.cerrar();
    }
  });
});
