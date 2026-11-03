// packages/core-main/src/seed/geo.ts (antes apps/retail/src/main/geo-seed/index.ts)
//
// seed:geo — Pobla provincia/departamento/localidad (+ código postal) para
// validación offline de direcciones de clientes.
//
// Abre su propia conexión a la DB (mismo patrón que dev-seed/db.ts): no
// depende del singleton de Electron, por eso puede correr directamente con
// ELECTRON_RUN_AS_NODE=1 sin que `app` esté inicializado.
// Aplica las migraciones pendientes antes de insertar (idempotente).
//
// Uso:  pnpm seed:geo            (descarga + puebla)
//       pnpm seed:geo --offline  (usa ./geo-cache, sin descargar)

import Database from 'better-sqlite3';
import fs, { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerCsv } from '@ferreteria/shared';
import os from 'node:os';
// ADR-063/067: normalizador canónico único en shared. Supersede el `normalizar()` privado que
// vivía acá (misma intención: NFD + sin acentos + colapsar; ahora en minúsculas y
// measure-aware). `nombre_norm` es hoy una columna de escritura (sin consumidor de
// consulta), así que el cambio de mayúsculas→minúsculas no afecta ningún match.
import { normalizar } from '@ferreteria/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const GEOREF_BASE = 'https://infra.datos.gob.ar/georef';
const CP_DATASET_URL =
  'https://raw.githubusercontent.com/androdron/localidades_AR/master/localidades_cp_maestro.csv';

const CACHE_DIR = join(process.cwd(), 'geo-cache');
const OFFLINE = process.argv.includes('--offline');

// ─────────────────────────────────────────────────────────────────────────────
// Barrios de CABA (Ley 2094/2006 — fijos, no requieren fuente externa)
// El API georef /localidades y /localidades-censales tratan CABA como una sola
// localidad; los barrios sólo aparecen en /asentamientos (muy pesado).
// ─────────────────────────────────────────────────────────────────────────────

const CABA_PROV_ID = '02'; // código oficial INDEC, estable

const CABA_BARRIOS = [
  'Agronomía', 'Almagro', 'Balvanera', 'Barracas', 'Belgrano',
  'Boedo', 'Caballito', 'Chacarita', 'Coghlan', 'Colegiales',
  'Constitución', 'Flores', 'Floresta', 'La Boca', 'La Paternal',
  'Liniers', 'Mataderos', 'Monte Castro', 'Montserrat', 'Nueva Pompeya',
  'Núñez', 'Palermo', 'Parque Avellaneda', 'Parque Chacabuco',
  'Parque Chas', 'Parque Patricios', 'Puerto Madero', 'Recoleta',
  'Retiro', 'Saavedra', 'San Cristóbal', 'San Nicolás', 'San Telmo',
  'Vélez Sársfield', 'Versalles', 'Villa Crespo', 'Villa del Parque',
  'Villa Devoto', 'Villa General Mitre', 'Villa Lugano', 'Villa Luro',
  'Villa Ortúzar', 'Villa Pueyrredón', 'Villa Real', 'Villa Riachuelo',
  'Villa Santa Rita', 'Villa Soldati', 'Villa Urquiza',
];

// ─────────────────────────────────────────────────────────────────────────────
// API pública — invocable desde el proceso main con DB ya abierta
// ─────────────────────────────────────────────────────────────────────────────

