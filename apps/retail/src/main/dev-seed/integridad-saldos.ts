// Test de integridad de saldos sobre una base real (ADR-151 §6). Abre la base EN SOLO LECTURA, no
// migra ni escribe nada, y lista los productos y las cuentas corrientes cuyo saldo guardado no
// coincide con la proyección de su libro. Uso: `pnpm integridad:saldos <ruta a una COPIA de la base>`.
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { diferenciasDeCuentaCorriente } from '@core/main';
import * as schema from '../db/schema';
import { diferenciasDeStock } from '../catalog/stock-proyeccion';

const ruta = process.argv[2];
if (!ruta || !fs.existsSync(ruta)) {
  console.error('Uso: pnpm integridad:saldos <ruta a una copia de ferreteria.db>');
  process.exit(2);
}

const sqlite = new Database(ruta, { readonly: true, fileMustExist: true });
const db = drizzle(sqlite, { schema });
const stock = diferenciasDeStock(db);
const ctacte = diferenciasDeCuentaCorriente(db);
const productos = sqlite.prepare('select count(*) as n from existencias').get() as { n: number };
const cuentas = sqlite.prepare('select count(*) as n from cuenta_corriente_cliente').get() as { n: number };
sqlite.close();

console.log(`[integridad] base: ${ruta}`);
console.log(`[integridad] stock: ${productos.n} productos, ${stock.length} con diferencia`);
for (const d of stock) console.log(`  producto ${d.producto_id}: guardado ${d.guardado}, proyectado ${d.proyectado}`);
console.log(`[integridad] cuenta corriente: ${cuentas.n} cuentas, ${ctacte.length} con diferencia`);
for (const d of ctacte) console.log(`  cuenta ${d.cuenta_id}: guardado ${d.guardado}, proyectado ${d.proyectado} (centavos)`);
process.exit(stock.length + ctacte.length === 0 ? 0 : 1);
