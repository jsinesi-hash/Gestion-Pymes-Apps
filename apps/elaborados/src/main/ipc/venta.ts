import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  getSession,
  str, optStr, num, centavos, oneOf, arr, id as vId,
  type VentaPagoPayload,
} from '@core/main';
import * as schema from '../db/schema';
import {
  valorizarCarrito, type Carrito, type ProductoCatalogo, type OpcionCatalogo,
} from '../domain/venta';
import { validarStock, type ConsumoLinea } from '../domain/consumo';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

// ── Parseo de payload (SEC-2: forma y tipo en el borde) ──────────────────────

function parseCarrito(p: Record<string, unknown>): Carrito {
  return {
    lineas: arr(p['lineas'], 'lineas', (l, i) => {
      const li = (l ?? {}) as Record<string, unknown>;
      return {
        producto_venta_id: vId(li['producto_venta_id'], `lineas.${i}.producto_venta_id`),
        cantidad: num(li['cantidad'], `lineas.${i}.cantidad`, { min: 0 }),
        descuento_linea_pct: li['descuento_linea_pct'] == null
          ? 0 : num(li['descuento_linea_pct'], `lineas.${i}.descuento_linea_pct`, { min: 0, max: 100 }),
        modificadores: li['modificadores'] == null ? [] : arr(li['modificadores'], `lineas.${i}.modificadores`, (m, j) => {
          const mj = (m ?? {}) as Record<string, unknown>;
          return {
            grupo_modificador_id: vId(mj['grupo_modificador_id'], `lineas.${i}.modificadores.${j}.grupo_modificador_id`),
            opcion_ids: arr(mj['opcion_ids'], `lineas.${i}.modificadores.${j}.opcion_ids`,
              (o, k) => vId(o, `lineas.${i}.modificadores.${j}.opcion_ids.${k}`)),
          };
        }),
      };
    }),
    descuento_global_pct: p['descuento_global_pct'] == null
      ? 0 : num(p['descuento_global_pct'], 'descuento_global_pct', { min: 0, max: 100 }),
  };
}

const MEDIOS = ['efectivo', 'tarjeta', 'cuenta_corriente', 'transferencia', 'cheque'] as const;

function parsePagos(raw: unknown): VentaPagoPayload[] {
  return arr(raw, 'pagos', (pg, i) => {
    const pj = (pg ?? {}) as Record<string, unknown>;
    const f = `pagos.${i}`;
    return {
      medio_pago: oneOf(pj['medio_pago'], `${f}.medio_pago`, MEDIOS),
      monto_centavos: centavos(pj['monto_centavos'], `${f}.monto_centavos`),
      ...(pj['recargo_pct'] != null && { recargo_pct: num(pj['recargo_pct'], `${f}.recargo_pct`, { min: 0 }) }),
      ...(pj['recargo_centavos'] != null && { recargo_centavos: centavos(pj['recargo_centavos'], `${f}.recargo_centavos`) }),
      ...(optStr(pj['numero_cheque'], `${f}.numero_cheque`, 60) !== undefined && { numero_cheque: optStr(pj['numero_cheque'], `${f}.numero_cheque`, 60)! }),
      ...(optStr(pj['banco'], `${f}.banco`, 120) !== undefined && { banco: optStr(pj['banco'], `${f}.banco`, 120)! }),
      ...(optStr(pj['fecha_cheque'], `${f}.fecha_cheque`, 40) !== undefined && { fecha_cheque: optStr(pj['fecha_cheque'], `${f}.fecha_cheque`, 40)! }),
      ...(optStr(pj['titular_cheque'], `${f}.titular_cheque`, 120) !== undefined && { titular_cheque: optStr(pj['titular_cheque'], `${f}.titular_cheque`, 120)! }),
    };
  });
}

