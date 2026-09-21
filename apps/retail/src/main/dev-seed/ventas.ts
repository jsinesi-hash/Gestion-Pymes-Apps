import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { formatSku } from '@ferreteria/shared';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

const SYNC = { version: 1, origin_id: 'system', sync_state: 'synced' as const };

function buildFechas() {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const apertura = new Date(ayer); apertura.setHours(8, 0, 0, 0);
  const cierre   = new Date(ayer); cierre.setHours(18, 0, 0, 0);
  const ventas   = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(ayer);
    d.setHours(8 + Math.floor(i * 0.6), (i * 36) % 60, 0, 0);
    return d;
  });
  return { apertura, cierre, ventas };
}

function calcIva(totalConIva: number): number {
  return Math.round((totalConIva * 21 / 121) * 100) / 100;
}

export function wipeVentas(db: Db): void {
  db.delete(schema.movimiento_caja).run();
  db.delete(schema.venta_pago).run();
  db.delete(schema.venta_detalle).run();
  db.delete(schema.venta).run();
  db.delete(schema.caja).run();
  db.update(schema.parametros_sistema)
    .set({ valor: '0' })
    .where(eq(schema.parametros_sistema.clave, 'venta_correlativo_C1'))
    .run();
}

type LineaDef = { sku: string; cantidad: number };
type VentaDef = {
  numero: string;
  cliente_doc: string;
  forma_pago: 'efectivo' | 'tarjeta' | 'cuenta_corriente' | 'transferencia';
  estado: 'confirmada' | 'anulada';
  desc_global: number;
  lineas: LineaDef[];
};
type ProdMap = Record<string, { id: string; sku: string; precio: number; nombre: string }>;

function procesarVenta(
  db: Db,
  v: VentaDef,
  fecha: Date,
  cajaId: string,
  adminId: string,
  prod: ProdMap,
  cli: Record<string, string>,
  CF: string,
): void {
  const ventaId = randomUUID();
  const audit = { usuario_creacion_id: adminId, fecha_creacion: fecha };
  const clienteId = v.cliente_doc === 'CF' ? CF : cli[v.cliente_doc];
  if (!clienteId) throw new Error(`Cliente no encontrado: ${v.cliente_doc}`);

  let subtotal = 0;
  for (const l of v.lineas) {
    const p = prod[l.sku];
    if (!p) throw new Error(`Producto no encontrado: ${l.sku}`);
    subtotal += p.precio * l.cantidad;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const descuentoAplicado = v.desc_global > 0 ? Math.round(subtotal * v.desc_global / 100 * 100) / 100 : 0;
  const baseConDesc = subtotal - descuentoAplicado;
  const importe_iva = calcIva(baseConDesc);
  const total = Math.round(baseConDesc);
  const ajuste_redondeo = Math.round((total - baseConDesc) * 100) / 100;

  db.insert(schema.venta).values({
    id: ventaId, numero_interno: v.numero, fecha,
    cliente_id: clienteId, usuario_id: adminId, caja_id: cajaId,
    subtotal, descuento_global: v.desc_global, importe_iva, total, ajuste_redondeo,
    forma_pago: v.forma_pago, estado: v.estado,
    ...audit, ...SYNC, updated_at: fecha,
  }).run();

  for (const l of v.lineas) {
    const p = prod[l.sku];
    db.insert(schema.venta_detalle).values({
      id: randomUUID(), venta_id: ventaId, producto_id: p.id,
      descripcion: p.nombre, cantidad: l.cantidad, precio_unitario: p.precio,
      descuento_linea: 0, alicuota_iva: 21,
      subtotal: Math.round(p.precio * l.cantidad * 100) / 100,
      ...SYNC, updated_at: fecha,
    }).run();
  }

  const generaMovCaja = v.estado === 'confirmada' &&
    (v.forma_pago === 'efectivo' || v.forma_pago === 'tarjeta' || v.forma_pago === 'transferencia');
  if (generaMovCaja) {
    db.insert(schema.movimiento_caja).values({
      id: randomUUID(), caja_id: cajaId, tipo: 'ingreso', motivo: 'venta',
      monto: total, forma_pago: v.forma_pago,
      referencia_tipo: 'venta', referencia_id: ventaId,
      usuario_id: adminId, fecha, ...SYNC, updated_at: fecha,
    }).run();
  }
}

const VENTAS: VentaDef[] = [
  // Confirmadas - efectivo (6)
  { numero:'V-C1-000001', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(1),  cantidad:1 }] },
  { numero:'V-C1-000002', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(2),  cantidad:2 }] },
  { numero:'V-C1-000003', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(3),  cantidad:1 }] },
  { numero:'V-C1-000004', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(21), cantidad:1 }] },
  { numero:'V-C1-000005', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'confirmada', desc_global:10, lineas:[{ sku:formatSku(8),  cantidad:1 }] },
  { numero:'V-C1-000006', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(7),  cantidad:1 }, { sku:formatSku(25), cantidad:2 }, { sku:formatSku(28), cantidad:5 }] },
  // Confirmadas - tarjeta (3)
  { numero:'V-C1-000007', cliente_doc:'28456789',    forma_pago:'tarjeta',          estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(9),  cantidad:1 }] },
  { numero:'V-C1-000008', cliente_doc:'35678123',    forma_pago:'tarjeta',          estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(31), cantidad:3 }] },
  { numero:'V-C1-000009', cliente_doc:'41234567',    forma_pago:'tarjeta',          estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(22), cantidad:2 }] },
  // Confirmadas - cuenta corriente (2)
  { numero:'V-C1-000010', cliente_doc:'30123456789', forma_pago:'cuenta_corriente', estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(4),  cantidad:1 }] },
  { numero:'V-C1-000011', cliente_doc:'20198765432', forma_pago:'cuenta_corriente', estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(33), cantidad:3 }] },
  // Confirmada - transferencia (1)
  { numero:'V-C1-000012', cliente_doc:'20301234561', forma_pago:'transferencia',    estado:'confirmada', desc_global:0,  lineas:[{ sku:formatSku(35), cantidad:2 }] },
  // Anuladas - efectivo (2)
  { numero:'V-C1-000013', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'anulada',    desc_global:0,  lineas:[{ sku:formatSku(1),  cantidad:1 }] },
  { numero:'V-C1-000014', cliente_doc:'CF',          forma_pago:'efectivo',         estado:'anulada',    desc_global:0,  lineas:[{ sku:formatSku(7),  cantidad:1 }] },
  // Anulada - cuenta corriente (1)
  { numero:'V-C1-000015', cliente_doc:'30123456789', forma_pago:'cuenta_corriente', estado:'anulada',    desc_global:0,  lineas:[{ sku:formatSku(8),  cantidad:1 }] },
];

