// Servidor HTTPS del hub (ADR-150 §1, §2, §8 y §9; ADR-158 §3). Sin framework: cinco rutas con JSON.
// Toda ruta salvo emparejar exige la credencial de la terminal, y el origin_id de un push sale de esa
// credencial, nunca del cuerpo: una terminal no puede hacerse pasar por otra.
import https from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AlmacenHub } from './almacen';
import type { RegistroTerminales } from './terminales';
import {
  CABECERA_ESQUEMA, CABECERA_PROTOCOLO, RUTAS, versionesCompatibles,
  type PedidoEmparejar, type PedidoPush, type Versiones,
} from './protocolo';

export interface OpcionesServidor {
  readonly almacen: AlmacenHub;
  readonly terminales: RegistroTerminales;
  readonly tls: { readonly certPem: string; readonly keyPem: string };
  readonly versiones: Versiones;
  /** Tope del cuerpo de un pedido (la semilla de una base entera es el pedido más grande). */
  readonly limiteCuerpoBytes?: number;
  /** Intentos fallidos de emparejar por dirección antes de cortar (fuerza bruta del código). */
  readonly maxIntentosEmparejar?: number;
  readonly registrar?: (mensaje: string) => void;
}

const LIMITE_CUERPO = 64 * 1024 * 1024;
const PAGINA_POR_DEFECTO = 500;
const PAGINA_MAXIMA = 2000;
const VENTANA_INTENTOS_MS = 10 * 60 * 1000;

class ErrorHttp extends Error {
  constructor(readonly status: number, codigo: string, readonly extra: Record<string, unknown> = {}) { super(codigo); }
}

/** Errores de dominio del almacén y del emparejamiento que son culpa del pedido, no del hub. */
const ERRORES_DEL_PEDIDO = /^(TABLA_NO_SINCRONIZA|COLUMNA_DESCONOCIDA|CAMBIO_INVALIDO|LOTE_FK_ROTA|CODIGO_INVALIDO|CODIGO_USADO|CODIGO_VENCIDO)/;

export function crearServidorHub(opts: OpcionesServidor): https.Server {
  const limite = opts.limiteCuerpoBytes ?? LIMITE_CUERPO;
  const maxIntentos = opts.maxIntentosEmparejar ?? 10;
  const fallidos = new Map<string, number[]>(); // dirección → instantes de intentos fallidos
  const registrar = opts.registrar ?? (() => {});

  function responder(res: ServerResponse, status: number, cuerpo: Record<string, unknown>): void {
    const datos = JSON.stringify({ ...cuerpo, hora_hub_ms: Date.now() });
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(datos) });
    res.end(datos);
  }

  function leerCuerpo(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const partes: Buffer[] = [];
      let total = 0;
      req.on('data', (b: Buffer) => {
        total += b.length;
        if (total > limite) { reject(new ErrorHttp(413, 'CUERPO_DEMASIADO_GRANDE')); req.resume(); return; }
        partes.push(b);
      });
      req.on('end', () => {
        if (total > limite) return;
        const texto = Buffer.concat(partes).toString('utf8');
        try { resolve(texto ? JSON.parse(texto) : {}); } catch { reject(new ErrorHttp(400, 'JSON_INVALIDO')); }
      });
      req.on('error', reject);
    });
  }

  function versionesDe(req: IncomingMessage): Versiones {
    const v = { protocolo: Number(req.headers[CABECERA_PROTOCOLO]), esquema: Number(req.headers[CABECERA_ESQUEMA]) };
    if (!versionesCompatibles(opts.versiones, v)) throw new ErrorHttp(409, 'VERSION_INCOMPATIBLE', { versiones: opts.versiones });
    return v;
  }

  function autenticar(req: IncomingMessage, versiones: Versiones): string {
    const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
    const t = m ? opts.terminales.autenticar(m[1]!, undefined, versiones) : null;
    if (!t) throw new ErrorHttp(401, 'NO_AUTORIZADO');
    return t.origin_id;
  }

  function limitarIntentos(direccion: string): void {
    const ahora = Date.now();
    const recientes = (fallidos.get(direccion) ?? []).filter((t) => ahora - t < VENTANA_INTENTOS_MS);
    fallidos.set(direccion, recientes);
    if (recientes.length >= maxIntentos) throw new ErrorHttp(429, 'DEMASIADOS_INTENTOS');
  }

  async function atender(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'https://hub');
    const ruta = `${req.method} ${url.pathname}`;
    const versiones = versionesDe(req);

    if (ruta === `POST ${RUTAS.emparejar}`) {
      const direccion = req.socket.remoteAddress ?? '?';
      limitarIntentos(direccion);
      const p = (await leerCuerpo(req)) as Partial<PedidoEmparejar>;
      try {
        const r = opts.terminales.emparejar(String(p.codigo ?? ''), {
          nombre: String(p.nombre ?? ''),
          ...(typeof p.origin_id_propuesto === 'string' ? { origin_id_propuesto: p.origin_id_propuesto } : {}),
        });
        opts.terminales.autenticar(r.credencial, undefined, versiones);
        registrar(`terminal emparejada: ${r.origin_id}`);
        return responder(res, 200, { ...r, versiones: opts.versiones });
      } catch (e) {
        fallidos.get(direccion)!.push(Date.now());
        throw e;
      }
    }

    const origen = autenticar(req, versiones);
    if (ruta === `POST ${RUTAS.push}`) {
      const p = (await leerCuerpo(req)) as Partial<PedidoPush>;
      if (!Array.isArray(p.cambios)) throw new ErrorHttp(400, 'CAMBIOS_FALTANTES');
      return responder(res, 200, { resultados: opts.almacen.aplicarLote(origen, p.cambios) });
    }
    if (ruta === `GET ${RUTAS.pull}`) {
      const desde = Math.max(0, Math.trunc(Number(url.searchParams.get('desde') ?? 0)) || 0);
      const pedido = Math.trunc(Number(url.searchParams.get('limite') ?? PAGINA_POR_DEFECTO)) || PAGINA_POR_DEFECTO;
      return responder(res, 200, { ...opts.almacen.cambiosDesde(desde, Math.min(Math.max(pedido, 1), PAGINA_MAXIMA)) });
    }
    if (ruta === `GET ${RUTAS.snapshot}`) return responder(res, 200, { ...opts.almacen.snapshot() });
    if (ruta === `GET ${RUTAS.estado}`) {
      return responder(res, 200, { origin_id: origen, cursor: opts.almacen.ultimoCursor(), versiones: opts.versiones });
    }
    throw new ErrorHttp(404, 'RUTA_INEXISTENTE');
  }

  return https.createServer({ cert: opts.tls.certPem, key: opts.tls.keyPem }, (req, res) => {
    atender(req, res).catch((e: unknown) => {
      if (e instanceof ErrorHttp) return responder(res, e.status, { error: e.message, ...e.extra });
      const mensaje = e instanceof Error ? e.message : String(e);
      if (ERRORES_DEL_PEDIDO.test(mensaje)) return responder(res, 422, { error: mensaje });
      registrar(`error en ${req.method} ${req.url}: ${mensaje}`);
      return responder(res, 500, { error: 'ERROR_INTERNO' });
    });
  });
}
