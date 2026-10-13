import { eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  getSession, confirmarVenta, anularVenta, ventaListByCajaHandler, requirePermission,
  str, optStr, num, centavos, oneOf, arr, id as vId,
  type VentaPagoPayload, type AplicarLineasCtx,
} from '@core/main';
import type { IpcMain } from 'electron';
import { generateId, nombreCompletoCliente } from '@ferreteria/shared';
import * as schema from '../db/schema';
import {
  valorizarCarrito, type Carrito, type ProductoCatalogo, type OpcionCatalogo, type VentaValorizada,
} from '../domain/venta';
import { validarStock, type ConsumoLinea } from '../domain/consumo';

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Absorbe el error de punto flotante acumulado en el stock (0.3 − 0.1 − 0.2 ≠ 0). `+ 0` normaliza -0. */
const redondear6 = (n: number) => Math.round(n * 1e6) / 1e6 + 0;

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
        cantidad: num(li['cantidad'], `lineas.${i}.cantidad`, { min: 0, max: 100000 }),
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

// ── venta:confirmar ──────────────────────────────────────────────────────────

function aplicarLineasElaborados(tx: Tx, v: VentaValorizada, ctx: AplicarLineasCtx): void {
  for (const l of v.lineas) {
    const lineaId = generateId();
    tx.insert(schema.venta_linea).values({
      id: lineaId, venta_id: ctx.ventaId, producto_venta_id: l.producto_venta_id,
      descripcion: l.descripcion, cantidad: l.cantidad,
      precio_unitario_centavos: l.precio_unitario_centavos, descuento_linea_pct: l.descuento_linea_pct,
      alicuota_iva: l.alicuota_iva, subtotal_centavos: l.subtotal_centavos, ...ctx.sync,
    }).run();
    for (const o of l.opciones) {
      tx.insert(schema.venta_linea_modificador).values({
        id: generateId(), venta_linea_id: lineaId, grupo_modificador_opcion_id: o.opcion_id,
        articulo_id: o.articulo_id, descripcion: o.nombre, recargo_centavos: o.recargo_centavos,
        cantidad_consumida: o.cantidad_consumida, ...ctx.sync,
      }).run();
    }
  }

  for (const c of v.consumo_total) {
    const art = tx.select().from(schema.articulo).where(eq(schema.articulo.id, c.articulo_id)).get()!;
    const ex = tx.select().from(schema.existencia_articulo)
      .where(eq(schema.existencia_articulo.articulo_id, c.articulo_id)).get()!;
    const stock_resultante = redondear6(ex.stock - c.cantidad);
    tx.insert(schema.movimiento_articulo).values({
      id: generateId(), articulo_id: c.articulo_id, tipo: 'salida', motivo: 'venta',
      cantidad: -c.cantidad, stock_resultante, costo_unitario_centavos: art.costo_promedio_centavos,
      referencia_tipo: 'venta', referencia_id: ctx.ventaId, usuario_id: ctx.userId,
      fecha: ctx.now, observaciones: null, ...ctx.sync,
    }).run();
    tx.update(schema.existencia_articulo).set({
      stock: stock_resultante, ultima_fecha_movimiento: ctx.now,
      version: ex.version + 1, sync_state: 'pending', updated_at: ctx.now,
    }).where(eq(schema.existencia_articulo.articulo_id, c.articulo_id)).run();
  }
}

function lineasConModificadores(db: Db, ventaId: string) {
  const lineas = db.select().from(schema.venta_linea).where(eq(schema.venta_linea.venta_id, ventaId)).all();
  const mods = lineas.length === 0 ? [] : db.select().from(schema.venta_linea_modificador)
    .where(inArray(schema.venta_linea_modificador.venta_linea_id, lineas.map((l) => l.id))).all();
  return lineas.map((l) => ({ ...l, modificadores: mods.filter((m) => m.venta_linea_id === l.id) }));
}

export function ventaConfirmarHandler(db: Db, rawPayload: unknown) {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  // SEC-2: forma y tipo en el borde, antes de la lógica de negocio.
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  const carrito = parseCarrito(p);
  const caja_id = vId(p['caja_id'], 'caja_id');
  const cliente_id = vId(p['cliente_id'], 'cliente_id');
  const pagos = parsePagos(p['pagos']);
  const supervisor = parseSupervisor(p['supervisor_credenciales']);

  const { productos, opciones } = cargarCatalogo(db, carrito.lineas.map((l) => l.producto_venta_id));
  const v = valorizarCarrito(productos, opciones, carrito);

  let advertencias: AvisoStock[] = [];
  const { venta, comprobante } = confirmarVenta(db, {
    caja_id, cliente_id,
    // Único punto de conversión centavos → pesos hacia `venta` (columnas legado REAL).
    subtotal: v.subtotal_centavos / 100,
    // Convención de la columna legado `venta.descuento_global` (igual que Retail): PORCENTAJE, no importe.
    descuento_global: carrito.descuento_global_pct,
    importe_iva: v.importe_iva_centavos / 100,
    total: v.total_centavos / 100,
    ajuste_redondeo: v.ajuste_redondeo_centavos / 100,
    pagos,
    ...(supervisor && { supervisor_credenciales: supervisor }),
  }, {
    validarPrevio: () => {
      const ev = evaluarStock(db, v.consumo_total);
      if (ev.bloqueos.length > 0) throw new Error(`STOCK_INSUFICIENTE:${ev.bloqueos[0].nombre}`);
      advertencias = ev.advertencias;
    },
    aplicarLineas: (tx, ctx) => aplicarLineasElaborados(tx as unknown as Tx, v, ctx),
  });

  return { venta, lineas: lineasConModificadores(db, venta.id), comprobante, advertencias };
}