export async function runGeoSeedOffline(
  sqlite: Database.Database,
  cacheDir: string,
): Promise<void> {
  const read = (name: string) => readFileSync(join(cacheDir, name), 'utf-8');
  const provincias    = parseCsv(read('provincias.csv'));
  const departamentos = parseCsv(read('departamentos.csv'));
  // geo-cache usa 'localidades.csv' (nombre histórico del cache)
  const localidades   = parseCsv(read('localidades.csv'));
  const cpRows        = parseCsv(read('cp.csv'));

  const cpIndex = new Map<string, string>();
  for (const r of cpRows) {
    const prov = normalizar(r['provincia'] ?? r['provincia_nombre'] ?? '');
    const loc  = normalizar(r['localidad'] ?? r['nombre'] ?? '');
    const cp   = (r['codigo_postal'] ?? r['cp'] ?? '').trim();
    if (prov && loc && cp) cpIndex.set(`${prov}|${loc}`, cp);
  }

  const insProv = sqlite.prepare(
    `INSERT INTO provincia (id, nombre, nombre_norm) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, nombre_norm=excluded.nombre_norm`
  );
  const insDepto = sqlite.prepare(
    `INSERT INTO departamento (id, nombre, nombre_norm, provincia_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, nombre_norm=excluded.nombre_norm,
       provincia_id=excluded.provincia_id`
  );
  const insLoc = sqlite.prepare(
    `INSERT INTO localidad (id, nombre, nombre_norm, provincia_id, departamento_id, codigo_postal)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, nombre_norm=excluded.nombre_norm,
       provincia_id=excluded.provincia_id, departamento_id=excluded.departamento_id,
       codigo_postal=excluded.codigo_postal`
  );

  const cabaProvNorm = normalizar('Ciudad Autónoma de Buenos Aires');

  sqlite.pragma('foreign_keys = OFF');
  const load = sqlite.transaction(() => {
    for (const p of provincias) insProv.run(p['id'], p['nombre'], normalizar(p['nombre']));
    for (const d of departamentos) insDepto.run(d['id'], d['nombre'], normalizar(d['nombre']), d['provincia_id']);
    for (const l of localidades) {
      const provNorm = normalizar(l['provincia_nombre'] ?? l['provincia'] ?? '');
      const locNorm  = normalizar(l['nombre']);
      const cp = cpIndex.get(`${provNorm}|${locNorm}`) ?? null;
      insLoc.run(l['id'], l['nombre'], locNorm, l['provincia_id'], l['departamento_id'] || null, cp);
    }
    for (let i = 0; i < CABA_BARRIOS.length; i++) {
      const nombre  = CABA_BARRIOS[i];
      const locNorm = normalizar(nombre);
      const cp = cpIndex.get(`${cabaProvNorm}|${locNorm}`) ?? null;
      insLoc.run(`caba-barrio-${String(i + 1).padStart(2, '0')}`, nombre, locNorm, CABA_PROV_ID, null, cp);
    }
  });
  load();
  sqlite.pragma('foreign_keys = ON');
}

// ─────────────────────────────────────────────────────────────────────────────
// Apertura de DB (sin Electron app.getPath)
// ─────────────────────────────────────────────────────────────────────────────

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const appData = process.env.APPDATA ?? join(os.homedir(), 'AppData', 'Roaming');
  return join(appData, 'ferreteria-client', 'ferreteria.db');
}

function applyMigrations(sqlite: Database.Database): void {
  // CLI: el core no tiene carpeta de migraciones propia; el lanzador de cada app
  // (p.ej. apps/retail/scripts/seed-geo.cjs) pasa la suya por GEO_SEED_MIGRATIONS_DIR.
  const migrationsDir = process.env.GEO_SEED_MIGRATIONS_DIR ?? join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.endsWith('.down.sql'))
    .sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    const sql = fs.readFileSync(join(migrationsDir, file), 'utf8');
    const stmts = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      try { sqlite.exec(stmt); } catch { /* tabla/índice ya existe, ok */ }
    }
  }
}

