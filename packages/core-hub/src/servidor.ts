// Servidor HTTPS del hub (ADR-150 §1, §2, §8, §9 y §10; ADR-158 §3; ADR-152 §2 y ADR-154 §2). Sin
// framework: ocho rutas con JSON.
// Toda ruta salvo emparejar exige la credencial de la terminal, y el origin_id de un push sale de esa
// credencial, nunca del cuerpo: una terminal no puede hacerse pasar por otra.
import https from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AlmacenHub } from './almacen';
import type { RegistroTerminales } from './terminales';
import type { CoordinacionHub } from './coordinacion';
import {
  CABECERA_ESQUEMA, CABECERA_PROTOCOLO, RUTAS, versionesCompatibles,
  type PedidoBloque, type PedidoEmparejar, type PedidoPush, type PedidoResolverConflicto, type PedidoSemilla, type Versiones,
} from './protocolo';
import type { CambioEntrante } from './almacen';

export interface OpcionesServidor {
  readonly almacen: AlmacenHub;
  readonly terminales: RegistroTerminales;
  /** Permiso de coordinadora y bloques de correlativos (ADR-152 §2, ADR-154 §2). */
  readonly coordinacion: CoordinacionHub;
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
const ERRORES_DEL_PEDIDO = /^(HUB_NO_VACIO|TABLA_NO_SINCRONIZA|COLUMNA_DESCONOCIDA|CAMBIO_INVALIDO|LOTE_FK_ROTA|BLOQUE_INVALIDO|CODIGO_INVALIDO|CODIGO_USADO|CODIGO_VENCIDO|CONFLICTO_INEXISTENTE|CONFLICTO_YA_RESUELTO|RESOLUCION_NO_VALIDA|RESOLUCION_SIN_AUTOR|CAJA_INVALIDA)/;
const TIPOS_CONFLICTO = new Set(['lww', 'unicidad', 'integridad']);

export function crearServidorHub(opts: OpcionesServidor): https.Server {
  const limite = opts.limiteCuerpoBytes ?? LIMITE_CUERPO;
  const maxIntentos = opts.maxIntentosEmparejar ?? 10;
  const fallidos = new Map<string, number[]>(); // dirección → instantes de intentos fallidos
  const registrar = opts.registrar ?? (() => {});
  // Partes de la semilla recibidas, por terminal, hasta que llega la última (ADR-150 §10).
  const semillas = new Map<string, CambioEntrante[]>();

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
    if (ruta === `POST ${RUTAS.semilla}`) {
      const p = (await leerCuerpo(req)) as Partial<PedidoSemilla>;
      if (!Array.isArray(p.cambios)) throw new ErrorHttp(400, 'CAMBIOS_FALTANTES');
      if (opts.almacen.ultimoCursor() !== 0) { semillas.delete(origen); throw new ErrorHttp(422, 'HUB_NO_VACIO'); }
      const partes = p.inicio === true ? [] : (semillas.get(origen) ?? []);
      for (const c of p.cambios) partes.push(c);
      if (p.fin !== true) {
        semillas.set(origen, partes);
        return responder(res, 200, { recibidos: partes.length, cursor: 0 });
      }
      semillas.delete(origen);
      const rechazados = opts.almacen.aplicarLote(origen, partes).filter((r) => r.estado !== 'aplicado');
      registrar(`semilla de ${origen}: ${partes.length} filas, ${rechazados.length} rechazadas`);
      return responder(res, 200, { recibidos: partes.length, cursor: opts.almacen.ultimoCursor(), rechazados });
    }
    if (ruta === `POST ${RUTAS.coordinadora}`) return responder(res, 200, { ...opts.coordinacion.pedirCoordinadora(origen) });
    if (ruta === `POST ${RUTAS.bloque}`) {
      const p = (await leerCuerpo(req)) as Partial<PedidoBloque>;
      const b = opts.coordinacion.asignarBloque(String(p.serie ?? ''), origen, { minimo: Number(p.minimo), tamano: Number(p.tamano) });
      registrar(`bloque ${b.serie} ${b.desde}-${b.hasta} para ${origen}`);
      return responder(res, 200, { ...b });
    }
    if (ruta === `GET ${RUTAS.snapshot}`) return responder(res, 200, { ...opts.almacen.snapshot() });
    // F3 PR1 (ADR-159): el Supervisor revisa los conflictos desde cualquier caja. El permiso lo verifica la
    // caja (canal con `permiso:sync.conflictos`); el hub solo exige una credencial de terminal válida.
    if (ruta === `GET ${RUTAS.conflictos}`) {
      const tipo = url.searchParams.get('tipo');
      const antes = Number(url.searchParams.get('antes'));
      const limite = Number(url.searchParams.get('limite'));
      const id = Number(url.searchParams.get('id'));
      return responder(res, 200, {
        ...opts.almacen.listarConflictos({
          ...(Number.isInteger(id) && id > 0 ? { id } : {}),
          pendientes: url.searchParams.get('pendientes') === '1',
          ...(tipo && TIPOS_CONFLICTO.has(tipo) ? { tipo: tipo as 'lww' } : {}),
          ...(Number.isInteger(antes) && antes > 0 ? { antesDeId: antes } : {}),
          ...(Number.isInteger(limite) && limite > 0 ? { limite } : {}),
        }),
      });
    }
    if (ruta === `POST ${RUTAS.resolverConflicto}`) {
      const p = (await leerCuerpo(req)) as Partial<PedidoResolverConflicto>;
      const por = String(p.por ?? '').trim().slice(0, 80);
      const conflicto = opts.almacen.resolverConflicto(Number(p.id), {
        resolucion: String(p.resolucion ?? '') as PedidoResolverConflicto['resolucion'],
        por: por ? `${por} (${origen})` : '',
      });
      registrar(`conflicto ${conflicto.id} resuelto (${conflicto.resolucion}) desde ${origen}`);
      return responder(res, 200, { conflicto });
    }
    // F3 PR4 (ADR-155 §4): el único turno de caja compartida del negocio.
    if (ruta === `POST ${RUTAS.cajaAbrir}`) {
      const p = (await leerCuerpo(req)) as { caja_id?: unknown };
      const r = opts.coordinacion.abrirCajaCompartida(String(p.caja_id ?? ''), origen);
      if (r.abierta) registrar(`caja compartida ${r.caja_id} abierta por ${origen}`);
      return responder(res, 200, { ...r });
    }
    if (ruta === `POST ${RUTAS.cajaCerrar}`) {
      const p = (await leerCuerpo(req)) as { caja_id?: unknown };
      const r = opts.coordinacion.cerrarCajaCompartida(String(p.caja_id ?? ''));
      if (r.cerrada) registrar(`caja compartida ${String(p.caja_id)} cerrada por ${origen}`);
      return responder(res, 200, { ...r });
    }
    if (ruta === `GET ${RUTAS.caja}`) return responder(res, 200, { caja: opts.coordinacion.cajaCompartida() });
    if (ruta === `GET ${RUTAS.terminales}`) {
      return responder(res, 200, { terminales: opts.terminales.listar() });
    }
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
