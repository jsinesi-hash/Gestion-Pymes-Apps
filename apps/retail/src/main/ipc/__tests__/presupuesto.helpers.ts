import { generateId } from '@ferreteria/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

const sync = (now: Date) => ({
  version: 1 as const,
  origin_id: 'test-terminal',
  sync_state: 'pending' as const,
  updated_at: now,
});

let contador = 0;

/** Siembra una categoria + impuesto IVA 21 y devuelve sus ids (compartidos por productos). */
function base(db: Db, usuarioId: string) {
  const now = new Date();
  const n = ++contador;
  const categoriaId = generateId();
  db.insert(schema.categoria).values({
    id: categoriaId, nombre: `Cat Presup ${n}`, activo: true,
    usuario_creacion_id: usuarioId, fecha_creacion: now, ...sync(now),
  }).run();
  const impuestoId = generateId();
  db.insert(schema.impuesto).values({
    id: impuestoId, nombre: 'IVA 21', tipo: 'iva', alicuota: 21,
    predeterminado: true, activo: true,
    usuario_creacion_id: usuarioId, fecha_creacion: now, ...sync(now),
  }).run();
  return { categoriaId, impuestoId };
}

/**
 * Siembra un producto con precio de lista dado (en pesos). Sin lista predeterminada,
 * computarPresupuesto usa el fallback = precio_venta_lista * 100 (centavos).
 */
export function sembrarProducto(
  db: Db, usuarioId: string,
  opts: { precio?: number; nombre?: string; permiteFraccion?: boolean; ctx?: { categoriaId: string; impuestoId: string } } = {},
): string {
  const now = new Date();
  const n = ++contador;
  const ctx = opts.ctx ?? base(db, usuarioId);
  const productoId = generateId();
  db.insert(schema.producto).values({
    id: productoId,
    sku: `P-PRESUP-${n}`,
    sku_secuencial: 900000 + n,
    nombre_corto: opts.nombre ?? `Producto Presup ${n}`,
    nombre_largo: opts.nombre ?? `Producto de prueba ${n}`,
    unidad_venta: 'u', unidad_compra: 'u', factor_conversion: 1,
    permite_fraccion: opts.permiteFraccion ?? true,
    precio_costo_promedio: 50,
    precio_venta_lista: opts.precio ?? 100,
    impuesto_id: ctx.impuestoId,
    moneda: 'ARS',
    categoria_id: ctx.categoriaId,
    activo: true,
    usuario_creacion_id: usuarioId, fecha_creacion: now, ...sync(now),
  }).run();
  return productoId;
}

/**
 * Siembra una caja + venta confirmada minima y devuelve el ventaId. Solo para tests
 * que necesitan un venta.id real que satisfaga la FK presupuesto.venta_id.
 */
export function sembrarVenta(db: Db, usuarioId: string, clienteId: string): string {
  const now = new Date();
  const n = ++contador;
  const cajaId = generateId();
  db.insert(schema.caja).values({
    id: cajaId, usuario_id: usuarioId, fecha_apertura: now,
    monto_inicial: 0, estado: 'abierta', ...sync(now),
  }).run();
  const ventaId = generateId();
  db.insert(schema.venta).values({
    id: ventaId,
    numero_interno: `V-PRESUP-${String(n).padStart(6, '0')}`,
    fecha: now, cliente_id: clienteId, usuario_id: usuarioId, caja_id: cajaId,
    subtotal: 1000, total: 1000, forma_pago: 'efectivo', estado: 'confirmada',
    usuario_creacion_id: usuarioId, fecha_creacion: now, ...sync(now),
  }).run();
  return ventaId;
}

export function sembrarCliente(db: Db, usuarioId: string): string {
  const now = new Date();
  const n = ++contador;
  const clienteId = generateId();
  db.insert(schema.cliente).values({
    id: clienteId,
    tipo_documento: 'DNI',
    numero_documento: `4022233${n}`,
    nombre: 'Cliente',
    apellido: 'Presup Test',
    condicion_fiscal: 'Consumidor Final',
    habilita_cuenta_corriente: false,
    activo: true,
    usuario_creacion_id: usuarioId, fecha_creacion: now, ...sync(now),
  }).run();
  return clienteId;
}