function openDb(): Database.Database {
  const dbPath = resolveDbPath();
  console.log(`  DB: ${dbPath}\n`);
  fs.mkdirSync(join(dbPath, '..'), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return sqlite;
}

// Normalización: ver `normalizar()` en @ferreteria/shared (única fuente, ADR-063/067).

// ─────────────────────────────────────────────────────────────────────────────
// Descarga con cache
// ─────────────────────────────────────────────────────────────────────────────

async function fetchText(url: string, cacheName: string): Promise<string> {
  const cachePath = join(CACHE_DIR, cacheName);
  if (OFFLINE) {
    if (!existsSync(cachePath)) {
      throw new Error(`--offline pero falta ${cachePath}. Corré sin --offline primero.`);
    }
    return readFileSync(cachePath, 'utf-8');
  }
  console.log(`  ↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar ${url}`);
  const text = await res.text();
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, text, 'utf-8');
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV → filas con encabezado (el lector es `leerCsv` de @ferreteria/shared)
// ─────────────────────────────────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const [headers, ...filas] = leerCsv(text);
  if (!headers) return [];
  return filas.map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('seed:geo — geografía argentina (validación offline de direcciones)\n');

  // 1) Descarga
  console.log('1. Descargando fuentes…');
  const provinciasCsv    = await fetchText(`${GEOREF_BASE}/provincias.csv`, 'provincias.csv');
  const departamentosCsv = await fetchText(`${GEOREF_BASE}/departamentos.csv`, 'departamentos.csv');
  const localidadesCsv   = await fetchText(`${GEOREF_BASE}/localidades_censales.csv`, 'localidades_censales.csv');
  const cpCsv            = await fetchText(CP_DATASET_URL, 'cp.csv');

  const provincias    = parseCsv(provinciasCsv);
  const departamentos = parseCsv(departamentosCsv);
  const localidades   = parseCsv(localidadesCsv);
  const cpRows        = parseCsv(cpCsv);

  console.log(`   provincias=${provincias.length} departamentos=${departamentos.length} ` +
              `localidades=${localidades.length} cp=${cpRows.length}\n`);

  // Log de headers reales para detectar drift en el dataset
  if (provincias.length)    console.log('   [headers provincias]   ', Object.keys(provincias[0]).join(', '));
  if (departamentos.length) console.log('   [headers departamentos]', Object.keys(departamentos[0]).join(', '));
  if (localidades.length)   console.log('   [headers localidades]  ', Object.keys(localidades[0]).join(', '));
  if (cpRows.length)        console.log('   [headers CP]           ', Object.keys(cpRows[0]).join(', '));
  console.log();

  // 2) Índice CP por (provincia_norm | localidad_norm)
  console.log('2. Indexando códigos postales…');
  const cpIndex = new Map<string, string>();
  for (const r of cpRows) {
    const prov = normalizar(r['provincia'] ?? r['provincia_nombre'] ?? '');
    const loc  = normalizar(r['localidad'] ?? r['nombre'] ?? '');
    const cp   = (r['codigo_postal'] ?? r['cp'] ?? '').trim();
    if (prov && loc && cp) cpIndex.set(`${prov}|${loc}`, cp);
  }
  console.log(`   ${cpIndex.size} pares (provincia|localidad) con CP\n`);

  // 3) Abre DB y aplica migraciones pendientes
  const sqlite = openDb();

  // 4) Statements
  const insProv = sqlite.prepare(
    `INSERT INTO provincia (id, nombre, nombre_norm) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, nombre_norm=excluded.nombre_norm`
  );
  const insDepto = sqlite.prepare(
    `INSERT INTO departamento (id, nombre, nombre_norm, provincia_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, nombre_norm=excluded.nombre_norm,
       provincia_id=excluded.provincia_id`
  );
  const insLoc = sqlite.prepare(
    `INSERT INTO localidad (id, nombre, nombre_norm, provincia_id, departamento_id, codigo_postal)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, nombre_norm=excluded.nombre_norm,
       provincia_id=excluded.provincia_id, departamento_id=excluded.departamento_id,
       codigo_postal=excluded.codigo_postal`
  );
  const delLoc = sqlite.prepare('DELETE FROM localidad');

  // 5) Carga atómica — reemplaza localidades anteriores
  //    FK se deshabilita temporalmente para permitir borrar localidades
  //    referenciadas por cliente.localidad_id (texto de dirección no se pierde).
  console.log('3. Poblando (transacción atómica, reemplaza localidades anteriores)…');
  let conCp = 0, sinCp = 0;

  sqlite.pragma('foreign_keys = OFF');
  const load = sqlite.transaction(() => {
    delLoc.run();
    for (const p of provincias) {
      insProv.run(p['id'], p['nombre'], normalizar(p['nombre']));
    }
    for (const d of departamentos) {
      insDepto.run(d['id'], d['nombre'], normalizar(d['nombre']), d['provincia_id']);
    }
    for (const l of localidades) {
      const provNorm = normalizar(l['provincia_nombre'] ?? l['provincia'] ?? '');
      const locNorm  = normalizar(l['nombre']);
      const cp = cpIndex.get(`${provNorm}|${locNorm}`) ?? null;
      if (cp) conCp++; else sinCp++;
      insLoc.run(l['id'], l['nombre'], locNorm, l['provincia_id'], l['departamento_id'] || null, cp);
    }

    const cabaProvNorm = normalizar('Ciudad Autónoma de Buenos Aires');
    for (let i = 0; i < CABA_BARRIOS.length; i++) {
      const nombre  = CABA_BARRIOS[i];
      const locNorm = normalizar(nombre);
      const cp      = cpIndex.get(`${cabaProvNorm}|${locNorm}`) ?? null;
      if (cp) conCp++; else sinCp++;
      insLoc.run(`caba-barrio-${String(i + 1).padStart(2, '0')}`, nombre, locNorm, CABA_PROV_ID, null, cp);
    }
  });
  load();
  sqlite.pragma('foreign_keys = ON');

  const totalLoc = (sqlite.prepare('SELECT COUNT(*) c FROM localidad').get() as { c: number }).c;
  console.log(`   localidades=${totalLoc}  con CP=${conCp}  sin CP=${sinCp} ` +
              `(${((conCp / totalLoc) * 100).toFixed(1)}% cobertura CP)\n`);

  sqlite.close();
  console.log('✓ seed:geo completado.');
}

// Solo correr main() cuando se pide explícitamente como CLI (GEO_SEED_CLI=1, lo setea el lanzador de la app).
// OJO: NO usar `require.main === module`: este archivo se bundlea dentro del main de Electron de cada app, donde
// `module` ES el entry y la condición daba true en cada arranque → descargaba el dataset, escribía en
// %APPDATA%/ferreteria-client/ferreteria.db y terminaba la app con process.exit(1) si fallaba (ADR-111).
if (process.env['GEO_SEED_CLI'] === '1') {
  main().catch((err) => {
    console.error('\n✗ seed:geo falló:', err.message);
    process.exit(1);
  });
}
