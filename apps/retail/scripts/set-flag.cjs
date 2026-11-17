'use strict';
// Dev helper: habilita/deshabilita un feature flag (configuracion_negocio o parametros_sistema) en la BD local
// de userData, SIN tocar el default de produccion (que vive en la migracion, ADR-044).
//
// Uso (correr bajo el runtime de Electron para respetar el NMV de better-sqlite3):
//   ELECTRON_RUN_AS_NODE=1 <electron> scripts/set-flag.cjs agenda_habilitado true
//   pnpm exec cross-env ELECTRON_RUN_AS_NODE=1 electron scripts/set-flag.cjs <clave> <valor> [tipo]
//
// Es idempotente: si el flag todavia no existe (la migracion no corrio), lo inserta;
// cuando la migracion corra con INSERT OR IGNORE, respeta este valor.

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const [, , clave, valor, tipo = 'bool'] = process.argv;
if (!clave || valor === undefined) {
  console.error('Uso: set-flag.cjs <clave> <valor> [tipo=bool]');
  process.exit(1);
}

const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appData, 'ferreteria-client', 'ferreteria.db');
if (!fs.existsSync(dbPath)) {
  console.error(`No existe la BD: ${dbPath}. Corré la app (pnpm dev) al menos una vez.`);
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// ADR-155 §1: las claves del negocio viven en configuracion_negocio; el resto, en parametros_sistema.
const esDelNegocio = db.prepare(
  "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'configuracion_negocio'",
).get() && db.prepare('SELECT 1 FROM configuracion_negocio WHERE id = ?').get(clave);
if (esDelNegocio) {
  db.prepare(
    "UPDATE configuracion_negocio SET valor = ?, version = version + 1, sync_state = 'pending', updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?",
  ).run(String(valor), clave);
} else {
  db.prepare(
    `INSERT INTO parametros_sistema (clave, valor, tipo, descripcion)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
  ).run(clave, String(valor), tipo, `Feature flag (dev): ${clave}`);
}

const row = esDelNegocio
  ? db.prepare('SELECT id AS clave, valor, tipo FROM configuracion_negocio WHERE id = ?').get(clave)
  : db.prepare('SELECT clave, valor, tipo FROM parametros_sistema WHERE clave = ?').get(clave);
console.log(`OK — ${row.clave} = ${row.valor} (${row.tipo}) [${esDelNegocio ? 'negocio' : 'terminal'}]  @ ${dbPath}`);
db.close();
