// El hub como servicio del sistema operativo (ADR-156 §1, ADR-158 §2; F2 PR6). El proceso es el mismo en
// los tres: el ejecutable de la app en modo Node (`ELECTRON_RUN_AS_NODE=1`) con la entrada del hub y el
// comando `iniciar`. Cambia solo cómo se registra:
// - Windows: tarea programada que arranca con la PC como SYSTEM (decisión del usuario: sin descargar un
//   wrapper de servicio). Un lanzador `.cmd` la vuelve a levantar si el hub se cae. La carpeta va en
//   ProgramData y los usuarios pueden escribirla, para que la app genere códigos de emparejamiento.
// - Linux: unidad de systemd; macOS: LaunchDaemon. Los dos corren como el usuario que lo instala, con su
//   carpeta de siempre.
// Este módulo solo arma los archivos y los comandos; quién los ejecuta (y cómo pide permisos de
// administrador) lo decide quien lo llama.
import fs from 'node:fs';
import path from 'node:path';

export type PlataformaServicio = 'win32' | 'linux' | 'darwin';

export interface DatosServicio {
  /** Identificador de la app (`ferreteria-client`): nombra la carpeta, la unidad y el LaunchDaemon. */
  readonly id: string;
  /** Nombre visible (`Ferretería`): nombra la tarea y la regla del firewall en Windows. */
  readonly nombre: string;
  /** Ejecutable de la app (el `electron.exe` empaquetado) y los argumentos antes del comando del hub. */
  readonly ejecutable: string;
  readonly args: readonly string[];
  readonly carpeta: string;
  readonly puerto: number;
  /** Usuario con el que corre en Linux y macOS (en Windows corre como SYSTEM). */
  readonly usuario?: string;
}

export interface ArchivoServicio {
  readonly ruta: string;
  readonly contenido: string;
  /** El Programador de tareas de Windows lee el XML en UTF-16. */
  readonly utf16?: boolean;
}

/** Un comando y sus argumentos, sin pasar por un shell. */
export type ComandoServicio = readonly string[];

export interface DefinicionServicio {
  readonly archivos: readonly ArchivoServicio[];
  readonly instalar: readonly ComandoServicio[];
  readonly desinstalar: readonly ComandoServicio[];
  /** Termina bien si el servicio está registrado. */
  readonly consultar: ComandoServicio;
}

/** Escribe un archivo de la definición (crea la carpeta). El XML de la tarea de Windows va en UTF-16 con BOM. */
export function escribirArchivoServicio(a: ArchivoServicio): void {
  fs.mkdirSync(path.dirname(a.ruta), { recursive: true });
  fs.writeFileSync(a.ruta, a.utf16 ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(a.contenido, 'utf16le')]) : a.contenido);
}

/** Escapa texto de un elemento XML (nunca va en atributos). */
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const comillas = (s: string) => `"${s}"`;
const lineaHub = (d: DatosServicio) => [d.ejecutable, ...d.args].map(comillas).join(' ') + ` iniciar --puerto ${d.puerto}`;

