// Certificado autofirmado del hub (ADR-150 §1, ADR-158 §3): X.509 v3 con clave ECDSA P-256 y firma
// ECDSA-SHA256, armado en DER con node:crypto, sin dependencias. La terminal no valida la cadena: fija
// la huella SHA-256 que ve al emparejarse (como SSH), así que alcanza con un certificado bien formado.
import { createHash, generateKeyPairSync, randomBytes, sign, X509Certificate } from 'node:crypto';

export interface CertificadoHub {
  readonly certPem: string;
  readonly keyPem: string;
  /** SHA-256 del certificado en DER, en el formato de Node (`AA:BB:…`). */
  readonly huella: string;
}

export interface OpcionesCertificado {
  /** Nombre común (CN) del hub, p. ej. `hub-retail`. */
  readonly nombre: string;
  readonly dias: number;
  /** Nombres DNS extra para el SAN (además de `localhost`). */
  readonly dns?: readonly string[];
  readonly desde?: Date;
}

// ── DER mínimo (X.690) ────────────────────────────────────────────────────────
function largo(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let x = n; x > 0; x >>= 8) bytes.unshift(x & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag: number, contenido: Buffer) => Buffer.concat([Buffer.from([tag]), largo(contenido.length), contenido]);
const secuencia = (...partes: Buffer[]) => tlv(0x30, Buffer.concat(partes));
const conjunto = (...partes: Buffer[]) => tlv(0x31, Buffer.concat(partes));
const explicito = (n: number, contenido: Buffer) => tlv(0xa0 | n, contenido);
const utf8 = (s: string) => tlv(0x0c, Buffer.from(s, 'utf8'));
const octetos = (b: Buffer) => tlv(0x04, b);
const bits = (b: Buffer) => tlv(0x03, Buffer.concat([Buffer.from([0]), b]));

function entero(b: Buffer): Buffer {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++; // sin ceros de más a la izquierda
  const v = b.subarray(i);
  return tlv(0x02, (v[0]! & 0x80) ? Buffer.concat([Buffer.from([0]), v]) : v);
}

function oid(punto: string): Buffer {
  const [a, b, ...resto] = punto.split('.').map(Number) as [number, number, ...number[]];
  const out = [40 * a + b];
  for (const n of resto) {
    const grupo: number[] = [n & 0x7f];
    for (let x = n >>> 7; x > 0; x >>>= 7) grupo.unshift(0x80 | (x & 0x7f));
    out.push(...grupo);
  }
  return tlv(0x06, Buffer.from(out));
}

/** UTCTime hasta 2049 y GeneralizedTime desde 2050 (RFC 5280 §4.1.2.5). */
function hora(d: Date): Buffer {
  const p = (n: number) => String(n).padStart(2, '0');
  const resto = `${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  const anio = d.getUTCFullYear();
  return anio < 2050
    ? tlv(0x17, Buffer.from(`${p(anio % 100)}${resto}`, 'ascii'))
    : tlv(0x18, Buffer.from(`${anio}${resto}`, 'ascii'));
}

const ECDSA_SHA256 = secuencia(oid('1.2.840.10045.4.3.2'));
const nombreX500 = (cn: string) => secuencia(conjunto(secuencia(oid('2.5.4.3'), utf8(cn))));

export function generarCertificado(opts: OpcionesCertificado): CertificadoHub {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const desde = opts.desde ?? new Date();
  const hasta = new Date(desde.getTime() + opts.dias * 86_400_000);
  const serie = randomBytes(16);
  serie[0]! &= 0x7f; // positivo

  const san = secuencia(...['localhost', ...(opts.dns ?? [])].map((n) => tlv(0x82, Buffer.from(n, 'ascii'))));
  const extensiones = explicito(3, secuencia(
    secuencia(oid('2.5.29.19'), octetos(secuencia())),           // basicConstraints: no es CA
    secuencia(oid('2.5.29.17'), octetos(san)),                     // subjectAltName
  ));
  const tbs = secuencia(
    explicito(0, entero(Buffer.from([2]))),                        // versión 3
    entero(serie),
    ECDSA_SHA256,
    nombreX500(opts.nombre),                                       // emisor = sujeto (autofirmado)
    secuencia(hora(desde), hora(hasta)),
    nombreX500(opts.nombre),
    publicKey.export({ type: 'spki', format: 'der' }),
    extensiones,
  );
  const firma = sign('sha256', tbs, privateKey); // ECDSA en DER, como pide X.509
  const der = secuencia(tbs, ECDSA_SHA256, bits(firma));
  const certPem = `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----\n`;
  return {
    certPem,
    keyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    huella: huellaDe(certPem),
  };
}

/** Huella SHA-256 de un certificado PEM, en el formato de `X509Certificate.fingerprint256`. */
export function huellaDe(certPem: string): string {
  const der = new X509Certificate(certPem).raw;
  return createHash('sha256').update(der).digest('hex').toUpperCase().match(/.{2}/g)!.join(':');
}