function parseSupervisor(raw: unknown): { nombre_usuario: string; password: string } | undefined {
  if (raw == null) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o['password'] !== 'string') throw new Error('supervisor_credenciales.password:TIPO');
  // La contraseña NO se recorta (str() haría trim): se pasa tal cual al core.
  return { nombre_usuario: str(o['nombre_usuario'], 'supervisor_credenciales.nombre_usuario'), password: o['password'] };
}

// ── Catálogo y stock ─────────────────────────────────────────────────────────

function cargarCatalogo(db: Db, productoIds: string[]) {
  const productos = new Map<string, ProductoCatalogo>();
  const opciones = new Map<string, OpcionCatalogo>();
  for (const pid of new Set(productoIds)) {
    const pv = db.select().from(schema.producto_venta).where(eq(schema.producto_venta.id, pid)).get();
    if (!pv || !pv.activo) continue; // valorizarCarrito lanza PRODUCTO_VENTA_NO_ENCONTRADO
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.id, pv.impuesto_id)).get()!;
    const componentes = db.select().from(schema.producto_venta_componente)
      .where(eq(schema.producto_venta_componente.producto_venta_id, pv.id)).all()
      .map((c) => ({ articulo_id: c.articulo_id, cantidad: c.cantidad }));
    const grupos = db.select().from(schema.producto_venta_grupo)
      .where(eq(schema.producto_venta_grupo.producto_venta_id, pv.id)).all()
      .map((g) => ({
        grupo_modificador_id: g.grupo_modificador_id, min: g.min, max: g.max,
        cantidad_total: g.cantidad_total, modo_descuento: g.modo_descuento,
      }));
    for (const g of grupos) {
      for (const o of db.select().from(schema.grupo_modificador_opcion)
        .where(eq(schema.grupo_modificador_opcion.grupo_modificador_id, g.grupo_modificador_id)).all()) {
        opciones.set(o.id, {
          id: o.id, grupo_modificador_id: o.grupo_modificador_id, articulo_id: o.articulo_id,
          nombre: o.nombre, recargo_centavos: o.recargo_centavos, cantidad: o.cantidad,
        });
      }
    }
    productos.set(pv.id, { id: pv.id, nombre: pv.nombre, precio_centavos: pv.precio_centavos, alicuota_iva: imp.alicuota, componentes, grupos });
  }
  return { productos, opciones };
}

export type AvisoStock = { articulo_id: string; nombre: string; stockResultante: number };

function evaluarStock(db: Db, consumos: readonly ConsumoLinea[]): { bloqueos: AvisoStock[]; advertencias: AvisoStock[] } {
  const stocks = new Map<string, { stock: number; bloquea_sin_stock: boolean }>();
  const nombres = new Map<string, string>();
  for (const c of consumos) {
    const art = db.select().from(schema.articulo).where(eq(schema.articulo.id, c.articulo_id)).get();
    const ex = db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, c.articulo_id)).get();
    nombres.set(c.articulo_id, art?.nombre ?? c.articulo_id);
    stocks.set(c.articulo_id, { stock: ex?.stock ?? 0, bloquea_sin_stock: art?.bloquea_sin_stock ?? true });
  }
  const bloqueos: AvisoStock[] = [];
  const advertencias: AvisoStock[] = [];
  for (const v of validarStock(consumos, stocks)) {
    const aviso = { articulo_id: v.articulo_id, nombre: nombres.get(v.articulo_id)!, stockResultante: v.stockResultante };
    if (v.bloquea) bloqueos.push(aviso);
    else if (v.stockResultante < 0) advertencias.push(aviso);
  }
  return { bloqueos, advertencias };
}

// ── venta:cotizar ────────────────────────────────────────────────────────────

export function ventaCotizarHandler(db: Db, rawPayload: unknown) {
  requireSession();
  const carrito = parseCarrito((rawPayload ?? {}) as Record<string, unknown>);
  const { productos, opciones } = cargarCatalogo(db, carrito.lineas.map((l) => l.producto_venta_id));
  const valorizada = valorizarCarrito(productos, opciones, carrito);
  return { ...valorizada, ...evaluarStock(db, valorizada.consumo_total) };
}
