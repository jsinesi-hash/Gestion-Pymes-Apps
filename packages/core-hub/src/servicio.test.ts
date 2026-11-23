import { describe, it, expect } from 'vitest';
import { definicionServicio, prepararServicio, type DatosServicio } from './servicio';
import { carpetaDatosPorDefecto } from './arranque';

// ADR-156 §1 y ADR-158 §2 (F2 PR6): el hub queda corriendo como servicio del sistema operativo. El
// proceso es el mismo en los tres (el ejecutable de la app en modo Node con la entrada del hub); cambia
// solo cómo se registra: tarea programada como SYSTEM al arrancar en Windows (decisión del usuario),
// unidad de systemd en Linux y LaunchDaemon en macOS.
const base: DatosServicio = {
  id: 'ferreteria-client',
  nombre: 'Ferretería',
  ejecutable: 'C:\\Program Files\\Ferreteria\\ferreteria.exe',
  args: ['C:\\Program Files\\Ferreteria\\resources\\app.asar\\.vite\\build\\cli.js'],
  carpeta: 'C:\\ProgramData\\ferreteria-client-hub',
  puerto: 7443,
  usuario: 'caja',
};

describe('carpeta del hub', () => {
  it('Windows: ProgramData (el servicio corre como SYSTEM); Linux y macOS: la del usuario que lo instala', () => {
    expect(carpetaDatosPorDefecto('ferreteria-client', { platform: 'win32', env: { ProgramData: 'D:\\PD' }, home: 'C:\\Users\\x' }))
      .toBe('D:\\PD\\ferreteria-client-hub');
    expect(carpetaDatosPorDefecto('ferreteria-client', { platform: 'win32', env: {}, home: 'C:\\Users\\x' }))
      .toBe('C:\\ProgramData\\ferreteria-client-hub');
    expect(carpetaDatosPorDefecto('ferreteria-client', { platform: 'linux', env: {}, home: '/home/caja' }))
      .toBe('/home/caja/.config/ferreteria-client-hub');
    expect(carpetaDatosPorDefecto('ferreteria-client', { platform: 'darwin', env: {}, home: '/Users/caja' }))
      .toBe('/Users/caja/Library/Application Support/ferreteria-client-hub');
    expect(carpetaDatosPorDefecto('ferreteria-client', { platform: 'win32', env: { GESTION_HUB_DIR: 'E:\\hub' }, home: 'C:\\Users\\x' }))
      .toBe('E:\\hub');
  });
});

