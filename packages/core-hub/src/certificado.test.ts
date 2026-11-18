import { describe, it, expect } from 'vitest';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import tls from 'node:tls';
import { generarCertificado, huellaDe } from './certificado';

// ADR-150 §1 y ADR-158 §3: el hub de la red local usa un certificado autofirmado que la terminal
// fija por su huella al emparejarse. Se genera con node:crypto, sin dependencias.
describe('certificado autofirmado del hub', () => {
  const c = generarCertificado({ nombre: 'hub-retail', dias: 3650 });

  it('Node lo lee como X.509 v3, autofirmado, con el nombre y la vigencia pedidos', () => {
    const x = new X509Certificate(c.certPem);
    expect(x.subject).toBe('CN=hub-retail');
    expect(x.issuer).toBe('CN=hub-retail');
    expect(x.verify(x.publicKey)).toBe(true); // la firma es suya
    expect(x.checkPrivateKey(createPrivateKey(c.keyPem))).toBe(true);
    const dias = (Date.parse(x.validTo) - Date.parse(x.validFrom)) / 86_400_000;
    expect(Math.round(dias)).toBe(3650);
    expect(x.subjectAltName).toContain('DNS:localhost');
  });

  it('la huella es el SHA-256 del certificado, la misma que informa Node', () => {
    const x = new X509Certificate(c.certPem);
    expect(c.huella).toBe(x.fingerprint256);
    expect(huellaDe(c.certPem)).toBe(c.huella);
  });

  it('dos certificados nunca son iguales (clave y número de serie propios)', () => {
    const otro = generarCertificado({ nombre: 'hub-retail', dias: 30 });
    expect(otro.huella).not.toBe(c.huella);
    expect(new X509Certificate(otro.certPem).serialNumber).not.toBe(new X509Certificate(c.certPem).serialNumber);
  });

  it('sirve para un handshake TLS real; el cliente lo acepta por huella y rechaza otra', async () => {
    const server = tls.createServer({ cert: c.certPem, key: c.keyPem }, (s) => s.end('ok'));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    const conectar = (huella: string) => new Promise<string>((resolve, reject) => {
      const s = tls.connect({
        host: '127.0.0.1', port, rejectUnauthorized: false,
      }, () => {
        const vista = s.getPeerX509Certificate()?.fingerprint256;
        if (vista !== huella) { s.destroy(); reject(new Error('HUELLA_DISTINTA')); return; }
        s.on('data', (d) => { resolve(String(d)); s.end(); });
      });
      s.on('error', reject);
    });
    try {
      await expect(conectar(c.huella)).resolves.toBe('ok');
      await expect(conectar('00:11')).rejects.toThrow('HUELLA_DISTINTA');
    } finally {
      server.close();
    }
  });
});
