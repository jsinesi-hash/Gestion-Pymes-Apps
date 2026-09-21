import { eq, sql } from 'drizzle-orm';
import { openDevDb } from './db';
import * as schema from '../db/schema';

const db = openDevDb();

// 1. What SQL does Drizzle generate?
const q = db.select({ id: schema.producto.id }).from(schema.producto).where(eq(schema.producto.activo, true));
console.log('SQL generado:', q.toSQL());

// 2. Drizzle raw sql count
const cnt = db.all(sql`SELECT COUNT(*) as c FROM producto`);
console.log('Drizzle raw sql count:', JSON.stringify(cnt));

// 3. Try without activo filter
const all = db.select({ id: schema.producto.id }).from(schema.producto).all();
console.log('Sin filtro activo:', all.length);

// 4. lista_precio count (should be 1)
const lp = db.select({ id: schema.lista_precio.id }).from(schema.lista_precio).all();
console.log('lista_precio count:', lp.length);
