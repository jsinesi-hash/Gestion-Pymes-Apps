// Transporte HTTPS de la terminal hacia el hub (ADR-150 §1, §2 y §8; ADR-158 §3). Fija el certificado
// que la terminal guardó al emparejarse: confía solo en él (como CA única, con la verificación de TLS
// encendida) y además compara la huella. Con `rejectUnauthorized: false` Node no llama a
// `checkServerIdentity`, así que eso no fijaría nada (hallazgo del PR2).
import https from 'node:https';
import { CABECERA_ESQUEMA, CABECERA_PROTOCOLO, type Versiones } from '@core/hub';

export interface RespuestaHub {
  readonly status: number;
  readonly body: Record<string, unknown>;
  /** Hora local al mandar el pedido y al terminar de recibir la respuesta (para medir el reloj). */
  readonly enviadoMs: number;
  readonly recibidoMs: number;
}

/** Lo que el cliente de sync necesita del hub. Los tests lo reemplazan por uno en memoria. */
export interface TransporteHub {
  pedir(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<RespuestaHub>;
  cerrar(): void;
}

export interface OpcionesTransporte {
  /** `https://<host>:<puerto>` del hub. */
  readonly url: string;
  /** Certificado del hub guardado al emparejar (PEM) y su huella SHA-256. */
  readonly certPem: string;
  readonly huella: string;
  readonly credencial: string;
  readonly versiones: Versiones;
  readonly timeoutMs?: number;
}

const TIMEOUT_POR_DEFECTO_MS = 15_000;

export function crearTransporteHttps(o: OpcionesTransporte): TransporteHub {
  const base = o.url.replace(/\/+$/, '');
  const checkServerIdentity = (_host: string, cert: { fingerprint256: string }) =>
    cert.fingerprint256 === o.huella ? undefined : new Error('HUELLA_DISTINTA');
  // Agente propio por hub: el global reusa sockets ya verificados contra otro certificado.
  const agente = new https.Agent({ keepAlive: true, maxSockets: 2, ca: o.certPem, checkServerIdentity });
  return {
    pedir(metodo, ruta, cuerpo) {
      const datos = cuerpo === undefined ? undefined : JSON.stringify(cuerpo);
      return new Promise<RespuestaHub>((resolve, reject) => {
        const enviadoMs = Date.now();
        const req = https.request(`${base}${ruta}`, {
          method: metodo,
          agent: agente,
          ca: o.certPem,
          checkServerIdentity,
          timeout: o.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS,
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${o.credencial}`,
            [CABECERA_PROTOCOLO]: String(o.versiones.protocolo),
            [CABECERA_ESQUEMA]: String(o.versiones.esquema),
            ...(datos === undefined ? {} : { 'content-length': Buffer.byteLength(datos) }),
          },
        }, (res) => {
          const partes: Buffer[] = [];
          res.on('data', (d: Buffer) => partes.push(d));
          res.on('error', (e) => reject(new Error(`HUB_INALCANZABLE: ${e.message}`)));
          res.on('end', () => {
            const texto = Buffer.concat(partes).toString('utf8');
            let body: Record<string, unknown> = {};
            try {
              body = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
            } catch {
              reject(new Error(`HUB_RESPUESTA_INVALIDA: ${res.statusCode}`));
              return;
            }
            resolve({ status: res.statusCode ?? 0, body, enviadoMs, recibidoMs: Date.now() });
          });
        });
        req.on('timeout', () => req.destroy(new Error('TIEMPO_AGOTADO')));
        req.on('error', (e) => {
          // La huella distinta es un error de seguridad, no de red: se informa tal cual.
          reject(e.message === 'HUELLA_DISTINTA' ? e : new Error(`HUB_INALCANZABLE: ${e.message}`));
        });
        if (datos !== undefined) req.write(datos);
        req.end();
      });
    },
    cerrar() {
      agente.destroy();
    },
  };
}