describe('definición del servicio', () => {
  it('Windows: tarea al arrancar como SYSTEM, lanzador que reintenta, firewall y carpeta escribible por los usuarios', () => {
    const d = definicionServicio('win32', base);
    const tarea = d.archivos.find((a) => a.ruta.endsWith('hub-tarea.xml'))!;
    expect(tarea.utf16).toBe(true);
    expect(tarea.contenido).toContain('<BootTrigger>');
    expect(tarea.contenido).toContain('<UserId>S-1-5-18</UserId>');
    expect(tarea.contenido).toContain('<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>');
    expect(tarea.contenido).toContain('<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>');
    const lanzador = d.archivos.find((a) => a.ruta.endsWith('hub-servicio.cmd'))!;
    expect(lanzador.ruta).toBe('C:\\ProgramData\\ferreteria-client-hub\\hub-servicio.cmd');
    expect(lanzador.contenido).toContain('set ELECTRON_RUN_AS_NODE=1');
    expect(lanzador.contenido).toContain('set "GESTION_HUB_DIR=C:\\ProgramData\\ferreteria-client-hub"');
    expect(lanzador.contenido).toContain('"C:\\Program Files\\Ferreteria\\ferreteria.exe" "C:\\Program Files\\Ferreteria\\resources\\app.asar\\.vite\\build\\cli.js" iniciar --puerto 7443');
    // Si el hub se cae, el lanzador lo vuelve a levantar (la tarea sigue en marcha).
    expect(lanzador.contenido).toMatch(/:inicio[\s\S]*goto inicio/);
    // La tarea ejecuta el lanzador.
    expect(tarea.contenido).toContain('<Command>C:\\Windows\\System32\\cmd.exe</Command>');
    expect(tarea.contenido).toContain('<Arguments>/c "C:\\ProgramData\\ferreteria-client-hub\\hub-servicio.cmd"</Arguments>');

    expect(d.instalar).toEqual([
      ['icacls', 'C:\\ProgramData\\ferreteria-client-hub', '/grant', '*S-1-5-32-545:(OI)(CI)M', '/T', '/Q'],
      ['schtasks', '/Create', '/TN', 'Ferretería hub', '/XML', 'C:\\ProgramData\\ferreteria-client-hub\\hub-tarea.xml', '/F'],
      ['netsh', 'advfirewall', 'firewall', 'delete', 'rule', 'name=Ferretería hub'],
      ['netsh', 'advfirewall', 'firewall', 'add', 'rule', 'name=Ferretería hub', 'dir=in', 'action=allow', 'protocol=TCP', 'localport=7443'],
      ['schtasks', '/Run', '/TN', 'Ferretería hub'],
      // Un usuario sin permisos no puede consultar una tarea de SYSTEM («Acceso denegado», visto en la
      // prueba real): el script elevado deja una marca en la carpeta y la app consulta la marca.
      ['cmd.exe', '/c', 'type', 'nul', '>', 'C:\\ProgramData\\ferreteria-client-hub\\hub-servicio.instalado'],
    ]);
    expect(d.desinstalar).toEqual([
      ['schtasks', '/End', '/TN', 'Ferretería hub'],
      // `/End` termina el lanzador pero no el hub que abrió (visto en la prueba real): se termina el
      // ejecutable de la app que corre como SYSTEM (la app abierta corre como el usuario).
      ['taskkill', '/F', '/FI', 'USERNAME eq SYSTEM', '/IM', 'ferreteria.exe'],
      ['schtasks', '/Delete', '/TN', 'Ferretería hub', '/F'],
      ['netsh', 'advfirewall', 'firewall', 'delete', 'rule', 'name=Ferretería hub'],
      ['cmd.exe', '/c', 'del', '/f', '/q', 'C:\\ProgramData\\ferreteria-client-hub\\hub-servicio.instalado'],
    ]);
    expect(d.consultar).toEqual(['cmd.exe', '/c', 'if', 'exist', 'C:\\ProgramData\\ferreteria-client-hub\\hub-servicio.instalado', '(exit', '0)', 'else', '(exit', '1)']);
  });

  it('Linux: unidad de systemd con el usuario, el entorno y reinicio automático', () => {
    const d = definicionServicio('linux', { ...base, ejecutable: '/opt/ferreteria/ferreteria', args: ['/opt/ferreteria/resources/app.asar/.vite/build/cli.js'], carpeta: '/home/caja/.config/ferreteria-client-hub' });
    expect(d.archivos).toHaveLength(1);
    const unidad = d.archivos[0]!;
    expect(unidad.ruta).toBe('/etc/systemd/system/ferreteria-client-hub.service');
    expect(unidad.contenido).toContain('User=caja');
    expect(unidad.contenido).toContain('Environment=ELECTRON_RUN_AS_NODE=1');
    expect(unidad.contenido).toContain('Environment="GESTION_HUB_DIR=/home/caja/.config/ferreteria-client-hub"');
    expect(unidad.contenido).toContain('ExecStart="/opt/ferreteria/ferreteria" "/opt/ferreteria/resources/app.asar/.vite/build/cli.js" iniciar --puerto 7443');
    expect(unidad.contenido).toContain('Restart=always');
    expect(unidad.contenido).toContain('WantedBy=multi-user.target');
    expect(d.instalar).toEqual([['systemctl', 'daemon-reload'], ['systemctl', 'enable', '--now', 'ferreteria-client-hub.service']]);
    expect(d.desinstalar).toEqual([
      ['systemctl', 'disable', '--now', 'ferreteria-client-hub.service'],
      ['rm', '-f', '/etc/systemd/system/ferreteria-client-hub.service'],
      ['systemctl', 'daemon-reload'],
    ]);
  });

  it('macOS: LaunchDaemon con el usuario, el entorno y KeepAlive', () => {
    const d = definicionServicio('darwin', { ...base, ejecutable: '/Applications/Ferretería.app/Contents/MacOS/ferreteria', args: ['/x/cli.js'], carpeta: '/Users/caja/Library/Application Support/ferreteria-client-hub' });
    const plist = d.archivos[0]!;
    expect(plist.ruta).toBe('/Library/LaunchDaemons/com.gestionpymes.ferreteria-client-hub.plist');
    expect(plist.contenido).toContain('<key>UserName</key><string>caja</string>');
    expect(plist.contenido).toContain('<string>/Applications/Ferretería.app/Contents/MacOS/ferreteria</string>');
    expect(plist.contenido).toContain('<key>ELECTRON_RUN_AS_NODE</key><string>1</string>');
    expect(plist.contenido).toContain('<key>KeepAlive</key><true/>');
    expect(d.instalar).toEqual([['launchctl', 'load', '-w', plist.ruta]]);
    expect(d.desinstalar).toEqual([['launchctl', 'unload', '-w', plist.ruta], ['rm', '-f', plist.ruta]]);
  });

  it('escapa los caracteres especiales del XML', () => {
    const d = definicionServicio('darwin', { ...base, ejecutable: '/a&b/<c>', args: [] });
    expect(d.archivos[0]!.contenido).toContain('<string>/a&amp;b/&lt;c&gt;</string>');
  });
});