function windows(d: DatosServicio): DefinicionServicio {
  const tarea = `${d.nombre} hub`;
  const rutaCmd = path.win32.join(d.carpeta, 'hub-servicio.cmd');
  const rutaXml = path.win32.join(d.carpeta, 'hub-tarea.xml');
  const log = path.win32.join(d.carpeta, 'hub.log');
  // chcp 65001: la ruta de la app puede tener acentos («Ferretería»). Si el hub termina, espera 10 s y
  // lo vuelve a levantar (`ping` en vez de `timeout`, que falla sin consola).
  const lanzador = [
    '@echo off',
    'chcp 65001 >nul',
    'set ELECTRON_RUN_AS_NODE=1',
    `set "GESTION_HUB_DIR=${d.carpeta}"`,
    ':inicio',
    `${lineaHub(d)} >> "${log}" 2>&1`,
    'ping -n 11 127.0.0.1 >nul',
    'goto inicio',
    '',
  ].join('\r\n');
  const contenido = [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    `  <RegistrationInfo><Description>${xml(`Hub de sincronización de ${d.nombre}: el servidor de la red local.`)}</Description></RegistrationInfo>`,
    '  <Triggers><BootTrigger><Enabled>true</Enabled></BootTrigger></Triggers>',
    '  <Principals><Principal id="Author"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>',
    '  <Settings>',
    '    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
    '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
    '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
    '    <AllowHardTerminate>true</AllowHardTerminate>',
    '    <StartWhenAvailable>true</StartWhenAvailable>',
    '    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>',
    '    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>',
    '    <AllowStartOnDemand>true</AllowStartOnDemand>',
    '    <Enabled>true</Enabled>',
    '    <Hidden>false</Hidden>',
    '    <RunOnlyIfIdle>false</RunOnlyIfIdle>',
    '    <WakeToRun>false</WakeToRun>',
    '    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>',
    '    <Priority>7</Priority>',
    '    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>',
    '  </Settings>',
    '  <Actions Context="Author">',
    `    <Exec><Command>C:\\Windows\\System32\\cmd.exe</Command><Arguments>${xml(`/c "${rutaCmd}"`)}</Arguments></Exec>`,
    '  </Actions>',
    '</Task>',
    '',
  ].join('\r\n');
  const regla = `name=${tarea}`;
  const marca = path.win32.join(d.carpeta, 'hub-servicio.instalado');
  return {
    archivos: [{ ruta: rutaCmd, contenido: lanzador }, { ruta: rutaXml, contenido, utf16: true }],
    instalar: [
      // Usuarios (S-1-5-32-545) pueden escribir la carpeta: la app genera los códigos de emparejamiento.
      ['icacls', d.carpeta, '/grant', '*S-1-5-32-545:(OI)(CI)M', '/T', '/Q'],
      ['schtasks', '/Create', '/TN', tarea, '/XML', rutaXml, '/F'],
      ['netsh', 'advfirewall', 'firewall', 'delete', 'rule', regla],
      ['netsh', 'advfirewall', 'firewall', 'add', 'rule', regla, 'dir=in', 'action=allow', 'protocol=TCP', `localport=${d.puerto}`],
      ['schtasks', '/Run', '/TN', tarea],
      // Un usuario sin permisos no puede consultar una tarea de SYSTEM («Acceso denegado»): el paso
      // elevado deja una marca en la carpeta y la app consulta la marca (si está en marcha lo comprueba
      // aparte, contra el hub).
      ['cmd.exe', '/c', 'type', 'nul', '>', marca],
    ],
    desinstalar: [
      ['schtasks', '/End', '/TN', tarea],
      // `/End` termina el lanzador pero no el hub que abrió: se termina el ejecutable de la app que corre
      // como SYSTEM (la app abierta corre como el usuario y no se toca).
      ['taskkill', '/F', '/FI', 'USERNAME eq SYSTEM', '/IM', path.win32.basename(d.ejecutable)],
      ['schtasks', '/Delete', '/TN', tarea, '/F'],
      ['netsh', 'advfirewall', 'firewall', 'delete', 'rule', regla],
      ['cmd.exe', '/c', 'del', '/f', '/q', marca],
    ],
    consultar: ['cmd.exe', '/c', 'if', 'exist', marca, '(exit', '0)', 'else', '(exit', '1)'],
  };
}

function linux(d: DatosServicio): DefinicionServicio {
  const unidad = `${d.id}-hub.service`;
  const ruta = `/etc/systemd/system/${unidad}`;
  const contenido = [
    '[Unit]',
    `Description=Hub de sincronización de ${d.nombre}`,
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    ...(d.usuario ? [`User=${d.usuario}`] : []),
    'Environment=ELECTRON_RUN_AS_NODE=1',
    `Environment="GESTION_HUB_DIR=${d.carpeta}"`,
    `ExecStart=${lineaHub(d)}`,
    'Restart=always',
    'RestartSec=5',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    '',
  ].join('\n');
  return {
    archivos: [{ ruta, contenido }],
    instalar: [['systemctl', 'daemon-reload'], ['systemctl', 'enable', '--now', unidad]],
    desinstalar: [['systemctl', 'disable', '--now', unidad], ['rm', '-f', ruta], ['systemctl', 'daemon-reload']],
    consultar: ['systemctl', 'is-enabled', unidad],
  };
}

