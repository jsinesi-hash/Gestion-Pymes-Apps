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

export type VentaFixture = {
  ventaId: string;
  clienteId: string;
  cajaId: string;
  categoriaId: string;
  detalleIds: string[];
  productoIds: string[];
};

/**
 * Crea una venta confirmada con N lineas por insercion directa (sin pasar por el POS,
 * para no acoplar los tests de remito a ese modulo).
 * `cantidades` lleva una entrada por linea, en unidades de presentacion (ADR-040).
 */
export function crearVentaConfirmada(
  db: Db,
  usuarioId: string,
  cantidades: number[] = [10],
  opts: { permiteFraccion?: boolean } = {},
): VentaFixture {
  const now = new Date();
  const n = ++contador;

  const categoriaId = generateId();
  db.insert(schema.categoria).values({
    id: categoriaId,
    nombre: `Categoria Remito ${n}`,
    activo: true,
    usuario_creacion_id: usuarioId,
    fecha_creacion: now,
    ...sync(now),
  }).run();

  const clienteId = generateId();
  db.insert(schema.cliente).values({
    id: clienteId,
    tipo_documento: 'DNI',
    numero_documento: `3011122${n}`,
    nombre: 'Cliente',
    apellido: 'Remito Test',
    condicion_fiscal: 'Consumidor Final',
    domicilio: 'Calle Falsa 123',
    habilita_cuenta_corriente: false,
    activo: true,
    usuario_creacion_id: usuarioId,
    fecha_creacion: now,
    ...sync(now),
  }).run();

  const cajaId = generateId();
  db.insert(schema.caja).values({
    id: cajaId,
    usuario_id: usuarioId,
    fecha_apertura: now,
    monto_inicial: 0,
    estado: 'abierta',
    ...sync(now),
  }).run();

  const ventaId = generateId();
  db.insert(schema.venta).values({
    id: ventaId,
    numero_interno: `V-TEST-${String(n).padStart(6, '0')}`,
    fecha: now,
    cliente_id: clienteId,
    usuario_id: usuarioId,
    caja_id: cajaId,
    subtotal: 1000,
    total: 1000,
    forma_pago: 'efectivo',
    estado: 'confirmada',
    usuario_creacion_id: usuarioId,
    fecha_creacion: now,
    ...sync(now),
  }).run();

  const detalleIds: string[] = [];
  const productoIds: string[] = [];

  cantidades.forEach((cantidad, i) => {
    const productoId = generateId();
    db.insert(schema.producto).values({
      id: productoId,
      sku: `P-TEST-${n}-${i}`,
      sku_secuencial: n * 100 + i,
      nombre_corto: `Producto ${i}`,
      nombre_largo: `Producto de prueba ${i}`,
      unidad_venta: 'u',
      unidad_compra: 'u',
      factor_conversion: 1,
      permite_fraccion: opts.permiteFraccion ?? false,
      precio_costo_promedio: 50,
      precio_venta_lista: 100,
      moneda: 'ARS',
      categoria_id: categoriaId,
      activo: true,
      usuario_creacion_id: usuarioId,
      fecha_creacion: now,
      ...sync(now),
    }).run();
    productoIds.push(productoId);

    const detalleId = generateId();
    db.insert(schema.venta_detalle).values({
      id: detalleId,
      venta_id: ventaId,
      producto_id: productoId,
      descripcion: `Producto ${i}`,
      cantidad,
      precio_unitario: 100,
      descuento_linea: 0,
      alicuota_iva: 21,
      subtotal: cantidad * 100,
      ...sync(now),
    }).run();
    detalleIds.push(detalleId);
  });

  return { ventaId, clienteId, cajaId, categoriaId, detalleIds, productoIds };
}