// La app corre como usuario: escribe los archivos que puede y arma un script con los comandos que piden
// administrador; ese script se corre elevado (UAC, pkexec u osascript) o directo desde una consola de
// administrador (`instalar-servicio`).
describe('preparar la instalación', () => {
  const PREP = 'C:\\Temp\\prep';
  const CARPETA = 'C:\\ProgramData\\ferreteria-client-hub';

  it('Windows: los archivos van directo a la carpeta; el script corta ante un error salvo en los pasos tolerantes', () => {
    const p = prepararServicio('win32', definicionServicio('win32', base), 'instalar', PREP);
    expect(p.escribir.map((a) => a.ruta)).toEqual([`${CARPETA}\\hub-servicio.cmd`, `${CARPETA}\\hub-tarea.xml`]);
    expect(p.script.ruta).toBe(`${PREP}\\hub-instalar.cmd`);
    const lineas = p.script.contenido.split('\r\n');
    expect(lineas).toContain(`icacls "${CARPETA}" /grant *S-1-5-32-545:(OI)(CI)M /T /Q || exit /b 1`);
    expect(lineas).toContain(`schtasks /Create /TN "Ferretería hub" /XML "${CARPETA}\\hub-tarea.xml" /F || exit /b 1`);
    // Borrar una regla que no existe falla: es tolerante.
    expect(lineas).toContain('netsh advfirewall firewall delete rule name="Ferretería hub" >nul 2>&1');
    expect(lineas).toContain('netsh advfirewall firewall add rule name="Ferretería hub" dir=in action=allow protocol=TCP localport=7443 || exit /b 1');
    expect(p.elevar[0]).toBe('powershell.exe');
    expect(p.elevar.join(' ')).toContain('-Verb RunAs');
    expect(p.elevar.join(' ')).toContain(`'${PREP}\\hub-instalar.cmd'`);
    // Si el usuario cancela el permiso, sale con error (1223 = operación cancelada), no con 0.
    expect(p.elevar.join(' ')).toMatch(/try \{.*-ErrorAction Stop.*\} catch \{ exit 1223 \}/);
  });

  it('Windows, desinstalar: todos los pasos son tolerantes (puede faltar alguno)', () => {
    const p = prepararServicio('win32', definicionServicio('win32', base), 'desinstalar', PREP);
    expect(p.escribir).toEqual([]);
    expect(p.script.contenido).not.toContain('exit /b 1');
    expect(p.script.contenido).toContain('schtasks /Delete /TN "Ferretería hub" /F >nul 2>&1');
  });

  it('Linux: la unidad se prepara aparte y el script la copia a /etc con permisos; se eleva con pkexec', () => {
    const d = definicionServicio('linux', { ...base, ejecutable: '/opt/f/ferreteria', args: ['/opt/f/cli.js'], carpeta: '/home/caja/.config/ferreteria-client-hub' });
    const p = prepararServicio('linux', d, 'instalar', '/tmp/prep');
    expect(p.escribir.map((a) => a.ruta)).toEqual(['/tmp/prep/ferreteria-client-hub.service']);
    expect(p.script.ruta).toBe('/tmp/prep/hub-instalar.sh');
    expect(p.script.contenido).toContain('set -e');
    expect(p.script.contenido).toContain("install -m 644 '/tmp/prep/ferreteria-client-hub.service' '/etc/systemd/system/ferreteria-client-hub.service'");
    expect(p.script.contenido).toContain("'systemctl' 'enable' '--now' 'ferreteria-client-hub.service'");
    expect(p.elevar).toEqual(['pkexec', '/bin/sh', '/tmp/prep/hub-instalar.sh']);
  });

  it('macOS: se eleva con osascript', () => {
    const d = definicionServicio('darwin', { ...base, ejecutable: '/A/f', args: [], carpeta: '/Users/caja/x' });
    const p = prepararServicio('darwin', d, 'desinstalar', '/tmp/prep');
    expect(p.script.contenido).toContain("'launchctl' 'unload' '-w' '/Library/LaunchDaemons/com.gestionpymes.ferreteria-client-hub.plist' || true");
    expect(p.elevar).toEqual(['osascript', '-e', `do shell script "/bin/sh '/tmp/prep/hub-desinstalar.sh'" with administrator privileges`]);
  });
});
