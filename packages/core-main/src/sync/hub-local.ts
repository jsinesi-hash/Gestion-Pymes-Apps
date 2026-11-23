// «Usar esta PC como servidor» (F2 PR6, ADR-156 §1 y ADR-158 §2). La pantalla de Sincronización instala
// el hub de la app como servicio del sistema operativo, ve si está en marcha y genera códigos de
// emparejamiento. La app corre como usuario: escribe la definición y corre los pasos de administrador con
// elevación (UAC en Windows, pkexec en Linux, osascript en macOS). Genérico: cada app dice cómo se lanza
// su hub y con qué esquema abre su base.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  carpetaDatosPorDefecto, definicionServicio, escribirArchivoServicio, generarCodigoHub, huellaGuardada,
  prepararServicio, PUERTO_POR_DEFECTO,
  type ComandoServicio, type OpcionesHub, type PlataformaServicio,
} from '@core/hub';
import { sondearHub } from './arranque';

export interface OpcionesHubLocal {
  /** Identificador de la app (`ferreteria-client`) y nombre visible (`Ferretería`). */
  readonly id: string;
  readonly nombre: string;
  /** Cómo se lanza el hub: el ejecutable de la app en modo Node y la entrada del hub. */
  readonly ejecutable: string;
  readonly args: readonly string[];
  /** Opciones del hub de la app sobre una carpeta (para generar códigos en su base). */
  readonly opcionesHub: (carpeta: string) => OpcionesHub;
  readonly puerto?: number;
}

/** Efectos afuera del proceso; los tests los reemplazan. */
export interface DepsHubLocal {
  readonly plataforma: PlataformaServicio;
  readonly carpeta: () => string;
  readonly temporal: () => string;
  readonly usuario: () => string;
  readonly direcciones: () => string[];
  /** Corre un comando sin shell y devuelve su código de salida. */
  readonly ejecutar: (c: ComandoServicio) => Promise<number>;
  readonly sondear: (url: string) => Promise<{ url: string; huella: string }>;
  readonly generarCodigo?: (o: OpcionesHub) => { codigo: string; vence_en: number };
  readonly huellaGuardada?: (carpeta: string) => string | null;
}

export interface EstadoHubLocal {
  readonly plataforma: PlataformaServicio;
  readonly carpeta: string;
  readonly puerto: number;
  /** Registrado como servicio del sistema operativo. */
  readonly instalado: boolean;
  /** Responde en esta PC con la huella de su propio certificado. */
  readonly enMarcha: boolean;
  /** Huella del certificado (null si el hub nunca arrancó en esta carpeta). */
  readonly huella: string | null;
  /** Direcciones IPv4 de la PC: las que se escriben en las otras cajas. */
  readonly direcciones: string[];
}

export interface HubLocal {
  estado(): Promise<EstadoHubLocal>;
  instalar(): Promise<EstadoHubLocal>;
  desinstalar(): Promise<EstadoHubLocal>;
  codigo(): { codigo: string; vence_en: number };
}

/** Las de Electron y el sistema: elevación real, red real. */
export function depsHubLocalSistema(id: string): DepsHubLocal {
  return {
    plataforma: process.platform as PlataformaServicio,
    carpeta: () => carpetaDatosPorDefecto(id),
    temporal: () => fs.mkdtempSync(path.join(os.tmpdir(), `${id}-hub-servicio-`)),
    usuario: () => os.userInfo().username,
    direcciones: () => Object.values(os.networkInterfaces()).flat()
      .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal).map((i) => i.address),
    ejecutar: (c) => new Promise((resolve) => {
      const p = spawn(c[0]!, c.slice(1), { stdio: 'ignore', windowsHide: true });
      p.on('error', () => resolve(1));
      p.on('exit', (codigo) => resolve(codigo ?? 1));
    }),
    sondear: (url) => sondearHub(url),
  };
}

export function crearHubLocal(o: OpcionesHubLocal, deps: DepsHubLocal): HubLocal {
  const puerto = o.puerto ?? PUERTO_POR_DEFECTO;
  const leerHuella = deps.huellaGuardada ?? huellaGuardada;

  function definicion() {
    return definicionServicio(deps.plataforma, {
      id: o.id, nombre: o.nombre, ejecutable: o.ejecutable, args: o.args,
      carpeta: deps.carpeta(), puerto, usuario: deps.usuario(),
    });
  }

  async function estado(): Promise<EstadoHubLocal> {
    const carpeta = deps.carpeta();
    const instalado = (await deps.ejecutar(definicion().consultar)) === 0;
    const huella = leerHuella(carpeta);
    let enMarcha = false;
    if (huella) {
      // Otro proceso escuchando en el puerto no cuenta: tiene que ser este hub (su certificado).
      try { enMarcha = (await deps.sondear(`127.0.0.1:${puerto}`)).huella === huella; } catch { enMarcha = false; }
    }
    return { plataforma: deps.plataforma, carpeta, puerto, instalado, enMarcha, huella, direcciones: deps.direcciones() };
  }

  async function aplicar(accion: 'instalar' | 'desinstalar'): Promise<EstadoHubLocal> {
    const def = definicion();
    const prep = prepararServicio(deps.plataforma, def, accion, deps.temporal());
    for (const a of [...prep.escribir, prep.script]) escribirArchivoServicio(a);
    // El código de salida de la elevación no alcanza (el usuario puede cancelar el permiso): se consulta.
    await deps.ejecutar(prep.elevar);
    const e = await estado();
    if (accion === 'instalar' && !e.instalado) throw new Error('HUB_SERVICIO_NO_INSTALADO');
    if (accion === 'desinstalar' && e.instalado) throw new Error('HUB_SERVICIO_SIGUE_INSTALADO');
    return e;
  }

  return {
    estado,
    instalar: () => aplicar('instalar'),
    desinstalar: () => aplicar('desinstalar'),
    codigo: () => (deps.generarCodigo ?? generarCodigoHub)(o.opcionesHub(deps.carpeta())),
  };
}