// ── venta:anular ─────────────────────────────────────────────────────────────

export function ventaAnularHandler(db: Db, rawPayload: unknown) {
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  const supervisor = parseSupervisor(p['supervisor_credenciales']);
  if (!supervisor) throw new Error('supervisor_credenciales:REQUERIDO');
  const rawMotivo = p['motivo'];
  if (rawMotivo != null && typeof rawMotivo !== 'string') throw new Error('motivo:TIPO');
  if (typeof rawMotivo === 'string' && rawMotivo.length > 500) throw new Error('motivo:MAX:500');
  const motivo = rawMotivo ?? '';
  const input = {
    venta_id: vId(p['venta_id'], 'venta_id'),
    motivo,
    supervisor_credenciales: supervisor,
  };

  return anularVenta(db, input, {
    // No recalcula: invierte los movimientos de artículo que originó esta venta.
    revertirLineas: (rawTx, ctx) => {
      const tx = rawTx as unknown as Tx;
      const originales = tx.select().from(schema.movimiento_articulo)
        .where(eq(schema.movimiento_articulo.referencia_id, ctx.venta.id)).all()
        .filter((m) => m.referencia_tipo === 'venta' && m.motivo === 'venta');
      for (const m of originales) {
        const ex = tx.select().from(schema.existencia_articulo)
          .where(eq(schema.existencia_articulo.articulo_id, m.articulo_id)).get()!;
        const stock_resultante = redondear6(ex.stock - m.cantidad); // m.cantidad es negativa → suma
        tx.insert(schema.movimiento_articulo).values({
          id: generateId(), articulo_id: m.articulo_id, tipo: 'entrada', motivo: 'anulacion_venta',
          cantidad: -m.cantidad, stock_resultante, costo_unitario_centavos: m.costo_unitario_centavos,
          referencia_tipo: 'anulacion_venta', referencia_id: ctx.venta.id, usuario_id: ctx.userId,
          fecha: ctx.now, observaciones: ctx.motivo, ...ctx.sync,
        }).run();
        tx.update(schema.existencia_articulo).set({
          stock: stock_resultante, ultima_fecha_movimiento: ctx.now,
          version: ex.version + 1, sync_state: 'pending', updated_at: ctx.now,
        }).where(eq(schema.existencia_articulo.articulo_id, m.articulo_id)).run();
      }
    },
  });
}

// ── venta:get ────────────────────────────────────────────────────────────────

export function ventaGetHandler(db: Db, payload: { id: string }) {
  requireSession();
  const id = vId((payload as Record<string, unknown> | null)?.['id'], 'id');
  const venta = db.select().from(schema.venta).where(eq(schema.venta.id, id)).get();
  if (!venta) return null;
  const comprobante = venta.comprobante_id
    ? db.select().from(schema.comprobante).where(eq(schema.comprobante.id, venta.comprobante_id)).get() ?? null
    : null;
  const c = db.select({ nombre: schema.cliente.nombre, apellido: schema.cliente.apellido })
    .from(schema.cliente).where(eq(schema.cliente.id, venta.cliente_id)).get();
  return {
    venta, lineas: lineasConModificadores(db, venta.id), comprobante,
    cliente: c ? { nombre_completo: nombreCompletoCliente(c) } : null,
  };
}

// ── Registro IPC ─────────────────────────────────────────────────────────────

export function registerVentaHandlers(ipcMain: IpcMain, db: Db): void {
  const guardCrear = requirePermission('venta.crear');
  ipcMain.handle('venta:cotizar',   guardCrear(async (_e, p) => ventaCotizarHandler(db, p)));
  ipcMain.handle('venta:confirmar', async (_e, p) => ventaConfirmarHandler(db, p)); // permiso verificado adentro
  ipcMain.handle('venta:anular',    async (_e, p) => ventaAnularHandler(db, p));    // permiso + supervisor en el core
  ipcMain.handle('venta:get',       async (_e, p) => ventaGetHandler(db, p));
  ipcMain.handle('venta:listByCaja', async (_e, p) => ventaListByCajaHandler(db, p));
}
