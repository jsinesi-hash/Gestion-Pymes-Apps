/**
 * Migración de datos ADR-034: lista_precio → lista_precio_valor
 *
 * 1. Crea "Lista General" (tipo='general', ajuste_porcentual=0) si no existe.
 *    Mayorista conserva predeterminada=true sin cambios.
 * 2. Siembra lista_precio_valor para todos los productos × todas las listas activas.
 *    Por cada (lista, producto): usa override de lista_precio_detalle si existe,
 *    si no, aplica el ajuste_porcentual general de la lista.
 * 3. Imprime tabla de verificación comparando el cálculo antiguo (renderer)
 *    con el nuevo valor absoluto almacenado.
 * 4. NO dropea lista_precio_detalle — esperar confirmación del gate.
 */
import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { openDevDb, checkpointDevDb } from './db';
import * as schema from '../db/schema';

async function main() {
  const db = openDevDb();

  // --- Admin user para campos de auditoría ---
  const [adminUser] = db.select({ id: schema.usuario.id })
    .from(schema.usuario)
    .where(eq(schema.usuario.activo, true))
    .limit(1)
    .all();
  if (!adminUser) throw new Error('No hay usuarios activos en la base');

  const now = new Date();
  const ORIGIN_ID = 'C1';

  // --- 1. Crear "Lista General" si no existe ---
  const [existingGeneral] = db.select({ id: schema.lista_precio.id })
    .from(schema.lista_precio)
    .where(eq(schema.lista_precio.tipo, 'general'))
    .limit(1)
    .all();

  let listaGeneralId: string;

  if (!existingGeneral) {
    listaGeneralId = randomUUID();
    db.insert(schema.lista_precio).values({
      id:                  listaGeneralId,
      nombre:              'Lista General',
      descripcion:         'Precio de lista base (IVA incluido). No modificar su predeterminada.',
      tipo:                'general',
      ajuste_porcentual:   0,
      predeterminada:      false,
      activo:              true,
      usuario_creacion_id: adminUser.id,
      fecha_creacion:      now,
      version:             1,
      origin_id:           ORIGIN_ID,
      sync_state:          'pending',
      updated_at:          now,
    }).run();
    console.log(`[precios-v2] ✓ "Lista General" creada: ${listaGeneralId}`);
  } else {
    listaGeneralId = existingGeneral.id;
    console.log(`[precios-v2] "Lista General" ya existe: ${listaGeneralId}`);
  }

  // --- 2. Leer listas, productos y overrides via Drizzle ---
  const listas = db.select({
    id:                schema.lista_precio.id,
    nombre:            schema.lista_precio.nombre,
    ajuste_porcentual: schema.lista_precio.ajuste_porcentual,
  }).from(schema.lista_precio).where(eq(schema.lista_precio.activo, true)).all();

  const productos = db.select({
    id:                  schema.producto.id,
    nombre_corto:        schema.producto.nombre_corto,
    precio_venta_lista:  schema.producto.precio_venta_lista,
  }).from(schema.producto).where(eq(schema.producto.activo, true)).all();

  const overrides = db.select({
    lista_precio_id:   schema.lista_precio_detalle.lista_precio_id,
    producto_id:       schema.lista_precio_detalle.producto_id,
    ajuste_porcentual: schema.lista_precio_detalle.ajuste_porcentual,
  }).from(schema.lista_precio_detalle).all();

  const overrideMap = new Map(
    overrides.map(o => [`${o.lista_precio_id}:${o.producto_id}`, o.ajuste_porcentual]),
  );

  console.log(`[precios-v2] ${listas.length} listas · ${productos.length} productos · ${overrides.length} overrides`);

  // --- 3. Limpiar registros vigentes previos (idempotente) ---
  const vigentes = db.select({ id: schema.lista_precio_valor.id })
    .from(schema.lista_precio_valor)
    .where(isNull(schema.lista_precio_valor.fecha_hasta))
    .all().length;

  if (vigentes > 0) {
    console.log(`[precios-v2] Eliminando ${vigentes} registros vigentes previos (re-seed)...`);
    db.delete(schema.lista_precio_valor)
      .where(isNull(schema.lista_precio_valor.fecha_hasta))
      .run();
  }

  // --- 4. Calcular filas a insertar ---
  type LpvInsert = typeof schema.lista_precio_valor.$inferInsert;
  const rows: LpvInsert[] = [];
  const verification: Array<{
    lista: string;
    producto: string;
    pct: string;
    precio_pesos: number;
    lpv_centavos: number;
  }> = [];

  for (const lista of listas) {
    for (const prod of productos) {
      const key = `${lista.id}:${prod.id}`;
      const hasOverride = overrideMap.has(key);
      const pct = hasOverride ? overrideMap.get(key)! : lista.ajuste_porcentual;

      // Fórmula idéntica a resolverPrecio / addLinea del renderer:
      // Math.round(baseCs * (1 + pct / 100))
      const baseCs    = Math.round(prod.precio_venta_lista * 100);
      const precioCs  = Math.round(baseCs * (1 + pct / 100));

      rows.push({
        id:                  randomUUID(),
        lista_precio_id:     lista.id,
        producto_id:         prod.id,
        precio_centavos:     precioCs,
        fecha_desde:         now,
        fecha_hasta:         null,
        origen:              'manual',
        recalculo_masivo_id: null,
        usuario_id:          adminUser.id,
        version:             1,
        origin_id:           ORIGIN_ID,
        sync_state:          'pending',
        updated_at:          now,
      });

      verification.push({
        lista:         lista.nombre,
        producto:      prod.nombre_corto,
        pct:           hasOverride ? `${pct}% (override)` : `${pct}% (gral)`,
        precio_pesos:  prod.precio_venta_lista,
        lpv_centavos:  precioCs,
      });
    }
  }

  // --- 5. Insertar en lotes de 100 ---
  for (let i = 0; i < rows.length; i += 100) {
    db.insert(schema.lista_precio_valor).values(rows.slice(i, i + 100)).run();
  }
  console.log(`[precios-v2] ✓ ${rows.length} registros insertados en lista_precio_valor`);

  // --- 6. Verificación: muestra representativa ---
  const mayoristaSample = verification.filter(r => r.lista === 'Mayorista').slice(0, 5);
  const generalSample   = verification.filter(r => r.lista === 'Lista General').slice(0, 5);
  const overrideSample  = verification.filter(r => r.pct.includes('override'));

  console.log('\n=== VERIFICACIÓN — muestra Mayorista ===');
  console.table(mayoristaSample);

  if (overrideSample.length > 0) {
    console.log('\n=== OVERRIDES (lista_precio_detalle migrados) ===');
    console.table(overrideSample);
  }

  console.log('\n=== VERIFICACIÓN — muestra Lista General ===');
  console.table(generalSample);

  // --- 7. Conteo final ---
  const total = db.select({ id: schema.lista_precio_valor.id })
    .from(schema.lista_precio_valor)
    .where(isNull(schema.lista_precio_valor.fecha_hasta))
    .all().length;
  console.log(`\n✓ Total registros vigentes en lista_precio_valor: ${total}`);
  console.log('  lista_precio_detalle conservada — confirmar el DROP después de verificar.');

  checkpointDevDb();
}

main().catch(err => { console.error(err); process.exit(1); });
