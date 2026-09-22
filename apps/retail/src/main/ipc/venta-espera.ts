import { eq, and } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, arr, num, id as vId } from '@core/main';
import type { LineaPayload } from './venta';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export type PausarPayload = {
  caja_id: string;
  cliente_id: string;
  lineas: LineaPayload[];
  descuento_global: number;
  subtotal: number;
  importe_iva: number;
  total: number;
  ajuste_redondeo: number;
  alias?: string | undefined;
};

export type VentaEsperaItem = {
  id: string;
  alias: string | null;
  en_espera_desde: Date | null;
  turno_creacion_id: string | null;
  cliente_id: string;
  total: number;
  count_items: number;
  vencida: boolean;
};

export type VentaEsperaLinea = {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precio_lista_actual_centavos: number;
  precio_unitario_guardado: number;
  descuento_linea_pct: number;
  alicuota_iva: number;
  permite_fraccion: boolean;
  stock_fisico: number;
};

export type VentaEsperaRetomarResult = {
  venta_id: string;
  alias: string | null;
  cliente_id: string;
  descuento_global: number;
  lineas: VentaEsperaLinea[];
  avisos: {
    stock_caido: Array<{ producto_id: string; nombre: string; stock_disponible: number }>;
    precio_cambiado: Array<{ producto_id: string; nombre: string; precio_viejo: number; precio_nuevo: number }>;
  };
};

export function ventaEsperaPausarHandler(db: Db, rawPayload: unknown): { venta_id: string } {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  // ADR-082 (SEC-2): valida la forma del payload antes de la lógica de negocio.
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  arr(p['lineas'], 'lineas', (l, i) => {
    const li = (l ?? {}) as Record<string, unknown>;
    return {
      producto_id: vId(li['producto_id'], `lineas.${i}.producto_id`),
      cantidad: num(li['cantidad'], `lineas.${i}.cantidad`, { min: 0 }),
    };
  });
  const payload = rawPayload as PausarPayload;

  const cajaRow = db.select().from(schema.caja)
    .where(and(eq(schema.caja.id, payload.caja_id), eq(schema.caja.estado, 'abierta')))
    .get();
  if (!cajaRow) throw new Error('CAJA_REQUERIDA');

  const maxParam = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'pos.ventas_en_espera.max'))
    .get();
  const max = maxParam ? Number.parseInt(maxParam.valor, 10) : 10;

  const enEsperaCount = db.select({ id: schema.venta.id }).from(schema.venta)
    .where(eq(schema.venta.estado, 'en_espera'))
    .all().length;
  if (enEsperaCount >= max) throw new Error('MAX_EN_ESPERA');

  const now = new Date();
  const ventaId = generateId();
  const terminal = getOriginId();
  const holdNum = `HOLD:${generateId().slice(0, 8)}`;
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };

  db.transaction((tx) => {
    tx.insert(schema.venta).values({
      id: ventaId,
      numero_interno: holdNum,
      fecha: now,
      cliente_id: payload.cliente_id,
      usuario_id: session.userId,
      caja_id: payload.caja_id,
      subtotal: payload.subtotal,
      descuento_global: payload.descuento_global,
      importe_iva: payload.importe_iva,
      total: payload.total,
      ajuste_redondeo: payload.ajuste_redondeo,
      forma_pago: 'efectivo',
      estado: 'en_espera',
      alias: payload.alias ?? null,
      en_espera_desde: now,
      turno_creacion_id: payload.caja_id,
      usuario_creacion_id: session.userId,
      fecha_creacion: now,
      ...sync,
    }).run();

    for (const linea of payload.lineas) {
      tx.insert(schema.venta_detalle).values({
        id: generateId(),
        venta_id: ventaId,
        producto_id: linea.producto_id,
        descripcion: linea.descripcion,
        cantidad: linea.cantidad,
        precio_unitario: linea.precio_unitario,
        descuento_linea: linea.descuento_linea,
        alicuota_iva: linea.alicuota_iva,
        subtotal: linea.subtotal,
        ...sync,
      }).run();
    }
  });

  return { venta_id: ventaId };
}

