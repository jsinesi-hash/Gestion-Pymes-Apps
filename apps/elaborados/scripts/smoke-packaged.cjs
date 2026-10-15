'use strict';
// Humo del INSTALADOR (ADR-111): extrae dist/Heladeria-Setup-<v>.exe y arranca elaborados.exe con un userData temporal y verifica que
// crea la BD, aplica TODAS las migraciones, siembra el admin y carga la geografía (geo-cache en resources/).
// Uso: node scripts/smoke-packaged.cjs   (después de `pnpm dist`)
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const TIMEOUT_MS = 90_000;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

// Se prueba lo que realmente se entrega: el contenido del instalador, extraído con 7za (sin instalar nada ni tocar
// accesos directos ni el registro). Las extraResources (geo-cache) las agrega electron-builder, no están en out/.
const version = require(path.join(appDir, 'package.json')).version;
const instalador = path.join(appDir, 'dist', `Heladeria-Setup-${version}.exe`);
if (!fs.existsSync(instalador)) { fail(`No existe ${instalador}. Corré \`pnpm dist\` primero.`); process.exit(1); }
const sieteZip = require(path.join(appDir, '..', '..', 'node_modules', '7zip-bin')).path7za;
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'elaborados-instalador-'));
const pkgDir = path.join(raiz, 'app');
const ext = spawnSync(sieteZip, ['x', instalador, `-o${pkgDir}`, '-y'], { stdio: 'ignore' });
if (ext.status !== 0) { fail('No se pudo extraer el instalador con 7za.'); process.exit(1); }

const exe = path.join(pkgDir, 'elaborados.exe');
const resources = path.join(pkgDir, 'resources');
if (!fs.existsSync(exe)) { fail(`No existe ${exe}`); process.exit(1); }

const journal = JSON.parse(fs.readFileSync(path.join(appDir, 'src/main/db/migrations/meta/_journal.json'), 'utf8'));
const esperadas = journal.entries.length;

// Verificaciones estáticas del paquete.
const chequeos = [
  ['geo-cache en resources/', fs.existsSync(path.join(resources, 'geo-cache', 'localidades.csv'))],
  ['migraciones desempaquetadas', fs.existsSync(path.join(resources, 'app.asar.unpacked'))],
];
const dbsEnPaquete = [];
(function buscar(dir, nivel) {
  if (nivel > 6) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) buscar(p, nivel + 1);
    else if (/\.db(-wal|-shm)?$/.test(e.name)) dbsEnPaquete.push(p);
  }
})(resources, 0);
chequeos.push(['ningún .db dentro del paquete', dbsEnPaquete.length === 0]);
for (const [nombre, ok] of chequeos) {
  console.log(`${ok ? '✓' : '✗'} ${nombre}`);
  if (!ok) process.exitCode = 1;
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'elaborados-smoke-'));
const dbPath = path.join(userData, 'elaborados.db');

// Consulta con el propio Electron en modo Node: mismo NMV que better-sqlite3 empaquetado.
const consulta = path.join(userData, 'consulta.cjs');
fs.writeFileSync(consulta, `
const path = require('path');
const dir = process.argv[2];
let Database;
for (const base of [path.join(process.argv[3], 'app.asar'), path.join(process.argv[3], 'app.asar.unpacked')]) {
  try { Database = require(path.join(base, 'node_modules', 'better-sqlite3')); break; } catch {}
}
const db = new Database(dir, { readonly: true });
const q = (sql) => { try { return db.prepare(sql).get().n; } catch { return -1; } };
console.log(JSON.stringify({
  migraciones: q('SELECT count(*) n FROM __drizzle_migrations'),
  admin: q("SELECT count(*) n FROM usuario WHERE nombre_usuario = 'admin'"),
  localidades: q('SELECT count(*) n FROM localidad'),
  consumidorFinal: q("SELECT count(*) n FROM cliente WHERE id = 'cf000000-0000-0000-0000-000000000001'"),
  impuestos: q('SELECT count(*) n FROM impuesto'),
}));
`);

function leer() {
  const r = spawnSync(exe, [consulta, dbPath, resources], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8',
  });
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return null; }
}

console.log(`Arrancando ${exe} con userData temporal…`);
const app = spawn(exe, [`--user-data-dir=${userData}`], { stdio: 'ignore' });
let salio = false;
app.on('exit', () => { salio = true; });

const inicio = Date.now();
const timer = setInterval(() => {
  let estado = null;
  if (fs.existsSync(dbPath)) estado = leer();
  const listo = estado && estado.migraciones === esperadas && estado.admin === 1 && estado.localidades > 0
    && estado.consumidorFinal === 1 && estado.impuestos > 0;
  if (listo || Date.now() - inicio > TIMEOUT_MS || salio) {
    clearInterval(timer);
    spawnSync('taskkill', ['/F', '/PID', String(app.pid), '/T'], { stdio: 'ignore' });
    console.log(`${listo ? '✓' : '✗'} BD creada y migrada (${esperadas} migraciones esperadas): ${JSON.stringify(estado)}`);
    if (!listo) {
      process.exitCode = 1;
      if (salio) console.error('La app terminó antes de completar el arranque.');
    }
    setTimeout(() => {
      for (const d of [userData, raiz]) {
        try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* archivos aún tomados: se limpia luego */ }
      }
      console.log(process.exitCode ? 'HUMO: FALLÓ' : 'HUMO: OK');
    }, 1500);
  }
}, 2000);