function macos(d: DatosServicio): DefinicionServicio {
  const etiqueta = `com.gestionpymes.${d.id}-hub`;
  const ruta = `/Library/LaunchDaemons/${etiqueta}.plist`;
  const log = path.posix.join(d.carpeta, 'hub.log');
  const cadena = (s: string) => `<string>${xml(s)}</string>`;
  const contenido = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key>${cadena(etiqueta)}`,
    ...(d.usuario ? [`  <key>UserName</key>${cadena(d.usuario)}`] : []),
    '  <key>ProgramArguments</key>',
    '  <array>',
    ...[d.ejecutable, ...d.args, 'iniciar', '--puerto', String(d.puerto)].map((a) => `    ${cadena(a)}`),
    '  </array>',
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    `    <key>ELECTRON_RUN_AS_NODE</key>${cadena('1')}`,
    `    <key>GESTION_HUB_DIR</key>${cadena(d.carpeta)}`,
    '  </dict>',
    '  <key>RunAtLoad</key><true/>',
    '  <key>KeepAlive</key><true/>',
    `  <key>StandardOutPath</key>${cadena(log)}`,
    `  <key>StandardErrorPath</key>${cadena(log)}`,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
  return {
    archivos: [{ ruta, contenido }],
    instalar: [['launchctl', 'load', '-w', ruta]],
    desinstalar: [['launchctl', 'unload', '-w', ruta], ['rm', '-f', ruta]],
    consultar: ['launchctl', 'list', etiqueta],
  };
}

export interface ServicioPreparado {
  /** Archivos que escribe el usuario que instala, antes de elevar. */
  readonly escribir: readonly ArchivoServicio[];
  /** Script con los pasos que piden administrador. */
  readonly script: ArchivoServicio;
  /** Comando que corre el script pidiendo permiso de administrador (UAC, pkexec u osascript). */
  readonly elevar: ComandoServicio;
}

/** Pasos que pueden fallar sin que eso sea un error: borrar algo que quizás no existe. */
function tolerante(accion: 'instalar' | 'desinstalar', c: ComandoServicio): boolean {
  return accion === 'desinstalar' || (c[0] === 'netsh' && c.includes('delete'));
}

/** Argumento para cmd.exe: entre comillas si tiene espacios o es una ruta; `clave=valor` con espacios → `clave="valor"`. */
function argCmd(a: string): string {
  if (!/[\s\\]/.test(a)) return a;
  const m = /^([A-Za-z]+)=(.*)$/.exec(a);
  return m ? `${m[1]}="${m[2]}"` : `"${a}"`;
}
const argSh = (a: string) => `'${a.replace(/'/g, `'\\''`)}'`;
const textoPs = (a: string) => `'${a.replace(/'/g, "''")}'`;

/**
 * Arma lo necesario para instalar o desinstalar el servicio desde la app (que corre como usuario): los
 * archivos que puede escribir ella misma y un script con los pasos de administrador, que se corre con
 * `elevar`. En Windows los archivos van directo a la carpeta del hub (ProgramData admite crearla); en
 * Linux y macOS se preparan en `carpetaTemporal` y el script los copia a su lugar del sistema.
 */
export function prepararServicio(
  plataforma: PlataformaServicio, def: DefinicionServicio, accion: 'instalar' | 'desinstalar', carpetaTemporal: string,
): ServicioPreparado {
  const pasos = accion === 'instalar' ? def.instalar : def.desinstalar;
  if (plataforma === 'win32') {
    const lineas = ['@echo off', 'chcp 65001 >nul'];
    for (const c of pasos) lineas.push(`${c.map(argCmd).join(' ')} ${tolerante(accion, c) ? '>nul 2>&1' : '|| exit /b 1'}`);
    lineas.push('exit /b 0', '');
    const ruta = path.win32.join(carpetaTemporal, `hub-${accion}.cmd`);
    return {
      escribir: accion === 'instalar' ? def.archivos : [],
      script: { ruta, contenido: lineas.join('\r\n') },
      elevar: ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command',
        // Si el usuario cancela el permiso, Start-Process falla: sale con 1223 (operación cancelada), no con 0.
        `try { $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', ('"' + ${textoPs(ruta)} + '"') -Verb RunAs -Wait -PassThru -ErrorAction Stop; exit $p.ExitCode } catch { exit 1223 }`],
    };
  }
  const preparados = accion === 'instalar'
    ? def.archivos.map((a) => ({ ...a, final: a.ruta, ruta: path.posix.join(carpetaTemporal, path.posix.basename(a.ruta)) }))
    : [];
  const lineas = ['#!/bin/sh', 'set -e'];
  for (const a of preparados) {
    lineas.push(`install -m 644 ${argSh(a.ruta)} ${argSh(a.final)}`);
    // launchd solo carga un LaunchDaemon que pertenece a root.
    if (plataforma === 'darwin') lineas.push(`chown root:wheel ${argSh(a.final)}`);
  }
  for (const c of pasos) lineas.push(`${c.map(argSh).join(' ')}${tolerante(accion, c) ? ' || true' : ''}`);
  lineas.push('');
  const ruta = path.posix.join(carpetaTemporal, `hub-${accion}.sh`);
  return {
    escribir: preparados.map(({ ruta: r, contenido }) => ({ ruta: r, contenido })),
    script: { ruta, contenido: lineas.join('\n') },
    elevar: plataforma === 'darwin'
      ? ['osascript', '-e', `do shell script "/bin/sh ${argSh(ruta)}" with administrator privileges`]
      : ['pkexec', '/bin/sh', ruta],
  };
}

export function definicionServicio(plataforma: PlataformaServicio, d: DatosServicio): DefinicionServicio {
  if (plataforma === 'win32') return windows(d);
  if (plataforma === 'darwin') return macos(d);
  return linux(d);
}