export function seedVentas(db: Db, force: boolean): void {
  const existing = db.select({ id: schema.venta.id }).from(schema.venta).all();
  if (existing.length > 0 && !force) {
    console.log('[skip] ventas ya tiene datos');
    return;
  }
  if (force) wipeVentas(db);

  const { apertura, cierre, ventas: fechasVentas } = buildFechas();

  const admin = db.select({ id: schema.usuario.id }).from(schema.usuario)
    .where(eq(schema.usuario.nombre_usuario, 'admin')).get();
  if (!admin) throw new Error('Usuario admin no encontrado');

  const todos = db.select({
    id: schema.producto.id,
    sku: schema.producto.sku,
    precio: schema.producto.precio_venta_lista,
    nombre: schema.producto.nombre_corto,
  }).from(schema.producto).all();
  const prod = Object.fromEntries(todos.map(p => [p.sku, p]));

  const clientes = db.select({ id: schema.cliente.id, doc: schema.cliente.numero_documento })
    .from(schema.cliente).all();
  const cli = Object.fromEntries(clientes.map(c => [c.doc, c.id]));
  const CF = 'cf000000-0000-0000-0000-000000000001';

  const cajaId = randomUUID();
  db.insert(schema.caja).values({
    id: cajaId,
    usuario_id: admin.id,
    fecha_apertura: apertura,
    fecha_cierre: cierre,
    monto_inicial: 5000,
    monto_esperado: 85000,
    monto_contado: 84800,
    diferencia: -200,
    estado: 'cerrada',
    usuario_cierre_id: admin.id,
    ...SYNC, updated_at: cierre,
  }).run();

  for (let i = 0; i < VENTAS.length; i++) {
    procesarVenta(db, VENTAS[i], fechasVentas[i], cajaId, admin.id, prod, cli, CF);
  }

  // Update correlativo so app starts from V-C1-000016
  db.update(schema.parametros_sistema)
    .set({ valor: '15', actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, 'venta_correlativo_C1'))
    .run();

  console.log('[ok] ventas: 1 caja cerrada, 15 ventas, 10 movimientos de caja');
}
