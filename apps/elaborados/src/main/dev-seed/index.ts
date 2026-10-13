// Seed de desarrollo de Elaborados (heladería). Se lanza con `pnpm seed:dev` / `pnpm seed:base`
// (scripts/seed-*.cjs: Electron con ELECTRON_RUN_AS_NODE=1 + tsx, mismo NMV que better-sqlite3).
//
//   --base  → solo datos base: auth (roles/permisos/admin) → impuestos → Consumidor Final →
//             categorías de venta y grupo "Sabores" del rubro. Sin productos, clientes ni ventas.
//   (sin flag) → lo anterior + login admin + catálogo demo + clientes demo + ventas demo
//             (la caja del admin queda abierta).
//
// Idempotente y SIN --force (ADR-099): cada paso se saltea si ya hay datos de su tipo y lo
// informa como "ya sembrado". Para empezar de cero, borrar el archivo de la BD.
// BD: DB_PATH si está definida; si no %APPDATA%/elaborados-client/elaborados.db (ver db.ts).
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { runSeed, loginHandler } from '@core/main';
import * as schema from '../db/schema';
import { PERMISOS_ELABORADOS, OPERADOR_PERMISOS_ELABORADOS } from '../auth/seed';
import { runCatalogSeedElaborados, asegurarConsumidorFinal, runBaseRubroHeladeria } from '../catalog/seed';
import { runDemoHeladeriaSeed } from '../catalog/demo-heladeria';
import { seedClientesDemo } from './clientes';
import { seedVentasDemo } from './ventas';
import { openDevDb, checkpointDevDb, closeDevDb } from './db';

type Db = BetterSQLite3Database<typeof schema>;

export type PasoSeed = { paso: string; estado: 'hecho' | 'ya sembrado'; detalle?: string };
export type ResumenSeed = { pasos: PasoSeed[] };

export function ejecutarSeedDev(db: Db, opts: { soloBase?: boolean } = {}): ResumenSeed {
  const pasos: PasoSeed[] = [];
  const log = (p: PasoSeed) => {
    pasos.push(p);
    console.log(`[seed] ${p.paso}: ${p.estado}${p.detalle ? ` (${p.detalle})` : ''}`);
  };

  // Base (cada uno idempotente por sí mismo).
  runSeed(db, { permisos: PERMISOS_ELABORADOS, operador: OPERADOR_PERMISOS_ELABORADOS });
  log({ paso: 'auth (roles, permisos, admin)', estado: 'hecho' });
  runCatalogSeedElaborados(db);
  log({ paso: 'impuestos', estado: 'hecho' });
  asegurarConsumidorFinal(db);
  log({ paso: 'consumidor final', estado: 'hecho' });
  runBaseRubroHeladeria(db);
  log({ paso: 'rubro (categorías de venta y grupo Sabores)', estado: 'hecho' });

  if (opts.soloBase) return { pasos };

  // Los handlers del demo y de venta exigen sesión.
  loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' }); // NOSONAR — credenciales del seed de auth

  const habiaProductos = db.select({ id: schema.producto_venta.id }).from(schema.producto_venta).limit(1).get();
  if (habiaProductos) {
    log({ paso: 'catálogo demo', estado: 'ya sembrado' });
  } else {
    runDemoHeladeriaSeed(db);
    const n = db.select({ id: schema.producto_venta.id }).from(schema.producto_venta).all().length;
    log({ paso: 'catálogo demo', estado: 'hecho', detalle: `${n} productos de venta` });
  }

  const { creados } = seedClientesDemo(db);
  log(creados > 0
    ? { paso: 'clientes demo', estado: 'hecho', detalle: `${creados} clientes` }
    : { paso: 'clientes demo', estado: 'ya sembrado' });

  const { creadas } = seedVentasDemo(db);
  if (creadas > 0) {
    const caja = db.select().from(schema.caja).where(eq(schema.caja.estado, 'abierta')).get();
    log({ paso: 'ventas demo', estado: 'hecho', detalle: `${creadas} ventas, caja ${caja?.id ?? '?'} abierta` });
  } else {
    log({ paso: 'ventas demo', estado: 'ya sembrado' });
  }

  return { pasos };
}

function main(): void {
  const soloBase = process.argv.includes('--base');
  const nombre = soloBase ? 'seed:base' : 'seed:dev';
  console.log(`[${nombre}] iniciando...`);
  const db = openDevDb();
  try {
    const { pasos } = ejecutarSeedDev(db, { soloBase });
    checkpointDevDb();
    const hechos = pasos.filter((p) => p.estado === 'hecho').length;
    console.log(`[${nombre}] listo: ${hechos} pasos hechos, ${pasos.length - hechos} ya sembrados.`);
  } finally {
    closeDevDb();
  }
}

// Solo como entrypoint (tsx/CJS); importarlo desde los tests no abre ninguna BD.
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
