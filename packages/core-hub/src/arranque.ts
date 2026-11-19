// Arranque y comandos del hub (ADR-158 §1 y §2). El mismo código corre en Windows, Linux y macOS: cada
// app lo llama con su esquema, su registro y sus migraciones; la carpeta de datos guarda la base del
// hub, el certificado y su clave. El servicio del sistema operativo (PR6) solo ejecuta `iniciar`.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { RegistroSync } from '@core/db';
import { abrirAlmacenHub } from './almacen';
import { abrirTerminales } from './terminales';
import { generarCertificado, huellaDe } from './certificado';
import { crearServidorHub } from './servidor';
import { PROTOCOLO_VERSION, versionEsquema } from './protocolo';

export const PUERTO_POR_DEFECTO = 7443;
const VIGENCIA_CERTIFICADO_DIAS = 3650;

export interface OpcionesHub {
  /** Nombre del hub (CN del certificado), p. ej. `hub-retail`. */
  readonly nombre: string;
  readonly schema: Record<string, unknown>;
  readonly registro: RegistroSync;
  readonly migracionesApp: string;
  readonly carpeta: string;
  readonly escribir?: (linea: string) => void;
}

export interface HubEnMarcha {
  readonly puerto: number;
  readonly huella: string;
  cerrar(): Promise<void>;
}

/**
 * Carpeta de datos del hub según el sistema operativo, o `GESTION_HUB_DIR` si está definida (desarrollo,
 * servicio con otra ruta). Nunca la carpeta de datos de la terminal: el hub tiene su propia base.
 */
export function carpetaDatosPorDefecto(
  app: string,
  entorno: { platform: NodeJS.Platform; env: NodeJS.ProcessEnv; home: string } = { platform: process.platform, env: process.env, home: os.homedir() },
): string {
  if (entorno.env['GESTION_HUB_DIR']) return entorno.env['GESTION_HUB_DIR'];
  const nombre = `${app}-hub`;
  if (entorno.platform === 'win32') return path.join(entorno.env['APPDATA'] ?? path.join(entorno.home, 'AppData', 'Roaming'), nombre);
  if (entorno.platform === 'darwin') return path.join(entorno.home, 'Library', 'Application Support', nombre);
  return path.join(entorno.env['XDG_CONFIG_HOME'] ?? path.join(entorno.home, '.config'), nombre);
}

function abrirBase(o: OpcionesHub) {
  fs.mkdirSync(o.carpeta, { recursive: true });
  const sqlite = new Database(path.join(o.carpeta, 'hub.db'));
  const almacen = abrirAlmacenHub(sqlite, { schema: o.schema, registro: o.registro, migracionesApp: o.migracionesApp });
  return { sqlite, almacen, terminales: abrirTerminales(sqlite) };
}

/** Lee el certificado de la carpeta o, la primera vez, lo genera; la clave queda solo para el dueño. */
function certificado(o: OpcionesHub): { certPem: string; keyPem: string; huella: string } {
  fs.mkdirSync(o.carpeta, { recursive: true });
  const rutaCert = path.join(o.carpeta, 'hub-cert.pem');
  const rutaClave = path.join(o.carpeta, 'hub-key.pem');
  if (fs.existsSync(rutaCert) && fs.existsSync(rutaClave)) {
    const certPem = fs.readFileSync(rutaCert, 'utf8');
    return { certPem, keyPem: fs.readFileSync(rutaClave, 'utf8'), huella: huellaDe(certPem) };
  }
  const c = generarCertificado({ nombre: o.nombre, dias: VIGENCIA_CERTIFICADO_DIAS, dns: [os.hostname()] });
  fs.writeFileSync(rutaClave, c.keyPem, { mode: 0o600 });
  fs.writeFileSync(rutaCert, c.certPem);
  return c;
}

function opcion(argv: readonly string[], nombre: string): string | undefined {
  const i = argv.indexOf(`--${nombre}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Fecha y hora local en 24 h (`2026-11-18 16:26`): no depende del ICU del runtime. */
function fecha(s: number | null): string {
  if (s == null) return '—';
  const d = new Date(s * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Comandos del hub:
 * - `iniciar [--puerto N] [--host H]`: abre la base, el certificado y el servidor HTTPS (no termina).
 * - `codigo`: genera un código de emparejamiento de un solo uso.
 * - `terminales`: lista las terminales emparejadas.
 * - `revocar <origin_id>`: deja a esa terminal sin acceso.
 * - `huella`: muestra la huella del certificado, para confirmarla al emparejar.
 */
export async function ejecutarComandoHub(argv: readonly string[], o: OpcionesHub): Promise<HubEnMarcha | undefined> {
  const escribir = o.escribir ?? ((l: string) => console.log(l));
  const [comando = 'iniciar', ...resto] = argv;

  if (comando === 'iniciar') {
    const { sqlite, almacen, terminales } = abrirBase(o);
    const tls = certificado(o);
    const versiones = { protocolo: PROTOCOLO_VERSION, esquema: versionEsquema(o.migracionesApp) };
    const server = crearServidorHub({ almacen, terminales, tls, versiones, registrar: (m) => escribir(`[hub] ${m}`) });
    const puerto = Number(opcion(resto, 'puerto') ?? process.env['GESTION_HUB_PUERTO'] ?? PUERTO_POR_DEFECTO);
    const host = opcion(resto, 'host') ?? '0.0.0.0';
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(puerto, host, resolve); });
    const real = (server.address() as AddressInfo).port;
    escribir(`[hub] ${o.nombre} escuchando en https://${host}:${real} (protocolo ${versiones.protocolo}, esquema ${versiones.esquema})`);
    escribir(`[hub] carpeta de datos: ${o.carpeta}`);
    escribir(`[hub] huella del certificado: ${tls.huella}`);
    return {
      puerto: real,
      huella: tls.huella,
      cerrar: () => new Promise<void>((r) => server.close(() => { sqlite.close(); r(); })),
    };
  }

  const { sqlite, terminales } = abrirBase(o);
  try {
    if (comando === 'codigo') {
      const { codigo, vence_en } = terminales.generarCodigo();
      escribir(`Código de emparejamiento: ${codigo} (vence ${fecha(vence_en)}, un solo uso)`);
    } else if (comando === 'terminales') {
      const lista = terminales.listar();
      if (lista.length === 0) escribir('Sin terminales emparejadas.');
      for (const t of lista) {
        escribir(`${t.origin_id}\t${t.nombre}\t${t.revocada_en ? `revocada ${fecha(t.revocada_en)}` : 'activa'}\túltimo contacto ${fecha(t.ultimo_contacto)}`);
      }
    } else if (comando === 'revocar') {
      const origin = resto[0];
      if (!origin) throw new Error('FALTA_ORIGIN_ID');
      terminales.revocar(origin);
      escribir(`Terminal ${origin} revocada.`);
    } else if (comando === 'huella') {
      escribir(certificado(o).huella);
    } else {
      throw new Error(`COMANDO_DESCONOCIDO: ${comando}`);
    }
  } finally {
    sqlite.close();
  }
  return undefined;
}