export function ventaEsperaListarHandler(db: Db): VentaEsperaItem[] {
  requireSession();

  const ttlParam = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'pos.ventas_en_espera.ttl_horas'))
    .get();
  const ttlHoras = ttlParam ? Number.parseInt(ttlParam.valor, 10) : 24;

  const ventas = db.select().from(schema.venta)
    .where(eq(schema.venta.estado, 'en_espera'))
    .all();

  const now = Date.now();

  return ventas.map(v => {
    const detalles = db.select({ id: schema.venta_detalle.id })
      .from(schema.venta_detalle)
      .where(eq(schema.venta_detalle.venta_id, v.id))
      .all();

    const fechaMs = v.en_espera_desde instanceof Date
      ? v.en_espera_desde.getTime()
      : typeof v.en_espera_desde === 'number'
        ? v.en_espera_desde
        : 0;
    const edadMs = fechaMs ? now - fechaMs : 0;
    const vencida = edadMs > ttlHoras * 60 * 60 * 1000;

    return {
      id: v.id,
      alias: v.alias ?? null,
      en_espera_desde: v.en_espera_desde instanceof Date
        ? v.en_espera_desde
        : v.en_espera_desde
          ? new Date(v.en_espera_desde as number)
          : null,
      turno_creacion_id: v.turno_creacion_id ?? null,
      cliente_id: v.cliente_id,
      total: v.total,
      count_items: detalles.length,
      vencida,
    };
  }).sort((a, b) => {
    const ta = a.en_espera_desde?.getTime() ?? 0;
    const tb = b.en_espera_desde?.getTime() ?? 0;
    return ta - tb;
  });
}

export function ventaEsperaRetomarHandler(db: Db, rawPayload: unknown): VentaEsperaRetomarResult {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  const p = (rawPayload ?? {}) as Record<string, unknown>;
  vId(p['venta_id'], 'venta_id');
  const payload = rawPayload as { venta_id: string };

  const ventaRow = db.select().from(schema.venta)
    .where(eq(schema.venta.id, payload.venta_id))
    .get();
  if (!ventaRow) throw new Error('VENTA_ESPERA_NOT_FOUND');
  if (ventaRow.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');

  const detalles = db.select().from(schema.venta_detalle)
    .where(eq(schema.venta_detalle.venta_id, payload.venta_id))
    .all();

  const avisos: VentaEsperaRetomarResult['avisos'] = { stock_caido: [], precio_cambiado: [] };
  const lineas: VentaEsperaLinea[] = [];

  for (const det of detalles) {
    const prod = db.select().from(schema.producto)
      .where(eq(schema.producto.id, det.producto_id)).get()!;
    const ex = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, det.producto_id)).get();

    const stockDisponible = ex?.stock_fisico ?? 0;
    if (stockDisponible < det.cantidad) {
      avisos.stock_caido.push({
        producto_id: det.producto_id,
        nombre: prod.nombre_corto,
        stock_disponible: stockDisponible,
      });
    }

    const precioActual = prod.precio_venta_lista;
    if (Math.abs(precioActual - det.precio_unitario) > 0.001) {
      avisos.precio_cambiado.push({
        producto_id: det.producto_id,
        nombre: prod.nombre_corto,
        precio_viejo: det.precio_unitario,
        precio_nuevo: precioActual,
      });
    }

    lineas.push({
      producto_id: det.producto_id,
      descripcion: det.descripcion,
      cantidad: det.cantidad,
      precio_lista_actual_centavos: Math.round(precioActual * 100),
      precio_unitario_guardado: det.precio_unitario,
      descuento_linea_pct: det.descuento_linea,
      alicuota_iva: det.alicuota_iva,
      permite_fraccion: prod.permite_fraccion ?? false,
      stock_fisico: stockDisponible,
    });
  }

  return {
    venta_id: payload.venta_id,
    alias: ventaRow.alias ?? null,
    cliente_id: ventaRow.cliente_id,
    descuento_global: ventaRow.descuento_global,
    lineas,
    avisos,
  };
}

export function ventaEsperaDescartarHandler(db: Db, rawPayload: unknown): { ok: boolean } {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  const p = (rawPayload ?? {}) as Record<string, unknown>;
  vId(p['venta_id'], 'venta_id');
  const payload = rawPayload as { venta_id: string };

  const ventaRow = db.select().from(schema.venta)
    .where(eq(schema.venta.id, payload.venta_id))
    .get();
  if (!ventaRow) throw new Error('VENTA_ESPERA_NOT_FOUND');
  if (ventaRow.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');

  const now = new Date();
  db.update(schema.venta).set({
    estado: 'descartada',
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
    version: ventaRow.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.venta.id, payload.venta_id)).run();

  return { ok: true };
}

export function registerVentaEsperaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('venta.espera:pausar',    async (_e, p) => ventaEsperaPausarHandler(db, p));
  ipcMain.handle('venta.espera:listar',    async ()      => ventaEsperaListarHandler(db));
  ipcMain.handle('venta.espera:retomar',   async (_e, p) => ventaEsperaRetomarHandler(db, p));
  ipcMain.handle('venta.espera:descartar', async (_e, p) => ventaEsperaDescartarHandler(db, p));
}
